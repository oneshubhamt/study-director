import {createBackupPresentation} from '../../helpers/backup-presentation.mjs';
import {RUNTIME_DATA_CONTRACT} from '../../../contracts/canonical-identities.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createProcessingEngine} from '../../helpers/file-processing.mjs';
import {createMemoryDirectory} from '../../helpers/memory-directory.mjs';
import {legacyNoteKey} from '../../helpers/note-ids.mjs';
import {passwordKey,streamEncryptionInfo,transformEncrypted} from '../../../portable/stream-encryption.js';

const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../../..'),read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
for(const file of ['source/core/internal.js','source/core/device-folder-storage.js','source/core/operation-lifecycle.js','source/core/record-codecs.js','source/core/backup-codec.js','source/core/canonical.js','source/core/reconciliation.js','source/core/managed-repository.js','source/core/repository-policy.js','source/core/repository-background.js','source/core/backup-provider.js','source/core/backup-capture.js','source/core/backup.js','source/core/managed-recovery.js'])vm.runInThisContext(read(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')],freeze=Object.freeze;
const CanonicalModule=registry.require('canonical',1),RecordCodecs=registry.require('record-codecs',1),BackupCodecs=registry.require('backup-codec',1),ManagedRepositoryModule=registry.require('managed-repository',1),RepositoryPolicyModule=registry.require('repository-policy',1),BackupProviderModule=registry.require('backup-provider',1,freeze({repositoryPolicy:RepositoryPolicyModule})),BackupCaptureModule=registry.require('backup-capture',1),RepositoryBackgroundModule=registry.require('repository-background',1,Object.freeze({lifecycle:registry.require('operation-lifecycle',1)})),BackupModule=registry.require('backup',1,Object.freeze({backupCapture:BackupCaptureModule,backupProvider:BackupProviderModule,canonical:CanonicalModule,managedRepository:ManagedRepositoryModule,repositoryBackground:RepositoryBackgroundModule})),ReconciliationModule=registry.require('reconciliation',1,Object.freeze({canonical:CanonicalModule})),ManagedRecoveryModule=registry.require('managed-recovery',1);
const processing=createProcessingEngine();
const limits=freeze({
  backupChunkItems:10,backupChunkTargetBytes:65536,backupMaxEntryBytes:65536,backupMaxLineBytes:262144,
  backupMaxCompressedBytes:4*1024*1024,backupMaxFileBytes:16*1024*1024,backupMaxUncompressedBytes:8*1024*1024,
  backupMaxAssetDescriptors:100,richAssetMaxBytes:8*1024*1024,maxBackupChunks:1000,importBytes:4*1024*1024,
  maxImportRecords:100,maxOngoingNotes:100,maxLegacyImportTombstones:100,maxReflectionChars:10000,maxScheduleChars:10000
});
const dataContract=RUNTIME_DATA_CONTRACT;
const defs=freeze({dailyRecord:freeze({idField:'date',backupLimit:100}),areaNote:freeze({idField:'key',backupLimit:100}),activeSession:freeze({idField:'id',backupLimit:1})});
const isDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
const normalizeArea=(item,key)=>item&&String(key||item.key||'')?freeze({version:2,key:String(key||item.key),text:String(item.text||''),updatedAt:String(item.updatedAt||'2026-09-19T00:00:00.000Z')}):null;
const dailyRecordCodec=freeze({
  sanitizeHistoricalDailyRecord:item=>item&&isDate(item.date)?freeze({...item}):null,
  canonicalizeHistoricalDailyRecord:item=>item&&isDate(item.date)?freeze({...item,version:15}):null,
  sanitizeCurrentDailyRecord:item=>item&&isDate(item.date)&&Number(item.version)===16?freeze({...item}):null,
  sanitizeImportedAreaNote:normalizeArea,sanitizeCurrentAreaNote:normalizeArea,isSupportedSavedDate:isDate
});
const activeSessionCodec=freeze({sanitizeCurrent:item=>item&&item.id==='current'?freeze({...item}):null});
const reflectionDraftCodec=freeze({format:'study-director.reflection-draft-codec',contractVersion:1,sanitizeCurrent:item=>item&&isDate(item.date)?freeze({...item,reflection:String(item.reflection||'')}):null});
const compatibilityCodec=freeze({format:'study-director.compatibility-codecs',contractVersion:1,dailyRecord:item=>dailyRecordCodec.sanitizeCurrentDailyRecord(item),areaNote:normalizeArea,areaNoteKey:legacyNoteKey,activeSession:item=>activeSessionCodec.sanitizeCurrent(item),reflectionDraft:item=>reflectionDraftCodec.sanitizeCurrent(item),personalData:item=>{if(!item||typeof item!=='object'||![1,2].includes(Number(item.version)))throw new Error('Unsupported legacy personal-data version.');const p=item.preferences||{};return {version:2,plans:item.plans,preferences:{studentName:p.studentName??null,theme:p.theme??null,presentation:p.presentation??null,quote:p.quote??null,practiceCueMode:p.practiceCueMode??null,fontScale:p.fontScale??null,practiceTargetMs:p.practiceTargetMs??null,nudge:p.nudge??null}};}});
const keyedRecord=freeze({create:()=>Object.create(null)}),entityDefinition=type=>defs[type]||null,entityIdentity=(type,item)=>String(item?.[defs[type]?.idField]||'');
const boundedInt=(value,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={})=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;};
const jsonByteLength=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).byteLength;
const personalDataCodec=RecordCodecs.createPersonalDataCodec(limits);
const assetId='img-1234567890abcdefghijklmn';
const codec=BackupCodecs.createBackupCodec(freeze({
  personalDataCodec,processing:freeze({...processing,scope:operation=>operation()}),appConfig:freeze({appName:'Study Director',attribution:'Study Director'}),limits,dataContract,
  legacy:freeze({schemaVersion:3,tombstoneLimit:limits.maxLegacyImportTombstones}),entityTypes:freeze(Object.keys(defs)),keyedRecord,entities:freeze({entityDefinition,entityIdentity}),helpers:freeze({boundedInt,jsonByteLength}),
  richText:freeze({assetIds:()=>freeze([]),assetIdValid:value=>/^img-[A-Za-z0-9_-]{16,128}$/.test(String(value||'')),imageMimeTypeValid:value=>['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(String(value||''))}),
  dailyRecordCodec,activeSessionCodec,compatibilityCodec
}));

const personalData=freeze({version:2,plans:freeze({draft:null,savedPlans:freeze([]),defaultId:null}),preferences:freeze({studentName:'Repository Source',theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null})});
const localPersonal=freeze({version:2,plans:freeze({draft:'09:00 | 45 | Local plan | work | Ethics | block | 1',savedPlans:freeze([{id:'plan-local0001',label:'Local plan',scheduleText:'09:00 | 45 | Local plan | work | Ethics | block | 1',createdAt:'2026-09-19T00:00:00.000Z',updatedAt:'2026-09-19T00:00:00.000Z'}]),defaultId:'plan-local0001'}),preferences:freeze({...personalData.preferences,studentName:'Local Before Handoff',theme:'glass'})});
const image=new Blob([new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4,5,6])],{type:'image/png'}),imageHash=await codec.checksumBlob(image);
let records=[freeze({version:16,recordKind:'study',date:'2026-09-18',reflection:'repository reflection',savedAt:'2026-09-18T20:00:00.000Z',updatedAt:'2026-09-18T20:00:00.000Z'})];
let notes={Ethics:normalizeArea({key:'Ethics',text:'repository note',updatedAt:'2026-09-18T20:00:00.000Z'},'Ethics')};
let preparationRebaseCalls=0;
let currentPersonal=personalData,deletions=[freeze({date:'2026-09-17',deletedAt:'2026-09-18T21:00:00.000Z'})],noteDeletions=[],attachmentDeletions=[],activeSession=null,scheduleText='',assets=new Map([[assetId,image]]),journal=null,reconciliationBase=null,reconciliationBaseNotes=Object.create(null),lastNoteConflicts=[],noteChoice=null,noteReconciliationCalls=0,reconciliationBaseNoteReadKeys=[],failExactNotes=false;
const documentStub=freeze({getElementById:()=>null,addEventListener:()=>{},createElement:()=>({click(){},remove(){}}),createDocumentFragment:()=>({appendChild(){}}),body:freeze({appendChild(){}})});
const noop=()=>{};
const encryptionKey=await passwordKey('repository restore adapter qa passphrase');
async function encryptBlob(file){const parts=[];await transformEncrypted(file,encryptionKey,{write:async bytes=>parts.push(new Uint8Array(bytes).slice())});return new Blob(parts,{type:'application/octet-stream'});}
async function decryptBlob(file){const parts=[];await transformEncrypted(file,encryptionKey,{write:async bytes=>parts.push(new Uint8Array(bytes).slice())},{decrypt:true});return new Blob(parts,{type:'application/octet-stream'});}
let fileJobActive=false,nestedFileJobReentries=0;
const exportsPort=freeze({
  backgroundAvailable:()=>true,protect:async fileOrFactory=>{const file=typeof fileOrFactory==='function'?await fileOrFactory():fileOrFactory;return freeze({...file,blob:await encryptBlob(file.blob),encrypted:true,protectionId:'qa-protection',checkProtection:async()=>{}});},
  unprotect:async file=>freeze({blob:await streamEncryptionInfo(file)?await decryptBlob(file):file,encrypted:!!await streamEncryptionInfo(file)}),check:()=>{},scope:operation=>operation(),job:async operation=>{if(fileJobActive){nestedFileJobReentries+=1;throw new Error('nested file job re-entry');}fileJobActive=true;try{return await operation();}finally{fileJobActive=false;}},
  run:(type,data,options)=>processing.run(type,data,options?.progress),download:()=>freeze({status:'downloaded'}),chooseSave:async()=>null,save:async()=>freeze({status:'saved'})
});
const configure=async config=>freeze(Object.fromEntries((config.groups||[]).map(group=>[group.id,['plans','personalSettings'].includes(group.id)?'replace':group.defaultValue])));
const portablePathMetrics={containers:0,inspections:0};
const runtimeBackupCodec=freeze({...codec,
  createV10Container:(...args)=>{portablePathMetrics.containers+=1;return codec.createV10Container(...args);},
  inspect:async(...args)=>{portablePathMetrics.inspections+=1;return codec.inspectCurrent(...args);}
});
const runtime=BackupModule.createRuntime(freeze({ports:freeze({
  configuration:freeze({activeSessionId:'current',appVersion:'repository-restore-test',backupVersion:RUNTIME_DATA_CONTRACT.schemas.Backup.version,limits}),
  
  persistence:freeze({
    activeSessionLoad:async()=>({ok:true,value:activeSession,error:null,storage:{idb:true}}),activeSessionSave:async value=>(activeSession=value,{ok:true,value}),activeSessionClear:async()=>(activeSession=null,{ok:true}),activeSessionSettled:async()=>true,
    dailyRecordBackupDates:async()=>({dates:records.map(record=>record.date).sort(),warning:''}),dailyRecordBackupMonth:async month=>records.filter(record=>String(record.date).startsWith(String(month)+'-')).sort((a,b)=>a.date.localeCompare(b.date)),dailyRecordDocuments:async dates=>dates.map(date=>records.find(record=>record.date===date)).filter(Boolean),
    dailyRecordImportBatches:async incoming=>{for(const record of incoming){const index=records.findIndex(row=>row.date===record.date);if(index>=0)records[index]=freeze({...record});else records.push(freeze({...record}));}records.sort((a,b)=>a.date.localeCompare(b.date));return {batches:incoming.length?1:0};},
    dailyRecordRemove:async date=>{records=records.filter(record=>record.date!==date);return true;},dailyRecordTimestamp:date=>records.find(record=>record.date===date)?.updatedAt||'',
    notesExportPayload:()=>notes,notesReadFreshPayload:async()=>notes,notesReadFreshItems:async keys=>(keys||[]).map(key=>notes[key]||null),notesFlush:async()=>true,notesNormalizePayload:value=>Object.fromEntries(Object.entries(value||{}).map(([key,item])=>[key,normalizeArea(item,key)]).filter(([,item])=>!!item)),notesAlignByTitle:value=>value,notesFailure:()=>null,
    restoreJournalPrepare:async value=>(journal={state:{id:value.id},payload:value},true),restoreJournalRead:async()=>journal,restoreJournalMark:async(id,phase)=>{if(journal)journal.state.phase=phase;return journal?.state||null;},restoreJournalClear:async()=>{journal=null;return true;},
    scheduleRead:()=>scheduleText,personalSettle:async()=>true,personalExport:async()=>currentPersonal,personalImport:async value=>{currentPersonal=freeze(value);return true;},personalVerify:async value=>assert.deepEqual(currentPersonal,value),
    storageGeneration:()=>0,sourceRevision:async()=> '2026-09-19T00:00:00.000Z',snapshotRevision:async()=> 'snapshot-stable',canonicalMutationEpochRead:async()=>null,canonicalPreparationRebase:async()=>{preparationRebaseCalls+=1;return Object.freeze({epoch:null,stamps:Object.freeze([{unit:'*'}])});},preparationUnitStamps:async()=>[],preparationUnitReplace:async()=>[],installationId:()=> 'inst_repository_restore_qa',
    deletionRecoveryFlush:async()=>true,deletionRecoverySavedDays:async()=>deletions.map(value=>freeze({...value})),deletionRecoveryReplaceSavedDays:async values=>{deletions=(values||[]).map(value=>freeze({...value}));return true;},deletionRecoveryAreaNotes:async()=>noteDeletions.map(value=>freeze({...value})),deletionRecoveryReplaceAreaNotes:async values=>(noteDeletions=(values||[]).map(value=>freeze({...value})),true),deletionRecoveryAttachments:async()=>attachmentDeletions.map(value=>freeze({...value})),deletionRecoveryReplaceAttachments:async values=>(attachmentDeletions=(values||[]).map(value=>freeze({...value})),true),deletionRecoveryClearAttachment:async()=>true,reconciliationBaseRead:async()=>reconciliationBase,reconciliationBaseReadNotes:async keys=>(reconciliationBaseNoteReadKeys.push(freeze([...(keys||[])])),freeze(Object.fromEntries(keys.filter(key=>Object.prototype.hasOwnProperty.call(reconciliationBaseNotes,key)).map(key=>[key,reconciliationBaseNotes[key]])))),reconciliationBaseWrite:async(checkpointId,payload)=>{if(payload&&payload.format==='study-director.reconciliation-base-update'){if(!payload.full&&reconciliationBase&&reconciliationBase.checkpointId!==payload.baseCheckpointId)return false;if(payload.full){const keep=new Set(payload.noteKeys||[]);for(const key of Object.keys(reconciliationBaseNotes))if(!keep.has(key))delete reconciliationBaseNotes[key];}for(const key of payload.deletes||[])delete reconciliationBaseNotes[key];for(const [key,text] of Object.entries(payload.updates||{}))reconciliationBaseNotes[key]=String(text);reconciliationBase=freeze({format:'study-director.reconciliation-base',version:2,checkpointId,establishedAt:new Date().toISOString(),noteCount:Number(payload.noteCount),noteKeyFingerprint:String(payload.noteKeyFingerprint||'0'.repeat(64))});return true;}reconciliationBaseNotes=Object.create(null);for(const [key,value] of Object.entries(payload||{}))reconciliationBaseNotes[key]=String(value&&typeof value==='object'&&'text' in value?value.text:(value??''));reconciliationBase=freeze({format:'study-director.reconciliation-base',version:2,checkpointId,establishedAt:new Date().toISOString(),noteCount:Object.keys(reconciliationBaseNotes).length,noteKeyFingerprint:'0'.repeat(64)});return true;}
  }),
  codecs:freeze({activeSession:activeSessionCodec,backup:runtimeBackupCodec}),reconciliation:freeze({createPlan:ReconciliationModule.createPlan,resolvePlan:ReconciliationModule.resolvePlan,summarizePlan:ReconciliationModule.summarizePlan}),noteReconciliation:freeze({resolve:async({conflicts=[]})=>{noteReconciliationCalls+=1;lastNoteConflicts=[...conflicts];return freeze({format:'study-director.note-reconciliation-result',version:1,notes:freeze(Object.fromEntries(conflicts.map(item=>[item.key,freeze({text:noteChoice?noteChoice(item):item.localValue,localCandidateId:item.localCandidateId,incomingCandidateId:item.incomingCandidateId})])))})}}),exports:exportsPort,
  session:freeze({canMutate:()=>true,cancelLiveDraftSave:noop,captureSnapshot:()=>null,hasActiveSession:()=>false,hasTasks:()=>false,toActiveSession:()=>null,withPersistenceSuppressed:operation=>operation()}),
  domain:freeze({clampText:(value,max=100000)=>String(value??'').slice(0,max),filenameSafeStudentName:()=> 'repository-source',getStudentName:()=>currentPersonal.preferences.studentName,materializeDailyRecordView:value=>value,sanitizeCurrentDailyRecord:dailyRecordCodec.sanitizeCurrentDailyRecord,todayISO:()=> '2026-09-19'}),
  view:freeze({presentation:createBackupPresentation(),refreshPnote:noop,refreshReview:noop,renderSchedule:noop}),
  events:freeze({
    libraryChanged:noop,backupCompleted:noop,
    reconcileAreaNotes:async payload=>{notes={...notes,...payload};return notes;},
    restoreAreaNotesSnapshot:async payload=>{if(failExactNotes){failExactNotes=false;throw new Error('injected exact note replacement failure');}notes={...payload};return notes;},
    restoreSessionState:async(value,nextSchedule)=>(activeSession=value,scheduleText=String(nextSchedule||''),true),verifyActiveSessionRuntime:async(value,nextSchedule)=>{assert.deepEqual(activeSession,value);assert.equal(scheduleText,String(nextSchedule||''));return true;},restoredFromFile:()=>false
  }),
  operations:freeze({assertAuthority:()=>true,clearFault:noop,failClosed:message=>{throw new Error(message);},runExclusive:async(kind,operation)=>operation()}),interactions:freeze({choose:async()=>null,configure,notify:noop}),
  environment:freeze({AbortController,clearTimeout,yieldTask:async()=>{},setTimeout}),diagnostics:freeze({capture:noop,start:()=>'',mark:()=>false,finish:()=>false,fail:()=>false}),
  assets:freeze({
    get:async id=>assets.get(id)||null,put:async(id,blob)=>{assets.set(id,blob);return true;},keys:async()=>[...assets.keys()],
    list:async()=>Promise.all([...assets].map(async([id,blob])=>freeze({id,type:blob.type,size:blob.size,hash:await codec.checksumBlob(blob),name:'proof.png',library:true}))),
    importAll:async items=>{for(const item of items)assets.set(item.assetId,new Blob([item.blob],{type:item.mimeType}));return items.length;},
    restoreAll:async items=>{assets=new Map(items.map(item=>[item.assetId,new Blob([item.blob],{type:item.mimeType})]));return true;},removeMany:async ids=>{for(const id of ids)assets.delete(id);return ids.length;},removeMetadata:async ids=>{for(const id of ids)assets.delete(id);return ids.length;},scheduleMaintenance:noop
  })
})}));

// Build one repository checkpoint through the production publication coordinator and retain its immutable object files.
const objectFiles=new Map();let publishedManifestBlob=null,publishedCommitBlob=null,activeObjectWrites=0,maxObjectWrites=0;
const published=await runtime.repository.publish(null,{interactive:false},freeze({
  writeObject:async entry=>{assert.ok(entry.blob instanceof Blob);activeObjectWrites+=1;maxObjectWrites=Math.max(maxObjectWrites,activeObjectWrites);try{await new Promise(resolve=>setTimeout(resolve,5));objectFiles.set(entry.objectId,entry.blob);return freeze({id:entry.objectId});}finally{activeObjectWrites-=1;}},
  writeManifest:async file=>(publishedManifestBlob=file.blob,freeze({name:file.manifest.checkpoint.checkpointId+'.sdcheckpoint'})),
  commit:async marker=>{publishedCommitBlob=marker.blob;const verified=await runtime.repository.inspectCommit(marker.blob);assert.equal(verified.checkpointId,marker.checkpointId);return freeze({name:marker.checkpointId+'.sdcommit'});},
  onCommitted:async()=>null,cleanup:async()=>null,onFailure:async()=>null
}));
assert.ok(maxObjectWrites>1,'Independent repository objects should publish concurrently.');assert.ok(maxObjectWrites<=8,'Repository object publication must stay within the shared eight-operation concurrency ceiling.');
const manifest=published.manifest,checkpointId=manifest.checkpoint.checkpointId,readObject=async entry=>objectFiles.get(entry.objectId)||null;
let activeStructuredReads=0,maxStructuredReads=0;
const concurrentProbeReader=async entry=>{
  const blob=objectFiles.get(entry.objectId)||null;if(!blob)return null;
  if(entry.kind==='attachment')return blob;
  activeStructuredReads+=1;maxStructuredReads=Math.max(maxStructuredReads,activeStructuredReads);
  try{await new Promise(resolve=>setTimeout(resolve,5));return blob;}finally{activeStructuredReads-=1;}
};
await runtime.repository.verifyCheckpoint(manifest,concurrentProbeReader,{interactive:false});
assert.ok(maxStructuredReads>1,'Independent structured repository objects should be read concurrently during checkpoint verification.');assert.ok(maxStructuredReads<=8,'Structured repository restore reads must stay within the shared bounded concurrency limit of eight.');
const attachmentObjectIds=new Set(manifest.objects.filter(entry=>entry.kind==='attachment').map(entry=>entry.objectId)),leaseReleaseCounts=new Map();
const leasedReadObject=async entry=>{const blob=objectFiles.get(entry.objectId)||null;if(!blob)return null;return freeze({blob,release:async()=>leaseReleaseCounts.set(entry.objectId,(leaseReleaseCounts.get(entry.objectId)||0)+1)});};
assert.equal(manifest.protectedCheckpointManifest.version,2);assert.equal(manifest.checkpoint.checkpointId,checkpointId);assert.equal(manifest.encrypted,true,'repository publication must preserve the configured encrypted protection state');
// Checkpoints in older repository formats stay restorable until they age out of
// the repository (registry: backup-repository-v1-v4). Version 4 has today's
// shape; versions 1 to 3 kept one object per record instead of packed shards,
// so the fixture unpacks this checkpoint's shards into that older layout.
// Before version 6 notes are keyed by title: such a version restores whole,
// its notes converted, but offers no earlier version of one note
// (registry: name-keyed-notes-in-backups).
{
  const sha256=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const plainText=async (blob,gzip)=>{let stream=(await decryptBlob(blob)).stream();if(gzip)stream=stream.pipeThrough(new DecompressionStream('gzip'));return new Response(stream).text();};
  const unpacked=new Map(objectFiles),perRecord=[];let sequence=0;
  for(const entry of manifest.objects.filter(item=>item.kind==='structuredPack')){
    const pack=JSON.parse(await plainText(objectFiles.get(entry.objectId),entry.compression==='gzip'));
    for(const member of pack.members){
      const text=JSON.stringify({format:'study-director.backup-repository-object',version:1,kind:member.kind,key:member.key,payload:member.payload});
      const expected=entry.members.find(row=>row.kind===member.kind&&row.key===member.key);assert.equal(await sha256(text),expected.fingerprint,'the unpacked object matches its packed fingerprint');
      const stored=await encryptBlob(new Blob([text])),objectId='obj_'+String(++sequence).padStart(32,'0');unpacked.set(objectId,stored);
      perRecord.push(freeze({objectId,kind:member.kind,key:member.key,fingerprint:expected.fingerprint,compression:'none',sourceBytes:expected.sourceBytes,storedBytes:stored.size,storedChecksum:await codec.checksumBlob(stored)}));
    }
  }
  const layoutBefore4=freeze([...manifest.objects.filter(item=>item.kind!=='structuredPack'),...perRecord]),readUnpacked=async entry=>unpacked.get(entry.objectId)||null;
  assert.equal(runtime.repository.noteObject(manifest,legacyNoteKey('Ethics')),null,'a current manifest keys notes by id, never by name');
  for(const version of [1,2,3,4,5]){
    // Before version 5 the counts also named the checkpoint manifest and personal data.
    const counts=version<5?freeze({...manifest.counts,checkpointManifest:1,personalData:perRecord.some(item=>item.kind==='personalData')?1:0}):manifest.counts;
    const older=freeze({...manifest,version,counts,objects:version<4?layoutBefore4:manifest.objects}),reader=version<4?readUnpacked:readObject;
    const candidate=await runtime.repository.inspect(older,reader,{interactive:false,committed:true});
    assert.ok(candidate,`a version ${version} checkpoint can still be inspected for restore`);await candidate.release?.();
    assert.equal(runtime.repository.noteObject(older,legacyNoteKey('Ethics')),null,`a version ${version} checkpoint names notes by title, so it offers no earlier version of a note`);
  }
}
// Simulate another installation receiving this checkpoint rather than the publishing installation's newly established local ancestry.
reconciliationBase=null;reconciliationBaseNotes=Object.create(null);

// Managed inspection must feed the private verified-snapshot path directly. It must not materialize or reopen a temporary portable container.
// The attachment is absent locally here, so the candidate reads it from the repository under a lease.
const localAssetsBeforeLeaseCheck=new Map(assets);assets.clear();
const managedPortableBefore=freeze({...portablePathMetrics}),candidate=await runtime.repository.inspect(manifest,leasedReadObject,{interactive:false,committed:true});
assert.equal(portablePathMetrics.containers,managedPortableBefore.containers,'Managed repository inspection must not encode a temporary .sdbackup container.');
assert.equal(portablePathMetrics.inspections,managedPortableBefore.inspections,'Managed repository inspection must not reopen/decode a temporary .sdbackup container.');
assert.equal(candidate.kind,'study-director.backup-candidate');assert.equal(candidate.preview.formatVersion,21);assert.equal(candidate.preview.reconciliationCapable,true);assert.equal(candidate.preview.encrypted,true,'repository-source encryption state must survive the internal verified-snapshot boundary');assert.equal(candidate.preview.authenticated,true);assert.equal(candidate.preview.checkpoint.checkpointId,checkpointId);
for(const objectId of attachmentObjectIds)assert.equal(leaseReleaseCounts.get(objectId)||0,0,'Managed candidate inspection must retain verified attachment leases until candidate restore/release.');
const forgedCandidate=freeze({kind:'study-director.backup-candidate',verified:true,preview:candidate.preview,release:async()=>{}});
await assert.rejects(()=>runtime.repository.bringIn(forgedCandidate),/current verified Study Director inspection/i,'A look-alike candidate must not cross the private verified-snapshot seal.');

// Standalone file creation/inspection must continue to use the unchanged portable format and decoder.
const standalone=await runtime.checkpoint.create(),standaloneContainers=portablePathMetrics.containers,standaloneInspections=portablePathMetrics.inspections,standaloneCandidate=await runtime.checkpoint.inspect(standalone.blob,{filename:standalone.filename});
assert.ok(standaloneContainers>managedPortableBefore.containers,'Standalone checkpoint creation must still encode the portable .sdbackup format.');
assert.ok(portablePathMetrics.inspections>standaloneInspections,'Standalone .sdbackup inspection must still use the portable decoder.');
await standaloneCandidate.release();await standalone.release();

for(const [id,blob] of localAssetsBeforeLeaseCheck)assets.set(id,blob);
// Replace local state, then prove the unified reconciliation path restores from the repository candidate without a parallel conflict engine.
records=[];notes={};assets.clear();currentPersonal=localPersonal;deletions=[];
const result=await runtime.repository.bringIn(candidate);
assert.equal(preparationRebaseCalls,1,'Successful managed Combine must atomically rebase backup acceleration metadata before later publication.');
assert.equal(result.mode,'reconcile');assert.equal(result.added,1);assert.equal(result.assetsRestored,1);assert.equal(result.notesReconciled,true);assert.equal(records[0].reflection,'repository reflection');assert.equal(notes.Ethics.text,'repository note');assert.equal(currentPersonal.preferences.studentName,'Repository Source');assert.equal(deletions[0].date,'2026-09-17');assert.equal(await codec.checksumBlob(assets.get(assetId)),imageHash);assert.equal(journal,null,'successful reconciliation must clear its rollback journal');
for(const objectId of attachmentObjectIds)assert.equal(leaseReleaseCounts.get(objectId),1,'Managed candidate restore must release each retained repository attachment lease exactly once.');

// After browser data is cleared, a missing-only Combine adds back Saved Days and
// attachments without asking and leaves the rescued notes, plans and session alone.
{
  const saved={records,notes,assets:new Map(assets),currentPersonal,deletions,activeSession,scheduleText};
  const rescuedSession=freeze({id:'current',type:'activeSession',version:9,revision:3,date:'2026-09-20',status:'active',scheduleText:'11:00 | 60 | Rescued | work | Ethics | block | 1',snapshot:freeze({label:'rescued'}),suspendedAt:null,updatedAt:'2026-09-20T05:00:00.000Z'});
  const rescuedNotes={Ethics:normalizeArea({key:'Ethics',text:'written after clearing',updatedAt:'2026-09-20T05:00:00.000Z'},'Ethics')};
  records=[];notes={...rescuedNotes};assets.clear();currentPersonal=localPersonal;deletions=[];activeSession=rescuedSession;scheduleText=rescuedSession.scheduleText;
  const missing=await runtime.repository.bringIn(await runtime.repository.inspect(manifest,readObject,{interactive:false,committed:true}),{missingOnly:true});
  assert.equal(missing.cancelled,false);assert.equal(missing.added,1);assert.equal(missing.assetsRestored,1);
  assert.deepEqual(records.map(row=>[row.date,row.reflection]),[['2026-09-18','repository reflection']],'the missing Saved Day comes back');
  assert.deepEqual(notes,rescuedNotes,'rescued notes are never replaced by the backup');
  assert.equal(activeSession,rescuedSession,'today’s session is untouched');assert.equal(scheduleText,rescuedSession.scheduleText);
  assert.deepEqual(currentPersonal,localPersonal,'rescued plans and settings stay as they are');
  // A difference that needs a choice stops before anything changes.
  records=[freeze({version:16,recordKind:'study',date:'2026-09-18',reflection:'local different day',savedAt:'2026-09-20T01:00:00.000Z',updatedAt:'2026-09-20T01:00:00.000Z'})];assets.clear();
  const undecided=await runtime.repository.bringIn(await runtime.repository.inspect(manifest,readObject,{interactive:false,committed:true}),{missingOnly:true});
  assert.equal(undecided.cancelled,true);assert.equal(undecided.reason,'needs-decision');
  assert.equal(records[0].reflection,'local different day');assert.equal(assets.size,0,'nothing is added when a decision is needed');
  ({records,notes,currentPersonal,deletions,activeSession,scheduleText}=saved);assets.clear();for(const [id,blob] of saved.assets)assets.set(id,blob);
}

// A restore reads attachments already on this device (same size and checksum,
// hashed again here) from local storage instead of the backup location;
// verifying the backup copy itself still reads every attachment object.
{
  const attachmentEntries=manifest.objects.filter(entry=>entry.kind==='attachment'),readIds=new Set(),countingReader=async entry=>{readIds.add(entry.objectId);return readObject(entry);};
  assert.ok(attachmentEntries.length>0);const savedAssets=new Map(assets);
  assets.clear();assets.set(assetId,image);
  const local=await runtime.repository.inspect(manifest,countingReader,{interactive:false,committed:true});
  assert.ok(attachmentEntries.every(entry=>!readIds.has(entry.objectId)),'an attachment already here is not downloaded again');await local.release();
  readIds.clear();assets.clear();
  const remote=await runtime.repository.inspect(manifest,countingReader,{interactive:false,committed:true});
  assert.ok(attachmentEntries.every(entry=>readIds.has(entry.objectId)),'a missing attachment is read from the backup');await remote.release();
  readIds.clear();assets.set(assetId,new Blob([new Uint8Array([1,2,3])],{type:'image/png'}));
  const different=await runtime.repository.inspect(manifest,countingReader,{interactive:false,committed:true});
  assert.ok(attachmentEntries.every(entry=>readIds.has(entry.objectId)),'a local file with different bytes is never used');await different.release();
  readIds.clear();assets.clear();assets.set(assetId,image);
  await runtime.repository.verifyCheckpoint(manifest,countingReader,{interactive:false});
  assert.ok(attachmentEntries.every(entry=>readIds.has(entry.objectId)),'verifying the backup copy reads its own attachment objects');
  assets.clear();for(const [id,blob] of savedAssets)assets.set(id,blob);
}

// Restoring one note from a backup version reviews only that note, always side
// by side, and leaves Saved Days, other notes, settings, attachments and the
// shared reconciliation base exactly as they are.
{
  const saved={records,notes,assets:new Map(assets),currentPersonal,deletions,activeSession,scheduleText,reconciliationBase};
  const localRecords=[freeze({version:16,recordKind:'study',date:'2026-09-18',reflection:'local different day',savedAt:'2026-09-21T01:00:00.000Z',updatedAt:'2026-09-21T01:00:00.000Z'})],localBase=freeze({format:'study-director.reconciliation-base',version:2,checkpointId:'cp_'+'7'.repeat(32),establishedAt:'2026-09-21T00:00:00.000Z',noteCount:1,noteKeyFingerprint:'0'.repeat(64)});
  const otherNote=normalizeArea({key:'Other',text:'other note',updatedAt:'2026-09-21T00:00:00.000Z'},'Other'),editedAt='2099-01-01T00:00:00.000Z';
  records=[...localRecords];notes={Ethics:normalizeArea({key:'Ethics',text:'paragraph lost by mistake',updatedAt:editedAt},'Ethics'),Other:otherNote};assets.clear();currentPersonal=localPersonal;deletions=[];reconciliationBase=localBase;
  const callsBefore=noteReconciliationCalls;noteChoice=conflict=>conflict.incomingValue;
  // Only the objects holding the note (and images its text uses) are read.
  const objectsRead=new Set(),countingReader=async entry=>{objectsRead.add(entry.objectId);return readObject(entry);},noteRead=()=>runtime.repository.inspect(manifest,countingReader,{interactive:false,committed:true,note:'Ethics'});
  const scoped=await noteRead();
  assert.ok(objectsRead.size>=1&&objectsRead.size<new Set(manifest.objects.map(entry=>entry.objectId)).size,`a one-note read fetches ${objectsRead.size} of ${manifest.objects.length} objects`);
  assert.ok(manifest.objects.filter(entry=>entry.kind==='attachment').every(entry=>!objectsRead.has(entry.objectId)),'images the note does not use are not read');
  await assert.rejects(()=>runtime.repository.bringIn(scoped),/read for one note only/u,'a one-note read never combines the whole version');
  await assert.rejects(async()=>runtime.repository.restoreVersion(await noteRead()),/read for one note only/u,'nor replaces current data');
  const restored=await runtime.repository.bringIn(await noteRead(),{note:'Ethics'});
  assert.equal(restored.cancelled,false);assert.equal(restored.notesReconciled,true);assert.equal(noteReconciliationCalls,callsBefore+1);
  assert.deepEqual(lastNoteConflicts.map(item=>item.key),['Ethics'],'only the chosen note is reviewed');assert.equal(lastNoteConflicts[0].ancestorAvailable,false,'the two texts are always shown side by side');assert.match(lastNoteConflicts[0].incomingLabel,/^Backup from /u);
  assert.equal(notes.Ethics.text,'repository note');assert.ok(Date.parse(notes.Ethics.updatedAt)>Date.parse(editedAt),'the restored text is a new edit with a newer revision');
  assert.equal(notes.Other,otherNote,'other notes are untouched');assert.deepEqual(records,localRecords,'Saved Days are untouched');assert.deepEqual(deletions,[],'no Saved-Day deletion comes back');
  assert.deepEqual(currentPersonal,localPersonal);assert.equal(assets.size,0,'Attachment Library items are not brought in by a one-note restore');assert.equal(reconciliationBase,localBase,'an older version restored for one note is not a new shared base');
  // Nothing to do: the same text, a note the backup lacks, or keeping the current text.
  const unchanged=await runtime.repository.bringIn(await noteRead(),{note:'Ethics'});
  assert.equal(unchanged.cancelled,true);assert.equal(unchanged.reason,'note-unchanged');assert.equal(noteReconciliationCalls,callsBefore+1);
  const absent=await runtime.repository.bringIn(await runtime.repository.inspect(manifest,readObject,{interactive:false,committed:true,note:'Other'}),{note:'Other'});
  assert.equal(absent.cancelled,true);assert.equal(absent.reason,'note-missing');assert.equal(notes.Other,otherNote);
  const current=normalizeArea({key:'Ethics',text:'keep this',updatedAt:editedAt},'Ethics');notes={...notes,Ethics:current};noteChoice=null;
  const kept=await runtime.repository.bringIn(await noteRead(),{note:'Ethics'});
  assert.equal(kept.cancelled,true);assert.equal(kept.reason,'note-kept');assert.equal(notes.Ethics,current);
  ({records,notes,currentPersonal,deletions,activeSession,scheduleText,reconciliationBase}=saved);assets.clear();for(const [id,blob] of saved.assets)assets.set(id,blob);
}

// A lagging device may sit far behind the incoming checkpoint's direct parent. Three-way note reconciliation must use any reachable ancestry ID carried by the managed checkpoint, not a shallow retention-derived prefix.
const deepAncestorCount=runtime.repository.retention.normalLimit+runtime.repository.retention.protectedLimit+4,deepAncestorIds=freeze(Array.from({length:deepAncestorCount},(_,index)=>'cp_'+String(1500+index).padStart(32,'0'))),directParentId=deepAncestorIds[0],laggedBaseId=deepAncestorIds.at(-1),laggedManifest=freeze({...manifest,reconciliationBaseId:directParentId,reconciliationAncestorIds:deepAncestorIds});
reconciliationBaseNotes=Object.assign(Object.create(null),{Ethics:'common ancestor note'});reconciliationBase=freeze({format:'study-director.reconciliation-base',version:2,checkpointId:laggedBaseId,establishedAt:new Date().toISOString(),noteCount:1,noteKeyFingerprint:'0'.repeat(64)});notes={Ethics:normalizeArea({key:'Ethics',text:'local descendant note',updatedAt:'2026-09-19T00:01:00.000Z'},'Ethics')};lastNoteConflicts=[];
const laggedCandidate=await runtime.repository.inspect(laggedManifest,readObject,{interactive:false,committed:true});await runtime.repository.bringIn(laggedCandidate);
assert.equal(lastNoteConflicts.length,1,'A deeply lagging device must still reach note reconciliation when local and incoming descendants diverge.');
assert.equal(lastNoteConflicts[0].ancestorAvailable,true,'The managed ancestry chain must prove a common ancestor even beyond the current managed-history retention capacity.');
assert.equal(lastNoteConflicts[0].ancestorValue,'common ancestor note','Three-way reconciliation must receive the exact hidden local baseline note from the deep common ancestor.');assert.deepEqual(reconciliationBaseNoteReadKeys.at(-1),['Ethics'],'Bring-in must load reconciliation ancestor text only for the actually conflicted note.');
assert.equal(notes.Ethics.text,'local descendant note','The test resolver keeps local text while proving ancestor delivery; ancestor lookup itself must not mutate the note.');
await laggedCandidate.release();

// A proven ancestor checkpoint with a missing per-note row must fail closed for that note rather than inventing an empty ancestor.
reconciliationBaseNotes=Object.create(null);reconciliationBase=freeze({format:'study-director.reconciliation-base',version:2,checkpointId:laggedBaseId,establishedAt:new Date().toISOString(),noteCount:1,noteKeyFingerprint:'0'.repeat(64)});notes={Ethics:normalizeArea({key:'Ethics',text:'local descendant note',updatedAt:'2026-09-19T00:02:00.000Z'},'Ethics')};lastNoteConflicts=[];
const missingAncestorCandidate=await runtime.repository.inspect(laggedManifest,readObject,{interactive:false,committed:true});await runtime.repository.bringIn(missingAncestorCandidate);assert.equal(lastNoteConflicts.length,1);assert.equal(lastNoteConflicts[0].ancestorAvailable,false,'A missing V2 reconciliation note row must disable automatic ancestor merge for that note.');assert.equal(notes.Ethics.text,'local descendant note');await missingAncestorCandidate.release();

// Managed Version Restore is a distinct exact-replacement operation: checkpoint portable scope wins completely, without reconciliation.
const extraAssetId='img-abcdefghijklmnopqrstuvwx',deletedAssetId='img-zyxwvutsrqponmlkjihgfedc',extraBlob=new Blob([new Uint8Array([9,8,7,6])],{type:'image/png'});
records=[freeze({version:16,recordKind:'study',date:'2026-09-18',reflection:'local divergent version',savedAt:'2026-09-19T02:00:00.000Z',updatedAt:'2026-09-19T02:00:00.000Z'}),freeze({version:16,recordKind:'study',date:'2026-09-20',reflection:'local only must disappear',savedAt:'2026-09-20T02:00:00.000Z',updatedAt:'2026-09-20T02:00:00.000Z'})];
notes={Ethics:normalizeArea({key:'Ethics',text:'local divergent note',updatedAt:'2026-09-20T02:00:00.000Z'},'Ethics'),LocalOnly:normalizeArea({key:'LocalOnly',text:'must disappear',updatedAt:'2026-09-20T02:00:00.000Z'},'LocalOnly')};
activeSession=freeze({id:'current',type:'activeSession',version:9,revision:1,date:'2026-09-20',status:'suspended',scheduleText:'10:00 | 30 | Local active | work | Ethics | block | 1',snapshot:freeze({label:'local'}),suspendedAt:'2026-09-20T02:00:00.000Z',updatedAt:'2026-09-20T02:00:00.000Z'});scheduleText=activeSession.scheduleText;
currentPersonal=localPersonal;deletions=[freeze({date:'2026-09-16',deletedAt:'2026-09-20T02:00:00.000Z'})];noteDeletions=[freeze({key:'DeletedLocalNote',deletedAt:'2026-09-20T02:00:00.000Z'})];attachmentDeletions=[freeze({assetId:deletedAssetId,deletedAt:'2026-09-20T02:00:00.000Z'})];assets=new Map([[assetId,image],[extraAssetId,extraBlob]]);
const noteCallsBeforeExact=noteReconciliationCalls,rebasesBeforeExact=preparationRebaseCalls,exactCandidate=await runtime.repository.inspect(manifest,readObject,{interactive:false,committed:true}),exactResult=await runtime.repository.restoreVersion(exactCandidate);assert.equal(preparationRebaseCalls,rebasesBeforeExact+1,'Successful managed Replace must atomically rebase backup acceleration metadata before reporting success.');
assert.equal(exactResult.mode,'restore-version');assert.equal(exactResult.verified,true);assert.equal(exactResult.checkpointId,checkpointId);assert.deepEqual(records.map(row=>row.date),['2026-09-18'],'Version Restore must remove local-only Saved Days.');assert.equal(records[0].reflection,'repository reflection','Version Restore must replace divergent Saved Days instead of asking reconciliation.');assert.deepEqual(Object.keys(notes),['Ethics']);assert.equal(notes.Ethics.text,'repository note');assert.equal(activeSession,null,'A historical checkpoint with no Active Session must clear the current Active Session.');assert.equal(scheduleText,'','The restored portable plan/session schedule must match the checkpoint.');assert.deepEqual(currentPersonal,personalData,'Plans and portable Preferences must match the selected managed version exactly.');assert.deepEqual(deletions.map(row=>row.date),['2026-09-17']);assert.deepEqual(noteDeletions,[]);assert.deepEqual(attachmentDeletions,[],'Canonical deletion ledgers must be replaced rather than unioned.');assert.deepEqual([...assets.keys()],[assetId],'Attachment metadata/bytes absent from the selected version must be removed.');assert.equal(await codec.checksumBlob(assets.get(assetId)),imageHash);assert.equal(noteReconciliationCalls,noteCallsBeforeExact,'Exact Version Restore must bypass Ongoing Note reconciliation.');assert.equal(journal,null,'Successful exact restore must clear its persistent rollback journal.');assert.equal(reconciliationBase.checkpointId,checkpointId,'The restored checkpoint becomes the new reconciliation ancestry base without mutating repository history.');

// P7: exact Version Restore must also restore a historical Active Session when that version contains one.
const historicalSession=freeze({id:'current',type:'activeSession',version:9,revision:7,date:'2026-09-19',status:'suspended',scheduleText:'07:30 | 50 | Historical active | work | Ethics | block | 1',snapshot:freeze({label:'historical-active'}),suspendedAt:'2026-09-19T05:00:00.000Z',updatedAt:'2026-09-19T05:00:00.000Z'});activeSession=historicalSession;scheduleText=historicalSession.scheduleText;const sessionObjectFiles=new Map(objectFiles);let sessionManifestBlob=null,sessionCommitBlob=null;const sessionPublication=await runtime.repository.publish([manifest],{interactive:false},freeze({writeObject:async entry=>(sessionObjectFiles.set(entry.objectId,entry.blob),freeze({id:entry.objectId})),writeManifest:async file=>(sessionManifestBlob=file.blob,freeze({name:file.manifest.checkpoint.checkpointId+'.sdcheckpoint'})),commit:async marker=>(sessionCommitBlob=marker.blob,freeze({name:marker.checkpointId+'.sdcommit'})),onCommitted:async()=>null,cleanup:async()=>null,onFailure:async()=>null})),sessionManifest=sessionPublication.manifest,sessionReadObject=async entry=>sessionObjectFiles.get(entry.objectId)||null;assert.ok(sessionManifest.objects.some(entry=>entry.kind==='activeSession'),'A managed checkpoint containing an Active Session must persist an Active Session repository object.');assert.ok(sessionManifestBlob instanceof Blob&&sessionCommitBlob instanceof Blob);activeSession=null;scheduleText='';const sessionCandidate=await runtime.repository.inspect(sessionManifest,sessionReadObject,{interactive:false,committed:true}),sessionRestore=await runtime.repository.restoreVersion(sessionCandidate);assert.equal(sessionRestore.restored.activeSession,true);assert.deepEqual(activeSession,historicalSession,'Historical Version Restore must reinstate the checkpoint Active Session exactly.');assert.equal(scheduleText,historicalSession.scheduleText,'Historical Version Restore must reinstate the Active Session schedule coherently.');const resetCandidate=await runtime.repository.inspect(manifest,readObject,{interactive:false,committed:true});await runtime.repository.restoreVersion(resetCandidate);assert.equal(activeSession,null,'Restoring the original no-session historical version must still clear the restored session.');assert.equal(scheduleText,'');

// A managed provider Version Restore must keep the selected historical object immutable and append a fresh current checkpoint after local verification.
const remoteFiles=new Map(),readDownloads=[];let providerUploaded=false;
const remoteKey=(kind,id)=>`${kind}:${id}`;
for(const [objectId,blob] of objectFiles)remoteFiles.set(remoteKey('object',objectId),{kind:'object',id:objectId,name:objectId+'.sdobject',blob,createdAt:manifest.exportedAt});
remoteFiles.set(remoteKey('checkpoint',checkpointId),{kind:'checkpoint',id:checkpointId,name:checkpointId+'.sdcheckpoint',blob:publishedManifestBlob,createdAt:manifest.exportedAt,history:{logicalFingerprint:manifest.logicalFingerprint,exportedAt:manifest.exportedAt,counts:manifest.counts,encrypted:manifest.encrypted,retention:manifest.retention}});
remoteFiles.set(remoteKey('commit',checkpointId),{kind:'commit',id:checkpointId,name:checkpointId+'.sdcommit',blob:publishedCommitBlob,createdAt:manifest.exportedAt});
const originalHistoricalManifestBytes=new Uint8Array(await publishedManifestBlob.arrayBuffer());
let safetyMaintenancePolls=0,publicationCounter=0,foregroundPublicationActive=false,orphanRestoreMaintenance=false,orphanRestoreReaps=0;const safetyCoordinationEvents=[];
const providerTransport=freeze({
  list:async({kind})=>freeze({items:freeze([...remoteFiles.values()].filter(file=>file.kind===kind).map(file=>freeze({kind:file.kind,id:file.id,name:file.name,size:file.blob.size,createdAt:file.createdAt,modifiedAt:file.createdAt,...(file.history?{history:file.history}:{})}))),overflow:false}),
  upload:async file=>{providerUploaded=true;const stored={kind:file.kind,id:file.id,name:file.name,blob:file.blob,createdAt:file.exportedAt||new Date().toISOString(),history:file.historySummary||null};remoteFiles.set(remoteKey(file.kind,file.id),stored);return freeze({kind:file.kind,id:file.id,name:file.name,size:file.blob.size,createdAt:stored.createdAt,modifiedAt:stored.createdAt});},
  download:async item=>{if(item.kind==='object'&&!providerUploaded)readDownloads.push(item.id);const stored=remoteFiles.get(remoteKey(item.kind,item.id));if(!stored)throw new Error('missing provider fixture file');return stored.blob;},
  delete:async item=>remoteFiles.delete(remoteKey(item.kind,item.id)),
  beginPublication:async()=>{foregroundPublicationActive=true;safetyCoordinationEvents.push('publication-start');return freeze({id:`pub_${String(++publicationCounter).padStart(32,'0')}`,createdAt:new Date().toISOString()});},
  listPublications:async()=>freeze({items:freeze([]),ignored:0,overflow:false}),
  assertPublication:async()=>true,
  endPublication:async()=>{foregroundPublicationActive=false;safetyCoordinationEvents.push('publication-end');return true;},
  beginMaintenance:async()=>freeze({id:'mnt_00000000000000000000000000000000',createdAt:new Date().toISOString()}),
  listMaintenances:async()=>{safetyMaintenancePolls+=1;safetyCoordinationEvents.push(`maintenance-poll:${foregroundPublicationActive?'publication-active':'no-publication'}`);if(orphanRestoreMaintenance)return freeze({items:freeze([freeze({id:'mnt_orphan_restore',createdAt:new Date(Date.now()-61*1000).toISOString()})]),ignored:0,overflow:false});const active=safetyMaintenancePolls===1?freeze([freeze({id:'mnt_11111111111111111111111111111111',createdAt:new Date().toISOString()})]):freeze([]);return freeze({items:active,ignored:0,overflow:false});},
  assertMaintenance:async()=>true,
  endMaintenance:async lease=>{if(lease&&lease.id==='mnt_orphan_restore'){orphanRestoreMaintenance=false;orphanRestoreReaps+=1;}return true;},
  choose:async(_choices,options)=>{assert.equal(options.mode,'restore-version');return checkpointId;}
});
assert.equal(runtime.providers.register(freeze({id:'repository-version-qa',label:'Repository Version QA',repository:providerTransport})),true);
const managedProviderRecoveryEvents=[];
const providerManagedRecovery=ManagedRecoveryModule.createCoordinator(freeze({
  automaticBackup:freeze({suspend:async kind=>(managedProviderRecoveryEvents.push('suspend:'+kind),freeze({token:'provider-qa'})),resume:async token=>(managedProviderRecoveryEvents.push('resume:'+token.token),true)}),
  diagnostics:freeze({capture:()=>{},mark:()=>false}),
  lifecycle:freeze({settle:async kind=>{managedProviderRecoveryEvents.push('settle:'+kind);},quiesce:async operation=>{managedProviderRecoveryEvents.push('quiesce-enter');try{return await operation();}finally{managedProviderRecoveryEvents.push('quiesce-exit');}},revision:()=> '2026-09-19T00:00:00.000Z',rebuild:async kind=>{managedProviderRecoveryEvents.push('rebuild:'+kind);}}),
  mutation:freeze({run:async(_kind,operation)=>{managedProviderRecoveryEvents.push('mutation-enter');try{return await operation();}finally{managedProviderRecoveryEvents.push('mutation-exit');}}})
}));
runtime.providers.configureManagedRecovery(freeze({run:spec=>providerManagedRecovery.execute(spec)}));
records.push(freeze({version:16,recordKind:'study',date:'2026-09-20',reflection:'provider local-only',savedAt:'2026-09-20T04:00:00.000Z',updatedAt:'2026-09-20T04:00:00.000Z'}));
const providerRestore=await runtime.providers.restoreRepositoryProviderVersion('repository-version-qa',{checkpointId});assert.equal(providerRestore.mode,'restore-version');assert.ok(safetyMaintenancePolls>=2,'Cross-device Version Restore must observe maintenance yield before publishing the protected safety checkpoint.');assert.equal(safetyCoordinationEvents.find(event=>event.startsWith('maintenance-poll:')),'maintenance-poll:publication-active','Foreground recovery must publish its coordination marker before waiting for remote maintenance to yield.');assert.equal(nestedFileJobReentries,0,'Managed restore safety publication must not re-enter and await its own exclusive file job.');assert.equal(providerRestore.convergence.source.status,'completed');assert.equal(providerRestore.convergence.source.unchanged,true,'Exact same-provider Version Restore must recognize that the selected checkpoint already exists remotely.');assert.deepEqual([...providerRestore.convergence.others],[],'no other location backs up on its own here');assert.deepEqual(records.map(row=>row.date),['2026-09-18']);
const providerCheckpoints=[...remoteFiles.values()].filter(file=>file.kind==='checkpoint');assert.equal(providerCheckpoints.length,2,'Managed provider Version Restore must retain the selected history and append one protected Before restore checkpoint, without publishing a redundant identical current checkpoint.');assert.ok(providerCheckpoints.some(file=>file.id===checkpointId),'The selected historical checkpoint must remain available after restore.');const historicalAfter=remoteFiles.get(remoteKey('checkpoint',checkpointId)).blob;assert.deepEqual(new Uint8Array(await historicalAfter.arrayBuffer()),originalHistoricalManifestBytes,'Historical managed checkpoint bytes must never be rewritten by Version Restore.');const providerManifests=[];for(const file of providerCheckpoints)providerManifests.push(await runtime.repository.inspectManifest(file.blob,{interactive:false}));const protectedProvider=providerManifests.find(item=>item.retention?.role==='before-restore');assert.ok(protectedProvider,'Managed provider restore must publish a protected Before restore checkpoint before local replacement.');assert.ok(Date.parse(protectedProvider.retention.protectedUntil)>Date.parse(protectedProvider.exportedAt));assert.equal(providerManifests.filter(item=>item.retention?.role!=='before-restore'&&item.checkpoint.checkpointId!==checkpointId).length,0,'Exact same-provider restore must not append a duplicate normal checkpoint after local replacement.');assert.deepEqual(managedProviderRecoveryEvents,['mutation-enter','suspend:restore-version','quiesce-enter','settle:restore-version','quiesce-exit','quiesce-enter','settle:restore-version','rebuild:restore-version','quiesce-exit','mutation-exit','resume:provider-qa'],'Provider recovery must keep long external safety I/O outside the two short quiescence windows while preserving one shared mutation transaction.');
records.push(freeze({version:16,recordKind:'study',date:'2026-09-21',reflection:'orphan-marker local-only',savedAt:'2026-09-21T04:00:00.000Z',updatedAt:'2026-09-21T04:00:00.000Z'}));orphanRestoreMaintenance=true;const orphanMarkerRestore=await runtime.providers.restoreRepositoryProviderVersion('repository-version-qa',{checkpointId});assert.equal(orphanMarkerRestore.mode,'restore-version','Version Restore must recover in the same attempt when a maintenance lease has been abandoned');assert.equal(orphanRestoreReaps,1,'Version Restore must reap the expired maintenance lease instead of timing out repeatedly');assert.equal(orphanRestoreMaintenance,false);assert.deepEqual(records.map(row=>row.date),['2026-09-18']);

// Restoring one note from a Drive version downloads only the objects that
// hold the note, never the version's attachments or other data, and keeps
// today's session through the recovery.
{
  const savedChoice=noteChoice,attachmentIds=new Set(manifest.objects.filter(entry=>entry.kind==='attachment').map(entry=>entry.objectId));
  notes={...notes,Ethics:normalizeArea({key:'Ethics',text:'text after an accident',updatedAt:'2099-01-03T00:00:00.000Z'},'Ethics')};noteChoice=conflict=>conflict.incomingValue;readDownloads.length=0;providerUploaded=false;
  const noteRestore=await runtime.providers.bringInRepositoryProvider('repository-version-qa',{checkpointId,note:'Ethics'});
  assert.equal(noteRestore.cancelled,false);assert.equal(noteRestore.notesReconciled,true);assert.equal(notes.Ethics.text,'repository note');
  assert.ok(readDownloads.length>=1&&readDownloads.length<new Set(manifest.objects.map(entry=>entry.objectId)).size,`the note read downloaded ${readDownloads.length} of ${manifest.objects.length} objects`);
  assert.ok(readDownloads.every(id=>!attachmentIds.has(id)),'no attachment the note does not use is downloaded');
  noteChoice=savedChoice;
}

// After browser data is cleared, adding what is missing from Drive runs
// quietly only while Drive is connected (it never asks to sign in), uses the
// newest version saved before the clear, and changes nothing when none exists.
{
  const saved={records:[...records],assets:new Map(assets),notes:{...notes},deletions:[...deletions]},beforeClear='2099-01-01T00:00:00.000Z';
  assert.deepEqual({...await runtime.providers.bringInRepositoryProvider('repository-version-qa',{missingOnly:true,quiet:true,before:beforeClear})},{cancelled:true,reason:'not-connected'});
  assert.equal(runtime.providers.register(freeze({id:'repository-missing-qa',label:'Repository Missing QA',connected:()=>true,repository:providerTransport})),true);
  records=[];assets.clear();
  const added=await runtime.providers.bringInRepositoryProvider('repository-missing-qa',{missingOnly:true,quiet:true,before:beforeClear});
  assert.equal(added.cancelled,false);assert.equal(added.added,1);assert.deepEqual(records.map(row=>row.date),['2026-09-18'],'the missing Saved Day comes back');
  assert.ok(Date.parse(added.exportedAt)<Date.parse(beforeClear),'the version used was saved before the clear');
  records=[];
  const none=await runtime.providers.bringInRepositoryProvider('repository-missing-qa',{missingOnly:true,quiet:true,before:'2000-01-01T00:00:00.000Z'});
  assert.equal(none.cancelled,true);assert.equal(none.reason,'needs-decision');assert.deepEqual(records,[],'nothing changes without a version from before the clear');
  ({notes}=saved);records=saved.records;deletions=saved.deletions;assets.clear();for(const [id,blob] of saved.assets)assets.set(id,blob);
}

// The Device Folder runs on the same engine as Google Drive through its
// storage adapter: backup, Version History, a one-note restore and an exact
// restore all work on a folder, reading and writing the existing layout.
{
  const saved={records:[...records],notes:{...notes},assets:new Map(assets),deletions:[...deletions],currentPersonal};
  const folder=createMemoryDirectory(),deviceStorage=registry.require('device-folder-storage',1).createStorage(freeze({
    folder:()=>folder,identities:freeze({root:'Study-Director-Automatic-Backup-Repository',objects:'objects',checkpoints:'checkpoints',commits:'commits'}),
    checksum:async blob=>codec.checksumBlob(blob),inspectManifest:(file,options)=>runtime.repository.inspectManifest(file,options),
    environment:freeze({canMutate:()=>true,now:()=>Date.now(),setTimeout,clearTimeout,yieldTask:async()=>{}}),
    limits:freeze({publicationMaxAgeMs:24*3600000,publicationAssertionMarginMs:30*60000,maintenanceMaxAgeMs:60000,maintenanceAssertionMarginMs:30000,responseTimeoutMs:10000})
  }));
  assert.equal(runtime.providers.register(freeze({id:'device-folder-engine',label:'Device Folder',connected:()=>true,repository:deviceStorage})),true);
  notes={Ethics:normalizeArea({key:'Ethics',text:'folder version',updatedAt:'2026-09-21T01:00:00.000Z'},'Ethics')};
  const published=await runtime.providers.backupRepositoryProvider('device-folder-engine',{interactive:false});
  assert.match(published.checkpointId,/^cp_[a-f0-9]{32}$/u);
  const repositoryRoot=await folder.getDirectoryHandle('Study-Director-Automatic-Backup-Repository');
  assert.deepEqual((await repositoryRoot.getDirectoryHandle('checkpoints')).names(),[published.checkpointId+'.sdcheckpoint'],'the version lands in the existing folder layout');
  const history=await runtime.providers.history('device-folder-engine',{interactive:false});
  assert.equal(history.available,true);assert.deepEqual(history.entries.map(entry=>entry.location.checkpointId),[published.checkpointId]);assert.equal(history.entries[0].location.tier,'latest');
  notes={...notes,Ethics:normalizeArea({key:'Ethics',text:'changed after the folder backup',updatedAt:'2099-01-04T00:00:00.000Z'},'Ethics')};noteChoice=conflict=>conflict.incomingValue;
  const noteRestore=await runtime.providers.bringInRepositoryProvider('device-folder-engine',{checkpointId:published.checkpointId,note:'Ethics'});noteChoice=null;
  assert.equal(noteRestore.cancelled,false);assert.equal(notes.Ethics.text,'folder version');
  ({records,notes,deletions,currentPersonal}=saved);assets.clear();for(const [id,blob] of saved.assets)assets.set(id,blob);
}

// An integrity-valid but unpublished repository manifest is not eligible for historical restore.
const uncommittedCandidate=await runtime.repository.inspect(manifest,readObject,{interactive:false});await assert.rejects(()=>runtime.repository.restoreVersion(uncommittedCandidate),/verified Device Folder or Google Drive backup/i);

// Standalone file candidates remain outside managed Version History and cannot invoke exact managed rollback.
const manualFile=await runtime.checkpoint.create(),manualCandidate=await runtime.checkpoint.inspect(manualFile.blob,{interactive:false});await assert.rejects(()=>runtime.repository.restoreVersion(manualCandidate),/only for a verified Device Folder or Google Drive backup/i);await manualFile.release();

// Failure after destructive replacement begins must recover the exact pre-operation local state from the persistent journal.
records=[freeze({version:16,recordKind:'study',date:'2026-09-20',reflection:'rollback record',savedAt:'2026-09-20T03:00:00.000Z',updatedAt:'2026-09-20T03:00:00.000Z'})];notes={Rollback:normalizeArea({key:'Rollback',text:'rollback note',updatedAt:'2026-09-20T03:00:00.000Z'},'Rollback')};currentPersonal=localPersonal;deletions=[freeze({date:'2026-09-16',deletedAt:'2026-09-20T03:00:00.000Z'})];noteDeletions=[freeze({key:'Old',deletedAt:'2026-09-20T03:00:00.000Z'})];attachmentDeletions=[freeze({assetId:deletedAssetId,deletedAt:'2026-09-20T03:00:00.000Z'})];assets=new Map([[extraAssetId,extraBlob]]);activeSession=null;scheduleText='09:00 | 45 | Local plan | work | Ethics | block | 1';
const rollbackAssetProof=Object.fromEntries(await Promise.all([...assets].map(async([id,blob])=>[id,freeze({size:blob.size,type:blob.type,checksum:await codec.checksumBlob(blob)})]))),deviceLocalSentinel=freeze({installationId:'device-local-installation',systemAlertsEnabled:true,keepScreenAwake:true,storageHealth:'healthy',pwaUpdateState:'idle'});
const rollbackBefore=JSON.stringify({records,notes,currentPersonal,deletions,noteDeletions,attachmentDeletions,assetIds:[...assets.keys()],scheduleText});failExactNotes=true;const failingCandidate=await runtime.repository.inspect(manifest,readObject,{interactive:false,committed:true});await assert.rejects(()=>runtime.repository.restoreVersion(failingCandidate),/injected exact note replacement failure/);assert.equal(JSON.stringify({records,notes,currentPersonal,deletions,noteDeletions,attachmentDeletions,assetIds:[...assets.keys()],scheduleText}),rollbackBefore,'Failed Version Restore must recover the exact pre-operation portable state.');const rollbackAssetProofAfter=Object.fromEntries(await Promise.all([...assets].map(async([id,blob])=>[id,freeze({size:blob.size,type:blob.type,checksum:await codec.checksumBlob(blob)})])));assert.deepEqual(rollbackAssetProofAfter,rollbackAssetProof,'Failed Version Restore rollback must recover attachment bytes, MIME type and size—not merely attachment IDs.');assert.deepEqual(deviceLocalSentinel,freeze({installationId:'device-local-installation',systemAlertsEnabled:true,keepScreenAwake:true,storageHealth:'healthy',pwaUpdateState:'idle'}),'Managed Version Restore must have no device-local mutation surface.');assert.equal(journal,null,'Successful rollback after failed Version Restore must clear the persistent journal.');

// Concurrent publication failure must still expose successful sibling writes to failure cleanup.
notes={...notes,CleanupProbe:normalizeArea({key:'CleanupProbe',text:'concurrent cleanup probe',updatedAt:'2026-09-20T03:05:00.000Z'},'CleanupProbe')};
let concurrentWriteAttempt=0,concurrentFailureWritten=-1;
await assert.rejects(()=>runtime.repository.publish([manifest],{interactive:false},freeze({
  writeObject:async entry=>{const attempt=++concurrentWriteAttempt;if(attempt===1){await new Promise(resolve=>setTimeout(resolve,12));throw new Error('injected concurrent publication failure');}await new Promise(resolve=>setTimeout(resolve,2));return freeze({id:entry.objectId});},
  writeManifest:async()=>{throw new Error('manifest must not be reached after object failure');},commit:async()=>null,onCommitted:async()=>null,cleanup:async()=>null,
  onFailure:async(_error,context)=>{concurrentFailureWritten=context.written.length;}
})),/injected concurrent publication failure/);
assert.ok(concurrentFailureWritten>0,'Concurrent publication failure cleanup must receive successful sibling object receipts instead of orphaning them invisibly.');

// Stored-byte corruption must fail before any current v20 candidate can be created.
const damagedEntry=manifest.objects.find(entry=>entry.kind!=='attachment'),original=objectFiles.get(damagedEntry.objectId),bytes=new Uint8Array(await original.arrayBuffer());bytes[bytes.length-1]^=1;objectFiles.set(damagedEntry.objectId,new Blob([bytes]));
await assert.rejects(()=>runtime.repository.inspect(manifest,readObject,{interactive:false,committed:true}),/read-back verification|checksum|fingerprint|integrity/i);await assert.rejects(()=>runtime.repository.verifyCheckpoint(manifest,readObject,{interactive:false}),/read-back verification|checksum|fingerprint|integrity/i,'Deep protected-checkpoint verification must reject a corrupted reused object before managed recovery can apply local mutation.');
objectFiles.set(damagedEntry.objectId,original);
// Missing objects likewise fail closed.
objectFiles.delete(damagedEntry.objectId);await assert.rejects(()=>runtime.repository.inspect(manifest,readObject,{interactive:false,committed:true}),{code:'REPOSITORY_OBJECT_MISSING'});

console.log(JSON.stringify({status:'PASS',suite:'repository-restore-adapter',repositoryToPortableCurrent:true,checkpointProvenancePreserved:true,managedPortableRoundTripRemoved:true,unforgeableVerifiedSnapshot:true,attachmentLeaseLifetimeBound:true,encryptedRepositoryRestored:true,existingInspectionCandidate:true,existingReconciliationEngine:true,exactVersionRestore:true,providerRestoreAvoidsRedundantPresent:true,recoverySafetyForegroundPreemptsMaintenance:true,orphanMaintenanceRestoreRecovery:true,historicalCheckpointImmutable:true,uncommittedManifestRejected:true,standaloneFileExcluded:true,failedExactRestoreRolledBack:true,rollbackAttachmentBytesExact:true,historicalActiveSessionRestored:true,deviceLocalPreserved:true,attachmentIntegrity:true,storedCorruptionRejected:true,missingObjectRejected:true,boundedStructuredRestoreReads:true,concurrentFailureReceipts:true},null,2));
