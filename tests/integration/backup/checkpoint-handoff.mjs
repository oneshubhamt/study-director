import {createBackupPresentation} from '../../helpers/backup-presentation.mjs';
import {RUNTIME_DATA_CONTRACT} from '../../../contracts/canonical-identities.mjs';
import {createProcessingEngine} from '../../helpers/file-processing.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
for(const file of ['source/core/internal.js','source/core/operation-lifecycle.js','source/core/record-codecs.js','source/core/backup-codec.js','source/core/canonical.js','source/core/reconciliation.js','source/core/managed-repository.js','source/core/repository-policy.js','source/core/repository-background.js','source/core/backup-provider.js','source/core/backup-capture.js','source/core/backup.js'])vm.runInThisContext(read(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
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
const processing=freeze({...createProcessingEngine(),scope:operation=>operation()});
const limits=freeze({
  backupChunkItems:10,backupChunkTargetBytes:65536,backupMaxEntryBytes:65536,backupMaxLineBytes:262144,
  backupMaxCompressedBytes:4*1024*1024,backupMaxFileBytes:16*1024*1024,backupMaxUncompressedBytes:8*1024*1024,
  backupMaxAssetDescriptors:100,richAssetMaxBytes:8*1024*1024,maxBackupChunks:1000,importBytes:4*1024*1024,
  maxImportRecords:100,maxOngoingNotes:100,maxLegacyImportTombstones:100,maxImportReflectionDrafts:100,maxReflectionChars:10000
});
const dataContract=RUNTIME_DATA_CONTRACT;
const defs=freeze({
  dailyRecord:freeze({idField:'date',backupLimit:limits.maxImportRecords}),areaNote:freeze({idField:'key',backupLimit:limits.maxOngoingNotes}),
  activeSession:freeze({idField:'id',backupLimit:1})
});
const isDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
const normalizeTimestamp=value=>Number.isFinite(Date.parse(String(value||'')))?new Date(value).toISOString():null;
const normalizeArea=(item,key)=>item&&String(key||item.key||'')?freeze({version:2,key:String(key||item.key),text:String(item.text||''),updatedAt:normalizeTimestamp(item.updatedAt)||'2026-08-01T00:00:00.000Z'}):null;
const normalizeDrafts=value=>(Array.isArray(value)?value:[]).filter(item=>item&&isDate(item.date)).map(item=>freeze({...item,version:1,date:String(item.date),reflection:String(item.reflection||''),revision:Number(item.revision)||0,sessionRevision:Number(item.sessionRevision)||0,updatedAt:normalizeTimestamp(item.updatedAt)||'2026-08-01T00:00:00.000Z'})).sort((a,b)=>a.date.localeCompare(b.date));
const dailyRecordCodec=freeze({
  sanitizeHistoricalDailyRecord:item=>item&&isDate(item.date)?freeze({...item}):null,
  canonicalizeHistoricalDailyRecord:item=>item&&isDate(item.date)?freeze({...item,version:15}):null,
  sanitizeCurrentDailyRecord:item=>item&&isDate(item.date)?freeze({...item,version:16,recordKind:'study',date:String(item.date)}):null,
  sanitizeImportedAreaNote:normalizeArea,sanitizeCurrentAreaNote:normalizeArea,isSupportedSavedDate:isDate
});
const activeSessionCodec=freeze({sanitizeCurrent:item=>item&&item.id==='current'?freeze({...item,version:9}):null});
const reflectionDraftCodec=freeze({format:'study-director.reflection-draft-codec',contractVersion:1,sanitizeCurrent:item=>item&&isDate(item.date)?freeze({...item,version:1,date:String(item.date),reflection:String(item.reflection||''),revision:Number(item.revision)||0,sessionRevision:Number(item.sessionRevision)||0,updatedAt:normalizeTimestamp(item.updatedAt)||'2026-08-01T00:00:00.000Z'}):null});
const compatibilityCodec=freeze({format:'study-director.compatibility-codecs',contractVersion:1,dailyRecord:item=>dailyRecordCodec.canonicalizeHistoricalDailyRecord(item),areaNote:normalizeArea,activeSession:item=>activeSessionCodec.sanitizeCurrent(item),reflectionDraft:item=>reflectionDraftCodec.sanitizeCurrent(item),personalData:item=>{if(!item||typeof item!=='object'||![1,2].includes(Number(item.version)))throw new Error('Unsupported legacy personal-data version.');const p=item.preferences||{};return {version:2,plans:item.plans,preferences:{studentName:p.studentName??null,theme:p.theme??null,presentation:p.presentation??null,quote:p.quote??null,practiceCueMode:p.practiceCueMode??null,fontScale:p.fontScale??null,practiceTargetMs:p.practiceTargetMs??null,nudge:p.nudge??null}};}});
const keyedRecord=freeze({create:()=>Object.create(null)});
const entityDefinition=type=>defs[type]||null,entityIdentity=(type,item)=>String(item?.[defs[type]?.idField]||'');
const boundedInt=(value,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={})=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;};
const jsonByteLength=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).byteLength;
const personalDataCodec=RecordCodecs.createPersonalDataCodec(limits);
const codec=BackupCodecs.createBackupCodec(freeze({personalDataCodec,processing,
  appConfig:freeze({appName:'Study Director',attribution:'Study Director'}),limits,dataContract,legacy:freeze({schemaVersion:3,tombstoneLimit:limits.maxLegacyImportTombstones}),entityTypes:freeze(Object.keys(defs)),keyedRecord,
  entities:freeze({entityDefinition,entityIdentity}),helpers:freeze({boundedInt,jsonByteLength}),
  richText:freeze({assetIds:()=>freeze([]),assetIdValid:value=>/^img-[A-Za-z0-9_-]{16,128}$/.test(String(value||'')),imageMimeTypeValid:value=>['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(String(value||''))}),
  dailyRecordCodec,activeSessionCodec,compatibilityCodec
}));
const runtimeCodec=freeze({...codec,inspect:codec.inspectCurrent});
const personal=(name='Checkpoint User')=>freeze({version:2,plans:freeze({draft:null,savedPlans:freeze([]),defaultId:null}),preferences:freeze({studentName:name,theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null})});
const record=(date,reflection,updatedAt='2026-08-20T12:00:00.000Z')=>freeze({version:16,recordKind:'study',date,reflection,studyQuality:4,savedAt:updatedAt,updatedAt});
const session=(date,label)=>freeze({id:'current',type:'activeSession',version:9,revision:2,date,status:'suspended',scheduleText:`08:00 | 60 | ${label} | work | Ethics | block | 1`,snapshot:freeze({label}),suspendedAt:'2026-08-20T13:00:00.000Z',updatedAt:'2026-08-20T13:00:00.000Z'});
const draft=(date,text,revision=1,updatedAt='2026-08-20T12:00:00.000Z')=>freeze({version:1,date,reflection:text,studyQuality:3,revision,sessionRevision:0,updatedAt});

async function makeCheckpoint({records=[],deletions=[],areaNotes={},noteDeletions=[],activeSession=null,personalData=personal(),installationId='inst_checkpoint_a',exportedAt='2026-08-20T14:00:00.000Z'}={}){
  const counts=codec.countShape({checkpointManifest:1,personalData:1,dailyRecord:records.length,areaNote:Object.keys(areaNotes).length,activeSession:activeSession?1:0});
  const plan=freeze({studentName:'Checkpoint User',installationId,exportedAt,sourceRevision:exportedAt,recordDates:freeze(records.map(item=>item.date).sort()),savedDayDeletions:freeze(deletions),areaNoteItems:freeze(Object.values(areaNotes)),areaNoteDeletions:freeze(noteDeletions),counts});
  const algorithm=codec.checksumAlgorithm(),manifest=codec.createManifest(plan,{compression:'none',algorithm});
  let seq=0;const hashes=[],lines=[JSON.stringify(manifest)];
  const add=async(type,items)=>{if(!items.length)return;const chunk=await codec.encodeChunk(seq++,type,items,algorithm);hashes.push(chunk.checksum);lines.push(chunk.line);};
  await add('checkpointManifest',[codec.createProtectedManifest(plan,manifest.checkpoint)]);
  await add('dailyRecord',records);
  await add('areaNote',Object.values(areaNotes));
  if(activeSession)await add('activeSession',[activeSession]);
  await add('personalData',[personalData]);
  const complete=await codec.encodeCompletion(seq,counts,hashes,algorithm,[]);lines.push(JSON.stringify(complete));
  return codec.createV10Container(new Blob([lines.join('\n')+'\n']),{compression:'none',assetBlobs:[]});
}

function createState({withActive=false}={}){
  return {
    records:new Map([
      ['2026-08-01',record('2026-08-01','local only','2026-08-21T12:00:00.000Z')],
      ['2026-08-02',record('2026-08-02','local conflict newer','2026-08-22T12:00:00.000Z')],
      ['2026-08-03',record('2026-08-03','local should survive import','2026-08-22T13:00:00.000Z')]
    ]),
    deletions:[{date:'2026-08-04',deletedAt:'2026-08-22T14:00:00.000Z'}],
    noteDeletions:[],
    notes:{Local:freeze({version:2,key:'Local',text:'local note',updatedAt:'2026-08-22T10:00:00.000Z'})},
    activeSession:withActive?session('2026-08-10','LOCAL'):null,
    schedule:withActive?'08:00 | 60 | LOCAL | work | Ethics | block | 1':'',
    personal:personal('Local User'),journal:null
  };
}

function createHarness(state,{decisions={},noteResolver=null,restoredFromFile=null,hasLiveTasks=false,fileMode='combine',preflightFailure=''}={}){
  state.deletions??=[];state.noteDeletions??=[];state.attachmentDeletions??=[];
  let injectedFailure=String(preflightFailure||'');
  const prompts=[];const statuses=[];const events=[];const diagnosticMarks=[];const fn=()=>false;
  const normalizeNotes=value=>Object.fromEntries(Object.entries(value||{}).map(([key,item])=>[key,normalizeArea(item,key)]).filter(([,item])=>item));
  // The file row shows the 'file' presentation's current message; record each one it shows.
  const presentation=createBackupPresentation();
  presentation.subscribe(()=>{const message=presentation.current('file')?.message||'';if(message&&statuses.at(-1)!==message)statuses.push(message);});
  const runtime=BackupModule.createRuntime(freeze({ports:freeze({
    configuration:freeze({appVersion:'QA_B3',backupVersion:RUNTIME_DATA_CONTRACT.schemas.Backup.version,limits}),
    
    persistence:freeze({
      activeSessionLoad:async()=>{if(injectedFailure==='session-read')return {ok:false,value:null,error:new Error('QA_FIXTURE session read failure'),storage:{idb:true}};return {ok:true,value:state.activeSession,error:null,storage:{idb:true}};},activeSessionSave:async value=>{events.push('preflight-session-save');if(injectedFailure==='session-save')return {ok:false,value:null,error:new Error('QA_FIXTURE session save failure')};state.activeSession=value;return {ok:true,value};},activeSessionClear:async()=>(state.activeSession=null,{ok:true}),activeSessionSettled:async()=>{if(injectedFailure==='session-settle')throw new Error('QA_FIXTURE session settle failure');return true;},
      dailyRecordBackupDates:async()=>({dates:[...state.records.keys()].sort(),warning:''}),dailyRecordBackupMonth:async month=>[...state.records.values()].filter(record=>String(record.date).startsWith(String(month)+'-')).sort((a,b)=>a.date.localeCompare(b.date)),dailyRecordDocuments:async dates=>dates.map(date=>state.records.get(date)).filter(Boolean),
      dailyRecordImportBatches:async values=>{for(const value of values){state.records.set(value.date,freeze({...value}));state.deletions=state.deletions.filter(item=>item.date!==value.date);}return {batches:values.length?1:0};},
      dailyRecordRemove:async date=>(state.records.delete(date),true),dailyRecordTimestamp:value=>Date.parse(value?.updatedAt||value?.savedAt||'')||0,
      notesExportPayload:()=>state.notes,notesReadFreshPayload:async()=>state.notes,notesReadFreshItems:async keys=>(keys||[]).map(key=>state.notes[key]||null),notesFlush:async()=>{events.push('preflight-notes-flush');if(injectedFailure==='notes')throw new Error('QA_FIXTURE notes preflight failure');return true;},notesNormalizePayload:normalizeNotes,notesAlignByTitle:value=>value,notesFailure:()=>({failed:false}),
      restoreJournalPrepare:async value=>(state.journal={state:{id:value.id},payload:value}),restoreJournalRead:async()=>state.journal,restoreJournalMark:async(id,phase)=>(state.journal.state.phase=phase,state.journal.state),restoreJournalClear:async()=>(state.journal=null,true),
      scheduleRead:()=>state.schedule,personalSettle:async()=>{if(injectedFailure==='personal')throw new Error('QA_FIXTURE personal preflight failure');return true;},personalExport:async()=>state.personal,personalImport:async value=>(state.personal=value,true),personalVerify:async value=>assert.deepEqual(state.personal,value),
      storageGeneration:()=>0,sourceRevision:async()=>'2026-08-23T00:00:00.000Z',snapshotRevision:async()=>'stable-b3',canonicalMutationEpochRead:async()=>null,canonicalPreparationRebase:async()=>Object.freeze({epoch:null,stamps:Object.freeze([])}),preparationUnitStamps:async()=>[],preparationUnitReplace:async()=>[],installationId:()=> 'inst_device_local',deletionRecoveryFlush:async()=>{events.push('preflight-deletion-flush');if(injectedFailure==='deletions')throw new Error('QA_FIXTURE deletion preflight failure');if(injectedFailure==='deletions-false')return false;if(injectedFailure==='deletions-unknown')return undefined;return true;},
      deletionRecoverySavedDays:async()=>state.deletions.map(value=>({...value})),deletionRecoveryReplaceSavedDays:async values=>(state.deletions=(values||[]).map(value=>({...value})),true),deletionRecoveryAreaNotes:async()=>state.noteDeletions.map(value=>({...value})),deletionRecoveryReplaceAreaNotes:async values=>(state.noteDeletions=(values||[]).map(value=>({...value})),true),deletionRecoveryAttachments:async()=>state.attachmentDeletions.map(value=>({...value})),deletionRecoveryReplaceAttachments:async values=>(state.attachmentDeletions=(values||[]).map(value=>({...value})),true),deletionRecoveryClearAttachment:async assetId=>(state.attachmentDeletions=state.attachmentDeletions.filter(item=>item.assetId!==assetId),true),reconciliationBaseRead:async()=>state.reconciliationBase?freeze({format:'study-director.reconciliation-base',version:2,checkpointId:state.reconciliationBase.checkpointId,establishedAt:state.reconciliationBase.establishedAt||new Date().toISOString(),noteCount:Number(state.reconciliationBase.noteCount??Object.keys(state.reconciliationBase.notes||{}).length),noteKeyFingerprint:String(state.reconciliationBase.noteKeyFingerprint||'0'.repeat(64))}):null,reconciliationBaseReadNotes:async keys=>freeze(Object.fromEntries(keys.filter(key=>Object.prototype.hasOwnProperty.call(state.reconciliationBase?.notes||{},key)).map(key=>[key,String(state.reconciliationBase.notes[key]?.text??state.reconciliationBase.notes[key]??'')]))),reconciliationBaseWrite:async(checkpointId,spec)=>{const current=Object.assign(Object.create(null),state.reconciliationBase?.notes||{});if(spec&&spec.format==='study-director.reconciliation-base-update'){if(!spec.full&&state.reconciliationBase&&state.reconciliationBase.checkpointId!==spec.baseCheckpointId)return false;if(spec.full){const keep=new Set(spec.noteKeys||[]);for(const key of Object.keys(current))if(!keep.has(key))delete current[key];}for(const key of spec.deletes||[])delete current[key];for(const [key,text] of Object.entries(spec.updates||{}))current[key]=freeze({text:String(text)});let noteCount=Number(spec.noteCount),noteKeyFingerprint=String(spec.noteKeyFingerprint||'');if(spec.full){const keys=[...(spec.noteKeys||[])].sort();noteCount=keys.length;noteKeyFingerprint=await processing.run('checksum',{value:JSON.stringify(keys),algorithm:'sha256'});}state.reconciliationBase=freeze({checkpointId,establishedAt:new Date().toISOString(),noteCount,noteKeyFingerprint,notes:freeze(current)});return true;}const notes=freeze({...spec}),keys=Object.keys(notes).sort();state.reconciliationBase=freeze({checkpointId,establishedAt:new Date().toISOString(),noteCount:keys.length,noteKeyFingerprint:await processing.run('checksum',{value:JSON.stringify(keys),algorithm:'sha256'}),notes});return true;}
    }),
    assets:freeze({get:async()=>null,put:async()=>true,keys:async()=>[],list:async()=>[],importAll:async()=>0,restoreAll:async()=>true,removeMany:async()=>0,removeMetadata:async()=>0,scheduleMaintenance:fn}),
    exports:freeze({...processing,backgroundAvailable:()=>true,protect:async file=>typeof file==='function'?await file():file,unprotect:async blob=>({blob,encrypted:false}),check:fn,job:fn=>fn(),download:fn,chooseSave:async()=>null,save:async()=>({status:'downloaded'})}),
    codecs:freeze({activeSession:activeSessionCodec,backup:runtimeCodec}),
    reconciliation:freeze({createPlan:ReconciliationModule.createPlan,resolvePlan:ReconciliationModule.resolvePlan,summarizePlan:ReconciliationModule.summarizePlan}),noteReconciliation:freeze({resolve:async options=>noteResolver?noteResolver(options,state):freeze({format:'study-director.note-reconciliation-result',version:1,notes:freeze(Object.fromEntries((options.conflicts||[]).map(item=>[item.key,freeze({text:options.manualOnly&&decisions.reflections==='incoming'?item.incomingValue:item.localValue,localCandidateId:item.localCandidateId,incomingCandidateId:item.incomingCandidateId})])))})}),
    session:freeze({canMutate:()=>true,cancelLiveDraftSave:()=>events.push('preflight-session-cancel'),captureSnapshot:()=>hasLiveTasks&&state.activeSession?state.activeSession.snapshot:null,hasActiveSession:()=>!!state.activeSession,hasTasks:()=>hasLiveTasks,toActiveSession:()=>hasLiveTasks?state.activeSession:null,withPersistenceSuppressed:async operation=>operation()}),
    domain:freeze({clampText:(value,max=100000)=>String(value??'').slice(0,max),filenameSafeStudentName:()=> 'student',getStudentName:()=>state.personal.preferences.studentName,materializeDailyRecordView:value=>value,sanitizeCurrentDailyRecord:dailyRecordCodec.sanitizeCurrentDailyRecord,todayISO:()=> '2026-08-31'}),
    view:freeze({presentation,refreshPnote:fn,refreshReview:fn,renderSchedule:fn}),
    events:freeze({libraryChanged:fn,backupCompleted:fn,
      reconcileAreaNotes:async(payload,deletions=[])=>{state.notes=normalizeNotes({...state.notes,...payload});const deletedKeys=new Set((deletions||[]).map(item=>String(item.key)));for(const key of deletedKeys)delete state.notes[key];state.noteDeletions=state.noteDeletions.filter(item=>!Object.hasOwn(state.notes,item.key)&&!Object.values(payload||{}).some(note=>note&&note.key===item.key));for(const item of deletions||[]){state.noteDeletions=state.noteDeletions.filter(existing=>existing.key!==item.key);state.noteDeletions.push({...item});}for(const note of Object.values(payload||{}))state.noteDeletions=state.noteDeletions.filter(item=>item.key!==note.key);events.push('notes');return state.notes;},
      restoreAreaNotesSnapshot:async payload=>{state.notes=normalizeNotes(payload);events.push('notes-rollback');return state.notes;},
      restoreSessionState:async(value,scheduleText)=>(state.activeSession=value,state.schedule=String(scheduleText||''),events.push('session'),true),
      verifyActiveSessionRuntime:async expected=>(assert.deepEqual(state.activeSession,expected),true),
      restoredFromFile:()=>{events.push('restored-from-file');return restoredFromFile?restoredFromFile(state):false;}
    }),
    operations:freeze({assertAuthority:()=>{if(injectedFailure==='ownership')throw new Error('QA_FIXTURE ownership failure');return true;},clearFault:fn,failClosed:message=>{throw new Error(String(message));},runExclusive:async(kind,operation)=>operation()}),
    interactions:freeze({choose:async options=>options&&options.title==='Use this backup'?fileMode:null,configure:async config=>{prompts.push(config);const out={...decisions};for(const group of config.groups||[]){if(group.id.startsWith('savedDay__')){const remoteRecord=group.choices.find(choice=>String(choice.label||'').startsWith('Use '));const remoteDeletion=group.choices.find(choice=>String(choice.label||'').startsWith('Apply deletion'));if(decisions.dailyRecords==='replace'&&remoteRecord)out[group.id]=remoteRecord.value;else if(decisions.savedDayDeletions==='apply'&&remoteDeletion)out[group.id]=remoteDeletion.value;else out[group.id]=group.defaultValue;}else if(String(group.label||'').startsWith('Note · ')){const remoteDeletion=group.choices.find(choice=>String(choice.label||'').startsWith('Apply deletion'));out[group.id]=(decisions.noteByKey?.[String(group.label).slice('Note · '.length)]||decisions.noteDeletions)==='apply'&&remoteDeletion?remoteDeletion.value:group.defaultValue;}else if(group.id==='activeSession'){const incoming=group.choices.find(choice=>String(choice.label||'').startsWith('Use session'));out.activeSession=decisions.activeSession==='checkpoint'&&incoming?incoming.value:group.defaultValue;}}return freeze(out);},notify:fn}),
    environment:freeze({AbortController,clearTimeout,yieldTask:async()=>{},setTimeout:callback=>(callback(),1)}),diagnostics:freeze({capture:fn,start:()=>'',mark:(name,details={})=>(diagnosticMarks.push([String(name),details]),true),finish:()=>false,fail:()=>false})
  })}));
  return {runtime,prompts,statuses,events,diagnosticMarks,setPreflightFailure:value=>{injectedFailure=String(value||'');}};
}

const checkpointRecords=[record('2026-08-02','checkpoint conflict older','2026-08-20T10:00:00.000Z'),record('2026-08-04','checkpoint revives local deletion','2026-08-20T10:30:00.000Z'),record('2026-08-05','checkpoint new','2026-08-20T11:00:00.000Z')];
const checkpointDeletions=freeze([{date:'2026-08-03',deletedAt:'2026-08-20T12:00:00.000Z'},{date:'2026-08-06',deletedAt:'2026-08-20T12:30:00.000Z'}]);
const checkpointNotes=freeze({Checkpoint:freeze({version:2,key:'Checkpoint',text:'checkpoint note',updatedAt:'2026-08-20T12:00:00.000Z'})});
const checkpointSession=session('2026-08-07','CHECKPOINT');
const blob=await makeCheckpoint({records:checkpointRecords,deletions:checkpointDeletions,areaNotes:checkpointNotes,activeSession:checkpointSession});

// Restore-preflight failures must identify the exact local safety stage without exposing study content.
const preflightCases=[
  ['ownership','RESTORE_PREFLIGHT_OWNERSHIP_LOST',false],
  ['notes','RESTORE_PREFLIGHT_NOTES_FAILED',false],
  ['deletions','RESTORE_PREFLIGHT_DELETION_FAILED',false],
  ['deletions-false','RESTORE_PREFLIGHT_DELETION_FAILED',false],
  ['deletions-unknown','RESTORE_PREFLIGHT_DELETION_FAILED',false],
  ['personal','RESTORE_PREFLIGHT_PERSONAL_FAILED',false],
  ['session-save','RESTORE_PREFLIGHT_SESSION_SAVE_FAILED',true],
  ['session-settle','RESTORE_PREFLIGHT_SESSION_SETTLE_FAILED',true],
  ['session-read','RESTORE_PREFLIGHT_SESSION_READ_FAILED',false]
];
for(const [stage,code,hasLiveTasks] of preflightCases){
  const preflightState=createState();
  if(hasLiveTasks)preflightState.activeSession=session('2026-08-31','PREFLIGHT');
  const preflightHarness=createHarness(preflightState,{hasLiveTasks});
  const preflightCandidate=await preflightHarness.runtime.controller.inspect(blob,{filename:`preflight-${stage}.sdbackup`});
  preflightHarness.setPreflightFailure(stage);
  await assert.rejects(()=>preflightHarness.runtime.controller.restore(preflightCandidate),error=>{
    assert.equal(error.code,code);assert.equal(error.backupStage,stage.startsWith('deletions')?'deletions':stage);return true;
  });
  assert.equal(preflightHarness.diagnosticMarks.at(-1)[0],`restore-preflight-${stage.startsWith('deletions')?'deletions':stage}-failed`);
  assert.equal(preflightHarness.diagnosticMarks.at(-1)[1].errorCode,code);
}


// Format/protection boundary: public provenance is separate from integrity-covered authority/deletion metadata.
const parsed=await codec.inspectCurrent(blob,{filename:'checkpoint.sdbackup'});
assert.equal(parsed.formatVersion,21);
assert.equal(parsed.manifest.protectedManifest.entityType,'checkpointManifest');
assert.equal(Object.hasOwn(parsed.manifest,'authority'),false,'Checkpoint authority must not leak into the public provenance manifest.');
assert.equal(Object.hasOwn(parsed.manifest,'savedDayDeletions'),false,'Saved-Day deletion history must stay behind the protected-manifest boundary.');
assert.equal(Object.hasOwn(parsed.manifest,'sourceRevision'),false,'Canonical source revision must stay behind the protected-manifest boundary.');
assert.equal(Object.hasOwn(parsed.manifest,'schemaVersion'),false,'Current checkpoints must not write the retired distributed-sync schemaVersion field.');
assert.equal(parsed.protectedCheckpointManifest.checkpointId,parsed.manifest.checkpoint.checkpointId);
assert.equal(parsed.protectedCheckpointManifest.authority.savedDays,'pairwise-explicit-deletions');
assert.deepEqual(parsed.protectedCheckpointManifest.savedDayDeletions,checkpointDeletions);
const validated=await codec.inspectCurrent(blob,{filename:'checkpoint.sdbackup',validateOnly:true});
assert.equal(validated.protectedCheckpointManifest.checkpointId,parsed.manifest.checkpoint.checkpointId,'validate-only must validate the protected checkpoint payload, not skip it');

// Unified reconciliation: local-only and divergent local data survive by default; explicit deletion conflicts require a choice.
const importState=createState();
const importHarness=createHarness(importState);
const importCandidate=await importHarness.runtime.controller.inspect(blob,{filename:'checkpoint.sdbackup'});
assert.equal(importCandidate.preview.reconciliationCapable,true);
const importResult=await importHarness.runtime.controller.restore(importCandidate);
assert.equal(importResult.mode,'reconcile');
const savedDayPrompt=importHarness.prompts.find(prompt=>prompt.groups?.some(group=>group.id==='savedDaysBulk'));
assert.ok(savedDayPrompt,'Several Saved-Day conflicts must expose one bulk-default control.');
const bulkGroup=savedDayPrompt.groups.find(group=>group.id==='savedDaysBulk'),savedDayGroups=savedDayPrompt.groups.filter(group=>String(group.id||'').startsWith('savedDay__'));
assert.ok(savedDayGroups.length>=2,'Bulk Saved-Day UX is only meaningful when several atomic conflicts are present.');
assert.deepEqual(bulkGroup.choices.map(choice=>choice.label),['Use this device for all','Use backup for all','Review individually']);
for(const group of savedDayGroups){
  const localChoice=group.choices.find(choice=>/Keep this device|Keep deleted/.test(choice.label)),incomingChoice=group.choices.find(choice=>choice!==localChoice);
  assert.equal(bulkGroup.choices[0].applyValues[group.id],localChoice.value,'Use-this-device bulk choice must select the complete local state for every conflicting day.');
  assert.equal(bulkGroup.choices[1].applyValues[group.id],incomingChoice.value,'Use-backup bulk choice must select the complete incoming state for every conflicting day.');
  assert.equal(bulkGroup.choices[2].applyValues[group.id],group.defaultValue,'Review-individually must restore each day’s safe native default.');
  assert.ok(group.choices.every(choice=>/saved|deleted|planned block|reflection|quality/i.test(choice.description)),'Each conflicting Saved Day must expose concise version context.');
}
assert.ok(Object.keys(bulkGroup.choices[1].applyValues).every(id=>id.startsWith('savedDay__')),'Saved-Day bulk controls must never alter Ongoing-Note or Active-Session choices.');

// P7: the bulk UX must remain bounded and atomic with many simultaneous Saved-Day conflicts.
const manyDates=Array.from({length:28},(_,index)=>`2026-06-${String(index+1).padStart(2,'0')}`),manyState=createState();manyState.records=new Map(manyDates.map((date,index)=>[date,record(date,`local ${index+1}`,'2026-09-01T12:00:00.000Z')]));manyState.deletions=[];manyState.notes={};manyState.activeSession=null;manyState.schedule='';const manyIncoming=manyDates.map((date,index)=>record(date,`backup ${index+1}`,'2026-09-02T12:00:00.000Z')),manyBlob=await makeCheckpoint({records:manyIncoming,exportedAt:'2026-09-02T13:00:00.000Z'}),manyHarness=createHarness(manyState,{decisions:{dailyRecords:'replace',reflections:'incoming'}});await manyHarness.runtime.controller.restore(await manyHarness.runtime.controller.inspect(manyBlob,{filename:'many-saved-day-conflicts.sdbackup'}));const manyPrompt=manyHarness.prompts.find(prompt=>prompt.groups?.some(group=>group.id==='savedDaysBulk')),manyBulk=manyPrompt?.groups.find(group=>group.id==='savedDaysBulk'),manyGroups=manyPrompt?.groups.filter(group=>String(group.id||'').startsWith('savedDay__'))||[];assert.ok(manyPrompt,'Many Saved-Day conflicts must still use one consolidated conflict surface.');assert.equal(manyGroups.length,manyDates.length,'Every conflicting Saved Day must remain an individually overridable atomic decision.');assert.equal(Object.keys(manyBulk.choices[0].applyValues).length,manyDates.length);assert.equal(Object.keys(manyBulk.choices[1].applyValues).length,manyDates.length);assert.ok(Object.keys(manyBulk.choices[0].applyValues).every(id=>id.startsWith('savedDay__')));assert.deepEqual([...manyState.records.keys()].sort(),manyDates);for(const [index,date] of manyDates.entries())assert.equal(manyState.records.get(date).reflection,`backup ${index+1}`,'Bulk incoming choice must replace the complete Saved-Day record, not merge fields.');
assert.ok(importHarness.events.includes('preflight-notes-flush')&&importHarness.events.includes('preflight-deletion-flush'),'Restore preflight must flush notes and deletion recovery before planning; Review state is carried by Active Session.');
assert.equal(importState.records.get('2026-08-01').reflection,'local only');
assert.equal(importState.records.get('2026-08-02').reflection,'local conflict newer','Reconciliation must keep a divergent local Saved Day by default.');
assert.equal(importState.records.get('2026-08-03').reflection,'local should survive import','A conflicting checkpoint deletion must not override the local Saved Day by default.');
assert.equal(importState.records.has('2026-08-04'),false,'Reconciliation must preserve a local deletion conflict by default.');
assert.equal(importState.records.get('2026-08-05').reflection,'checkpoint new','Reconciliation should still add a genuinely new Saved Day.');
assert.deepEqual(importState.deletions.map(item=>item.date),['2026-08-04','2026-08-06'],'Non-conflicting explicit deletion state should propagate without deleting a local Saved Day.');
assert.deepEqual(Object.keys(importState.notes).sort(),['Checkpoint','Local'],'Reconciliation should add a missing incoming Area while preserving local-only Areas.');


// Note deletion remains explicit and human-directed.
const deletionState=createState();
delete deletionState.notes.Local;
delete deletionState.notes.Checkpoint;
delete deletionState.records;
delete deletionState.deletions;
Object.assign(deletionState,{records:new Map(),deletions:[],notes:{Keep:normalizeArea({key:'Keep',text:'live local note',updatedAt:'2026-08-24T10:00:00.000Z'},'Keep')},noteDeletions:[{key:'Gone',deletedAt:'2026-08-24T12:00:00.000Z'}],activeSession:null,schedule:'',personal:personal('Deletion Device'),journal:null});
const deletionBlob=await makeCheckpoint({
  areaNotes:{Gone:normalizeArea({key:'Gone',text:'stale remote note',updatedAt:'2026-08-24T11:00:00.000Z'},'Gone')},
  noteDeletions:[{key:'Keep',deletedAt:'2026-08-24T14:00:00.000Z'}],
  installationId:'inst_delete_remote',exportedAt:'2026-08-24T15:00:00.000Z'
});
const deletionHarness=createHarness(deletionState);
await deletionHarness.runtime.controller.restore(await deletionHarness.runtime.controller.inspect(deletionBlob,{filename:'deletion-semantics.sdbackup'}));
assert.equal(Object.hasOwn(deletionState.notes,'Gone'),false,'A local note tombstone must prevent stale incoming note resurrection.');
assert.equal(deletionState.noteDeletions.some(item=>item.key==='Gone'),true);
assert.equal(deletionState.notes.Keep.text,'live local note','Incoming note deletion must default to the live local note.');

const explicitNoteDeleteState=createState();explicitNoteDeleteState.notes={Keep:normalizeArea({key:'Keep',text:'live local note',updatedAt:'2026-08-24T10:00:00.000Z'},'Keep')};explicitNoteDeleteState.noteDeletions=[];
const explicitNoteDeleteHarness=createHarness(explicitNoteDeleteState,{decisions:{noteDeletions:'apply'}});
await explicitNoteDeleteHarness.runtime.controller.restore(await explicitNoteDeleteHarness.runtime.controller.inspect(await makeCheckpoint({noteDeletions:[{key:'Keep',deletedAt:'2026-08-24T14:00:00.000Z'}],installationId:'inst_note_delete_remote'}),{filename:'note-delete-choice.sdbackup'}));
assert.equal(Object.hasOwn(explicitNoteDeleteState.notes,'Keep'),false,'Explicit note deletion choice must remove the live local note.');
assert.equal(explicitNoteDeleteState.noteDeletions.some(item=>item.key==='Keep'),true,'Explicit note deletion must become canonical tombstone state.');

// Distinct names that formerly sanitized to the same ID must retain independent choices through restore.
const collisionState=createState();collisionState.notes=Object.fromEntries(['a b','a_b'].map(key=>[key,normalizeArea({key,text:'keep '+key,updatedAt:'2026-08-24T10:00:00.000Z'},key)]));
const collisionHarness=createHarness(collisionState,{decisions:{noteByKey:{'a b':'keep','a_b':'apply'}}});
const collisionBlob=await makeCheckpoint({noteDeletions:['a b','a_b'].map(key=>({key,deletedAt:'2026-08-24T14:00:00.000Z'}))});
await collisionHarness.runtime.controller.restore(await collisionHarness.runtime.controller.inspect(collisionBlob,{filename:'independent-note-decisions.sdbackup'}));
assert.equal(collisionState.notes['a b'].text,'keep a b');assert.equal(Object.hasOwn(collisionState.notes,'a_b'),false);
assert.deepEqual(collisionState.noteDeletions.map(item=>item.key),['a_b']);

// Explicit incoming choices: selected checkpoint states are applied, but unrelated local Saved Days survive.
const handoffState=createState({withActive:true});
const handoffHarness=createHarness(handoffState,{decisions:{dailyRecords:'replace',reflections:'incoming',savedDayDeletions:'apply',activeSession:'checkpoint',plans:'replace',personalSettings:'replace'}});
const handoffCandidate=await handoffHarness.runtime.controller.inspect(blob,{filename:'checkpoint.sdbackup'});
const handoffResult=await handoffHarness.runtime.controller.restore(handoffCandidate);
assert.equal(handoffResult.mode,'reconcile');
assert.equal(handoffState.records.get('2026-08-01').reflection,'local only','Reconciliation must preserve unrelated local Saved Days.');
assert.equal(handoffState.records.get('2026-08-02').reflection,'checkpoint conflict older','Explicit checkpoint choice must win even when its timestamp is older.');
assert.equal(handoffState.records.has('2026-08-03'),false,'Explicit checkpoint deletion must remove the matching local Saved Day.');
assert.equal(handoffState.records.get('2026-08-04').reflection,'checkpoint revives local deletion','Checkpoint record choice must be able to replace a local deletion.');
assert.equal(handoffState.records.get('2026-08-05').reflection,'checkpoint new');
assert.deepEqual(handoffState.deletions.map(item=>item.date),['2026-08-03','2026-08-06']);
assert.deepEqual(Object.keys(handoffState.notes).sort(),['Checkpoint','Local'],'Reconciliation must add missing Areas without clearing local-only notes.');
assert.equal(handoffState.activeSession.date,'2026-08-07','Handoff must restore a non-today interrupted session.');
assert.match(handoffState.schedule,/CHECKPOINT/u);
assert.equal(handoffState.personal.preferences.studentName,'Checkpoint User');
assert.equal(handoffHarness.prompts.some(prompt=>prompt.groups?.some(group=>group.id==='restoreMode')),false,'Current checkpoints must use one reconciliation flow rather than exposing Import versus Handoff.');

// Explicit local conflict choices must be honored; there is no timestamp-based automatic winner.
const keepState=createState({withActive:true});
const keepHarness=createHarness(keepState,{decisions:{dailyRecords:'keep',savedDayDeletions:'keep',activeSession:'keep',plans:'keep',personalSettings:'keep'}});
const keepCandidate=await keepHarness.runtime.controller.inspect(blob,{filename:'checkpoint.sdbackup'});
await keepHarness.runtime.controller.restore(keepCandidate);
assert.equal(keepState.records.get('2026-08-02').reflection,'local conflict newer');
assert.equal(keepState.records.get('2026-08-03').reflection,'local should survive import');
assert.equal(keepState.records.has('2026-08-04'),false,'Keeping the local deletion must reject the conflicting checkpoint record.');
assert.equal(keepState.records.get('2026-08-05').reflection,'checkpoint new','Non-conflicting checkpoint records still transfer during reconciliation.');
assert.deepEqual(keepState.deletions.map(item=>item.date),['2026-08-04','2026-08-06'],'Non-conflicting checkpoint deletion history may transfer without deleting unrelated local data.');
assert.deepEqual(Object.keys(keepState.notes).sort(),['Checkpoint','Local'],'Local note conflicts stay local, but missing incoming Areas are still added.');
assert.equal(keepState.activeSession.date,'2026-08-10');
assert.match(keepState.schedule,/LOCAL/u);

// Presence semantics: when local has no Active Session and the checkpoint has one, the incoming session transfers automatically.
const incomingSessionState=createState();
const incomingSessionHarness=createHarness(incomingSessionState);
const incomingSessionBlob=await makeCheckpoint({activeSession:session('2026-08-15','REMOTE-ONLY')});
await incomingSessionHarness.runtime.controller.restore(await incomingSessionHarness.runtime.controller.inspect(incomingSessionBlob,{filename:'checkpoint-incoming-session.sdbackup'}));
assert.equal(incomingSessionState.activeSession.date,'2026-08-15','Incoming Active Session must transfer when no local session exists.');
assert.match(incomingSessionState.schedule,/REMOTE-ONLY/u);

// Restore preflight must flush in-memory Active Session state before it becomes a reconciliation candidate.
const liveFlushState=createState({withActive:true});
const liveFlushHarness=createHarness(liveFlushState,{hasLiveTasks:true});
const liveFlushBlob=await makeCheckpoint({records:[],deletions:[],areaNotes:{},activeSession:null});
await liveFlushHarness.runtime.controller.restore(await liveFlushHarness.runtime.controller.inspect(liveFlushBlob,{filename:'checkpoint-live-flush.sdbackup'}));
assert.ok(liveFlushHarness.events.includes('preflight-session-cancel')&&liveFlushHarness.events.includes('preflight-session-save'),'Restore preflight must settle the live Active Session before reconciliation planning.');

// Presence semantics: an explicit checkpoint with no Active Session cannot clear a local active/suspended session.
const noSessionBlob=await makeCheckpoint({records:[],deletions:[],areaNotes:{},activeSession:null});
const clearState=createState({withActive:true});
const clearHarness=createHarness(clearState,{decisions:{activeSession:'checkpoint',plans:'keep',personalSettings:'keep'}});
const clearCandidate=await clearHarness.runtime.controller.inspect(noSessionBlob,{filename:'checkpoint-no-session.sdbackup'});
await clearHarness.runtime.controller.restore(clearCandidate);
assert.equal(clearState.activeSession.date,'2026-08-10','Checkpoint absence must not clear a local Active Session.');



// CR3 Note reconciliation remains scratch-only until the resolved note enters the journaled restore commit.
const noteState=createState();
noteState.notes.Shared=freeze({version:2,key:'Shared',text:'Local sentence. Local-only detail.',updatedAt:'2026-08-22T15:00:00.000Z'});
const noteBlob=await makeCheckpoint({areaNotes:{Shared:freeze({version:2,key:'Shared',text:'Local sentence. Imported addition.',updatedAt:'2026-08-23T15:00:00.000Z'})},installationId:'inst_note_remote'});
let noteReconcileCalls=0;
const noteHarness=createHarness(noteState,{noteResolver:async({conflicts})=>{
  noteReconcileCalls++;assert.equal(noteState.journal,null,'Scratch reconciliation must run before the restore journal/canonical mutation phase.');assert.equal(noteState.notes.Shared.text,'Local sentence. Local-only detail.','Canonical local note must remain untouched while scratch reconciliation is open.');
  assert.equal(conflicts.length,1);assert.equal(conflicts[0].key,'Shared');assert.match(conflicts[0].incomingValue,/Imported addition/u);
  return freeze({format:'study-director.note-reconciliation-result',version:1,notes:freeze({Shared:freeze({text:'Local sentence. Local-only detail. Imported addition.',localCandidateId:conflicts[0].localCandidateId,incomingCandidateId:conflicts[0].incomingCandidateId})})});
}});
await noteHarness.runtime.controller.restore(await noteHarness.runtime.controller.inspect(noteBlob,{filename:'note-conflict.sdbackup'}));
assert.equal(noteReconcileCalls,1,'One divergent Area must invoke one reconciliation session.');
assert.equal(noteState.notes.Shared.text,'Local sentence. Local-only detail. Imported addition.','Only the resolved scratch value may become canonical.');
assert.equal(noteState.notes.Local.text,'local note','Unrelated local-only Area must remain untouched.');

// Canonical data changing while scratch reconciliation is open must invalidate the plan before any journal/write and rebuild from fresh state.
const staleState=createState();
staleState.notes.Shared=freeze({version:2,key:'Shared',text:'Local before external edit.',updatedAt:'2026-08-22T15:00:00.000Z'});
const staleBlob=await makeCheckpoint({areaNotes:{Shared:freeze({version:2,key:'Shared',text:'Incoming alternative.',updatedAt:'2026-08-23T15:00:00.000Z'})},installationId:'inst_stale_remote'});
let staleCalls=0;
const staleHarness=createHarness(staleState,{noteResolver:async({conflicts})=>{
  staleCalls+=1;assert.equal(staleState.journal,null,'A stale reconciliation must be rejected before the restore journal exists.');
  assert.equal(conflicts.length,1);
  if(staleCalls===1){
    assert.equal(conflicts[0].localValue,'Local before external edit.');
    staleState.notes.Shared=freeze({version:2,key:'Shared',text:'External canonical edit while modal open.',updatedAt:'2026-08-24T16:00:00.000Z'});
    return freeze({format:'study-director.note-reconciliation-result',version:1,notes:freeze({Shared:freeze({text:'STALE RESULT MUST NOT COMMIT',localCandidateId:conflicts[0].localCandidateId,incomingCandidateId:conflicts[0].incomingCandidateId})})});
  }
  assert.equal(conflicts[0].localValue,'External canonical edit while modal open.','Rebuilt reconciliation must read the latest canonical note.');
  return freeze({format:'study-director.note-reconciliation-result',version:1,notes:freeze({Shared:freeze({text:conflicts[0].localValue,localCandidateId:conflicts[0].localCandidateId,incomingCandidateId:conflicts[0].incomingCandidateId})})});
}});
await staleHarness.runtime.controller.restore(await staleHarness.runtime.controller.inspect(staleBlob,{filename:'stale-note-conflict.sdbackup'}));
assert.equal(staleCalls,2,'A stale scratch decision must cause exactly one fresh reconciliation retry in this scenario.');
assert.equal(staleState.notes.Shared.text,'External canonical edit while modal open.','The stale scratch result must never become canonical.');
assert.ok(staleHarness.statuses.some(message=>/Rebuilding the comparison/u.test(message)),'The stale-plan retry should be visible on the standalone restore surface.');

// A file restore that changed data tells every automatic backup location at once.
const fileState={records:new Map(),deletions:[],notes:{},activeSession:null,schedule:'',personal:personal('File Device'),journal:null};
let fileConvergenceCalls=0;
const fileHarness=createHarness(fileState,{restoredFromFile:()=>{fileConvergenceCalls+=1;return true;}});
const fileBlob=await makeCheckpoint({records:[record('2026-08-30','file reconciliation')],installationId:'inst_file_remote'});
Object.defineProperty(fileBlob,'name',{value:'file-handoff.sdbackup',configurable:true});
const fileInput={files:[fileBlob],value:'selected'};
await fileHarness.runtime.controller.importLocal({target:fileInput});
assert.equal(fileState.records.get('2026-08-30').reflection,'file reconciliation');
assert.equal(fileConvergenceCalls,1,'A changed file restore must tell the automatic backup locations exactly once.');assert.ok(fileHarness.statuses.some(message=>/Automatic backups will include it shortly/u.test(message)));
assert.equal(fileInput.value,'','File input should still be reset after convergence handling.');


// A verified current standalone backup may replace portable canonical data exactly.
const replaceState=createState();
const replaceHarness=createHarness(replaceState,{fileMode:'replace'});
const replaceBlob=await makeCheckpoint({records:[record('2026-08-30','standalone exact replacement')],installationId:'inst_file_replace'});
Object.defineProperty(replaceBlob,'name',{value:'file-replace.sdbackup',configurable:true});
const replaceInput={files:[replaceBlob],value:'selected'};
await replaceHarness.runtime.controller.importLocal({target:replaceInput});
assert.deepEqual([...replaceState.records.keys()],['2026-08-30'],'standalone Replace must remove portable Saved Days absent from the selected backup.');
assert.equal(replaceState.records.get('2026-08-30').reflection,'standalone exact replacement');
assert.equal(replaceInput.value,'','standalone Replace should reset the file input after verified completion.');

// A → B → A sequential handoff: later divergence, explicit deletion and interrupted-session state remain coherent.
const aRoundTrip=createState({withActive:true});
const aFirstBlob=await makeCheckpoint({
  records:[...aRoundTrip.records.values()],deletions:aRoundTrip.deletions,areaNotes:aRoundTrip.notes,
  activeSession:aRoundTrip.activeSession,personalData:aRoundTrip.personal,installationId:'inst_device_a',exportedAt:'2026-08-24T08:00:00.000Z'
});
const bRoundTrip={records:new Map(),deletions:[],notes:{},activeSession:null,schedule:'',personal:personal('Device B'),journal:null};
const bFirstHarness=createHarness(bRoundTrip,{decisions:{dailyRecords:'replace',reflections:'incoming',savedDayDeletions:'apply',activeSession:'checkpoint',plans:'replace',personalSettings:'replace'}});
await bFirstHarness.runtime.controller.restore(await bFirstHarness.runtime.controller.inspect(aFirstBlob,{filename:'a-to-b.sdbackup'}));
assert.equal(bRoundTrip.records.get('2026-08-02').reflection,'local conflict newer');
assert.equal(bRoundTrip.activeSession.date,'2026-08-10');
// Both devices now diverge independently after the first handoff.
aRoundTrip.records.set('2026-08-02',record('2026-08-02','A divergent after handoff','2026-08-26T12:00:00.000Z'));
aRoundTrip.records.set('2026-08-13',record('2026-08-13','A local-only after handoff','2026-08-26T13:00:00.000Z'));
bRoundTrip.records.set('2026-08-02',record('2026-08-02','B divergent authoritative choice','2026-08-25T09:00:00.000Z'));
bRoundTrip.records.delete('2026-08-03');
bRoundTrip.deletions=[...bRoundTrip.deletions.filter(item=>item.date!=='2026-08-03'),{date:'2026-08-03',deletedAt:'2026-08-25T09:05:00.000Z'}];
bRoundTrip.records.set('2026-08-11',record('2026-08-11','B new day','2026-08-25T09:10:00.000Z'));
bRoundTrip.activeSession=session('2026-08-12','DEVICE-B');bRoundTrip.schedule=bRoundTrip.activeSession.scheduleText;
const bReturnBlob=await makeCheckpoint({
  records:[...bRoundTrip.records.values()],deletions:bRoundTrip.deletions,areaNotes:bRoundTrip.notes,
  activeSession:bRoundTrip.activeSession,personalData:bRoundTrip.personal,installationId:'inst_device_b',exportedAt:'2026-08-25T10:00:00.000Z'
});
const aReturnHarness=createHarness(aRoundTrip,{decisions:{dailyRecords:'replace',reflections:'incoming',savedDayDeletions:'apply',activeSession:'checkpoint',plans:'replace',personalSettings:'replace'}});
await aReturnHarness.runtime.controller.restore(await aReturnHarness.runtime.controller.inspect(bReturnBlob,{filename:'b-to-a.sdbackup'}));
assert.equal(aRoundTrip.records.get('2026-08-02').reflection,'B divergent authoritative choice','Explicit B checkpoint choice must resolve a divergent copy even when B has the older timestamp.');
assert.equal(aRoundTrip.records.has('2026-08-03'),false,'B deletion must propagate back to A.');
assert.equal(aRoundTrip.records.get('2026-08-11').reflection,'B new day');
assert.equal(aRoundTrip.records.get('2026-08-13').reflection,'A local-only after handoff','A day outside B checkpoint authority must remain untouched.');
assert.equal(aRoundTrip.activeSession.date,'2026-08-12');
assert.match(aRoundTrip.schedule,/DEVICE-B/u);

console.log(JSON.stringify({status:'PASS',suite:'checkpoint-handoff',preflightVariants:preflightCases.length,coverage:['current protected deletion manifest','unified reconciliation preserves local defaults','explicit Saved-Day deletion choices','explicit conflict choices beat timestamps','non-today Active Session portability','incoming-only Active Session transfers automatically','checkpoint absence preserves local Active Session','A→B→A divergent sequential handoff','scratch note reconciliation before canonical commit','restore preflight flushes pending canonical state','stale reconciliation rebuild fence','file reconciliation Device Backup convergence','standalone file Replace exact replacement']},null,2));
