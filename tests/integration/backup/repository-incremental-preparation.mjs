import {createBackupPresentation} from '../../helpers/backup-presentation.mjs';
import {RUNTIME_DATA_CONTRACT} from '../../../contracts/canonical-identities.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createProcessingEngine} from '../../helpers/file-processing.mjs';
import {testPendingReviewCodec,memoryPendingReviews,paragraphMerge} from '../../helpers/pending-review-codec.mjs';

for(const file of ['source/core/internal.js','source/core/operation-lifecycle.js','source/core/canonical.js','source/core/record-codecs.js','source/core/reconciliation.js','source/core/managed-repository.js','source/core/repository-policy.js','source/core/repository-background.js','source/core/backup-provider.js','source/core/backup-capture.js','source/core/backup.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const freeze=Object.freeze,CanonicalModule=registry.require('canonical',1),ManagedRepositoryModule=registry.require('managed-repository',1),RepositoryPolicyModule=registry.require('repository-policy',1),RepositoryBackgroundModule=registry.require('repository-background',1,Object.freeze({lifecycle:registry.require('operation-lifecycle',1)})),BackupProviderModule=registry.require('backup-provider',1,freeze({repositoryPolicy:RepositoryPolicyModule})),BackupCaptureModule=registry.require('backup-capture',1),BackupModule=registry.require('backup',1,freeze({backupCapture:BackupCaptureModule,backupProvider:BackupProviderModule,canonical:CanonicalModule,managedRepository:ManagedRepositoryModule,repositoryBackground:RepositoryBackgroundModule})),ReconciliationModule=registry.require('reconciliation',1,freeze({canonical:CanonicalModule}));
const processing=createProcessingEngine(),documentStub=freeze({getElementById:()=>null,addEventListener:()=>{},createElement:()=>({click(){},remove(){}}),createDocumentFragment:()=>({appendChild(){}}),body:freeze({appendChild(){}})}),noop=()=>{};
const countsShape=value=>freeze({dailyRecord:Number(value?.dailyRecord||0),note:Number(value?.note||0),activeSession:Number(value?.activeSession||0),personalData:Number(value?.personalData||0),checkpointManifest:Number(value?.checkpointManifest||0)});
let checkpointCounter=0;
const RecordCodecs=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('record-codecs',1);
const pendingReviewCodec=testPendingReviewCodec(RecordCodecs,{personalDataCodec:RecordCodecs.createPersonalDataCodec(Object.freeze({}))}),keptReviews=memoryPendingReviews(pendingReviewCodec);
const BackupCodec=freeze({
  countShape:countsShape,assetIds:()=>freeze([]),
  createCheckpointMetadata:(installationId,createdAt)=>freeze({checkpointId:'cp_'+(++checkpointCounter).toString(16).padStart(32,'0'),createdAt,originInstallationId:installationId}),
  createProtectedManifest:(plan,checkpoint)=>freeze({format:'study-director.checkpoint-protected-manifest',version:3,checkpointId:checkpoint.checkpointId,sourceRevision:new Date(plan.sourceRevision).toISOString(),authority:freeze({savedDays:'pairwise-explicit-deletions',notes:'pairwise-explicit-deletions',activeSession:'pairwise-singleton',plans:'pairwise-collection',personalSettings:'pairwise-singleton',attachments:'referenced-plus-library'}),savedDayDeletions:freeze([...(plan.savedDayDeletions||[])]),noteDeletions:freeze([...(plan.noteDeletions||[])]),attachmentDeletions:freeze([...(plan.attachmentDeletions||[])])}),
  utf8Bytes:value=>new TextEncoder().encode(String(value??'')),compressionSupported:()=>typeof CompressionStream==='function',checksumAlgorithm:()=> 'sha256',createManifest:()=>({}),encodeChunk:async()=>({line:'',checksum:''}),splitItems:items=>[items],encodeCompletion:async()=>({}),createV10Container:()=>new Blob(),inspect:async()=>({}),normalizeRecord:value=>value,normalizeNote:value=>value
});
const ActiveSessionCodec=freeze({sanitizeImportedActiveSession:value=>value,sanitizeCurrent:value=>value});
const exportsPort=freeze({followProtection:async()=>false,
  backgroundAvailable:()=>true,protect:async(file)=>freeze({...file,encrypted:false,protectionId:'',checkProtection:async()=>{}}),unprotect:async file=>freeze({blob:file,encrypted:false}),check:()=>{},scope:operation=>operation(),job:operation=>operation(),
  run:async(type,data,options)=>{if(type==='file.release')return true;return processing.run(type,data,options?.progress);},download:async()=>{},chooseSave:()=>{},save:async()=>({status:'saved'})
});
const token=value=>Number(value).toString(16).padStart(32,'0').slice(-32);
function isoDay(offset){const date=new Date(Date.UTC(2025,0,1+offset));return date.toISOString().slice(0,10);}
function monthOf(date){return String(date).slice(0,7);}

function createScenario(dayCount){
  let epochSerial=1,stampSerial=100,epochToken=token(epochSerial),sourceRevision='2026-09-22T05:00:00.000Z',stamps=new Map(),base=null,baseNotes=Object.create(null),failPersonalSettle=false,failPreparationIndexRead=false,sourceFenceRace=false,allowFullCaptureFlush=false,dailyRecordCanonical=true;
  let dailyRecords=Array.from({length:dayCount},(_,index)=>freeze({version:16,recordKind:'study',date:isoDay(index),reflection:`saved-${index}`,savedAt:'2026-09-22T04:00:00.000Z',updatedAt:'2026-09-22T04:00:00.000Z'}));
  let notes={Subject:freeze({version:2,key:'Subject',text:'stable note',updatedAt:'2026-09-22T04:00:00.000Z'})};
  let personalData=freeze({version:2,plans:freeze({draft:null,savedPlans:freeze([]),defaultId:null}),preferences:freeze({studentName:'Incremental QA',theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null})});
  const counters={dateScans:0,documentReads:0,monthReads:0,monthDocuments:0,noteFullReads:0,noteTargetReads:0,personalSettles:0,personalBackupCaptureSettles:0,notesBackupCaptureSettles:0,personalReads:0,assetLists:0,assetBodies:0,structuredStringifies:0,structuredHashes:0,reconciliationNoteReads:0,reconciliationNoteWrites:0,reconciliationNoteDeletes:0};
  const currentFence=()=>`study-director.fast-capture-fence.v1|${epochToken}|0|${sourceRevision}`;
  const stampRows=()=>freeze([...stamps.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([unit,stamp])=>freeze({unit,token:stamp})));
  const replaceStamps=async units=>{stamps=new Map([...new Set(units)].sort().map(unit=>[unit,token(++stampSerial)]));return stampRows();};
  const mutate=(unit,operation)=>{operation();epochToken=token(++epochSerial);stamps.set(unit,token(++stampSerial));sourceRevision=new Date(Date.parse(sourceRevision)+60000).toISOString();};
  const runtime=BackupModule.createRuntime(freeze({ports:freeze({
    configuration:freeze({appVersion:'Incremental QA',backupVersion:RUNTIME_DATA_CONTRACT.schemas.Backup.version,limits:freeze({backupChunkItems:50,backupMaxCompressedBytes:64*1024*1024,backupMaxFileBytes:1024*1024*1024,backupMaxAssetDescriptors:50000,maxImportRecords:10000,maxNotes:1000})}),
    persistence:freeze({
      activeSessionLoad:async()=>({ok:true,value:null,error:null,storage:{idb:true}}),activeSessionSave:async value=>({ok:true,value}),activeSessionClear:async()=>({ok:true}),activeSessionSettled:async()=>true,
      dailyRecordBackupDates:async()=>{counters.dateScans++;return {dates:dailyRecords.map(item=>item.date),warning:dailyRecordCanonical?'':'Saved-day IndexedDB unavailable; rescue subset only.',canonical:dailyRecordCanonical};},
      dailyRecordBackupMonth:async month=>{counters.monthReads++;const rows=dailyRecords.filter(item=>monthOf(item.date)===month);counters.monthDocuments+=rows.length;return rows;},
      dailyRecordDocuments:async dates=>{counters.documentReads+=dates.length;return dates.map(date=>dailyRecords.find(item=>item.date===date)).filter(Boolean);},dailyRecordImportBatches:async()=>({batches:0}),dailyRecordRemove:async()=>true,dailyRecordTimestamp:()=>'',
      notesExportPayload:()=>notes,notesReadFreshPayload:async()=>{counters.noteFullReads++;return notes;},notesReadFreshItems:async keys=>{counters.noteTargetReads+=keys.length;return keys.map(key=>notes[key]||null);},notesFlush:async options=>{if(options?.backupCapture===true)counters.notesBackupCaptureSettles++;return true;},notesNormalizePayload:value=>value,notesTrashKey:key=>String(key).startsWith('~')?'':'~deleted '+key,notesAlignByTitle:value=>value,notesFailure:()=>null,
      restoreJournalPrepare:async()=>true,restoreJournalRead:async()=>null,restoreJournalMark:async()=>true,restoreJournalClear:async()=>true,
      scheduleRead:()=>'',personalSettle:async options=>{counters.personalSettles++;if(options?.backupCapture===true)counters.personalBackupCaptureSettles++;if(failPersonalSettle){failPersonalSettle=false;throw new Error('synthetic Plan settlement failure');}return true;},personalExport:async options=>{counters.personalReads++;if(options?.flush!==false){assert.equal(allowFullCaptureFlush,true,'incremental managed repository preparation must read personal data without mutating the fenced source');allowFullCaptureFlush=false;}return personalData;},personalImport:async()=>true,personalVerify:async()=>true,
      storageGeneration:()=>0,sourceRevision:async()=>sourceRevision,snapshotRevision:async()=>{const observed=currentFence();if(sourceFenceRace){sourceFenceRace=false;mutate('personalData',()=>{});}return observed;},canonicalMutationEpochRead:async()=>freeze({token:epochToken}),canonicalPreparationRebase:async()=>{epochToken=token(++epochSerial);stamps=new Map([['*',token(++stampSerial)]]);return freeze({epoch:freeze({token:epochToken}),stamps:stampRows()});},preparationUnitStamps:async()=>{if(failPreparationIndexRead){failPreparationIndexRead=false;throw new Error('synthetic preparation index read failure');}return stampRows();},preparationUnitReplace:replaceStamps,installationId:()=> 'inst_incremental_qa',
      deletionRecoveryFlush:async()=>true,deletionRecoverySavedDays:async()=>[],deletionRecoveryReplaceSavedDays:async()=>true,deletionRecoveryNotes:async()=>[],deletionRecoveryReplaceNotes:async()=>true,deletionRecoveryAttachments:async()=>[],deletionRecoveryReplaceAttachments:async()=>true,deletionRecoveryClearAttachment:async()=>true,
      reconciliationBaseRead:async()=>base,reconciliationBaseReadNotes:async keys=>{counters.reconciliationNoteReads+=keys.length;const out=Object.create(null);for(const key of keys)if(Object.prototype.hasOwnProperty.call(baseNotes,key))out[key]=baseNotes[key];return freeze(out);},
      reconciliationBaseReadDays:async()=>freeze({}),...keptReviews.ports,reconciliationBaseWrite:async(checkpointId,spec)=>{if(!spec||spec.format!=='study-director.reconciliation-base-update')throw new Error('Expected incremental reconciliation baseline update.');if(!spec.full&&(!base||base.checkpointId!==spec.baseCheckpointId))return false;if(spec.full){const keep=new Set(spec.noteKeys||[]);for(const key of Object.keys(baseNotes))if(!keep.has(key)){delete baseNotes[key];counters.reconciliationNoteDeletes++;}}for(const key of spec.deletes||[]){if(Object.prototype.hasOwnProperty.call(baseNotes,key)){delete baseNotes[key];counters.reconciliationNoteDeletes++;}}for(const [key,text] of Object.entries(spec.updates||{})){baseNotes[key]=String(text);counters.reconciliationNoteWrites++;}let noteCount=Number(spec.noteCount),noteKeyFingerprint=String(spec.noteKeyFingerprint||'');if(spec.full){const keys=[...(spec.noteKeys||[])].sort();noteCount=keys.length;noteKeyFingerprint=await processing.run('checksum',{value:JSON.stringify(keys),algorithm:'sha256'});}base=freeze({format:'study-director.reconciliation-base',version:2,checkpointId,establishedAt:new Date().toISOString(),noteCount,noteKeyFingerprint});return true;}
    }),
    codecs:freeze({activeSession:ActiveSessionCodec,backup:BackupCodec,pendingReview:pendingReviewCodec}),reconciliation:freeze({createPlan:ReconciliationModule.createPlan,resolvePlan:ReconciliationModule.resolvePlan,summarizePlan:ReconciliationModule.summarizePlan}),noteReconciliation:freeze({merge:paragraphMerge,resolve:async()=>freeze({format:'study-director.note-reconciliation-result',version:1,notes:freeze({})})}),exports:freeze({...exportsPort,run:async(type,data,options)=>{if(type==='stringify'&&data&&data.value&&data.value.format==='study-director.backup-repository-object')counters.structuredStringifies++;if(type==='checksum'&&typeof data?.value==='string'&&data.value.includes('\"format\":\"study-director.backup-repository-object\"'))counters.structuredHashes++;if(type==='file.release')return true;return processing.run(type,data,options?.progress);}}),
    session:freeze({canMutate:()=>true,cancelLiveDraftSave:noop,captureSnapshot:()=>null,hasActiveSession:()=>false,hasTasks:()=>false,toActiveSession:()=>null,withPersistenceSuppressed:operation=>operation(),yieldSession:async()=>false}),
    domain:freeze({clampText:value=>String(value||''),filenameSafeStudentName:value=>String(value||'qa'),getStudentName:()=> 'Incremental QA',materializeDailyRecordView:value=>value,sanitizeCurrentDailyRecord:value=>value,todayISO:()=> '2026-09-22'}),
    view:freeze({presentation:createBackupPresentation(),refreshPnote:noop,refreshReview:noop,renderSchedule:noop}),events:freeze({libraryChanged:noop,backupCompleted:noop,reconcileNotes:async()=>true,restoreNotesSnapshot:async()=>true,restoreSessionState:async()=>true,verifyActiveSessionRuntime:async()=>true,restoredFromFile:()=>false}),
    operations:freeze({canShare:()=>true,assertAuthority:()=>true,clearFault:noop,failClosed:message=>{throw new Error(message);},runExclusive:async(kind,operation)=>operation()}),interactions:freeze({choose:async()=>null,configure:async()=>null,notify:noop}),environment:freeze({AbortController,clearTimeout,yieldTask:async()=>{},setTimeout}),diagnostics:freeze({capture:noop,start:()=>'',mark:()=>false,finish:()=>false,fail:()=>false}),
    assets:freeze({get:async()=>{counters.assetBodies++;throw new Error('No attachment body should be opened in this fixture.');},put:async()=>true,keys:async()=>[],list:async()=>{counters.assetLists++;return [];},importAll:async()=>true,restoreAll:async()=>true,removeMany:async()=>true,removeMetadata:async()=>0,scheduleMaintenance:noop})
  })}));
  async function publish(history,{duringObjectWrite=null,shared=true}={}){let changedDuringWrite=false;return runtime.repository.publish(history,{interactive:false,shared,baseUpdate:true},freeze({writeObject:async entry=>{if(!changedDuringWrite&&typeof duringObjectWrite==='function'){changedDuringWrite=true;duringObjectWrite();}return freeze({id:entry.objectId});},writeManifest:async file=>freeze({name:file.manifest.checkpoint.checkpointId+'.sdcheckpoint'}),commit:async marker=>freeze({name:marker.checkpointId+'.sdcommit'}),onCommitted:async()=>null,cleanup:async()=>null,onFailure:async()=>null}));}
  return freeze({
    runtime,counters,publish,stampRows,base:()=>base,
    mutateDay(index){const date=dailyRecords[index].date,unit=`dailyRecordPack:${monthOf(date)}`;mutate(unit,()=>{dailyRecords=dailyRecords.map((row,rowIndex)=>rowIndex===index?freeze({...row,reflection:row.reflection+'-edited',updatedAt:sourceRevision}):row);});return unit;},
    mutateNote(){mutate('note:Subject',()=>{notes={Subject:freeze({...notes.Subject,text:notes.Subject.text+' edited',updatedAt:sourceRevision})};});},
    deleteNote(){mutate('note:Subject',()=>{notes={};});},
    mutatePersonal(){mutate('personalData',()=>{personalData=freeze({...personalData,preferences:freeze({...personalData.preferences,studentName:'Incremental QA 2'})});});},
    forceUnexplainedEpoch(){epochToken=token(++epochSerial);sourceRevision=new Date(Date.parse(sourceRevision)+60000).toISOString();},
    forceWildcard(){epochToken=token(++epochSerial);stamps.set('*',token(++stampSerial));sourceRevision=new Date(Date.parse(sourceRevision)+60000).toISOString();},
    failNextPersonalSettle(){failPersonalSettle=true;},
    failNextPreparationIndexRead(){failPreparationIndexRead=true;allowFullCaptureFlush=true;},
    raceNextFastFence(){sourceFenceRace=true;allowFullCaptureFlush=true;},
    setDailyRecordCanonical(value){dailyRecordCanonical=value===true;},
    desyncDailyRecordInventory(){dailyRecords=[...dailyRecords,freeze({version:16,recordKind:'study',date:'2025-12-31',reflection:'untracked',savedAt:'2026-09-22T04:00:00.000Z',updatedAt:'2026-09-22T04:00:00.000Z'})];}
  });
}

for(const dayCount of [1,30,365]){
  const scenario=createScenario(dayCount),first=await scenario.publish(null),cold={...scenario.counters};
  assert.equal(cold.documentReads,dayCount,`${dayCount}-day cold baseline must read every Saved Day exactly once`);
  assert.equal(cold.dateScans,1,`${dayCount}-day cold baseline must enumerate Saved Days once`);
  const second=await scenario.publish(first.manifest),warmDelta=Object.fromEntries(Object.keys(cold).map(key=>[key,scenario.counters[key]-cold[key]]));
  assert.equal(warmDelta.documentReads,0,`${dayCount}-day warm no-op must not reread Saved-Day payloads`);
  assert.equal(warmDelta.dateScans,1,`${dayCount}-day warm no-op must perform exactly one lightweight canonical Saved-Day key probe`);
  assert.equal(warmDelta.monthReads,0,`${dayCount}-day warm no-op must not issue monthly Saved-Day reads`);
  assert.equal(warmDelta.noteFullReads,0,`${dayCount}-day warm no-op must not reread all notes`);
  assert.equal(warmDelta.noteTargetReads,0,`${dayCount}-day warm no-op must not reread unchanged notes`);
  assert.equal(warmDelta.personalReads,0,`${dayCount}-day warm no-op must not re-export unchanged personal data`);
  assert.equal(warmDelta.personalSettles,1,`${dayCount}-day warm no-op must settle pending Plan/preferences before establishing the capture fence`);
  assert.equal(warmDelta.personalBackupCaptureSettles,1,`${dayCount}-day managed settlement must tag Plan/preferences writes as backup capture`);
  assert.equal(warmDelta.notesBackupCaptureSettles,1,`${dayCount}-day managed settlement must tag note writes as backup capture`);
  assert.equal(warmDelta.structuredStringifies,0,`${dayCount}-day warm no-op must not serialize unchanged structured repository objects`);
  assert.equal(warmDelta.structuredHashes,0,`${dayCount}-day warm no-op must not hash unchanged structured repository objects`);
  assert.equal(second.objectsWritten,0,`${dayCount}-day warm no-op must write no payload objects`);
  assert.equal(warmDelta.assetBodies,0,'warm no-op must preserve zero unchanged attachment-body reads');
  assert.equal(warmDelta.reconciliationNoteReads,0,`${dayCount}-day warm no-op must not read reconciliation note text`);
  assert.equal(warmDelta.reconciliationNoteWrites,0,`${dayCount}-day warm no-op must advance only reconciliation header metadata`);
  assert.equal(warmDelta.reconciliationNoteDeletes,0,`${dayCount}-day warm no-op must not touch reconciliation note rows`);
  const beforeEdit={...scenario.counters},changedMonth=scenario.mutateDay(Math.min(dayCount-1,14)),third=await scenario.publish(second.manifest),editDelta=Object.fromEntries(Object.keys(beforeEdit).map(key=>[key,scenario.counters[key]-beforeEdit[key]]));
  const expectedMonthCount=dayCount===1?1:dayCount===30?30:31;
  assert.equal(editDelta.documentReads,0,`${dayCount}-day one-day edit must not return to full Saved-Day reads`);
  assert.equal(editDelta.dateScans,1,`${dayCount}-day one-day edit must perform exactly one lightweight canonical Saved-Day key probe`);
  assert.equal(editDelta.monthReads,1,`${dayCount}-day one-day edit must read exactly one monthly pack`);
  assert.equal(editDelta.monthDocuments,expectedMonthCount,`${dayCount}-day one-day edit must read only ${changedMonth}`);
  assert.equal(editDelta.structuredStringifies,1,`${dayCount}-day one-day edit must serialize only the changed monthly object`);
  assert.equal(editDelta.structuredHashes,1,`${dayCount}-day one-day edit must hash only the changed monthly object`);
  assert.equal(third.objectsWritten,1,`${dayCount}-day one-day edit must write only the changed monthly object`);
}


// The incremental reuse fast path must not hide an unreadable canonical Saved-Day store.
{
  const scenario=createScenario(30),first=await scenario.publish(null),second=await scenario.publish(first.manifest),before={...scenario.counters};
  scenario.setDailyRecordCanonical(false);
  await assert.rejects(()=>scenario.publish(second.manifest),error=>error&&error.code==='BACKUP_CANONICAL_CAPTURE_INCOMPLETE','incremental managed publication must fail closed when canonical Saved-Day enumeration is unavailable even if prior repository objects are reusable');
  assert.equal(scenario.counters.documentReads-before.documentReads,0,'canonical completeness probing must not reread Saved-Day payloads merely to reject an unreadable store');
  assert.equal(scenario.counters.dateScans-before.dateScans,1,'incremental completeness must use one lightweight Saved-Day key probe');
}

// The canonical inventory probe must also catch preparation-index drift that
// would otherwise omit an untracked Saved Day from a reused incremental checkpoint.
{
  const scenario=createScenario(30),first=await scenario.publish(null),second=await scenario.publish(first.manifest);
  scenario.desyncDailyRecordInventory();
  await assert.rejects(()=>scenario.publish(second.manifest),error=>error&&error.code==='BACKUP_PREPARATION_INDEX_INVALID','incremental managed publication must fail closed when its reusable Saved-Day inventory no longer matches canonical storage');
}

// Other structured-unit attribution stays selective: Note and personal singleton.
{
  const scenario=createScenario(30),first=await scenario.publish(null),second=await scenario.publish(first.manifest);
  let before={...scenario.counters};scenario.mutateNote();let next=await scenario.publish(second.manifest);
  assert.equal(scenario.counters.noteTargetReads-before.noteTargetReads,1,'a note stamp change must target only that note');
  assert.equal(scenario.counters.noteFullReads-before.noteFullReads,0,'an attributed Note change must not force a full note read');
  assert.equal(scenario.counters.documentReads-before.documentReads,0,'a note change must not reread Saved Days');
  assert.equal(scenario.counters.structuredStringifies-before.structuredStringifies,1,'a note edit must serialize one structured object');
  assert.equal(scenario.counters.structuredHashes-before.structuredHashes,1,'a note edit must hash one structured object');
  assert.equal(scenario.counters.reconciliationNoteWrites-before.reconciliationNoteWrites,1,'a note edit must update only its reconciliation row');
  assert.equal(scenario.counters.reconciliationNoteDeletes-before.reconciliationNoteDeletes,0,'a note edit must not delete reconciliation rows');
  assert.equal(next.objectsWritten,1,'an attributed Note change must rewrite only one repository object');
  before={...scenario.counters};scenario.deleteNote();next=await scenario.publish(next.manifest);
  assert.equal(scenario.counters.noteTargetReads-before.noteTargetReads,1,'a note deletion must target only the deleted note identity');
  assert.equal(scenario.counters.noteFullReads-before.noteFullReads,0,'a note deletion must not force a full note read');
  assert.equal(scenario.counters.structuredStringifies-before.structuredStringifies,0,'a note deletion must not serialize an absent repository object');
  assert.equal(scenario.counters.structuredHashes-before.structuredHashes,0,'a note deletion must not hash an absent repository object');
  assert.equal(scenario.counters.reconciliationNoteWrites-before.reconciliationNoteWrites,0,'a note deletion must not rewrite surviving reconciliation rows');
  assert.equal(scenario.counters.reconciliationNoteDeletes-before.reconciliationNoteDeletes,1,'a note deletion must remove exactly its reconciliation row');
  assert.equal(next.objectsWritten,0,'a note deletion must be represented by the checkpoint manifest/deletion state without a replacement note object');
  before={...scenario.counters};scenario.mutatePersonal();next=await scenario.publish(next.manifest);
  assert.equal(scenario.counters.personalReads-before.personalReads,1,'a personalData stamp change must re-export personal data once');
  assert.equal(scenario.counters.documentReads-before.documentReads,0,'a personalData change must not reread Saved Days');
  assert.equal(scenario.counters.structuredStringifies-before.structuredStringifies,1,'a personalData edit must serialize one structured object');
  assert.equal(next.objectsWritten,1,'a personalData edit must rewrite one repository object');
}


// Only a shared location (Drive) moves the base. A Device Folder version in
// between leaves it where it was, and the next Drive version still carries the
// change made before it into the base.
{
  const scenario=createScenario(30),first=await scenario.publish(null),second=await scenario.publish(first.manifest);
  let before={...scenario.counters};scenario.mutateNote();const local=await scenario.publish(second.manifest,{shared:false});
  assert.equal(scenario.counters.reconciliationNoteWrites-before.reconciliationNoteWrites,0,'a Device Folder version does not move the shared base');assert.equal(scenario.base().checkpointId,second.checkpointId);
  before={...scenario.counters};const shared=await scenario.publish([local.manifest]);
  assert.equal(shared.unchanged,true,'nothing changed since the Device Folder version');assert.equal(scenario.base().checkpointId,local.checkpointId,'the next Drive backup shares that same version');
  assert.equal(scenario.counters.reconciliationNoteWrites-before.reconciliationNoteWrites,1,'the note changed before the Device Folder version reaches the base');
}



// Incremental acceleration metadata is disposable: restore/migration damage to
// the preparation index must fall back to a complete canonical capture rather
// than making backup depend on a later user mutation (such as applying a Plan).
{
  const scenario=createScenario(30),first=await scenario.publish(null),second=await scenario.publish(first.manifest),before={...scenario.counters};
  scenario.failNextPreparationIndexRead();const recovered=await scenario.publish(second.manifest);
  assert.ok(recovered.checkpointId,'a preparation-index read failure must fall back to a complete canonical checkpoint');
  assert.equal(scenario.counters.dateScans-before.dateScans,1,'preparation-index fallback must rebuild canonical Saved-Day inventory once');
  const beforeRace={...scenario.counters};scenario.raceNextFastFence();const raced=await scenario.publish(recovered.manifest);
  assert.ok(raced.checkpointId,'a canonical write racing the fast fence must be retried/fallen back safely instead of failing backup');
  assert.ok(scenario.counters.dateScans-beforeRace.dateScans>=1,'a fast-fence race may conservatively fall back to a full canonical capture');
}


// Authoritative restore/combine invalidation must make acceleration metadata disposable.
// The next publication rebases from canonical state immediately, without waiting for a user edit.
{
  const scenario=createScenario(30),first=await scenario.publish(null),second=await scenario.publish(first.manifest),before={...scenario.counters};
  assert.equal(scenario.runtime.controller.invalidateRepositoryPreparation(),true,'runtime must expose an explicit preparation-cache invalidation hook for authoritative recovery');
  const rebased=await scenario.publish(second.manifest);
  assert.ok(rebased.checkpointId,'an invalidated preparation cache must still publish immediately');
  assert.equal(scenario.counters.dateScans-before.dateScans,1,'post-restore invalidation must rebuild Saved-Day inventory exactly once');
  assert.equal(scenario.counters.documentReads-before.documentReads,30,'post-restore invalidation must conservatively reread the canonical Saved-Day corpus once');
}

// Preparation failures must retain a stable safe diagnostic code and stage instead of collapsing to generic Error.
{
  const scenario=createScenario(1);scenario.failNextPersonalSettle();
  await assert.rejects(()=>scenario.publish(null),error=>error&&error.code==='BACKUP_PLAN_SETTLE_FAILED'&&error.backupStage==='checkpoint-plan-settle','Plan settlement failure must be attributable in copied backup diagnostics.');
}

// Once local checkpoint preparation has been fully verified, later edits belong
// to the next checkpoint; a slow external publication must not invalidate the
// immutable checkpoint already being uploaded.
{
  const scenario=createScenario(30),first=await scenario.publish(null),second=await scenario.publish(first.manifest);
  scenario.mutateNote();
  const published=await scenario.publish(second.manifest,{duringObjectWrite:()=>scenario.mutatePersonal()});
  assert.ok(published.checkpointId,'a source mutation during external publication must not invalidate the already sealed checkpoint');
  const followUp=await scenario.publish(published.manifest);
  assert.equal(followUp.objectsWritten,1,'the concurrent mutation must remain pending for the next managed checkpoint');
}

// Unexplained epoch changes and wildcard attribution are conservative: slower, never less safe.
for(const mode of ['unexplained','wildcard']){
  const scenario=createScenario(30),first=await scenario.publish(null),second=await scenario.publish(first.manifest),before={...scenario.counters};
  mode==='unexplained'?scenario.forceUnexplainedEpoch():scenario.forceWildcard();
  await scenario.publish(second.manifest);
  assert.equal(scenario.counters.documentReads-before.documentReads,30,`${mode} provenance must fall back to the complete Saved-Day capture`);
  assert.equal(scenario.counters.dateScans-before.dateScans,1,`${mode} provenance must rebuild the complete canonical inventory`);
}

console.log(JSON.stringify({
  incrementalPreparation:true,
  corpora:[1,30,365],
  warmNoOpSavedDayPayloadReads:0,
  warmNoOpStructuredSerializationAndHashing:0,
  oneDayEditScope:'one monthly pack',
  uncertaintyFallback:'full canonical capture'
},null,2));
