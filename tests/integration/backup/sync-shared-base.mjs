import {createBackupPresentation} from '../../helpers/backup-presentation.mjs';
import {RUNTIME_DATA_CONTRACT} from '../../../contracts/canonical-identities.mjs';
import {createProcessingEngine} from '../../helpers/file-processing.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {testPendingReviewCodec,memoryPendingReviews,paragraphMerge} from '../../helpers/pending-review-codec.mjs';
import {checkCases} from '../../helpers/generated-cases.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
for(const file of ['source/core/internal.js','source/core/operation-lifecycle.js','source/core/record-codecs.js','source/core/backup-codec.js','source/core/canonical.js','source/core/reconciliation.js','source/core/managed-repository.js','source/core/repository-policy.js','source/core/repository-background.js','source/core/backup-provider.js','source/core/backup-capture.js','source/core/backup.js','source/core/managed-recovery.js'])vm.runInThisContext(read(file),{filename:file});
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
const ManagedRecoveryModule=registry.require('managed-recovery',1);
const freeze=Object.freeze;
const processing=freeze({...createProcessingEngine(),scope:operation=>operation()});
const limits=freeze({
  backupChunkItems:10,backupChunkTargetBytes:65536,backupMaxEntryBytes:65536,backupMaxLineBytes:262144,
  backupMaxCompressedBytes:4*1024*1024,backupMaxFileBytes:16*1024*1024,backupMaxUncompressedBytes:8*1024*1024,
  backupMaxAssetDescriptors:100,richAssetMaxBytes:8*1024*1024,maxBackupChunks:1000,importBytes:4*1024*1024,
  maxImportRecords:100,maxNotes:100,maxLegacyImportTombstones:100,maxImportReflectionDrafts:100,maxReflectionChars:10000,maxPendingReviews:20,maxNoteLinks:50
});
const dataContract=RUNTIME_DATA_CONTRACT;
const defs=freeze({
  dailyRecord:freeze({idField:'date',backupLimit:limits.maxImportRecords}),note:freeze({idField:'key',backupLimit:limits.maxNotes}),
  activeSession:freeze({idField:'id',backupLimit:1})
});
const isDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
const normalizeTimestamp=value=>Number.isFinite(Date.parse(String(value||'')))?new Date(value).toISOString():null;
const normalizeArea=(item,key)=>item&&String(key||item.key||'')?freeze({version:2,key:String(key||item.key),...(item.label?{label:String(item.label)}:{}),text:String(item.text||''),updatedAt:normalizeTimestamp(item.updatedAt)||'2026-08-01T00:00:00.000Z',...(item.links?{links:[...item.links]}:{})}):null;
const normalizeDrafts=value=>(Array.isArray(value)?value:[]).filter(item=>item&&isDate(item.date)).map(item=>freeze({...item,version:1,date:String(item.date),reflection:String(item.reflection||''),revision:Number(item.revision)||0,sessionRevision:Number(item.sessionRevision)||0,updatedAt:normalizeTimestamp(item.updatedAt)||'2026-08-01T00:00:00.000Z'})).sort((a,b)=>a.date.localeCompare(b.date));
const dailyRecordCodec=freeze({
  sanitizeHistoricalDailyRecord:item=>item&&isDate(item.date)?freeze({...item}):null,
  canonicalizeHistoricalDailyRecord:item=>item&&isDate(item.date)?freeze({...item,version:15}):null,
  sanitizeCurrentDailyRecord:item=>item&&isDate(item.date)?freeze({...item,version:16,recordKind:'study',date:String(item.date)}):null,
  savedDayCoversSessionEvidence:(day,local)=>day?.recordKind==='study'&&day.date===local?.date&&/saved on B|saved after BF1 handoff|saved on B before the new day/i.test(String(day.reflection||'')),
  sanitizeImportedNote:normalizeArea,sanitizeCurrentNote:normalizeArea,isSupportedSavedDate:isDate
});
const sanitizeActiveSession=item=>item&&item.id==='current'?freeze({...item,version:RUNTIME_DATA_CONTRACT.schemas.ActiveSession.version,runningOn:item.runningOn||'inst_device_local'}):null;
const activeSessionCodec=freeze({sanitizeCurrent:sanitizeActiveSession,contentValue:item=>{const clean=sanitizeActiveSession(item);if(!clean)return null;const snapshot=clean.snapshot&&typeof clean.snapshot==='object'?clean.snapshot:{},{contentRevision:_contentRevision,savedRevision:_savedRevision,updatedAt:_updatedAt,...contentSnapshot}=snapshot;return freeze({date:String(clean.date||''),scheduleText:String(clean.scheduleText||''),snapshot:freeze(contentSnapshot)});}});
const sessionContentFingerprint=async item=>processing.run('checksum',{value:CanonicalModule.signature(activeSessionCodec.contentValue(item)),algorithm:'sha256'});
const reflectionDraftCodec=freeze({format:'study-director.reflection-draft-codec',contractVersion:1,sanitizeCurrent:item=>item&&isDate(item.date)?freeze({...item,version:1,date:String(item.date),reflection:String(item.reflection||''),revision:Number(item.revision)||0,sessionRevision:Number(item.sessionRevision)||0,updatedAt:normalizeTimestamp(item.updatedAt)||'2026-08-01T00:00:00.000Z'}):null});
const compatibilityCodec=freeze({format:'study-director.compatibility-codecs',contractVersion:1,dailyRecord:item=>dailyRecordCodec.canonicalizeHistoricalDailyRecord(item),note:normalizeArea,activeSession:item=>activeSessionCodec.sanitizeCurrent(item),reflectionDraft:item=>reflectionDraftCodec.sanitizeCurrent(item),personalData:item=>{if(!item||typeof item!=='object'||![1,2].includes(Number(item.version)))throw new Error('Unsupported legacy personal-data version.');const p=item.preferences||{};return {version:2,plans:item.plans,preferences:{studentName:p.studentName??null,theme:p.theme??null,presentation:p.presentation??null,quote:p.quote??null,practiceCueMode:p.practiceCueMode??null,fontScale:p.fontScale??null,practiceTargetMs:p.practiceTargetMs??null,nudge:p.nudge??null}};}});
const keyedRecord=freeze({create:()=>Object.create(null)});
const entityDefinition=type=>defs[type]||null,entityIdentity=(type,item)=>String(item?.[defs[type]?.idField]||'');
const boundedInt=(value,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={})=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;};
const jsonByteLength=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).byteLength;
const personalDataCodec=RecordCodecs.createPersonalDataCodec(limits);
const pendingReviewCodec=testPendingReviewCodec(RecordCodecs,{personalDataCodec,activeSessionCodec});
const codec=BackupCodecs.createBackupCodec(freeze({personalDataCodec,pendingReviewCodec,processing,
  appConfig:freeze({appName:'Study Director',attribution:'Study Director'}),limits,dataContract,legacy:freeze({schemaVersion:3,tombstoneLimit:limits.maxLegacyImportTombstones}),entityTypes:freeze(Object.keys(defs)),keyedRecord,
  entities:freeze({entityDefinition,entityIdentity}),helpers:freeze({boundedInt,jsonByteLength}),
  richText:freeze({assetIds:()=>freeze([]),assetIdValid:value=>/^img-[A-Za-z0-9_-]{16,128}$/.test(String(value||'')),imageMimeTypeValid:value=>['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(String(value||''))}),
  dailyRecordCodec,activeSessionCodec,compatibilityCodec
}));
const runtimeCodec=freeze({...codec,inspect:codec.inspectCurrent});
const STARTER_SCHEDULE='06:00 | 60 | Starter Block | work | Core | block | 1';
// A device's start-up state: no settings chosen and the starter plan.
const startup=(draft=STARTER_SCHEDULE)=>freeze({version:2,plans:freeze({draft,savedPlans:freeze([]),defaultId:null}),preferences:freeze({studentName:null,theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null})});
const personal=(name='Checkpoint User')=>freeze({version:2,plans:freeze({draft:null,savedPlans:freeze([]),defaultId:null}),preferences:freeze({studentName:name,theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null})});
const record=(date,reflection,updatedAt='2026-08-20T12:00:00.000Z')=>freeze({version:16,recordKind:'study',date,reflection,studyQuality:4,savedAt:updatedAt,updatedAt});
const session=(date,label,{runningOn='inst_device_local',status='suspended',revision=2}={})=>freeze({id:'current',type:'activeSession',version:RUNTIME_DATA_CONTRACT.schemas.ActiveSession.version,revision,date,status,runningOn,scheduleText:`08:00 | 60 | ${label} | work | Ethics | block | 1`,snapshot:freeze({label}),suspendedAt:'2026-08-20T13:00:00.000Z',updatedAt:'2026-08-20T13:00:00.000Z'});
const revisionedSession=(date,label,{runningOn='inst_device_local',status='active',revision=2,contentRevision=1,savedRevision=0,updatedAt='2026-08-20T13:00:00.000Z'}={})=>{
  const base=session(date,label,{runningOn,status,revision});
  return freeze({...base,snapshot:freeze({...base.snapshot,contentRevision,savedRevision:Math.min(contentRevision,savedRevision),updatedAt}),updatedAt});
};
const revisionedRecord=(date,reflection,sourceRevision,updatedAt='2026-08-20T18:00:00.000Z')=>freeze({...record(date,reflection,updatedAt),sourceRevision});
const draft=(date,text,revision=1,updatedAt='2026-08-20T12:00:00.000Z')=>freeze({version:1,date,reflection:text,studyQuality:3,revision,sessionRevision:0,updatedAt});

// The canonical Pending Review codec owns the semantic identity across
// every import, not only automatic sync. Distinct kept content remains
// distinct, and resolved reviews never suppress a future independent one.
{
  const kept=personal('Codec baseline'),other=personal('Codec divergent');
  const a=pendingReviewCodec.create({subject:'personal',ref:'personal',kept}),
    duplicate=pendingReviewCodec.create({subject:'personal',ref:'personal',kept}),
    distinct=pendingReviewCodec.create({subject:'personal',ref:'personal',kept:other});
  const merged=pendingReviewCodec.merge([[duplicate,a,distinct]],limits.maxPendingReviews);
  assert.equal(merged.filter(item=>!item.resolvedAt).length,2,'identical open reviews coalesce without losing a genuinely different conflict');
  const retained=merged.find(item=>!item.resolvedAt&&item.kept.preferences.studentName==='Codec baseline');
  assert.ok(retained);
  assert.ok(merged.some(item=>item.id!==retained.id&&item.resolvedAt),'the redundant identity is resolved for future devices');
  const finished=pendingReviewCodec.resolved(retained),reimported=pendingReviewCodec.merge([[...merged,finished],[a,duplicate]],limits.maxPendingReviews);
  assert.equal(reimported.filter(item=>!item.resolvedAt&&item.subject==='personal').length,1,'resolved aliases never re-open a completed conflict');
  const recurrence=pendingReviewCodec.create({subject:'personal',ref:'personal',kept}),
    reopened=pendingReviewCodec.merge([[...reimported,recurrence]],limits.maxPendingReviews);
  assert.equal(reopened.filter(item=>!item.resolvedAt&&item.subject==='personal').length,2,'a fresh occurrence is not suppressed by a content-free resolved tombstone');
  const firstSession=pendingReviewCodec.create({subject:'session',ref:'session',kept:revisionedSession('2026-08-29','same',{revision:7})}),
    secondSession=pendingReviewCodec.create({subject:'session',ref:'session',kept:revisionedSession('2026-08-29','same',{revision:9,updatedAt:'2026-08-29T10:00:00.000Z'})});
  const sessionMerged=pendingReviewCodec.merge([[firstSession,secondSession]],limits.maxPendingReviews);
  assert.equal(sessionMerged.filter(item=>!item.resolvedAt).length,1,'session review dedup uses semantic study content, not ownership/control revisions');
  const firstDay=pendingReviewCodec.create({subject:'savedDay',ref:'2026-08-28',kept:record('2026-08-28','same')}),
    differentDay=pendingReviewCodec.create({subject:'savedDay',ref:'2026-08-28',kept:record('2026-08-28','changed')});
  assert.equal(pendingReviewCodec.merge([[firstDay,differentDay]],limits.maxPendingReviews).filter(item=>!item.resolvedAt).length,2,'different Saved-Day content is never collapsed');
}

async function makeCheckpoint({records=[],deletions=[],notes={},noteDeletions=[],activeSession=null,pendingReviews=[],personalData=personal(),installationId='inst_checkpoint_a',exportedAt='2026-08-20T14:00:00.000Z'}={}){
  const counts=codec.countShape({checkpointManifest:1,personalData:1,dailyRecord:records.length,note:Object.keys(notes).length,activeSession:activeSession?1:0,pendingReview:pendingReviews.length});
  const plan=freeze({studentName:'Checkpoint User',installationId,exportedAt,sourceRevision:exportedAt,recordDates:freeze(records.map(item=>item.date).sort()),savedDayDeletions:freeze(deletions),noteItems:freeze(Object.values(notes)),noteDeletions:freeze(noteDeletions),counts});
  const algorithm=codec.checksumAlgorithm(),manifest=codec.createManifest(plan,{compression:'none',algorithm});
  let seq=0;const hashes=[],lines=[JSON.stringify(manifest)];
  const add=async(type,items)=>{if(!items.length)return;const chunk=await codec.encodeChunk(seq++,type,items,algorithm);hashes.push(chunk.checksum);lines.push(chunk.line);};
  await add('checkpointManifest',[codec.createProtectedManifest(plan,manifest.checkpoint)]);
  await add('dailyRecord',records);
  await add('note',Object.values(notes));
  if(activeSession)await add('activeSession',[activeSession]);
  await add('pendingReview',pendingReviews);
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

// This device's base (what it last shared through Drive), kept in memory the
// way the host keeps it: notes, one fingerprint per Saved Day, and the plans
// and session fingerprints.
function baseStore(state){
  const base=()=>state.reconciliationBase;
  return {
    reconciliationBaseRead:async()=>base()?freeze({format:'study-director.reconciliation-base',version:base().version||3,checkpointId:base().checkpointId,establishedAt:base().establishedAt||new Date().toISOString(),noteCount:Number(base().noteCount??Object.keys(base().notes||{}).length),noteKeyFingerprint:String(base().noteKeyFingerprint||'0'.repeat(64)),personalFingerprint:String(base().personalFingerprint||''),sessionFingerprint:String(base().sessionFingerprint||''),sessionContentFingerprint:base().sessionContentFingerprint??null,personalFields:base().personalFields||null}):null,
    reconciliationBaseReadNotes:async keys=>freeze(Object.fromEntries(keys.filter(key=>Object.prototype.hasOwnProperty.call(base()?.notes||{},key)).map(key=>[key,freeze({label:String(base().notes[key]?.label??''),text:String(base().notes[key]?.text??'')})]))),
    reconciliationBaseReadDays:async dates=>freeze(Object.fromEntries((dates||[]).filter(date=>Object.prototype.hasOwnProperty.call(base()?.days||{},date)).map(date=>[date,base().days[date]]))),
    reconciliationBaseReadDayAncestry:async(dates,checkpointId)=>{assert.equal(checkpointId,base()?.checkpointId,'a stale shared ancestor cannot be used');return freeze(Object.fromEntries((dates||[]).filter(date=>Object.hasOwn(base()?.days||{},date)).map(date=>[date,freeze({full:base().days[date],semantic:base()?.semanticDays?.[date]??null})])));},
    reconciliationBaseWrite:async(checkpointId,spec)=>{
      assert.equal(spec?.format,'study-director.reconciliation-base-update');assert.ok([3,4].includes(spec.version));
      const current=base();if(!spec.full&&current?.checkpointId!==spec.baseCheckpointId)return false;
      const notes=Object.assign(Object.create(null),spec.full?{}:current?.notes||{}),days=Object.assign(Object.create(null),spec.full?{}:current?.days||{}),semanticDays=Object.assign(Object.create(null),spec.full?{}:current?.semanticDays||{});
      for(const key of spec.deletes||[])delete notes[key];for(const [key,value] of Object.entries(spec.updates||{}))notes[key]=freeze({label:String(value.label),text:String(value.text)});
      for(const [month,value] of Object.entries(spec.days||{})){for(const date of Object.keys(days))if(date.startsWith(month+'-'))delete days[date];Object.assign(days,value||{});}
      for(const [month,value] of Object.entries(spec.semanticDays||{})){for(const date of Object.keys(semanticDays))if(date.startsWith(month+'-'))delete semanticDays[date];Object.assign(semanticDays,value||{});}
      const keys=spec.full?[...spec.noteKeys].sort():null,kept=(value,old)=>value===null?String(old||''):String(value);
      state.reconciliationBase=freeze({version:spec.version===4?5:4,checkpointId,establishedAt:new Date().toISOString(),noteCount:keys?keys.length:Number(spec.noteCount),noteKeyFingerprint:keys?await processing.run('checksum',{value:JSON.stringify(keys),algorithm:'sha256'}):String(spec.noteKeyFingerprint),personalFingerprint:kept(spec.personalFingerprint,current?.personalFingerprint),personalFields:spec.personalFingerprint===null?current?.personalFields||null:spec.personalFields,sessionFingerprint:kept(spec.sessionFingerprint,current?.sessionFingerprint),sessionContentFingerprint:spec.version===4?(spec.sessionContentFingerprint===null?current?.sessionContentFingerprint??null:spec.sessionContentFingerprint):null,notes:freeze(notes),days:freeze(days),semanticDays:freeze(semanticDays)});
      return true;
    }
  };
}

// inertTimers: scheduled engine work never fires, so a test drives every
// backup itself.
function createHarness(state,{decisions={},noteResolver=null,restoredFromFile=null,hasLiveTasks=false,fileMode='combine',extrasMode='keep',preflightFailure='',verificationFailure='',inertTimers=false,runtimeLimits=limits}={}){
  state.deletions??=[];state.noteDeletions??=[];state.attachmentDeletions??=[];state.reviews??=memoryPendingReviews(pendingReviewCodec,{limit:limits.maxPendingReviews});
  let injectedFailure=String(preflightFailure||''),verificationFault=String(verificationFailure||'');
  const verifying=()=>state.journal?.state?.phase==='verifying';
  const prompts=[];const statuses=[];const events=[];const diagnosticMarks=[];const fn=()=>false;
  const normalizeNotes=value=>Object.fromEntries(Object.entries(value||{}).map(([key,item])=>[key,normalizeArea(item,key)]).filter(([,item])=>item));
  // The file row shows the 'file' presentation's current message; record each one it shows.
  const presentation=createBackupPresentation();
  presentation.subscribe(()=>{const message=presentation.current('file')?.message||'';if(message&&statuses.at(-1)!==message)statuses.push(message);});
  const runtime=BackupModule.createRuntime(freeze({ports:freeze({
    configuration:freeze({appVersion:'QA_B3',backupVersion:RUNTIME_DATA_CONTRACT.schemas.Backup.version,starterSchedule:STARTER_SCHEDULE,limits:runtimeLimits}),
    
    persistence:freeze({
      activeSessionLoad:async()=>{if(injectedFailure==='session-read')return {ok:false,value:null,error:new Error('QA_FIXTURE session read failure'),storage:{idb:true}};if(verificationFault==='active-session'&&verifying())return {ok:true,value:null,error:null,storage:{idb:true}};return {ok:true,value:state.activeSession,error:null,storage:{idb:true}};},activeSessionSave:async value=>{
         events.push('preflight-session-save');
         if(injectedFailure==='session-save')return {ok:false,value:null,error:new Error('QA_FIXTURE session save failure')};
         if(injectedFailure==='session-save-local-only')return {ok:true,value,error:new Error('IndexedDB unavailable'),storage:{local:true,idb:false}};
         state.activeSession=injectedFailure==='session-save-readback-mismatch'?freeze({...value,revision:value.revision+1}):value;
         return {ok:true,value,storage:{local:false,idb:true}};
       },activeSessionClear:async()=>(state.activeSession=null,{ok:true}),activeSessionSettled:async()=>{if(injectedFailure==='session-settle')throw new Error('QA_FIXTURE session settle failure');return true;},
      dailyRecordBackupDates:async()=>({dates:[...state.records.keys()].sort(),warning:''}),dailyRecordBackupMonth:async month=>[...state.records.values()].filter(record=>String(record.date).startsWith(String(month)+'-')).sort((a,b)=>a.date.localeCompare(b.date)),dailyRecordDocuments:async dates=>verificationFault==='saved-days'&&verifying()?[]:dates.map(date=>state.records.get(date)).filter(Boolean),
      dailyRecordImportBatches:async values=>{if(values.length)events.push('days-import');for(const value of values){state.records.set(value.date,freeze({...value}));state.deletions=state.deletions.filter(item=>item.date!==value.date);}return {batches:values.length?1:0};},
      dailyRecordRemove:async date=>(events.push('days-remove'),state.records.delete(date),true),dailyRecordTimestamp:value=>Date.parse(value?.updatedAt||value?.savedAt||'')||0,
      notesExportPayload:()=>state.notes,notesReadFreshPayload:async()=>state.notes,notesReadFreshItems:async keys=>verificationFault==='notes'&&verifying()?(keys||[]).map(()=>null):(keys||[]).map(key=>state.notes[key]||null),notesFlush:async()=>{events.push('preflight-notes-flush');if(injectedFailure==='notes')throw new Error('QA_FIXTURE notes preflight failure');return true;},notesNormalizePayload:normalizeNotes,notesTrashKey:key=>String(key).startsWith('~')?'':'~deleted '+key,notesAlignByTitle:value=>value,notesFailure:()=>({failed:false}),
      restoreJournalPrepare:async value=>(state.journal={state:{id:value.id},payload:value}),restoreJournalRead:async()=>state.journal,restoreJournalMark:async(id,phase)=>(state.journal.state.phase=phase,state.journal.state),restoreJournalClear:async()=>(state.journal=null,true),
      personalSettle:async()=>{events.push('personal-settle');
        if(injectedFailure==='personal'||state.failPersonalSettle)throw new Error('QA_FIXTURE personal preflight failure');
        if(Object.prototype.hasOwnProperty.call(state,'pendingPlanDraft')){
          state.personal=freeze({...state.personal,plans:freeze({...state.personal.plans,draft:state.pendingPlanDraft})});
          delete state.pendingPlanDraft;
        }
        return true;},personalExport:async()=>state.personal,personalImport:async value=>{if(state.failPersonalImport)throw new Error('QA_FIXTURE rejected personal write');events.push('personal-import');state.personal=value;return true;},personalVerify:async value=>{if(verificationFault==='personal'&&verifying())throw new Error('QA_FIXTURE personal verification failure');assert.deepEqual(state.personal,value);},
      storageGeneration:()=>0,sourceRevision:async()=>'2026-08-23T00:00:00.000Z',snapshotRevision:async()=>'stable-b3',canonicalMutationEpochRead:async()=>null,canonicalPreparationRebase:async()=>Object.freeze({epoch:null,stamps:Object.freeze([])}),preparationUnitStamps:async()=>[],preparationUnitReplace:async()=>[],installationId:()=>state.installationId||'inst_device_local',deletionRecoveryFlush:async()=>{events.push('preflight-deletion-flush');if(injectedFailure==='deletions')throw new Error('QA_FIXTURE deletion preflight failure');if(injectedFailure==='deletions-false')return false;if(injectedFailure==='deletions-unknown')return undefined;return true;},
      deletionRecoverySavedDays:async()=>verificationFault==='deletions'&&verifying()?[{date:'2026-01-01',deletedAt:'2026-01-01T00:00:00.000Z'}]:state.deletions.map(value=>({...value})),deletionRecoveryReplaceSavedDays:async values=>(events.push('day-ledger'),state.deletions=(values||[]).map(value=>({...value})),true),deletionRecoveryNotes:async()=>state.noteDeletions.map(value=>({...value})),deletionRecoveryReplaceNotes:async values=>(state.noteDeletions=(values||[]).map(value=>({...value})),true),deletionRecoveryAttachments:async()=>state.attachmentDeletions.map(value=>({...value})),deletionRecoveryReplaceAttachments:async values=>(state.attachmentDeletions=(values||[]).map(value=>({...value})),true),deletionRecoveryClearAttachment:async assetId=>(state.attachmentDeletions=state.attachmentDeletions.filter(item=>item.assetId!==assetId),true),...baseStore(state),...state.reviews.ports,
      pendingReviewsResolve:async ids=>{
        if(state.failReviewAck){state.failReviewAck=false;throw new Error('QA_FIXTURE review receipt failed');}
        return state.reviews.ports.pendingReviewsResolve(ids);
      },
      pendingReviewsReadItems:async ids=>verificationFault==='pending-reviews'&&verifying()?(ids||[]).map(()=>null):state.reviews.ports.pendingReviewsReadItems(ids)
    }),
    assets:freeze({get:async()=>null,put:async()=>true,keys:async()=>[],list:async()=>{if(verificationFault==='attachments'&&verifying())throw new Error('QA_FIXTURE attachment verification failure');return [];},importAll:async()=>0,restoreAll:async()=>true,removeMany:async()=>0,removeMetadata:async()=>0,scheduleMaintenance:fn}),
    exports:freeze({...processing,followProtection:async value=>{(state.followed??=[]).push({...value});return false;},backgroundAvailable:()=>true,protect:async file=>typeof file==='function'?await file():freeze({...file,encrypted:false,protectionId:'',checkProtection:async()=>{}}),unprotect:async blob=>({blob,encrypted:false}),check:fn,job:fn=>fn(),download:fn,chooseSave:async()=>null,save:async()=>({status:'downloaded'})}),
    codecs:freeze({activeSession:activeSessionCodec,backup:runtimeCodec,dailyRecord:dailyRecordCodec,pendingReview:pendingReviewCodec}),
    reconciliation:freeze({createPlan:ReconciliationModule.createPlan,resolvePlan:ReconciliationModule.resolvePlan,summarizePlan:ReconciliationModule.summarizePlan,savedDayContentValue:ReconciliationModule.savedDayContentValue}),noteReconciliation:freeze({merge:paragraphMerge,resolve:async options=>noteResolver?noteResolver(options,state):freeze({format:'study-director.note-reconciliation-result',version:1,notes:freeze(Object.fromEntries((options.conflicts||[]).map(item=>[item.key,freeze({text:options.manualOnly&&decisions.reflections==='incoming'?item.incomingValue:item.localValue,localCandidateId:item.localCandidateId,incomingCandidateId:item.incomingCandidateId})])))})}),
    session:freeze({canMutate:()=>true,cancelLiveDraftSave:()=>events.push('preflight-session-cancel'),captureSnapshot:()=>hasLiveTasks&&state.activeSession?state.activeSession.snapshot:null,hasActiveSession:()=>!!state.activeSession&&state.running!==false&&state.activeSession.runningOn===(state.installationId||'inst_device_local'),hasTasks:()=>hasLiveTasks,toActiveSession:()=>hasLiveTasks?state.activeSession:null,withPersistenceSuppressed:async operation=>operation(),yieldSession:async()=>{events.push('session-yield');state.activeSession=freeze({...state.activeSession,status:'suspended',...(state.yieldAddsProgress?{snapshot:freeze({...state.activeSession.snapshot,label:'A-FINAL-TICK'})}:{})});state.running=false;return true;}}),
    domain:freeze({clampText:(value,max=100000)=>String(value??'').slice(0,max),filenameSafeStudentName:()=> 'student',getStudentName:()=>state.personal.preferences.studentName,materializeDailyRecordView:value=>value,sanitizeCurrentDailyRecord:dailyRecordCodec.sanitizeCurrentDailyRecord,todayISO:()=> '2026-08-31'}),
    view:freeze({presentation,refreshPnote:fn,refreshReview:fn,renderSchedule:fn}),
    events:freeze({libraryChanged:fn,backupCompleted:fn,
      reconcileNotes:async(payload,deletions=[])=>{state.notes=normalizeNotes({...state.notes,...payload});const deletedKeys=new Set((deletions||[]).map(item=>String(item.key)));for(const key of deletedKeys)delete state.notes[key];state.noteDeletions=state.noteDeletions.filter(item=>!Object.hasOwn(state.notes,item.key)&&!Object.values(payload||{}).some(note=>note&&note.key===item.key));for(const item of deletions||[]){state.noteDeletions=state.noteDeletions.filter(existing=>existing.key!==item.key);state.noteDeletions.push({...item});}for(const note of Object.values(payload||{}))state.noteDeletions=state.noteDeletions.filter(item=>item.key!==note.key);events.push('notes');return state.notes;},
      restoreNotesSnapshot:async payload=>{state.notes=normalizeNotes(payload);events.push('notes-rollback');return state.notes;},
      // This fixture's state.schedule is the applied runtime schedule, not
      // the independent Plan working draft. Production restore derives it from
      // the canonical Active Session; the backup layer no longer transports a
      // second session→draft schedule argument.
      restoreSessionState:async value=>(state.activeSession=value,state.schedule=String(value&&value.scheduleText||''),events.push('session'),true),
      verifyActiveSessionRuntime:async expected=>(assert.deepEqual(state.activeSession,expected),true),
      restoredFromFile:()=>{events.push('restored-from-file');return restoredFromFile?restoredFromFile(state):false;}
    }),
    operations:freeze({canShare:()=>true,assertAuthority:()=>{if(injectedFailure==='ownership')throw new Error('QA_FIXTURE ownership failure');return true;},clearFault:fn,failClosed:message=>{throw new Error(String(message));},runExclusive:async(kind,operation)=>operation()}),
    interactions:freeze({choose:async options=>{prompts.push(options);return options&&options.title==='Use this backup'?fileMode:options&&options.title==='Keep what isn’t in this backup?'?extrasMode:null;},configure:async config=>{prompts.push(config);
      if(config.title==='Kept versions'&&Object.prototype.hasOwnProperty.call(state,'draftEditedDuringReview')){
        state.pendingPlanDraft=state.draftEditedDuringReview;delete state.draftEditedDuringReview;
      }
      const out={...decisions};for(const group of config.groups||[]){if(group.id.startsWith('kept__')){out[group.id]=state.keptSelections?.[group.id]||state.keptSelections?.[group.id.split('__').slice(2).join('__')]||state.keptChoice||group.defaultValue;continue;}if(group.id.startsWith('savedDay__')){const remoteRecord=group.choices.find(choice=>String(choice.label||'').startsWith('Use '));const remoteDeletion=group.choices.find(choice=>String(choice.label||'').startsWith('Apply deletion'));if(decisions.dailyRecords==='replace'&&remoteRecord)out[group.id]=remoteRecord.value;else if(decisions.savedDayDeletions==='apply'&&remoteDeletion)out[group.id]=remoteDeletion.value;else out[group.id]=group.defaultValue;}else if(String(group.label||'').startsWith('Note · ')){const remoteDeletion=group.choices.find(choice=>choice.label==='Delete it');out[group.id]=(decisions.noteByKey?.[String(group.label).slice('Note · '.length)]||decisions.noteDeletions)==='apply'&&remoteDeletion?remoteDeletion.value:group.defaultValue;}else if(group.id==='activeSession'){const incoming=group.choices.find(choice=>String(choice.label||'').startsWith('Use session'));out.activeSession=decisions.activeSession==='checkpoint'&&incoming?incoming.value:group.defaultValue;}}return freeze(out);},notify:fn}),
    environment:freeze({AbortController,clearTimeout:inertTimers?()=>{}:clearTimeout,yieldTask:async()=>{},setTimeout:inertTimers?()=>0:callback=>(callback(),1)}),diagnostics:freeze({capture:fn,start:()=>'',mark:(name,details={})=>(diagnosticMarks.push([String(name),details]),true),finish:()=>false,fail:()=>false})
  })}));
  return {runtime,prompts,statuses,events,diagnosticMarks,setPreflightFailure:value=>{injectedFailure=String(value||'');}};
}

const checkpointRecords=[record('2026-08-02','checkpoint conflict older','2026-08-20T10:00:00.000Z'),record('2026-08-04','checkpoint revives local deletion','2026-08-20T10:30:00.000Z'),record('2026-08-05','checkpoint new','2026-08-20T11:00:00.000Z')];
const checkpointDeletions=freeze([{date:'2026-08-03',deletedAt:'2026-08-20T12:00:00.000Z'},{date:'2026-08-06',deletedAt:'2026-08-20T12:30:00.000Z'}]);
const checkpointNotes=freeze({Checkpoint:freeze({version:2,key:'Checkpoint',text:'checkpoint note',updatedAt:'2026-08-20T12:00:00.000Z'})});
const checkpointSession=session('2026-08-07','CHECKPOINT');
const blob=await makeCheckpoint({records:checkpointRecords,deletions:checkpointDeletions,notes:checkpointNotes,activeSession:checkpointSession});

// Restore-preflight failures must identify the exact local safety stage without exposing study content.
const preflightCases=[
  ['ownership','RESTORE_PREFLIGHT_OWNERSHIP_LOST',false],
  ['notes','RESTORE_PREFLIGHT_NOTES_FAILED',false],
  ['deletions','RESTORE_PREFLIGHT_DELETION_FAILED',false],
  ['deletions-false','RESTORE_PREFLIGHT_DELETION_FAILED',false],
  ['deletions-unknown','RESTORE_PREFLIGHT_DELETION_FAILED',false],
  ['personal','RESTORE_PREFLIGHT_PERSONAL_FAILED',false],
  ['session-save','RESTORE_PREFLIGHT_SESSION_SAVE_FAILED',true],
  ['session-save-local-only','RESTORE_PREFLIGHT_SESSION_SAVE_FAILED',true],
  ['session-save-readback-mismatch','RESTORE_PREFLIGHT_SESSION_SAVE_FAILED',true],
  ['session-settle','RESTORE_PREFLIGHT_SESSION_SETTLE_FAILED',true],
  ['session-read','RESTORE_PREFLIGHT_SESSION_READ_FAILED',false]
];
// A limit the module reads but is not given would become 0 or no limit at
// all (the review merge then kept no resolved reviews, Entry 022): start-up
// refuses it instead.
for(const key of ['maxPendingReviews','maxNoteLinks']){
  const without=freeze(Object.fromEntries(Object.entries(limits).filter(([name])=>name!==key)));
  assert.throws(()=>createHarness(createState(),{runtimeLimits:without}),new RegExp(`Backup configuration is missing limits: ${key}\\.`,'u'),`the Backup module refuses to start without ${key}`);
}
for(const [stage,code,hasLiveTasks] of preflightCases){
  const preflightState=createState();
  if(hasLiveTasks)preflightState.activeSession=session('2026-08-31','PREFLIGHT');
  const preflightHarness=createHarness(preflightState,{hasLiveTasks});
  const preflightCandidate=await preflightHarness.runtime.controller.inspect(blob,{filename:`preflight-${stage}.sdbackup`});
  preflightHarness.setPreflightFailure(stage);
  await assert.rejects(()=>preflightHarness.runtime.controller.restore(preflightCandidate),error=>{
    assert.equal(error.code,code);assert.equal(error.backupStage,stage.startsWith('deletions')?'deletions':stage.startsWith('session-save')?'session-save':stage);return true;
  });
  assert.equal(preflightHarness.diagnosticMarks.at(-1)[0],`restore-preflight-${stage.startsWith('deletions')?'deletions':stage.startsWith('session-save')?'session-save':stage}-failed`);
  assert.equal(preflightHarness.diagnosticMarks.at(-1)[1].errorCode,code);
}

const verificationReview=pendingReviewCodec.create({subject:'note',ref:'Checkpoint',kept:freeze({text:checkpointNotes.Checkpoint.text}),keptAt:'2026-08-20T13:00:00.000Z'});
const verificationBlob=await makeCheckpoint({records:checkpointRecords,deletions:checkpointDeletions,notes:checkpointNotes,activeSession:checkpointSession,pendingReviews:[verificationReview]});
// This fixture has no physical attachment payload, so changed-only verification
// correctly does not enter the attachment domain here; restore-assets owns that
// physical corruption coverage. Every case below creates a real mutation in the
// domain whose diagnostic stage it expects.
const verificationCases=freeze([
  freeze({domain:'saved-days',decisions:freeze({})}),
  freeze({domain:'notes',decisions:freeze({})}),
  freeze({domain:'personal',decisions:freeze({plans:'replace',personalSettings:'replace'})}),
  freeze({domain:'pending-reviews',decisions:freeze({})}),
  freeze({domain:'deletions',decisions:freeze({})}),
  freeze({domain:'active-session',decisions:freeze({})})
]);
for(const {domain,decisions} of verificationCases){
  const verificationState=createState(),verificationHarness=createHarness(verificationState,{verificationFailure:domain,decisions});
  const verificationCandidate=await verificationHarness.runtime.controller.inspect(verificationBlob,{filename:`verification-${domain}.sdbackup`});
  await assert.rejects(()=>verificationHarness.runtime.controller.restore(verificationCandidate),error=>{assert.equal(error.backupStage,`restore-verification-${domain}`);assert.equal(error.code,'RESTORE_VERIFICATION_MISMATCH');return true;});
  assert.ok(verificationHarness.diagnosticMarks.some(([name,details])=>name===`restore-verification-${domain}-failed`&&details.stage===`restore-verification-${domain}`),`${domain} verification must identify its exact diagnostic stage`);
}



// Format/protection boundary: public provenance is separate from integrity-covered authority/deletion metadata.
const parsed=await codec.inspectCurrent(blob,{filename:'checkpoint.sdbackup'});
assert.equal(parsed.formatVersion,23);
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
assert.ok(Object.keys(bulkGroup.choices[1].applyValues).every(id=>id.startsWith('savedDay__')),'Saved-Day bulk controls must never alter Note or Active-Session choices.');

// Many genuinely different study-quality and reflection records must still
// use one bounded bulk-decision surface. Reflection-only differences are
// intentionally handled by the more focused text comparison, not bulk choice.
const manyDates=Array.from({length:28},(_,index)=>`2026-06-${String(index+1).padStart(2,'0')}`),manyState=createState();manyState.records=new Map(manyDates.map((date,index)=>[date,record(date,`local ${index+1}`,'2026-09-01T12:00:00.000Z')]));manyState.deletions=[];manyState.notes={};manyState.activeSession=null;manyState.schedule='';const manyIncoming=manyDates.map((date,index)=>({...record(date,`backup ${index+1}`,'2026-09-02T12:00:00.000Z'),studyQuality:2})),manyBlob=await makeCheckpoint({records:manyIncoming,exportedAt:'2026-09-02T13:00:00.000Z'}),manyHarness=createHarness(manyState,{decisions:{dailyRecords:'replace',reflections:'incoming'}});await manyHarness.runtime.controller.restore(await manyHarness.runtime.controller.inspect(manyBlob,{filename:'many-saved-day-conflicts.sdbackup'}));const manyPrompt=manyHarness.prompts.find(prompt=>prompt.groups?.some(group=>group.id==='savedDaysBulk')),manyBulk=manyPrompt?.groups.find(group=>group.id==='savedDaysBulk'),manyGroups=manyPrompt?.groups.filter(group=>String(group.id||'').startsWith('savedDay__'))||[];assert.ok(manyPrompt,'Many Saved-Day conflicts must still use one consolidated conflict surface.');assert.equal(manyGroups.length,manyDates.length,'Every conflicting Saved Day must remain an individually overridable atomic decision.');assert.equal(Object.keys(manyBulk.choices[0].applyValues).length,manyDates.length);assert.equal(Object.keys(manyBulk.choices[1].applyValues).length,manyDates.length);assert.ok(Object.keys(manyBulk.choices[0].applyValues).every(id=>id.startsWith('savedDay__')));assert.deepEqual([...manyState.records.keys()].sort(),manyDates);for(const [index,date] of manyDates.entries())assert.equal(manyState.records.get(date).reflection,`backup ${index+1}`,'Bulk incoming choice must replace the complete Saved-Day record, not merge fields.');
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
  notes:{Gone:normalizeArea({key:'Gone',text:'stale remote note',updatedAt:'2026-08-24T11:00:00.000Z'},'Gone')},
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
const noteGroups=harness=>harness.prompts.flatMap(config=>config.groups||[]).filter(group=>String(group.label||'').startsWith('Note'));
assert.equal(noteGroups(explicitNoteDeleteHarness).length,1,'A deletion the backup made of a note this device still has is asked about.');
// The backup deleted the note and holds this device's very text in Recently deleted: the deletion applies without asking.
const trashCopyState=createState();trashCopyState.notes={Keep:normalizeArea({key:'Keep',text:'live local note',updatedAt:'2026-08-24T10:00:00.000Z'},'Keep')};trashCopyState.noteDeletions=[];
const trashCopyHarness=createHarness(trashCopyState);
await trashCopyHarness.runtime.controller.restore(await trashCopyHarness.runtime.controller.inspect(await makeCheckpoint({notes:{'~deleted Keep':normalizeArea({key:'~deleted Keep',text:'live local note',updatedAt:'2026-08-24T14:00:00.000Z'},'~deleted Keep')},noteDeletions:[{key:'Keep',deletedAt:'2026-08-24T14:00:00.000Z'}],installationId:'inst_note_trash_remote'}),{filename:'note-trash-copy.sdbackup'}));
assert.equal(Object.hasOwn(trashCopyState.notes,'Keep'),false,'A deletion whose deleted copy holds this device’s text applies by itself.');assert.equal(trashCopyState.notes['~deleted Keep'].text,'live local note','The text stays in Recently deleted.');
assert.equal(noteGroups(trashCopyHarness).length,0,'Nothing is asked when nothing on this device can be lost.');
// A note renamed with no shared history: one question for all titles; the backup's titles are used when chosen.
const titleState=createState();titleState.notes={Renamed:normalizeArea({key:'Renamed',label:'Old title',text:'same text',updatedAt:'2026-08-24T10:00:00.000Z'},'Renamed')};titleState.noteDeletions=[];
const titleHarness=createHarness(titleState,{decisions:{noteTitles:'incoming'}});
await titleHarness.runtime.controller.restore(await titleHarness.runtime.controller.inspect(await makeCheckpoint({notes:{Renamed:normalizeArea({key:'Renamed',label:'New title',text:'same text',updatedAt:'2026-08-24T12:00:00.000Z'},'Renamed')},installationId:'inst_note_title_remote'}),{filename:'note-title.sdbackup'}));
assert.deepEqual(noteGroups(titleHarness).map(group=>group.id),['noteTitles'],'Differing titles are one question.');
// Linked notes from both sides are kept: nothing is lost, nothing is asked.
const linkA='n_'+'a'.repeat(16),linkB='n_'+'b'.repeat(16),linkState=createState();linkState.notes={Linked:normalizeArea({key:'Linked',text:'same text',links:[linkA],updatedAt:'2026-08-24T10:00:00.000Z'},'Linked')};linkState.noteDeletions=[];
const linkHarness=createHarness(linkState);
await linkHarness.runtime.controller.restore(await linkHarness.runtime.controller.inspect(await makeCheckpoint({notes:{Linked:normalizeArea({key:'Linked',text:'same text',links:[linkB],updatedAt:'2026-08-24T12:00:00.000Z'},'Linked')},installationId:'inst_note_links_remote'}),{filename:'note-links.sdbackup'}));
assert.deepEqual([...linkState.notes.Linked.links],[linkA,linkB]);assert.equal(noteGroups(linkHarness).length,0);assert.equal(titleState.notes.Renamed.label,'New title');assert.equal(titleState.notes.Renamed.text,'same text');

// Distinct names that formerly sanitized to the same ID must retain independent choices through restore.
const collisionState=createState();collisionState.notes=Object.fromEntries(['a b','a_b'].map(key=>[key,normalizeArea({key,text:'keep '+key,updatedAt:'2026-08-24T10:00:00.000Z'},key)]));
const collisionHarness=createHarness(collisionState,{decisions:{noteByKey:{'a b':'keep','a_b':'apply'}}});
const collisionBlob=await makeCheckpoint({noteDeletions:['a b','a_b'].map(key=>({key,deletedAt:'2026-08-24T14:00:00.000Z'}))});
await collisionHarness.runtime.controller.restore(await collisionHarness.runtime.controller.inspect(collisionBlob,{filename:'independent-note-decisions.sdbackup'}));
assert.equal(collisionState.notes['a b'].text,'keep a b');assert.equal(Object.hasOwn(collisionState.notes,'a_b'),false);
assert.deepEqual(collisionState.noteDeletions.map(item=>item.key),['a_b']);

// Explicit incoming choices: selected checkpoint states are applied, but unrelated local Saved Days survive.
const combineState=createState({withActive:true});
const combineHarness=createHarness(combineState,{decisions:{dailyRecords:'replace',reflections:'incoming',savedDayDeletions:'apply',activeSession:'checkpoint',plans:'replace',personalSettings:'replace'}});
const combineCandidate=await combineHarness.runtime.controller.inspect(blob,{filename:'checkpoint.sdbackup'});
const combineResult=await combineHarness.runtime.controller.restore(combineCandidate);
assert.equal(combineResult.mode,'reconcile');
assert.equal(combineState.records.get('2026-08-01').reflection,'local only','Reconciliation must preserve unrelated local Saved Days.');
assert.equal(combineState.records.get('2026-08-02').reflection,'checkpoint conflict older','Explicit checkpoint choice must win even when its timestamp is older.');
assert.equal(combineState.records.has('2026-08-03'),false,'Explicit checkpoint deletion must remove the matching local Saved Day.');
assert.equal(combineState.records.get('2026-08-04').reflection,'checkpoint revives local deletion','Checkpoint record choice must be able to replace a local deletion.');
assert.equal(combineState.records.get('2026-08-05').reflection,'checkpoint new');
assert.deepEqual(combineState.deletions.map(item=>item.date),['2026-08-03','2026-08-06']);
assert.deepEqual(Object.keys(combineState.notes).sort(),['Checkpoint','Local'],'Reconciliation must add missing Areas without clearing local-only notes.');
assert.equal(combineState.activeSession.date,'2026-08-07','Handoff must restore a non-today interrupted session.');
assert.match(combineState.schedule,/CHECKPOINT/u);
assert.equal(combineState.personal.preferences.studentName,'Checkpoint User');
assert.equal(combineHarness.prompts.some(prompt=>prompt.groups?.some(group=>group.id==='restoreMode')),false,'Current checkpoints must use one reconciliation flow rather than exposing Import versus Handoff.');

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
assert.equal(keepHarness.events.includes('personal-import'),false,'Keeping local Personal Data must not rewrite it during Combine.');

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
const liveFlushBlob=await makeCheckpoint({records:[],deletions:[],notes:{},activeSession:null});
await liveFlushHarness.runtime.controller.restore(await liveFlushHarness.runtime.controller.inspect(liveFlushBlob,{filename:'checkpoint-live-flush.sdbackup'}));
assert.ok(liveFlushHarness.events.includes('preflight-session-cancel')&&liveFlushHarness.events.includes('preflight-session-save'),'Restore preflight must settle the live Active Session before reconciliation planning.');

// Presence semantics: an explicit checkpoint with no Active Session cannot clear a local active/suspended session.
const noSessionBlob=await makeCheckpoint({records:[],deletions:[],notes:{},activeSession:null});
const clearState=createState({withActive:true});
const clearHarness=createHarness(clearState,{decisions:{activeSession:'checkpoint',plans:'keep',personalSettings:'keep'}});
const clearCandidate=await clearHarness.runtime.controller.inspect(noSessionBlob,{filename:'checkpoint-no-session.sdbackup'});
await clearHarness.runtime.controller.restore(clearCandidate);
assert.equal(clearState.activeSession.date,'2026-08-10','Checkpoint absence must not clear a local Active Session.');



// CR3 Note reconciliation remains scratch-only until the resolved note enters the journaled restore commit.
const noteState=createState();
noteState.notes.Shared=freeze({version:2,key:'Shared',text:'Local sentence. Local-only detail.',updatedAt:'2026-08-22T15:00:00.000Z'});
const noteBlob=await makeCheckpoint({notes:{Shared:freeze({version:2,key:'Shared',text:'Local sentence. Imported addition.',updatedAt:'2026-08-23T15:00:00.000Z'})},installationId:'inst_note_remote'});
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
const staleBlob=await makeCheckpoint({notes:{Shared:freeze({version:2,key:'Shared',text:'Incoming alternative.',updatedAt:'2026-08-23T15:00:00.000Z'})},installationId:'inst_stale_remote'});
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
const replaceHarness=createHarness(replaceState,{fileMode:'replace',extrasMode:'remove'});
const replaceBlob=await makeCheckpoint({records:[record('2026-08-30','standalone exact replacement')],installationId:'inst_file_replace'});
Object.defineProperty(replaceBlob,'name',{value:'file-replace.sdbackup',configurable:true});
const replaceInput={files:[replaceBlob],value:'selected'};
const localDates=[...replaceState.records.keys()].sort();
await replaceHarness.runtime.controller.importLocal({target:replaceInput});
const extrasPrompt=replaceHarness.prompts.find(options=>options.title==='Keep what isn’t in this backup?');
assert.ok(extrasPrompt&&extrasPrompt.message.includes(`${localDates.length} Saved Days`),'Replace asks once about Saved Days the backup neither has nor deleted.');
assert.deepEqual([...replaceState.records.keys()],['2026-08-30'],'Replace with “Remove them” removes portable Saved Days absent from the selected backup.');
assert.deepEqual(replaceState.deletions.map(item=>item.date).filter(date=>localDates.includes(date)).sort(),localDates,'Saved Days removed on purpose are recorded as deleted, so a later combine does not bring them back.');
// “Keep them” (the default) keeps what the backup neither has nor deleted.
const extrasKeepState=createState(),extrasKeepHarness=createHarness(extrasKeepState,{fileMode:'replace'}),extrasKeptDates=[...extrasKeepState.records.keys()].sort(),extrasKeepBlob=await makeCheckpoint({records:[record('2026-08-30','standalone exact replacement')],installationId:'inst_file_replace_keep'});
Object.defineProperty(extrasKeepBlob,'name',{value:'file-replace-keep.sdbackup',configurable:true});
await extrasKeepHarness.runtime.controller.importLocal({target:{files:[extrasKeepBlob],value:'selected'}});
assert.deepEqual([...extrasKeepState.records.keys()].sort(),[...extrasKeptDates,'2026-08-30'].sort(),'Replace with “Keep them” keeps Saved Days the backup neither has nor deleted.');
assert.equal(extrasKeepState.records.get('2026-08-30').reflection,'standalone exact replacement');
assert.equal(replaceState.records.get('2026-08-30').reflection,'standalone exact replacement');
assert.equal(replaceInput.value,'','standalone Replace should reset the file input after verified completion.');

// A → B → A sequential Combine: later divergence, explicit deletion and interrupted-session state remain coherent.
const aRoundTrip=createState({withActive:true});
const aFirstBlob=await makeCheckpoint({
  records:[...aRoundTrip.records.values()],deletions:aRoundTrip.deletions,notes:aRoundTrip.notes,
  activeSession:aRoundTrip.activeSession,personalData:aRoundTrip.personal,installationId:'inst_device_a',exportedAt:'2026-08-24T08:00:00.000Z'
});
const bRoundTrip={records:new Map(),deletions:[],notes:{},activeSession:null,schedule:'',personal:personal('Device B'),journal:null};
const bFirstHarness=createHarness(bRoundTrip,{decisions:{dailyRecords:'replace',reflections:'incoming',savedDayDeletions:'apply',activeSession:'checkpoint',plans:'replace',personalSettings:'replace'}});
await bFirstHarness.runtime.controller.restore(await bFirstHarness.runtime.controller.inspect(aFirstBlob,{filename:'a-to-b.sdbackup'}));
assert.equal(bRoundTrip.records.get('2026-08-02').reflection,'local conflict newer');
assert.equal(bRoundTrip.activeSession.date,'2026-08-10');
// Both devices now diverge independently after the first Combine.
aRoundTrip.records.set('2026-08-02',record('2026-08-02','A divergent after handoff','2026-08-26T12:00:00.000Z'));
aRoundTrip.records.set('2026-08-13',record('2026-08-13','A local-only after handoff','2026-08-26T13:00:00.000Z'));
bRoundTrip.records.set('2026-08-02',record('2026-08-02','B divergent authoritative choice','2026-08-25T09:00:00.000Z'));
bRoundTrip.records.delete('2026-08-03');
bRoundTrip.deletions=[...bRoundTrip.deletions.filter(item=>item.date!=='2026-08-03'),{date:'2026-08-03',deletedAt:'2026-08-25T09:05:00.000Z'}];
bRoundTrip.records.set('2026-08-11',record('2026-08-11','B new day','2026-08-25T09:10:00.000Z'));
bRoundTrip.activeSession=session('2026-08-12','DEVICE-B');bRoundTrip.schedule=bRoundTrip.activeSession.scheduleText;
const bReturnBlob=await makeCheckpoint({
  records:[...bRoundTrip.records.values()],deletions:bRoundTrip.deletions,notes:bRoundTrip.notes,
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

let syncWorld=null;
// Drive sync between two devices. Each takes in what the other changed before
// uploading its own: a change made on one side only needs no choice, a
// difference made on both waits for the person, and a session running here
// keeps its own state while everything else merges.
{
  const drive=new Map(),key=(kind,id)=>kind+':'+id,keepAll={on:false};
  const describe=file=>freeze({kind:file.kind,id:file.id,name:file.name,size:file.blob.size,createdAt:file.createdAt,modifiedAt:file.createdAt,digest:file.digest,remoteId:'remote-'+key(file.kind,file.id),...(file.historySummary?{history:freeze({...file.historySummary,exportedAt:file.exportedAt})}:{})});
  const store=files=>freeze({
    list:async({kind})=>freeze({items:freeze([...files.values()].filter(file=>file.kind===kind).map(describe)),overflow:false}),
    upload:async file=>{const stored=freeze({...file,createdAt:new Date().toISOString()});files.set(key(file.kind,file.id),stored);return describe(stored);},
    download:async ref=>{const stored=files.get(key(ref.kind,ref.id));if(!stored)throw new Error('QA_FIXTURE missing backup file');return freeze({blob:stored.blob,release:async()=>{}});},
    // A test can hold on to every version (all of them fall in one hour, so
    // retention would keep only the newest).
    delete:async ref=>{if(!keepAll.on)files.delete(key(ref.kind,ref.id));}
  }),transport=store(drive),versions=files=>[...files.values()].filter(file=>file.kind==='checkpoint'&&file.historySummary?.retention?.role!=='before-restore').map(file=>file.id).sort();
  const head=()=>[...drive.values()].filter(file=>file.kind==='checkpoint'&&file.historySummary?.retention?.role!=='before-restore').sort((a,b)=>Date.parse(b.exportedAt)-Date.parse(a.exportedAt))[0]?.id||'';
  // Session ownership claims on Drive, shared by the devices that use them.
  const claims=new Map(),claimItem=file=>freeze({kind:'session-claim',id:file.id,name:file.name,size:file.blob.size,digest:file.digest,serverDigest:file.digest,createdAt:file.exportedAt,modifiedAt:file.exportedAt,remoteId:'claim-'+file.id});
  const claimTransport=freeze({...transport,
    listSessionClaims:async()=>freeze({items:freeze([...claims.values()].map(claimItem)),overflow:false,ignored:0}),
    uploadSessionClaim:async file=>{claims.set(file.id,freeze({...file}));return claimItem(file);},
    downloadSessionClaim:async item=>{const file=claims.get(item.id);if(!file)throw new Error('QA_FIXTURE missing session claim');return freeze({blob:file.blob,release:async()=>{}});},
    deleteSessionClaim:async item=>claims.delete(item.id)
  });
  // folder: this device also backs up to a Device Folder of its own.
  // claims: it takes part in session ownership claims (Continue here).
  const device=(state,{folder=null,claims:claiming=false}={})=>{
    // A review of kept versions takes state.keptChoice ('use' or the default)
    // and, for note texts, state.reviewText(conflict) or the current text.
    const reviewTexts=(options,current)=>freeze({format:'study-director.note-reconciliation-result',version:1,notes:freeze(Object.fromEntries((options.conflicts||[]).map(item=>[item.key,freeze({text:typeof current.reviewText==='function'?current.reviewText(item,options):item.localValue,localCandidateId:item.localCandidateId,incomingCandidateId:item.incomingCandidateId})])))});
    const harness=createHarness(state,{noteResolver:reviewTexts,inertTimers:!!folder}),providers=harness.runtime.providers,recovery=ManagedRecoveryModule.createCoordinator(freeze({
      automaticBackup:freeze({suspend:async()=>freeze({}),resume:async()=>true}),diagnostics:freeze({capture:()=>{},mark:()=>false}),
      lifecycle:freeze({settle:async()=>{},quiesce:async operation=>operation(),revision:()=>'2026-08-23T00:00:00.000Z',rebuild:async()=>{}}),mutation:freeze({run:async(_kind,operation)=>operation()})
    }));
    providers.configureManagedRecovery(freeze({run:spec=>recovery.execute(spec)}));
    assert.equal(providers.register(freeze({id:'drive',label:'Google Drive',shared:true,connected:()=>true,repository:claiming?claimTransport:transport})),true);
    if(claiming)providers.configureSessionOwnership(freeze({installationId:()=>state.installationId,read:async()=>state.activeSession,today:()=>'2026-08-31'}));
    // The change clock: every capture in this harness has the same source revision.
    if(folder){assert.equal(providers.register(freeze({id:'folder',label:'Device Folder',connected:()=>true,repository:store(folder)})),true);providers.configureAutomaticBackup(freeze({covered:()=>'',current:()=>'2026-08-23T00:00:00.000Z'}));providers.configurePendingBackupRetry(freeze({read:async()=>null,mark:async()=>true,clear:async()=>true}));}
    return freeze({
      backUpFolder:()=>providers.backupRepositoryProvider('folder',{interactive:false}),
      upload:async()=>{await new Promise(resolve=>setTimeout(resolve,3));return providers.backupRepositoryProvider('drive',{interactive:false});},
      sync:()=>providers.syncRepositoryProvider('drive',{checkpointId:head()}),
      review:()=>providers.bringInRepositoryProvider('drive',{checkpointId:head(),review:true}),
      restore:checkpointId=>providers.restoreRepositoryProviderVersion('drive',{checkpointId,confirmed:true}),
      // Combine from Version History, read from the location the list chose.
      combine:(id,checkpointId)=>providers.bringInRepositoryProvider(id,{checkpointId}),
      reviewKept:(options={})=>harness.runtime.controller.reviewKeptVersions(options),
      noteVersions:(id,noteId,options={})=>providers.noteVersions(id,noteId,{interactive:false,...options}),
      handoffSource:()=>providers.readSessionHandoffSource('drive'),
      claim:request=>providers.claimSessionOwnership('drive',request)
    });
  };
  const note=text=>freeze({Shared:freeze({version:2,key:'Shared',text,updatedAt:new Date().toISOString()})});
  const a={installationId:'inst_sync_device_a',records:new Map([['2026-08-01',record('2026-08-01','day one')],['2026-08-02',record('2026-08-02','day two')]]),deletions:[],noteDeletions:[],notes:note('first'),activeSession:null,schedule:'',personal:personal('Sync User'),journal:null};
  const b={installationId:'inst_sync_device_b',records:new Map(),deletions:[],noteDeletions:[],notes:{},activeSession:null,schedule:'',personal:personal('Sync User'),journal:null};
  const A=device(a),B=device(b);
  // A new device takes in everything.
  const v1=await A.upload();assert.equal(a.reconciliationBase.checkpointId,v1.checkpointId,'a Drive backup is what this device shares');
  syncWorld=freeze({drive,head,device,note,keepAll,versions,claims});
  assert.equal((await B.sync()).cancelled,false);
  assert.deepEqual([...b.records.keys()].sort(),['2026-08-01','2026-08-02']);assert.equal(b.notes.Shared.text,'first');
  assert.deepEqual(b.followed,[{protectionId:'',encrypted:false,removedElsewhere:false}],'a sync tells the backup password what the newest version uses');assert.equal(b.reconciliationBase.checkpointId,v1.checkpointId,'what a device takes in from Drive is what it shares');
  // Changes on one side only cross over both ways without a question.
  a.notes=note('edited on A');const v2=await A.upload();
  b.records.set('2026-08-02',record('2026-08-02','edited on B','2026-08-30T10:00:00.000Z'));
  await assert.rejects(()=>B.upload(),error=>error?.code==='REPOSITORY_SYNC_BEHIND','a device never uploads over a version it has not taken in');
  assert.equal(head(),v2.checkpointId);
  assert.equal((await B.sync()).cancelled,false,'changes made on one side only need no choice');
  assert.equal(b.notes.Shared.text,'edited on A');assert.equal(b.records.get('2026-08-02').reflection,'edited on B','this device keeps its own change');assert.equal(b.reconciliationBase.checkpointId,v2.checkpointId);
  const v3=await B.upload();
  assert.equal((await A.sync()).cancelled,false);assert.equal(a.records.get('2026-08-02').reflection,'edited on B');assert.equal(a.notes.Shared.text,'edited on A');assert.equal(a.reconciliationBase.checkpointId,v3.checkpointId);
  // A session left on one device carries on on the other; saving that day there ends it here too.
  a.activeSession=session('2026-08-29','MOVING',{runningOn:a.installationId});a.schedule=a.activeSession.scheduleText;a.running=false;await A.upload();
  assert.equal((await B.sync()).cancelled,false);assert.equal(b.activeSession.snapshot.label,'MOVING','a session moves to a device that has none');
  b.activeSession=null;b.schedule='';b.records.set('2026-08-29',record('2026-08-29','saved on B','2026-08-30T12:00:00.000Z'));const saved=await B.upload();
  assert.equal((await A.sync()).cancelled,false);assert.equal(a.activeSession,null,'a session saved as a Saved Day on the other device ends here');assert.equal(a.records.get('2026-08-29').reflection,'saved on B');
  // The same Saved Day changed on both: the sync never stops. The newer shows
  // and the other is kept for review, on every device, until the person
  // chooses; a time only chooses what shows meanwhile.
  a.records.set('2026-08-01',record('2026-08-01','day one by A','2026-08-31T09:00:00.000Z'));const v4=await A.upload();
  b.records.set('2026-08-01',record('2026-08-01','day one by B','2026-08-31T10:00:00.000Z'));
  assert.equal((await B.sync()).cancelled,false,'a difference made on both sides never stops a sync');
  assert.equal(b.records.get('2026-08-01').reflection,'day one by B','the newer one shows');assert.equal(b.reconciliationBase.checkpointId,v4.checkpointId,'the sync took in Drive’s version');
  const keptDay=b.reviews.open().find(review=>review.subject==='savedDay');assert.equal(keptDay.ref,'2026-08-01');assert.equal(keptDay.kept.reflection,'day one by A','the other is kept for review');
  await B.upload();assert.equal((await A.sync()).cancelled,false);
  assert.equal(a.records.get('2026-08-01').reflection,'day one by B');assert.deepEqual(a.reviews.open().map(review=>review.id),[keptDay.id],'the kept version reaches the other device');
  // Reviewed on either device: the choice is an ordinary edit, and the review ends everywhere.
  a.keptChoice='use';const dayReview=await A.reviewKept();a.keptChoice='';
  assert.equal(dayReview.reviewed,1);assert.equal(a.records.get('2026-08-01').reflection,'day one by A','the kept version is used');assert.deepEqual(a.reviews.open(),[]);
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  assert.equal(b.records.get('2026-08-01').reflection,'day one by A');assert.deepEqual(b.reviews.open(),[],'a review resolved on one device ends on every device');
  // Notes changed on both: different paragraphs merge by themselves (Smart
  // merge); the same paragraph shows the newer edit and keeps the other with
  // what both last shared, for the review's Smart merge.
  b.notes=note('one\n\ntwo');await B.upload();assert.equal((await A.sync()).cancelled,false);
  a.notes=note('one by A\n\ntwo');await A.upload();b.notes=note('one\n\ntwo by B');
  assert.equal((await B.sync()).cancelled,false);assert.equal(b.notes.Shared.text,'one by A\n\ntwo by B','edits to different paragraphs are joined');assert.equal(b.reviews.open().length,0,'nothing is kept when nothing is lost');
  await B.upload();assert.equal((await A.sync()).cancelled,false);assert.equal(a.notes.Shared.text,'one by A\n\ntwo by B');
  a.notes=note('one, A again\n\ntwo by B');await A.upload();await new Promise(resolve=>setTimeout(resolve,3));b.notes=note('one, B again\n\ntwo by B');
  assert.equal((await B.sync()).cancelled,false);assert.equal(b.notes.Shared.text,'one, B again\n\ntwo by B','the newer edit shows');
  const keptNote=b.reviews.open().find(review=>review.subject==='note');assert.equal(keptNote.kept.text,'one, A again\n\ntwo by B','the other edit is kept');assert.equal(keptNote.base.text,'one by A\n\ntwo by B','with what both last shared');
  let offered=null;b.reviewText=(item,options)=>{offered={item,purpose:options.purpose};return 'one, A and B\n\ntwo by B';};
  assert.equal((await B.reviewKept({ref:'Shared'})).reviewed,1);b.reviewText=null;
  assert.equal(offered.purpose,'kept');assert.equal(offered.item.localValue,'one, B again\n\ntwo by B');assert.equal(offered.item.incomingValue,'one, A again\n\ntwo by B');assert.equal(offered.item.ancestorValue,'one by A\n\ntwo by B','the review offers Smart merge from what both last shared');
  assert.equal(b.notes.Shared.text,'one, A and B\n\ntwo by B');assert.deepEqual(b.reviews.open(),[]);
  await B.upload();assert.equal((await A.sync()).cancelled,false);assert.equal(a.notes.Shared.text,'one, A and B\n\ntwo by B');assert.deepEqual(a.reviews.open(),[]);
  // A note edited on one device and deleted on the other stays; its review offers to delete it.
  const draft=text=>freeze({version:2,key:'Draft',text,updatedAt:new Date().toISOString()});
  b.notes={...b.notes,Draft:draft('a draft')};await B.upload();assert.equal((await A.sync()).cancelled,false);
  a.notes={Shared:a.notes.Shared};a.noteDeletions=[{key:'Draft',deletedAt:new Date().toISOString()}];await A.upload();
  b.notes={...b.notes,Draft:draft('kept writing on B')};
  assert.equal((await B.sync()).cancelled,false);assert.equal(b.notes.Draft.text,'kept writing on B','an edited note is never deleted by a sync');
  const keptDeletion=b.reviews.open().find(review=>review.subject==='note');assert.equal(keptDeletion.ref,'Draft');assert.equal(keptDeletion.kept,null,'the review offers the deletion');
  b.keptChoice='use';assert.equal((await B.reviewKept()).reviewed,1);b.keptChoice='';
  assert.equal(b.notes.Draft,undefined,'choosing it deletes the note');assert.ok(b.noteDeletions.some(item=>item.key==='Draft'));
  await B.upload();assert.equal((await A.sync()).cancelled,false);assert.deepEqual(a.reviews.open(),[]);
  // Plans and settings changed on both: this device's stay and the other's are kept.
  a.personal=personal('Name on A');await A.upload();b.personal=personal('Name on B');
  assert.equal((await B.sync()).cancelled,false);assert.equal(b.personal.preferences.studentName,'Name on B');
  const keptPersonal=b.reviews.open().find(review=>review.subject==='personal');assert.equal(keptPersonal.kept.preferences.studentName,'Name on A');
  b.keptChoice='use';await B.reviewKept();b.keptChoice='';assert.equal(b.personal.preferences.studentName,'Name on A','the review lets the person pick the kept settings');assert.deepEqual(b.reviews.open(),[]);
  await B.upload();assert.equal((await A.sync()).cancelled,false);
  // After a verified shared base exists, clearing the name is authored
  // deletion, not a brand-new device. The separately added remote draft
  // still merges automatically under per-field ancestry.
  a.personal=freeze({...personal('Name on A'),plans:freeze({draft:'07:00 | 60 | A plan | work | Ethics | block | 1',savedPlans:freeze([]),defaultId:null})});await A.upload();b.personal=startup(null);
  assert.equal((await B.sync()).cancelled,false);
  assert.equal(b.personal.preferences.studentName,null,'a cleared name survives a known shared-base edit');
  assert.equal(b.personal.plans.draft,a.personal.plans.draft,'the independent remote draft merges');
  assert.equal(b.reviews.open().some(review=>review.subject==='personal'),false,'disjoint proven edits require no review');
  await B.upload();assert.equal((await A.sync()).cancelled,false);
  a.personal=startup(null);await A.upload();b.personal=freeze({...personal('Name on B, planned'),plans:freeze({draft:'08:00 | 30 | B plan | work | Ethics | block | 1',savedPlans:freeze([]),defaultId:null})});const mine=b.personal;
  assert.equal((await B.sync()).cancelled,false);
  assert.deepEqual(b.personal,mine,'the independent local draft is never replaced by a remote clear');
  assert.equal(b.reviews.open().some(review=>review.subject==='personal'),true,
    'competing edits since a common draft ancestor require an explicit choice, even if the remote draft became blank');
  assert.equal((await B.reviewKept()).reviewed,1,'keeping the local authored draft resolves the genuine conflict');
  assert.deepEqual(b.reviews.open(),[]);
  await B.upload();assert.equal((await A.sync()).cancelled,false);
  // BF-1R2: independent authored drafts cannot be overwritten because
  // a whole-checkpoint sourceRevision is newer. The remote draft is kept.
  const remoteDraft='06:00 | 60 | Remote independent draft | work | Polity | pages | 10';
  const localDraft='09:00 | 45 | Local independent draft | work | History | pages | 8';
  a.personal=freeze({...a.personal,plans:freeze({...a.personal.plans,draft:remoteDraft})});await A.upload();
  b.personal=freeze({...b.personal,plans:freeze({...b.personal.plans,draft:localDraft})});
  assert.equal((await B.sync()).cancelled,false);
  assert.equal(b.personal.plans.draft,localDraft,'sync never replaces an independently authored local draft by a global timestamp');
  const keptDraft=b.reviews.open().find(review=>review.subject==='personal'&&review.kept?.plans?.draft===remoteDraft);
  assert.ok(keptDraft,'the remote draft stays available for an explicit kept-version decision');
  b.keptChoice='use';await B.reviewKept();b.keptChoice='';
  assert.equal(b.personal.plans.draft,remoteDraft,'choosing the kept version deliberately imports its draft');
  await B.upload();assert.equal((await A.sync()).cancelled,false);
  // With verified common ancestry and only one side changed, the new draft
  // still synchronizes automatically; safety must not disable normal sync.
  const oneSidedDraft='07:00 | 75 | One-sided draft update | work | Geography | pages | 12';
  a.personal=freeze({...a.personal,plans:freeze({...a.personal.plans,draft:oneSidedDraft})});await A.upload();
  assert.equal((await B.sync()).cancelled,false);
  assert.equal(b.personal.plans.draft,oneSidedDraft,'a proven one-sided draft update synchronizes normally');
  // A session running here keeps its own state; everything else merges.
  a.activeSession=session('2026-08-30','A-SESSION',{runningOn:a.installationId});a.schedule=a.activeSession.scheduleText;a.running=false;a.notes=note('edited on A again');await A.upload();
  b.activeSession=session('2026-08-31','B-SESSION',{runningOn:b.installationId});b.schedule=b.activeSession.scheduleText;
  assert.equal((await B.sync()).cancelled,false,'sync is never blocked by a running session');
  assert.equal(b.activeSession.snapshot.label,'B-SESSION','the session running here stays as it is');assert.equal(b.notes.Shared.text,'edited on A again','everything else merges as usual');
  assert.equal(b.reviews.open().filter(review=>review.subject==='session'&&review.kept?.snapshot?.label==='A-SESSION').length,1,'the remote earlier-day session is preserved once on B');
  assert.equal((await B.sync()).cancelled,false);
  assert.equal(b.reviews.open().filter(review=>review.subject==='session'&&review.kept?.snapshot?.label==='A-SESSION').length,1,'repeated sync never generates the same session review twice');
  // Another device's own session never silently replaces one left unsaved
  // here: this one stays and the other is kept for review.
  await B.upload();
  assert.equal((await A.sync()).cancelled,false);
  assert.equal(a.activeSession.snapshot.label,'A-SESSION','an unsaved earlier session is not replaced by a new one from another device');
  assert.equal(a.reviews.open().filter(review=>review.subject==='session'&&review.kept?.snapshot?.label==='B-SESSION').length,1,'the independent later-day session is preserved exactly once for review');
}

// BF-2: Verified per-field ancestors merge independent setting changes
// without a whole-Personal-Data timestamp winner or an unnecessary review.
{
  syncWorld.drive.clear();syncWorld.claims.clear();
  const {device,note}=syncWorld,shared=personal('BF2 Shared');
  const a={installationId:'inst_bf2_personal_a',records:new Map(),deletions:[],noteDeletions:[],notes:note('BF2'),activeSession:null,schedule:'',personal:shared,journal:null};
  const b={installationId:'inst_bf2_personal_b',records:new Map(),deletions:[],noteDeletions:[],notes:{},activeSession:null,schedule:'',personal:shared,journal:null};
  const A=device(a),B=device(b);
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  a.personal=freeze({...a.personal,preferences:freeze({...a.personal.preferences,theme:'dark'})});await A.upload();
  b.personal=freeze({...b.personal,preferences:freeze({...b.personal.preferences,quote:'Keep working locally'})});
  assert.equal((await B.sync()).cancelled,false);
  assert.equal(b.personal.preferences.theme,'dark','a remotely edited independent setting merges automatically');
  assert.equal(b.personal.preferences.quote,'Keep working locally','the local independently changed setting survives');
  assert.equal(b.reviews.open().filter(review=>review.subject==='personal').length,0,'disjoint proven changes create no Personal Data review');
  await B.upload();assert.equal((await A.sync()).cancelled,false);
  assert.equal(a.personal.preferences.quote,'Keep working locally','the automatic merge converges on the other device');
  assert.equal(a.personal.preferences.theme,'dark');
  assert.deepEqual(a.reviews.open(),[]);
  a.personal=freeze({...a.personal,preferences:freeze({...a.personal.preferences,theme:null})});
  await A.upload();
  b.personal=freeze({...b.personal,preferences:freeze({...b.personal.preferences,soundMode:'minimal'})});
  assert.equal((await B.sync()).cancelled,false);
  assert.equal(b.personal.preferences.theme,null,'a proven explicit preference removal is not mistaken for fresh-device startup');
  assert.equal(b.personal.preferences.soundMode,'minimal','an unrelated optional setting addition survives');
  assert.equal(b.reviews.open().filter(review=>review.subject==='personal').length,0);
  await B.upload();assert.equal((await A.sync()).cancelled,false);

  // A saved-plan addition and default selection are automatic when only A
  // made them; a competing edit to the same working draft is reviewable.
  const plan=freeze({id:'plan-bf2-saved-0001',label:'Alternate',scheduleText:'09:00 | 60 | Revision | work | Ethics | pages | 12',createdAt:'2026-08-31T10:00:00.000Z',updatedAt:'2026-08-31T10:00:00.000Z'});
  a.personal=freeze({...a.personal,plans:freeze({draft:'06:00 | 45 | Draft A | work | Polity | pages | 8',savedPlans:freeze([plan]),defaultId:plan.id})});
  await A.upload();
  b.personal=freeze({...b.personal,plans:freeze({...b.personal.plans,draft:'07:00 | 30 | Draft B | work | History | pages | 6'})});
  assert.equal((await B.sync()).cancelled,false);
  const planReview=b.reviews.open().find(review=>review.subject==='personal');
  assert.ok(planReview,'only the competing working-draft edits require review');
  assert.equal(b.personal.plans.draft,'07:00 | 30 | Draft B | work | History | pages | 6','a conflicting draft stays local');
  assert.equal(b.personal.plans.savedPlans[0].id,plan.id,'the independent saved-plan addition merges automatically');
  assert.equal(b.personal.plans.defaultId,plan.id,'its one-sided default selection merges with the saved-plan entry');
  assert.equal((await B.reviewKept()).reviewed,1,'the draft conflict is resolved explicitly');
  assert.equal(b.personal.plans.draft,'07:00 | 30 | Draft B | work | History | pages | 6');
  assert.deepEqual(b.reviews.open(),[]);

  // A remote review id referring to the same open semantic conflict must be
  // retired as a replicated resolved tombstone, not duplicated as a prompt.
  a.personal=freeze({...a.personal,preferences:freeze({...a.personal.preferences,quote:'Different A quote'})});
  await A.upload();
  b.personal=freeze({...b.personal,preferences:freeze({...b.personal.preferences,quote:'Different B quote'})});
  assert.equal((await B.sync()).cancelled,false);
  const first=b.reviews.open().find(review=>review.subject==='personal');
  assert.ok(first);
  const other=pendingReviewCodec.create({subject:'personal',ref:'personal',kept:first.kept,base:first.base});
  a.reviews= a.reviews||memoryPendingReviews(pendingReviewCodec,{limit:limits.maxPendingReviews});
  await a.reviews.ports.pendingReviewsMerge([other]);
  await A.upload();
  assert.equal((await B.sync()).cancelled,false);
  const duplicates=b.reviews.open().filter(review=>review.subject==='personal'&&JSON.stringify(review.kept)===JSON.stringify(first.kept));
  assert.equal(duplicates.length,1,'equivalent open semantic conflicts appear only once');
  const tombstones=await b.reviews.ports.pendingReviewsList();
  assert.ok(tombstones.some(review=>review.id===other.id&&review.resolvedAt),'duplicate incoming identity is resolved for all devices');
}

// BF-2: a same-setting conflict waits for an explicit field choice;
// failed personal-data persistence cannot consume the review or lose the
// authoritative local settings, and retry remains possible.
{
  syncWorld.drive.clear();syncWorld.claims.clear();
  const {device}=syncWorld,origin=personal('BF2 Same-setting');
  const a={installationId:'inst_bf2_same_a',records:new Map(),deletions:[],noteDeletions:[],notes:{},activeSession:null,schedule:'',personal:origin,journal:null};
  const b={installationId:'inst_bf2_same_b',records:new Map(),deletions:[],noteDeletions:[],notes:{},activeSession:null,schedule:'',personal:origin,journal:null};
  const A=device(a),B=device(b);
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  a.personal=freeze({...a.personal,preferences:freeze({...a.personal.preferences,theme:'dark'})});await A.upload();
  b.personal=freeze({...b.personal,preferences:freeze({...b.personal.preferences,theme:'light',quote:'Local note'})});
  assert.equal((await B.sync()).cancelled,false);
  const open=b.reviews.open().filter(review=>review.subject==='personal');
  assert.equal(open.length,1,'same-setting divergence creates one meaningful review');
  assert.equal(b.personal.preferences.theme,'light');
  b.keptSelections={'preference:theme':'use'};
  b.failPersonalImport=true;
  await assert.rejects(B.reviewKept(),/QA_FIXTURE rejected personal write/u);
  assert.equal(b.personal.preferences.theme,'light','failed import does not partially replace the local setting');
  assert.equal(b.reviews.open().filter(review=>review.subject==='personal').length,1,'failed import retains the unresolved review');
  b.failPersonalImport=false;
  assert.equal((await B.reviewKept()).reviewed,1,'the same review remains safely retryable');
  b.keptSelections=null;
  assert.equal(b.personal.preferences.theme,'dark');
  assert.equal(b.personal.preferences.quote,'Local note','the independently authored setting remains unaffected');
  await B.upload();assert.equal((await A.sync()).cancelled,false);
  assert.equal(a.personal.preferences.theme,'dark');
  assert.equal(a.personal.preferences.quote,'Local note');
  assert.deepEqual(a.reviews.open(),[]);
}

// BF-2 closure: a later-domain failure cannot hide earlier commits or
// retire a review whose canonical Personal Data write did not succeed.
{
  const date='2026-08-01',local=personal('Local reviewer'),kept=personal('Kept reviewer');
  const state={installationId:'inst_bf2_bulk_review',records:new Map([[date,record(date,'Local day')]]),
    deletions:[],notes:{},noteDeletions:[],activeSession:null,personal:local,journal:null};
  state.reviews=memoryPendingReviews(pendingReviewCodec,{limit:limits.maxPendingReviews});
  const savedDay=pendingReviewCodec.create({subject:'savedDay',ref:date,kept:record(date,'Kept day'),
    keptAt:'2026-08-20T10:00:00.000Z'});
  const personalReview=pendingReviewCodec.create({subject:'personal',ref:'personal',kept,
    keptAt:'2026-08-20T11:00:00.000Z'});
  await state.reviews.ports.pendingReviewsMerge([savedDay,personalReview]);
  const h=createHarness(state);state.keptChoice='use';state.failPersonalImport=true;
  await assert.rejects(h.runtime.controller.reviewKeptVersions(),/1 of 2 kept versions confirmed/u,
    'a later failed domain reports independently committed choices');
  assert.equal(state.records.get(date)?.reflection,'Kept day');
  const [receipt]=await state.reviews.ports.pendingReviewsReadItems([savedDay.id]);
  assert.ok(receipt?.resolvedAt,'the completed day has a replicated acknowledgement');
  assert.deepEqual(state.reviews.open().map(review=>review.id),[personalReview.id],
    'the failed Personal Data version is the only outstanding review');
  assert.equal(state.personal.preferences.studentName,'Local reviewer');
  state.failPersonalImport=false;
  assert.equal((await h.runtime.controller.reviewKeptVersions()).reviewed,1);
  assert.equal(state.personal.preferences.studentName,'Kept reviewer');
  assert.deepEqual(state.reviews.open(),[],'retry neither replays nor loses an earlier choice');
}

// A deliberate removal may make a previously populated device look blank.
// Exact field ancestry must be considered before the first-install shortcut.
{
  syncWorld.drive.clear();syncWorld.claims.clear();
  const {device}=syncWorld,origin=personal('Authored name');
  const a={installationId:'inst_c2_blank_a',records:new Map(),deletions:[],notes:{},noteDeletions:[],activeSession:null,personal:origin,journal:null};
  const b={installationId:'inst_c2_blank_b',records:new Map(),deletions:[],notes:{},noteDeletions:[],activeSession:null,personal:origin,journal:null};
  const A=device(a),B=device(b);
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  a.personal=freeze({...a.personal,preferences:freeze({...a.personal.preferences,theme:'dark'})});await A.upload();
  b.personal=freeze({...b.personal,preferences:freeze({...b.personal.preferences,studentName:null})});
  assert.equal((await B.sync()).cancelled,false);
  assert.equal(b.personal.preferences.studentName,null,'intentional deletion survives a superficially blank local profile');
  assert.equal(b.personal.preferences.theme,'dark','independent remote setting still merges');
  assert.equal(b.reviews.open().filter(review=>review.subject==='personal').length,0);
  await B.upload();assert.equal((await A.sync()).cancelled,false);
  assert.equal(a.personal.preferences.studentName,null,'intentional deletion propagates after safe reconciliation');
}
{
  syncWorld.drive.clear();syncWorld.claims.clear();
  const {device}=syncWorld,origin=personal('Known before deletion');
  const a={installationId:'inst_c2_unknown_a',records:new Map(),deletions:[],notes:{},noteDeletions:[],activeSession:null,personal:origin,journal:null};
  const b={installationId:'inst_c2_unknown_b',records:new Map(),deletions:[],notes:{},noteDeletions:[],activeSession:null,personal:origin,journal:null};
  const A=device(a),B=device(b);
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  b.reconciliationBase=freeze({...b.reconciliationBase,version:3,personalFields:null});
  a.personal=freeze({...a.personal,preferences:freeze({...a.personal.preferences,theme:'dark'})});await A.upload();
  b.personal=freeze({...b.personal,preferences:freeze({...b.personal.preferences,studentName:null})});
  assert.equal((await B.sync()).cancelled,false);
  assert.equal(b.personal.preferences.studentName,null,'unknown ancestry cannot erase local deletion');
  assert.equal(b.personal.preferences.theme,null,'legacy ancestry cannot invent field causality');
  assert.equal(b.reviews.open().filter(review=>review.subject==='personal').length,1);
}

// Manual Kept Versions must flush pending edits before showing a Personal
// Data comparison and must reject a choice made stale by a new modal-time edit.
{
  const local=freeze({...personal('Manual reviewer'),plans:freeze({draft:'Original local',savedPlans:freeze([]),defaultId:null})});
  const remote=freeze({...personal('Manual reviewer'),plans:freeze({draft:'Remote option',savedPlans:freeze([]),defaultId:null})});
  const state={installationId:'inst_c2_manual_review',records:new Map(),deletions:[],notes:{},noteDeletions:[],activeSession:null,personal:local,journal:null};
  state.reviews=memoryPendingReviews(pendingReviewCodec,{limit:limits.maxPendingReviews});
  await state.reviews.ports.pendingReviewsMerge([pendingReviewCodec.create({subject:'personal',ref:'personal',kept:remote})]);
  state.pendingPlanDraft='Local unsaved in editor';
  const h=createHarness(state);state.keptChoice='use';
  assert.equal((await h.runtime.controller.reviewKeptVersions()).reviewed,1);
  assert.equal(state.personal.plans.draft,'Remote option','the selected kept draft replaces only a flushed, visible local draft');
  assert.equal(h.events.filter(x=>x==='personal-settle').length,2,'the editor settles before and after modal choices');
  assert.deepEqual(state.reviews.open(),[]);
}
{
  const local=freeze({...personal('Manual editor'),plans:freeze({draft:'Original local',savedPlans:freeze([]),defaultId:null})});
  const remote=freeze({...personal('Manual editor'),plans:freeze({draft:'Remote option',savedPlans:freeze([]),defaultId:null})});
  const state={installationId:'inst_c2_edit_during_modal',records:new Map(),deletions:[],notes:{},noteDeletions:[],activeSession:null,personal:local,journal:null};
  state.reviews=memoryPendingReviews(pendingReviewCodec,{limit:limits.maxPendingReviews});
  await state.reviews.ports.pendingReviewsMerge([pendingReviewCodec.create({subject:'personal',ref:'personal',kept:remote})]);
  state.draftEditedDuringReview='New edit while choices are open';
  const h=createHarness(state);state.keptChoice='use';
  const result=await h.runtime.controller.reviewKeptVersions();
  assert.equal(result.reviewed,0,'a newly edited Plan draft makes the modal comparison stale');
  assert.equal(state.personal.plans.draft,'New edit while choices are open','intervening local work is retained');
  assert.equal(state.reviews.open().length,1,'stale review remains available after a fresh comparison');
  state.failPersonalSettle=true;
  await assert.rejects(h.runtime.controller.reviewKeptVersions(),/QA_FIXTURE personal preflight failure/u);
  assert.equal(state.reviews.open().length,1,'a failed local Plan write cannot consume the kept version');
}

// BF-C3: A selected domain write can commit immediately before its review
// tombstone fails. Reopening and selecting that version again must acknowledge
// the review without replaying an already-applied canonical write.
{
  const date='2026-08-12',row=freeze({id:'ethics-1',start:'08:00',duration:60,
    name:'Ethics',kind:'work',area:'Ethics',measure:'pages',target:10});
  const localDay=freeze({...record(date,'Current reflection'),schedule:freeze([row]),
    results:freeze({'ethics-1':freeze({completion:50,actualSeconds:900})}),quote:'Current quote',carryForwardDraft:'Current next step'});
  const keptDay=freeze({...localDay,reflection:'Kept reflection',
    results:freeze({'ethics-1':freeze({completion:90,actualSeconds:1800})}),quote:'Kept quote',carryForwardDraft:'Kept next step'});
  const state={installationId:'inst_c3_day_retry',records:new Map([[date,localDay]]),
    deletions:[],notes:{},noteDeletions:[],activeSession:null,personal:personal('Day reviewer'),journal:null};
  state.reviews=memoryPendingReviews(pendingReviewCodec,{limit:limits.maxPendingReviews});
  await state.reviews.ports.pendingReviewsMerge([pendingReviewCodec.create({
    subject:'savedDay',ref:date,kept:keptDay})]);
  const h=createHarness(state);state.keptChoice='use';state.failReviewAck=true;
  await assert.rejects(h.runtime.controller.reviewKeptVersions(),/QA_FIXTURE review receipt failed/u);
  assert.equal(state.records.get(date).reflection,'Kept reflection');
  const committedTime=state.records.get(date).updatedAt;
  assert.equal(h.events.filter(event=>event==='days-import').length,1);
  assert.equal(state.reviews.open().length,1,'a failed receipt leaves the review open');
  const prompt=h.prompts.find(prompt=>prompt.title==='Kept versions');
  const choice=prompt.groups.find(group=>group.label===`Saved Day · ${date}`);
  assert.match(choice.description,/Differing: task results/u);
  assert.match(choice.description,/reflection/u);
  assert.match(choice.description,/originating device and precise cause not recorded/u);
  assert.match(choice.choices[0].description,/Ethics: 50% \/ 15 min/u);
  assert.match(choice.choices[1].description,/Ethics: 90% \/ 30 min/u);
  assert.match(choice.choices[0].description,/Current reflection/u);
  assert.match(choice.choices[1].description,/Kept reflection/u);
  assert.match(choice.choices[0].description,/Current quote/u);
  assert.match(choice.choices[1].description,/Kept quote/u);
  assert.equal((await h.runtime.controller.reviewKeptVersions()).reviewed,1);
  assert.equal(h.events.filter(event=>event==='days-import').length,1,'retry does not write the already-applied Saved Day again');
  assert.equal(state.records.get(date).updatedAt,committedTime,'retry never manufactures a new save timestamp');
  assert.deepEqual(state.reviews.open(),[]);
}
{
  const date='2026-08-13';
  const state={installationId:'inst_c3_delete_retry',records:new Map([[date,record(date,'To delete')]]),
    deletions:[],notes:{},noteDeletions:[],activeSession:null,personal:personal('Deletion reviewer'),journal:null};
  state.reviews=memoryPendingReviews(pendingReviewCodec,{limit:limits.maxPendingReviews});
  await state.reviews.ports.pendingReviewsMerge([pendingReviewCodec.create({subject:'savedDay',ref:date,kept:null})]);
  const h=createHarness(state);state.keptChoice='use';state.failReviewAck=true;
  await assert.rejects(h.runtime.controller.reviewKeptVersions(),/QA_FIXTURE review receipt failed/u);
  assert.equal(state.records.has(date),false);
  assert.equal(state.deletions.some(value=>value.date===date),true,'deletion receipt is stored independently');
  const before=h.events.filter(event=>event==='days-remove'||event==='day-ledger').length;
  assert.equal((await h.runtime.controller.reviewKeptVersions()).reviewed,1);
  assert.equal(h.events.filter(event=>event==='days-remove'||event==='day-ledger').length,before,
    'retry does not delete again or rewrite an already-published deletion tombstone');
  assert.ok(h.prompts.filter(prompt=>prompt.title==='Kept versions').at(-1).groups.some(group=>group.label===`Saved Day · ${date}`),
    'absence on both sides never silently consumes an unresolved deletion review');
  assert.deepEqual(state.reviews.open(),[]);
}
{
  const date='2026-08-14';
  const current=session(date,'CURRENT',{runningOn:'inst_device_local',status:'suspended'});
  const kept=session(date,'KEPT',{runningOn:'inst_kept_owner',status:'active'});
  const state={installationId:'inst_c3_session_retry',records:new Map(),deletions:[],notes:{},noteDeletions:[],
    activeSession:current,running:false,personal:personal('Session reviewer'),journal:null};
  state.reviews=memoryPendingReviews(pendingReviewCodec,{limit:limits.maxPendingReviews});
  await state.reviews.ports.pendingReviewsMerge([pendingReviewCodec.create({subject:'session',ref:'session',kept})]);
  const h=createHarness(state);state.keptChoice='use';state.failReviewAck=true;
  await assert.rejects(h.runtime.controller.reviewKeptVersions(),/QA_FIXTURE review receipt failed/u);
  assert.equal(state.activeSession.snapshot.label,'KEPT');
  assert.equal(state.activeSession.status,'suspended','using a kept session never starts another timer');
  const revision=state.activeSession.revision;
  assert.equal(h.events.filter(event=>event==='session').length,1);
  const prompt=h.prompts.find(row=>row.title==='Kept versions');
  const group=prompt.groups.find(row=>row.label==='Active / suspended session');
  assert.match(group.description,/Differing: schedule/u);
  assert.match(group.description,/originating device and precise cause not recorded/u);
  assert.match(group.choices[0].description,/suspended/u);
  assert.match(group.choices[1].description,/active/u);
  assert.equal((await h.runtime.controller.reviewKeptVersions()).reviewed,1);
  assert.equal(h.events.filter(event=>event==='session').length,1,'the suspended session is not restored twice');
  assert.equal(state.activeSession.revision,revision,'the retry does not advance control revision');
  assert.deepEqual(state.reviews.open(),[]);
}
{
  const here=normalizeArea({key:'Shared',label:'Current title',text:'Unchanged body'},'Shared');
  const state={installationId:'inst_c3_note_retry',records:new Map(),deletions:[],
    notes:{Shared:here},noteDeletions:[],activeSession:null,personal:personal('Note reviewer'),journal:null};
  state.reviews=memoryPendingReviews(pendingReviewCodec,{limit:limits.maxPendingReviews});
  await state.reviews.ports.pendingReviewsMerge([pendingReviewCodec.create({
    subject:'note',ref:'Shared',kept:{label:'Kept title'}})]);
  const h=createHarness(state);state.keptChoice='use';state.failReviewAck=true;
  await assert.rejects(h.runtime.controller.reviewKeptVersions(),/QA_FIXTURE review receipt failed/u);
  assert.equal(state.notes.Shared.label,'Kept title');
  const storedAt=state.notes.Shared.updatedAt;
  assert.equal(h.events.filter(event=>event==='notes').length,1);
  assert.equal((await h.runtime.controller.reviewKeptVersions()).reviewed,1);
  assert.equal(state.notes.Shared.updatedAt,storedAt,'already-applied note text/title does not generate a fresh revision');
  assert.equal(h.events.filter(event=>event==='notes').length,1);
  assert.deepEqual(state.reviews.open(),[]);
}
{
  const state={installationId:'inst_c3_personal_retry',records:new Map(),deletions:[],notes:{},noteDeletions:[],
    activeSession:null,personal:personal('Current name'),journal:null};
  state.reviews=memoryPendingReviews(pendingReviewCodec,{limit:limits.maxPendingReviews});
  await state.reviews.ports.pendingReviewsMerge([pendingReviewCodec.create({
    subject:'personal',ref:'personal',kept:personal('Kept name')})]);
  const h=createHarness(state);state.keptChoice='use';state.failReviewAck=true;
  await assert.rejects(h.runtime.controller.reviewKeptVersions(),/QA_FIXTURE review receipt failed/u);
  assert.equal(state.personal.preferences.studentName,'Kept name');
  assert.equal(h.events.filter(event=>event==='personal-import').length,1);
  assert.equal((await h.runtime.controller.reviewKeptVersions()).reviewed,1);
  assert.equal(h.events.filter(event=>event==='personal-import').length,1);
  assert.deepEqual(state.reviews.open(),[]);
}

// A kept session can explicitly be absent: using it must clear the local
// suspended session, not merely retire the review while doing nothing.
{
  const date='2026-08-16';
  const state={installationId:'inst_c3_session_delete',records:new Map(),deletions:[],notes:{},noteDeletions:[],
    activeSession:session(date,'LOCAL',{runningOn:'inst_device_local',status:'suspended'}),
    running:false,personal:personal('Session deletion'),journal:null};
  state.reviews=memoryPendingReviews(pendingReviewCodec,{limit:limits.maxPendingReviews});
  await state.reviews.ports.pendingReviewsMerge([pendingReviewCodec.create({subject:'session',ref:'session',kept:null})]);
  const h=createHarness(state);state.keptChoice='use';state.failReviewAck=true;
  await assert.rejects(h.runtime.controller.reviewKeptVersions(),/QA_FIXTURE review receipt failed/u);
  assert.equal(state.activeSession,null,'using a kept absence clears the canonical suspended session');
  assert.equal(h.events.filter(event=>event==='session').length,1);
  assert.equal(state.reviews.open().length,1,'the interrupted review acknowledgement remains pending');
  const group=h.prompts.find(row=>row.title==='Kept versions').groups.find(row=>row.label==='Active / suspended session');
  assert.match(group.choices[1].label,/remove session/u,'absence has an explicit destructive label');
  assert.equal((await h.runtime.controller.reviewKeptVersions()).reviewed,1);
  assert.equal(h.events.filter(event=>event==='session').length,1,'retry never repeats a canonical session clear');
  assert.deepEqual(state.reviews.open(),[]);
}

// Control revisions, save acknowledgement counters and timestamps may differ
// even where two sessions contain identical study evidence. The dialog must
// describe that as a control/ownership issue, not invented changed progress.
{
  const date='2026-08-15';
  const here=revisionedSession(date,'SAME',{runningOn:'inst_device_local',status:'suspended',
    revision:7,contentRevision:3,savedRevision:2});
  const kept=revisionedSession(date,'SAME',{runningOn:'inst_other_owner',status:'active',
    revision:11,contentRevision:10,savedRevision:9,updatedAt:'2026-08-30T12:00:00.000Z'});
  const state={installationId:'inst_c3_control_only',records:new Map(),deletions:[],notes:{},noteDeletions:[],
    activeSession:here,running:false,personal:personal('Control review'),journal:null};
  state.reviews=memoryPendingReviews(pendingReviewCodec,{limit:limits.maxPendingReviews});
  await state.reviews.ports.pendingReviewsMerge([pendingReviewCodec.create({subject:'session',ref:'session',kept})]);
  const h=createHarness(state);
  assert.equal((await h.runtime.controller.reviewKeptVersions()).reviewed,1);
  const group=h.prompts.find(p=>p.title==='Kept versions').groups.find(p=>p.label==='Active / suspended session');
  assert.match(group.description,/Compared content matches/u);
  assert.match(group.description,/Session status differs/u);
  assert.match(group.description,/Recorded ownership differs/u);
  assert.doesNotMatch(group.description,/Differing: study evidence/u,
    'timestamp and revision-only differences cannot impersonate changed study progress');
  assert.equal(h.events.filter(event=>event==='session').length,0,'keeping current control state performs no session write');
}

// BF-2: a legacy v3 shared base has no field ancestry. Independent
// changes must remain reviewable, never guessed from timestamps.
{
  syncWorld.drive.clear();syncWorld.claims.clear();
  const {device}=syncWorld,origin=personal('Legacy ancestry');
  const a={installationId:'inst_bf2_legacy_a',records:new Map(),deletions:[],notes:{},noteDeletions:[],activeSession:null,personal:origin,journal:null};
  const b={installationId:'inst_bf2_legacy_b',records:new Map(),deletions:[],notes:{},noteDeletions:[],activeSession:null,personal:origin,journal:null};
  const A=device(a),B=device(b);
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  b.reconciliationBase=freeze({...b.reconciliationBase,version:3,personalFields:null});
  a.personal=freeze({...a.personal,preferences:freeze({...a.personal.preferences,theme:'dark'})});await A.upload();
  b.personal=freeze({...b.personal,preferences:freeze({...b.personal.preferences,quote:'Unshared locally'})});
  assert.equal((await B.sync()).cancelled,false);
  assert.equal(b.personal.preferences.theme,null,'v3 ancestry cannot falsely authorize a per-field automatic merge');
  assert.equal(b.personal.preferences.quote,'Unshared locally');
  assert.equal(b.reviews.open().filter(review=>review.subject==='personal').length,1);
}
// Independently added saved-plan identities must merge, while competing
// edits to one identity stay reviewable and preserve every unrelated plan.
{
  syncWorld.drive.clear();syncWorld.claims.clear();
  const {device}=syncWorld,origin=personal('Saved-plan union'),
    plan=(id,label)=>freeze({id,label,scheduleText:'08:00 | 60 | '+label+' | work | Ethics | pages | 8',
      createdAt:'2026-08-31T10:00:00.000Z',updatedAt:'2026-08-31T10:00:00.000Z'});
  const pA=plan('plan-bf2-independent-a','A plan'),pB=plan('plan-bf2-independent-b','B plan');
  const a={installationId:'inst_bf2_plans_a',records:new Map(),deletions:[],notes:{},noteDeletions:[],activeSession:null,personal:origin,journal:null};
  const b={installationId:'inst_bf2_plans_b',records:new Map(),deletions:[],notes:{},noteDeletions:[],activeSession:null,personal:origin,journal:null};
  const A=device(a),B=device(b);
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  a.personal=freeze({...a.personal,plans:freeze({...a.personal.plans,savedPlans:freeze([pA])})});await A.upload();
  b.personal=freeze({...b.personal,plans:freeze({...b.personal.plans,savedPlans:freeze([pB])})});
  assert.equal((await B.sync()).cancelled,false);
  assert.deepEqual(new Set(b.personal.plans.savedPlans.map(x=>x.id)),new Set([pA.id,pB.id]),'distinct saved-plan additions merge without loss');
  assert.equal(b.reviews.open().filter(review=>review.subject==='personal').length,0);
  await B.upload();assert.equal((await A.sync()).cancelled,false);
  assert.equal(a.personal.plans.savedPlans.length,2);
  const change=(current,label)=>freeze({...current,label,scheduleText:'08:00 | 60 | '+label+' | work | Ethics | pages | 8',updatedAt:'2026-09-01T10:00:00.000Z'});
  a.personal=freeze({...a.personal,plans:freeze({...a.personal.plans,
    savedPlans:freeze(a.personal.plans.savedPlans.map(x=>x.id===pA.id?change(x,'A-side edit'):x))})});await A.upload();
  b.personal=freeze({...b.personal,plans:freeze({...b.personal.plans,
    savedPlans:freeze(b.personal.plans.savedPlans.map(x=>x.id===pA.id?change(x,'B-side edit'):x))})});
  assert.equal((await B.sync()).cancelled,false);
  assert.equal(b.personal.plans.savedPlans.find(x=>x.id===pA.id).label,'B-side edit');
  assert.equal(b.reviews.open().filter(review=>review.subject==='personal').length,1,'same-plan divergent edits remain reviewable');
  b.keptSelections={['savedPlan:'+pA.id]:'use'};
  assert.equal((await B.reviewKept()).reviewed,1);
  b.keptSelections=null;
  assert.equal(b.personal.plans.savedPlans.find(x=>x.id===pA.id).label,'A-side edit');
  assert.equal(b.personal.plans.savedPlans.find(x=>x.id===pB.id).label,'B plan','another saved plan is untouched by the chosen version');
}
// Nested reminder values are independently reconciled, not treated as one
// indivisible Personal Data field.
{
  syncWorld.drive.clear();syncWorld.claims.clear();
  const {device}=syncWorld,original=personal('Nudge leaves'),
    baseline=freeze({...original,preferences:freeze({...original.preferences,nudge:freeze({enabled:true,nudgeAfter:40,breakMinutes:6,sound:true})})});
  const a={installationId:'inst_bf2_nudge_a',records:new Map(),deletions:[],notes:{},noteDeletions:[],activeSession:null,personal:baseline,journal:null};
  const b={installationId:'inst_bf2_nudge_b',records:new Map(),deletions:[],notes:{},noteDeletions:[],activeSession:null,personal:baseline,journal:null};
  const A=device(a),B=device(b);
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  a.personal=freeze({...a.personal,preferences:freeze({...a.personal.preferences,nudge:freeze({...a.personal.preferences.nudge,nudgeAfter:50})})});await A.upload();
  b.personal=freeze({...b.personal,preferences:freeze({...b.personal.preferences,nudge:freeze({...b.personal.preferences.nudge,breakMinutes:10})})});
  assert.equal((await B.sync()).cancelled,false);
  assert.equal(b.personal.preferences.nudge.nudgeAfter,50);
  assert.equal(b.personal.preferences.nudge.breakMinutes,10);
  assert.equal(b.reviews.open().filter(review=>review.subject==='personal').length,0,'independent nudge leaves do not cause a false conflict');
  await B.upload();assert.equal((await A.sync()).cancelled,false);
  a.personal=freeze({...a.personal,preferences:freeze({...a.personal.preferences,nudge:freeze({...a.personal.preferences.nudge,nudgeAfter:55})})});await A.upload();
  b.personal=freeze({...b.personal,preferences:freeze({...b.personal.preferences,nudge:freeze({...b.personal.preferences.nudge,nudgeAfter:60,breakMinutes:12})})});
  assert.equal((await B.sync()).cancelled,false);
  assert.equal(b.personal.preferences.nudge.nudgeAfter,60,'a true same-leaf reminder conflict keeps the local value');
  assert.equal(b.personal.preferences.nudge.breakMinutes,12,'a separate local reminder edit survives');
  assert.equal(b.reviews.open().filter(review=>review.subject==='personal').length,1,'the one same-leaf reminder conflict remains reviewable');
  b.keptSelections={'nudge:nudgeAfter':'use'};
  assert.equal((await B.reviewKept()).reviewed,1,'the review permits selecting exactly the other reminder interval');
  b.keptSelections=null;
  assert.equal(b.personal.preferences.nudge.nudgeAfter,55);
  assert.equal(b.personal.preferences.nudge.breakMinutes,12,'accepting the remote interval cannot replace the unrelated break length');
  assert.deepEqual(b.reviews.open(),[]);
}

// Restoring an older version reaches every device: the restoring device makes
// it Drive's newest at its next upload, the other device takes it in at its
// next sync, and versions kept for review on either device stay.
{
  syncWorld.drive.clear();syncWorld.keepAll.on=true;
  const {device,note}=syncWorld;
  const a={installationId:'inst_restore_device_a',records:new Map([['2026-08-01',record('2026-08-01','first day')]]),deletions:[],noteDeletions:[],notes:note('version one'),activeSession:null,schedule:'',personal:personal('Restore User'),journal:null};
  const b={installationId:'inst_restore_device_b',records:new Map(),deletions:[],noteDeletions:[],notes:{},activeSession:null,schedule:'',personal:personal('Restore User'),journal:null};
  const A=device(a),B=device(b);
  const first=await A.upload();assert.equal((await B.sync()).cancelled,false);assert.equal(b.notes.Shared.text,'version one');
  // The same Saved Day changed on both leaves a version kept for review on both devices.
  a.notes=note('version two');a.records.set('2026-08-01',record('2026-08-01','first day by A','2026-08-31T09:00:00.000Z'));await A.upload();
  b.records.set('2026-08-01',record('2026-08-01','first day by B','2026-08-31T10:00:00.000Z'));
  assert.equal((await B.sync()).cancelled,false);assert.equal(b.notes.Shared.text,'version two');
  const kept=b.reviews.open().find(review=>review.subject==='savedDay');assert.ok(kept,'a version is kept for review');
  await B.upload();assert.equal((await A.sync()).cancelled,false);assert.deepEqual(a.reviews.open().map(review=>review.id),[kept.id]);
  // An older version does not descend from what both last shared, so Replace
  // shows the notes it changes; the person takes the backup's copy.
  a.reviewText=item=>item.incomingValue;const restored=await A.restore(first.checkpointId);a.reviewText=null;assert.notEqual(restored.cancelled,true);
  assert.equal(a.notes.Shared.text,'version one','the restore applies here at once');
  assert.deepEqual(a.reviews.open().map(review=>review.id),[kept.id],'versions kept for review stay through a restore');
  assert.equal(restored.convergence?.source?.shared,true,'the restore came from Drive');
  const after=await A.upload();assert.notEqual(after.checkpointId,first.checkpointId,'the restored state becomes Drive’s newest version');
  assert.equal((await B.sync()).cancelled,false,'the other device takes the restore in without a question');
  assert.equal(b.notes.Shared.text,'version one','and gets the restored note');
  assert.deepEqual(b.reviews.open().map(review=>review.id),[kept.id],'its versions kept for review stay too');
  syncWorld.keepAll.on=false;
}

// Two devices that each back up to a Device Folder too. Drive and Device
// Folder publish the same canonical local state independently; neither waits
// for, downloads, or backfills a checkpoint from the other.
{
  syncWorld.drive.clear();
  const {device,note,head,versions,drive}=syncWorld;
  const folderA=new Map(),folderB=new Map(),content=(files,id)=>[...files.values()].find(file=>file.kind==='checkpoint'&&file.id===id)?.historySummary?.logicalFingerprint;
  const a={installationId:'inst_both_device_a',records:new Map([['2026-08-01',record('2026-08-01','first day')]]),deletions:[],noteDeletions:[],notes:note('one'),activeSession:null,schedule:'',personal:personal('Both User'),journal:null};
  const b={installationId:'inst_both_device_b',records:new Map(),deletions:[],noteDeletions:[],notes:{},activeSession:null,schedule:'',personal:personal('Both User'),journal:null};
  const A=device(a,{folder:folderA}),B=device(b,{folder:folderB});
  const folderFirst=await A.backUpFolder(),driveFirst=await A.upload();
  assert.notEqual(driveFirst.checkpointId,folderFirst.checkpointId,'independent locations do not share checkpoint identities');
  assert.equal(content(folderA,folderFirst.checkpointId),content(drive,driveFirst.checkpointId),'both destinations describe the same canonical local state');
  assert.equal((await B.sync()).cancelled,false);assert.equal(b.notes.Shared.text,'one');
  const taken=await B.backUpFolder();assert.ok(content(folderB,taken.checkpointId),'the Device Folder records what its version holds');
  assert.equal(content(folderB,taken.checkpointId),content(drive,head()),'after sync, Device Folder independently captures the same state as Drive head');
  assert.equal((await B.upload()).unchanged,true,'Drive has nothing new to take after B only absorbed its current head');
  // B changes: each destination independently publishes the resulting state.
  b.notes=note('two by B');const folderBChanged=await B.backUpFolder(),driveBChanged=await B.upload();
  assert.notEqual(driveBChanged.checkpointId,folderBChanged.checkpointId);assert.equal(content(folderB,folderBChanged.checkpointId),content(drive,driveBChanged.checkpointId));
  // A takes it in; nothing goes back up, and A's Device Folder independently captures it.
  assert.equal((await A.sync()).cancelled,false);assert.equal(a.notes.Shared.text,'two by B');
  const takenA=await A.backUpFolder();assert.equal(content(folderA,takenA.checkpointId),content(drive,head()));
  assert.equal((await A.upload()).unchanged,true,'no device uploads again what it only took in');
  // A note's earlier versions deduplicate by covered logical history rather
  // than by shared checkpoint ids.
  const local=await A.noteVersions('folder','Shared');
  assert.equal(local.available,true);assert.deepEqual(local.entries.map(entry=>entry.text),['two by B']);
  assert.notDeepEqual(versions(drive),versions(folderA),'independent locations retain independent checkpoint identities');
  assert.deepEqual((await A.noteVersions('drive','Shared')).entries.map(entry=>entry.text),['two by B'],'read alone, Drive offers its copy');
  const shared=await A.noteVersions('drive','Shared',{skip:local.covered});
  assert.equal(shared.available,true);assert.deepEqual(shared.entries,[],'after Device Folder coverage, Drive offers no duplicate logical note version');
}

// Combining Drive's newest version moves the shared base only when Drive's
// verified shared head is the source. Device Folder remains an independent
// recovery destination and does not impersonate Drive ancestry.
{
  syncWorld.drive.clear();syncWorld.keepAll.on=true;
  const {device,note,head}=syncWorld;
  const folderA=new Map(),folderB=new Map();
  const a={installationId:'inst_head_device_a',records:new Map([['2026-08-01',record('2026-08-01','first day')]]),deletions:[],noteDeletions:[],notes:note('one'),activeSession:null,schedule:'',personal:personal('Both User'),journal:null};
  const b={installationId:'inst_head_device_b',records:new Map(),deletions:[],noteDeletions:[],notes:{},activeSession:null,schedule:'',personal:personal('Both User'),journal:null};
  const A=device(a,{folder:folderA}),B=device(b,{folder:folderB});
  await A.backUpFolder();await A.upload();
  assert.equal((await B.sync()).cancelled,false);const first=head();assert.equal(b.reconciliationBase.checkpointId,first);
  a.notes=note('two by A');await A.backUpFolder();await A.upload();const newest=head();assert.notEqual(newest,first);
  const combined=await B.combine('drive',newest);assert.equal(combined.cancelled,false);assert.equal(b.notes.Shared.text,'two by A');
  assert.equal(b.reconciliationBase.checkpointId,newest,'Combining Drive’s newest verified head moves the shared base');
  const older=await B.combine('drive',first);assert.equal(older.cancelled,false);assert.equal(b.reconciliationBase.checkpointId,newest,'combining an older Drive version leaves the shared base alone');
  syncWorld.keepAll.on=false;
}

// A study session belongs to the device running it. Another device keeps a
// copy it never runs, edits notes freely, and continues the session only when
// it is handed over (Suspend) or taken over (Continue here); the device taken
// over from stops, and keeps what it recorded for review.
{
  syncWorld.drive.clear();
  const {head,device,note}=syncWorld,day='2026-08-31';
  const a={installationId:'inst_session_device_a',records:new Map(),deletions:[],noteDeletions:[],notes:note('first'),activeSession:null,schedule:'',personal:personal('Sync User'),journal:null};
  const b={installationId:'inst_session_device_b',records:new Map(),deletions:[],noteDeletions:[],notes:{},activeSession:null,schedule:'',personal:personal('Sync User'),journal:null};
  const A=device(a),B=device(b),running=(state,label,revision)=>{state.activeSession=session(day,label,{runningOn:state.installationId,status:'active',revision});state.schedule=state.activeSession.scheduleText;state.running=true;};
  running(a,'A-1',10);await A.upload();
  assert.equal((await B.sync()).cancelled,false);
  assert.equal(b.activeSession.snapshot.label,'A-1');assert.equal(b.activeSession.runningOn,a.installationId,'a session running on another device comes in as that device’s');
  // Notes edited on the other device come in while the session runs, and the session carries on untouched.
  b.notes=note('edited on B during A’s session');await B.upload();
  running(a,'A-2',11);
  assert.equal((await A.sync()).cancelled,false,'notes from another device never stop a running session');
  assert.equal(a.notes.Shared.text,'edited on B during A’s session');assert.equal(a.activeSession.snapshot.label,'A-2','the running session stays as it is');assert.equal(a.running,true);
  await A.upload();
  assert.equal((await B.sync()).cancelled,false);assert.equal(b.activeSession.snapshot.label,'A-2','the copy on the other device follows the running one');
  // A review opened during the session settles the rest and leaves the session as it is.
  b.notes=note('second edit on B');await B.upload();running(a,'A-2b',11.5);
  const reviewed=await A.review();assert.equal(reviewed.cancelled,false,'a review works during a running session');
  assert.equal(a.notes.Shared.text,'second edit on B');assert.equal(a.activeSession.snapshot.label,'A-2b','the review leaves the running session as it is');assert.equal(a.running,true);
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  // Suspend hands the session over; Continue here picks it up on the other device.
  a.activeSession=session(day,'A-SUSPENDED',{runningOn:a.installationId,revision:12});a.running=false;await A.upload();
  assert.equal((await B.sync()).cancelled,false);assert.equal(b.activeSession.snapshot.label,'A-SUSPENDED');assert.equal(b.activeSession.status,'suspended');
  running(b,'B-CONTINUED',13);await B.upload();
  assert.equal((await A.sync()).cancelled,false);assert.equal(a.activeSession.runningOn,b.installationId,'the device that handed the session over now shows it running elsewhere');assert.equal(a.activeSession.snapshot.label,'B-CONTINUED');
  // Taken over while the other device has nothing unsynced: it follows quietly.
  running(a,'A-TOOK-OVER',14);await A.upload();
  assert.equal((await B.sync()).cancelled,false,'a device with nothing unsynced follows a takeover without a question');
  assert.equal(b.activeSession.runningOn,a.installationId);assert.equal(b.activeSession.snapshot.label,'A-TOOK-OVER');
  // Taken over after recording progress: that device stops and keeps its progress for review.
  running(b,'B-TOOK-BACK',15);await B.upload();
  running(a,'A-PROGRESS',16);
  const yielded=await A.sync();
  assert.equal(yielded.cancelled,false,'a takeover never stops the sync');
  assert.equal(a.running,false,'the device that was taken over stops its timer');assert.equal(a.activeSession.snapshot.label,'B-TOOK-BACK','it shows the session running on the other device');
  const keptProgress=a.reviews.open().find(review=>review.subject==='session');assert.equal(keptProgress.kept.snapshot.label,'A-PROGRESS','its own progress is kept for review');assert.equal(keptProgress.kept.status,'suspended');
}

// BF-1R1: first catch-up after B saves the old day AND starts a newer day.
// An unchanged A is already covered by the shared ancestor; A's genuinely
// later work must survive as a single unresolved version, not an obsolete
// Active Session that keeps triggering previous-day warnings.
for(const variant of ['unchanged','late','last-tick']){
  const lateWork=variant==='late',finalTick=variant==='last-tick';
  syncWorld.drive.clear();syncWorld.claims.clear();
  const {device,note}=syncWorld,day='2026-08-27',later='2026-08-28';
  const suffix=variant.replaceAll('-','_');
  const a={installationId:'inst_bf1r1_old_'+suffix,records:new Map(),deletions:[],noteDeletions:[],notes:note('bf1r1'),activeSession:null,schedule:'',personal:personal('BF1R1 User'),journal:null};
  const b={installationId:'inst_bf1r1_new_'+suffix,records:new Map(),deletions:[],noteDeletions:[],notes:{},activeSession:null,schedule:'',personal:personal('BF1R1 User'),journal:null};
  const A=device(a),B=device(b);
  a.activeSession=session(day,'SHARED-OLD-DAY',{runningOn:a.installationId,revision:10});
  a.schedule=a.activeSession.scheduleText;a.running=true;a.yieldAddsProgress=finalTick;
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  b.records.set(day,record(day,'saved on B before the new day','2026-08-28T02:00:00.000Z'));
  b.activeSession=session(later,'B-NEXT-DAY',{runningOn:b.installationId,revision:13});
  b.schedule=b.activeSession.scheduleText;b.running=true;
  await B.upload();
  if(lateWork){
    a.activeSession=session(day,'A-UNSYNCED-LATE-WORK',{runningOn:a.installationId,revision:14});
    a.schedule=a.activeSession.scheduleText;
  }
  assert.equal((await A.sync()).cancelled,false,'a newer-day checkpoint and old Saved Day must converge together');
  assert.equal(a.activeSession.date,later,'the obsolete previous-day Active Session cannot suppress the new day');
  assert.equal(a.activeSession.snapshot.label,'B-NEXT-DAY');
  assert.equal(a.running,false,'the old device must stop executing the prior day');
  assert.equal(a.records.get(day)?.reflection,'saved on B before the new day');
  const oldCopies=()=>a.reviews.open().filter(review=>review.subject==='session'&&review.kept?.date===day);
  assert.equal(oldCopies().length,lateWork||finalTick?1:0,'only genuinely unsaved old work is retained');
  if(lateWork||finalTick)assert.equal(oldCopies()[0].kept.snapshot.label,lateWork?'A-UNSYNCED-LATE-WORK':'A-FINAL-TICK');
  assert.equal((await A.sync()).cancelled,false);
  assert.equal(oldCopies().length,lateWork||finalTick?1:0,'replay of an already settled day cannot enqueue a second review');
}

// BF-C4.1: a real shared semantic ancestor prevents false reviews when
// local changes only touch save metadata and the other device changes study.
for(const variant of ['remote-edit','remote-delete','local-edit','both-edit']){
  syncWorld.drive.clear();syncWorld.claims.clear();
  const date='2026-09-12',a={installationId:'inst_sem_day_a_'+variant.replaceAll('-','_'),records:new Map(),deletions:[],noteDeletions:[],
    notes:syncWorld.note('semantic'),activeSession:null,schedule:'',personal:personal('Semantic QA'),journal:null},
    b={installationId:'inst_sem_day_b_'+variant.replaceAll('-','_'),records:new Map(),deletions:[],noteDeletions:[],
    notes:{},activeSession:null,schedule:'',personal:personal('Semantic QA'),journal:null};
  const A=syncWorld.device(a),B=syncWorld.device(b);
  a.records.set(date,revisionedRecord(date,'shared study',17,'2026-09-12T09:00:00.000Z'));
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  assert.ok(a.reconciliationBase.semanticDays[date], 'new checkpoint stores a distinct semantic Day fingerprint');
  if(variant==='local-edit'||variant==='both-edit')a.records.set(date,freeze({...a.records.get(date),reflection:'A added content',sourceRevision:19}));
  else a.records.set(date,freeze({...a.records.get(date),savedAt:'2026-09-12T11:00:00.000Z',updatedAt:'2026-09-12T11:00:00.000Z',sourceRevision:950}));
  if(variant==='remote-delete'){
    b.records.delete(date);b.deletions=[{date,deletedAt:'2026-09-12T12:00:00.000Z'}];
  }else if(variant==='local-edit'){
    b.records.set(date,freeze({...b.records.get(date),savedAt:'2026-09-12T12:00:00.000Z',updatedAt:'2026-09-12T12:00:00.000Z',sourceRevision:997}));
  }else b.records.set(date,freeze({...b.records.get(date),reflection:'B added content',updatedAt:'2026-09-12T12:00:00.000Z'}));
  await B.upload();assert.equal((await A.sync()).cancelled,false);
  const kept=a.reviews.open().filter(item=>item.subject==='savedDay'&&item.ref===date);
  if(variant==='remote-delete')assert.equal(a.records.has(date),false,'remote deletion wins against local metadata-only refresh');
  else assert.equal(a.records.get(date)?.reflection,variant==='local-edit'?'A added content':'B added content','one-sided meaningful study change wins');
  assert.equal(kept.length,variant==='both-edit'?1:0,'only two different substantive edits create a kept version');
  assert.equal((await A.sync()).cancelled,false);
  assert.equal(a.reviews.open().filter(item=>item.subject==='savedDay'&&item.ref===date).length,variant==='both-edit'?1:0,'repeated sync remains idempotent');
}
// Session content ancestry must not hand the running clock to a device merely
// because metadata differs. It allows the verified owner's actual progress
// to replace an unmodified semantic branch without a false review.
{
  syncWorld.drive.clear();syncWorld.claims.clear();
  const date='2026-09-13',a={installationId:'inst_sem_session_a',records:new Map(),deletions:[],noteDeletions:[],
    notes:syncWorld.note('session'),activeSession:null,schedule:'',personal:personal('Session QA'),journal:null},
    b={installationId:'inst_sem_session_b',records:new Map(),deletions:[],noteDeletions:[],
    notes:{},activeSession:null,schedule:'',personal:personal('Session QA'),journal:null};
  const A=syncWorld.device(a),B=syncWorld.device(b);
  a.activeSession=revisionedSession(date,'SHARED',{runningOn:a.installationId,revision:10,contentRevision:7,savedRevision:0});
  a.schedule=a.activeSession.scheduleText;a.running=true;
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  const before=a.activeSession,sharedFingerprint=a.reconciliationBase.sessionContentFingerprint;
  assert.ok(sharedFingerprint&&sharedFingerprint!==a.reconciliationBase.sessionFingerprint,'semantic and full session hashes remain distinct');
  a.activeSession=freeze({...before,revision:11,updatedAt:'2026-09-13T10:00:00.000Z'});
  b.activeSession=revisionedSession(date,'B-PROGRESS',{runningOn:b.installationId,revision:12,contentRevision:8});
  b.schedule=b.activeSession.scheduleText;b.running=true;await B.upload();
  assert.equal((await A.sync()).cancelled,false);
  assert.equal(a.activeSession.snapshot.label,'B-PROGRESS','actual later study work is adopted');
  assert.equal(a.activeSession.runningOn,b.installationId,'the remote execution owner retains ownership');
  assert.equal(a.running,false,'old owner stops its clock');
  assert.equal(a.reviews.open().filter(item=>item.subject==='session').length,0,'metadata-only ancestor does not manufacture a kept session');
}

// BF-C4: A local save-acknowledged session may differ from its full-record
// ancestor only in control metadata. The *real* Saved Day evidence predicate
// is the independent, content-based retirement proof. Unacknowledged work,
// deletions, and a later genuinely divergent session never inherit that proof.
for(const variant of ['metadata-covered','divergent','unacknowledged','deleted']){
  syncWorld.drive.clear();syncWorld.claims.clear();
  const day='2026-09-05',later='2026-09-06',a={
    installationId:'inst_bfc4_a_'+variant.replaceAll('-','_'),records:new Map(),deletions:[],noteDeletions:[],
    notes:syncWorld.note('bfc4'),activeSession:null,schedule:'',personal:personal('BF-C4 User'),journal:null
  },b={
    installationId:'inst_bfc4_b_'+variant.replaceAll('-','_'),records:new Map(),deletions:[],noteDeletions:[],
    notes:{},activeSession:null,schedule:'',personal:personal('BF-C4 User'),journal:null
  };
  const A=syncWorld.device(a),B=syncWorld.device(b);
  a.activeSession=revisionedSession(day,'BF-C4-SHARED',{runningOn:a.installationId,revision:10,contentRevision:5,savedRevision:0});
  a.schedule=a.activeSession.scheduleText;a.running=true;
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  if(variant==='deleted')b.deletions=[{date:day,deletedAt:'2026-09-06T07:00:00.000Z'}];
  else b.records.set(day,revisionedRecord(day,'saved on B before the new day',104,'2026-09-06T07:00:00.000Z'));
  b.activeSession=revisionedSession(later,'BF-C4-NEXT',{runningOn:b.installationId,revision:13,contentRevision:1});
  b.schedule=b.activeSession.scheduleText;b.running=true;await B.upload();
  const old=a.activeSession,snapshot=freeze({...old.snapshot,
    label:variant==='divergent'?'BF-C4-UNSAVED-LATE-WORK':old.snapshot.label,
    contentRevision:variant==='divergent'?6:old.snapshot.contentRevision,
    savedRevision:variant==='metadata-covered'||variant==='deleted'?5:0,
    updatedAt:'2026-09-05T22:00:00.000Z'});
  a.activeSession=freeze({...old,revision:11,snapshot,updatedAt:'2026-09-05T22:00:00.000Z'});
  assert.notEqual(await processing.run('checksum',{value:CanonicalModule.signature(a.activeSession),algorithm:'sha256'}),
    a.reconciliationBase.sessionFingerprint,'the full-record ancestor must differ in every BF-C4 case');
  assert.equal((await A.sync()).cancelled,false);
  const keptOld=a.reviews.open().filter(item=>item.subject==='session'&&item.kept?.date===day);
  if(variant==='metadata-covered'){
    assert.equal(a.activeSession?.date,later,'canonically acknowledged study evidence is retired despite changed control metadata');
    assert.equal(keptOld.length,0,'control metadata must not manufacture an unsaved-study review');
    assert.equal((await A.sync()).cancelled,false);
    assert.equal(a.reviews.open().filter(item=>item.subject==='session'&&item.kept?.date===day).length,0,'repeated sync stays review-free');
  }else if(variant==='deleted'){
    assert.equal(a.activeSession?.date,day,'a deleted or absent Saved Day cannot prove that a local session is stored');
    assert.equal(keptOld.length,0,'the live local session is retained rather than archived as an obsolete day');
  }else{
    assert.equal(a.activeSession?.date,later,'the newer-day session may display after preserving the old branch');
    assert.equal(keptOld.length,1,variant==='divergent'
      ?'genuine unsaved study progress must be kept for review'
      :'a matching Day without a canonical save acknowledgement cannot prove retirement');
  }
}

// BF-C4: when the verified descendant has *ended* the same-day session,
// an acknowledged local copy need not exactly match its legacy full hash.
// No new Saved Day fingerprint format or ownership authority is introduced.
{
  syncWorld.drive.clear();syncWorld.claims.clear();
  const day='2026-09-07',a={installationId:'inst_bfc4_end_a',records:new Map(),deletions:[],noteDeletions:[],
    notes:syncWorld.note('bfc4-end'),activeSession:null,schedule:'',personal:personal('BF-C4 User'),journal:null},
    b={installationId:'inst_bfc4_end_b',records:new Map(),deletions:[],noteDeletions:[],
    notes:{},activeSession:null,schedule:'',personal:personal('BF-C4 User'),journal:null};
  const A=syncWorld.device(a),B=syncWorld.device(b);
  a.activeSession=revisionedSession(day,'BF-C4-ENDED',{runningOn:a.installationId,revision:7,contentRevision:3,savedRevision:0});
  a.schedule=a.activeSession.scheduleText;a.running=true;
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  b.records.set(day,revisionedRecord(day,'saved on B',501,'2026-09-07T19:00:00.000Z'));
  b.activeSession=null;b.schedule='';b.running=false;await B.upload();
  const previous=a.activeSession;
  a.activeSession=freeze({...previous,revision:8,updatedAt:'2026-09-07T19:01:00.000Z',
    snapshot:freeze({...previous.snapshot,savedRevision:3,updatedAt:'2026-09-07T19:01:00.000Z'})});
  assert.equal((await A.sync()).cancelled,false);
  assert.equal(a.activeSession,null,'verified remote end and acknowledged matching Day may retire a metadata-changed session');
  assert.equal(a.reviews.open().filter(item=>item.subject==='session').length,0,'an acknowledged end creates no phantom kept version');
}

// BF-1: Continue Here is fenced by the exact verified Drive session content.
// The read is side-effect free: B may have a stale local copy, but it claims
// the newest shared session without reconciling unrelated domains. Pure
// ownership changes create no review. When B saves/ends the session, A
// converges to the Saved Day and no Active Session without an unsaved warning
// or kept version.
{
  syncWorld.drive.clear();syncWorld.claims.clear();
  const {device,note}=syncWorld,day='2026-08-31';
  const a={installationId:'inst_bf1_session_device_a',records:new Map(),deletions:[],noteDeletions:[],notes:note('bf1'),activeSession:null,schedule:'',personal:personal('BF1 User'),journal:null};
  const b={installationId:'inst_bf1_session_device_b',records:new Map(),deletions:[],noteDeletions:[],notes:{},activeSession:null,schedule:'',personal:personal('BF1 User'),journal:null};
  const A=device(a,{claims:true}),B=device(b,{claims:true}),keptSessions=state=>state.reviews.open().filter(review=>review.subject==='session');
  a.activeSession=revisionedSession(day,'BF1-SHARED',{runningOn:a.installationId,revision:10,contentRevision:7,savedRevision:0,updatedAt:'2026-08-31T09:00:00.000Z'});a.schedule=a.activeSession.scheduleText;a.running=true;
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  const source=await B.handoffSource();
  assert.equal(source.status,'completed');assert.equal(source.session.runningOn,a.installationId);assert.equal(source.session.snapshot.label,'BF1-SHARED');
  const bBefore=structuredClone(b.activeSession),observedContentFingerprint=await sessionContentFingerprint(source.session);
  assert.deepEqual(b.activeSession,bBefore,'reading the handoff source must not reconcile or mutate B');
  const claimed=await B.claim({date:day,observedOwner:source.session.runningOn,observedRevision:source.session.revision,observedContentFingerprint,expectedCheckpointId:source.checkpointId,handoffToken:'11111111-1111-4111-8111-111111111111',revision:11});
  assert.equal(claimed.status,'completed');
  b.activeSession=freeze({...source.session,runningOn:b.installationId,status:'active',revision:11,suspendedAt:null,updatedAt:'2026-08-31T09:01:00.000Z'});b.schedule=b.activeSession.scheduleText;b.running=true;

  // Before B publishes its first owned checkpoint, Drive still names A. The
  // claim stops A but that stale checkpoint must not create a review or revert
  // ownership.
  assert.equal((await A.sync()).cancelled,false);
  assert.equal(a.running,false,'the old owner stops from the handoff claim');
  assert.equal(keptSessions(a).length,0,'a stale pre-claim checkpoint does not manufacture a session review');
  await B.upload();assert.equal((await A.sync()).cancelled,false);
  assert.equal(a.activeSession.runningOn,b.installationId,'A follows B once B publishes the owned session');
  assert.equal(keptSessions(a).length,0,'ownership-only movement remains review-free');

  // B saves and ends the exact session. The released ownership epoch plus the
  // no-session checkpoint is the causal end transition; sourceRevision is data
  // provenance, not cross-device ancestry proof.
  b.records.set(day,revisionedRecord(day,'saved after BF1 handoff',7,'2026-08-31T09:05:00.000Z'));b.activeSession=null;b.schedule='';b.running=false;
  await B.upload();
  assert.equal((await A.sync()).cancelled,false,'the old owner must converge to the Saved Day without a decision');
  assert.equal(a.activeSession,null,'A retires the obsolete Active Session after B ends it');
  assert.equal(a.records.get(day).reflection,'saved after BF1 handoff');
  assert.equal(keptSessions(a).length,0,'a legitimate handoff and save leave no Active Session kept version');
}

// BF-1: a Drive claim that exists but cannot be verified is not an absent
// claim. Sync must stop without applying the still-old shared checkpoint;
// repairing the remote claim then permits the original owner to yield.
{
  syncWorld.drive.clear();syncWorld.claims.clear();
  const {device,note,claims}=syncWorld,day='2026-08-31';
  const a={installationId:'inst_bf1_uncertain_a',records:new Map(),deletions:[],noteDeletions:[],notes:note('claim'),activeSession:null,schedule:'',personal:personal('BF1 User'),journal:null};
  const b={installationId:'inst_bf1_uncertain_b',records:new Map(),deletions:[],noteDeletions:[],notes:{},activeSession:null,schedule:'',personal:personal('BF1 User'),journal:null};
  const A=device(a,{claims:true}),B=device(b,{claims:true});
  a.activeSession=revisionedSession(day,'OWNER-A',{runningOn:a.installationId,revision:20,contentRevision:5});a.schedule=a.activeSession.scheduleText;a.running=true;
  await A.upload();assert.equal((await B.sync()).cancelled,false);
  const source=await B.handoffSource(),fingerprint=await sessionContentFingerprint(source.session);
  const claimed=await B.claim({date:day,observedOwner:source.session.runningOn,observedRevision:source.session.revision,observedContentFingerprint:fingerprint,expectedCheckpointId:source.checkpointId,handoffToken:'22222222-2222-4222-8222-222222222222',revision:21});
  assert.equal(claimed.status,'completed');
  const [id,file]=[...claims.entries()].at(-1);
  claims.set(id,freeze({...file,blob:new Blob(['invalid protected claim'])}));
  await assert.rejects(A.sync(),error=>error?.code==='REPOSITORY_SESSION_CLAIM_UNCERTAIN','unverifiable ownership must fail closed rather than fall back to stale checkpoint ancestry');
  assert.equal(a.activeSession.runningOn,a.installationId,'claim read failure must not replace local Active Session');
  assert.equal(a.running,true,'failure to verify the remote ownership did not authorize a local state transition');
  claims.set(id,file);
  assert.equal((await A.sync()).cancelled,false);
  assert.equal(a.running,false,'a verified remote owner stops the old runtime before changing the stored session');
}

// Continue Here reads Drive's newest session even when this device's local copy
// is stale. Work made by the current owner after the claim stays current; work
// the old owner records after the observed handoff boundary is kept exactly
// once for review rather than stealing ownership back.
{
  syncWorld.drive.clear();syncWorld.claims.clear();
  const {device,note}=syncWorld,day='2026-08-31';
  const a={installationId:'inst_claim_sync_a',records:new Map(),deletions:[],noteDeletions:[],notes:note('first'),activeSession:null,schedule:'',personal:personal('Sync User'),journal:null};
  const b={installationId:'inst_claim_sync_b',records:new Map(),deletions:[],noteDeletions:[],notes:{},activeSession:null,schedule:'',personal:personal('Sync User'),journal:null};
  const A=device(a,{claims:true}),B=device(b,{claims:true}),running=(state,label,revision)=>{state.activeSession=session(day,label,{runningOn:state.installationId,status:'active',revision});state.schedule=state.activeSession.scheduleText;state.running=true;};
  const keptSessions=state=>state.reviews.open().filter(review=>review.subject==='session');
  running(a,'A-1',10);await A.upload();assert.equal((await B.sync()).cancelled,false);
  running(a,'A-2',11);await A.upload();
  const source=await B.handoffSource();
  assert.equal(source.session.snapshot.label,'A-2','Continue Here reads the newest verified Drive session');
  assert.equal(b.activeSession.snapshot.label,'A-1','the handoff read itself does not mutate B');
  const claim=await B.claim({date:day,observedOwner:source.session.runningOn,observedRevision:source.session.revision,observedContentFingerprint:await sessionContentFingerprint(source.session),expectedCheckpointId:source.checkpointId,handoffToken:'33333333-3333-4333-8333-333333333333',revision:12});
  assert.equal(claim.status,'completed');
  b.activeSession=freeze({...source.session,runningOn:b.installationId,status:'active',revision:12,suspendedAt:null,updatedAt:new Date().toISOString()});b.schedule=b.activeSession.scheduleText;b.running=true;
  // Both devices may now make progress. A cannot publish through the ownership
  // fence; B can continue locally without first importing unrelated data.
  running(a,'A-3',13);await assert.rejects(A.upload(),error=>error?.code==='REPOSITORY_SESSION_OWNERSHIP_AHEAD','the old owner cannot publish past B’s claim');
  running(b,'B-CONTINUED',13);
  assert.equal((await B.sync()).cancelled,false,'B may reconcile the pre-claim Drive head without losing ownership');
  assert.equal(b.running,true);assert.equal(b.activeSession.runningOn,b.installationId);assert.equal(b.activeSession.snapshot.label,'B-CONTINUED');
  assert.equal(keptSessions(b).length,0,'the current owner does not review the stale pre-claim copy');
  await B.upload();assert.equal((await A.sync()).cancelled,false);
  assert.equal(a.running,false);assert.equal(a.activeSession.runningOn,b.installationId);assert.equal(a.activeSession.snapshot.label,'B-CONTINUED');
  assert.equal(keptSessions(a).filter(review=>review.kept?.snapshot?.label==='A-3').length,1,'late old-owner progress is kept exactly once');

  // A takes ownership back from the newest B state, then both sides diverge;
  // B's late progress is likewise kept once.
  const backSource=await A.handoffSource();
  const back=await A.claim({date:day,observedOwner:backSource.session.runningOn,observedRevision:backSource.session.revision,observedContentFingerprint:await sessionContentFingerprint(backSource.session),expectedCheckpointId:backSource.checkpointId,handoffToken:'44444444-4444-4444-8444-444444444444',revision:14});
  assert.equal(back.status,'completed');
  a.activeSession=freeze({...backSource.session,runningOn:a.installationId,status:'active',revision:14,suspendedAt:null,updatedAt:new Date().toISOString()});a.schedule=a.activeSession.scheduleText;a.running=true;
  running(a,'A-BACK',15);await A.upload();running(b,'B-PROGRESS',16);
  assert.equal((await B.sync()).cancelled,false);
  assert.equal(b.running,false);assert.equal(b.activeSession.runningOn,a.installationId);assert.equal(b.activeSession.snapshot.label,'A-BACK');
  assert.equal(keptSessions(b).filter(review=>review.kept?.snapshot?.label==='B-PROGRESS').length,1,'late B progress is kept exactly once after A takes ownership back');
}

// Taken over and already saved as that day's Saved Day on the other device
// before this one syncs: the session ends here too (it never comes back), and
// what this device recorded since it last synced is kept for review.
{
  syncWorld.drive.clear();
  const {device,note}=syncWorld;
  const a={installationId:'inst_session_device_a',records:new Map(),deletions:[],noteDeletions:[],notes:note('first'),activeSession:null,schedule:'',personal:personal('Sync User'),journal:null};
  const b={installationId:'inst_session_device_b',records:new Map(),deletions:[],noteDeletions:[],notes:{},activeSession:null,schedule:'',personal:personal('Sync User'),journal:null};
  const A=device(a),B=device(b),start=(state,day,label,revision,status='active')=>{state.activeSession=session(day,label,{runningOn:state.installationId,status,revision});state.schedule=state.activeSession.scheduleText;state.running=status==='active';};
  const takenAndSaved=async day=>{assert.equal((await B.sync()).cancelled,false);start(b,day,`B-${day}`,50);await B.upload();b.activeSession=null;b.schedule='';b.running=false;b.records.set(day,record(day,`saved on B ${day}`,`${day}T18:00:00.000Z`));await B.upload();};
  const keptSessions=()=>a.reviews.open().filter(review=>review.subject==='session');
  // Running here with progress since the last sync: the timer stops and the progress is kept.
  start(a,'2026-09-01','A-RUNNING',10);await A.upload();await takenAndSaved('2026-09-01');
  start(a,'2026-09-01','A-RUNNING-PROGRESS',11);
  assert.equal((await A.sync()).cancelled,false,'an ended session never stops the sync');
  assert.equal(a.activeSession,null,'a session saved on the other device ends here too');assert.equal(a.running,false,'the timer here stops');assert.equal(a.records.get('2026-09-01').reflection,'saved on B 2026-09-01');
  assert.equal(keptSessions().length,1);assert.equal(keptSessions()[0].kept.snapshot.label,'A-RUNNING-PROGRESS','what it recorded since is kept for review');assert.equal(keptSessions()[0].kept.status,'suspended');
  await A.upload();assert.equal((await B.sync()).cancelled,false);assert.equal(b.activeSession,null,'the ended session does not come back on the other device');
  // Suspended here with progress since the last sync: the same.
  start(a,'2026-09-02','A-SUSPENDED',20,'suspended');await A.upload();await takenAndSaved('2026-09-02');
  start(a,'2026-09-02','A-SUSPENDED-PROGRESS',21,'suspended');
  assert.equal((await A.sync()).cancelled,false);assert.equal(a.activeSession,null);
  assert.equal(keptSessions().length,2);assert.ok(keptSessions().some(review=>review.kept.snapshot.label==='A-SUSPENDED-PROGRESS'));
  await A.upload();assert.equal((await B.sync()).cancelled,false);assert.equal(b.activeSession,null);
  // Running here with nothing new since the last sync: it simply ends, with nothing to review.
  start(a,'2026-09-03','A-IDLE',30);await A.upload();await takenAndSaved('2026-09-03');
  assert.equal((await A.sync()).cancelled,false);assert.equal(a.activeSession,null);assert.equal(keptSessions().length,2,'nothing new here, nothing kept');
  // A session of its own that the other side never saw stays, even when that side saved the same day.
  a.activeSession=null;await A.upload();assert.equal((await B.sync()).cancelled,false);
  start(a,'2026-09-04','A-UNSEEN',40);b.records.set('2026-09-04',record('2026-09-04','B’s own day','2026-09-04T18:00:00.000Z'));await B.upload();
  assert.equal((await A.sync()).cancelled,false);assert.equal(a.activeSession.snapshot.label,'A-UNSEEN','a session the other side never had is not ended by it');assert.equal(a.running,true);
}

// The merge rules (docs/areas/backup-and-sync.md#merge-rules) over generated
// cases. From a shared start, each device keeps, edits (one of the first two
// paragraphs, so both sides often pick the same one) or
// deletes each note, keeps or edits each Saved Day, and may add a note of its
// own. A uploads, B syncs, B uploads, A syncs. Whatever the mix, nothing is
// lost, both devices end alike, and a repeated sync changes nothing.
let mergeRuleCases=0;
{
  const {device}=syncWorld,T0=Date.parse('2026-09-01T08:00:00.000Z'),iso=ms=>new Date(ms).toISOString();
  const noteRow=(key,text,ms)=>freeze({version:2,key,text,updatedAt:iso(ms)}),baseText=key=>[0,1,2].map(paragraph=>`${key} paragraph ${paragraph}`).join('\n\n');
  const snapshot=state=>freeze({notes:Object.fromEntries(Object.entries(state.notes).map(([key,value])=>[key,value.text]).sort(([x],[y])=>x.localeCompare(y))),days:Object.fromEntries([...state.records].map(([date,value])=>[date,value.reflection]).sort(([x],[y])=>x.localeCompare(y))),reviews:state.reviews.open().map(review=>review.id).sort()});
  mergeRuleCases=await checkCases('sync merge rules',{seed:20261102,count:30},async({int,weighted,chance},index)=>{
    syncWorld.drive.clear();
    const keys=Array.from({length:int(2,3)},(_,n)=>`Note${n}`),dates=['2026-08-01','2026-08-02'].slice(0,int(1,2));
    const a={installationId:`inst_rule_a_${index}`,records:new Map(dates.map(date=>[date,record(date,`${date} as shared`,iso(T0))])),deletions:[],noteDeletions:[],notes:Object.fromEntries(keys.map(key=>[key,noteRow(key,baseText(key),T0)])),activeSession:null,schedule:'',personal:personal('Rule User'),journal:null};
    const b={installationId:`inst_rule_b_${index}`,records:new Map(),deletions:[],noteDeletions:[],notes:{},activeSession:null,schedule:'',personal:personal('Rule User'),journal:null};
    const A=device(a),B=device(b);
    await A.upload();assert.equal((await B.sync()).cancelled,false);assert.deepEqual(snapshot(b).notes,snapshot(a).notes,'both start from the same notes');
    // Every change gets its own time, so "the newer" is always defined.
    const used=new Set(),at=()=>{let ms;do ms=T0+int(1,7200)*1000;while(used.has(ms));used.add(ms);return ms;};
    const change=(state,side)=>{
      const notes={},days={};
      for(const key of keys){
        const kind=weighted({keep:3,edit:4,delete:2});notes[key]={kind};
        if(kind==='edit'){const paragraph=int(0,1),parts=baseText(key).split('\n\n');parts[paragraph]=`${key} paragraph ${paragraph} by ${side} ${int(1,999999)}`;const ms=at(),text=parts.join('\n\n');state.notes={...state.notes,[key]:noteRow(key,text,ms)};Object.assign(notes[key],{paragraph,line:parts[paragraph],text,ms});}
        if(kind==='delete'){const ms=at(),{[key]:gone,...rest}=state.notes;state.notes={...rest,[`~deleted ${key}`]:noteRow(`~deleted ${key}`,gone.text,ms)};state.noteDeletions=[...state.noteDeletions,{key,deletedAt:iso(ms)}];}
      }
      for(const date of dates){days[date]={kind:'keep'};if(chance(0.5)){const ms=at(),reflection=`${date} by ${side}`;state.records.set(date,record(date,reflection,iso(ms)));days[date]={kind:'edit',reflection,ms};}}
      const added=chance(0.4)?`Added on ${side}`:null;if(added)state.notes={...state.notes,[added]:noteRow(added,`written on ${side}`,at())};
      return {notes,days,added};
    };
    const byA=change(a,'A'),byB=change(b,'B');
    await A.upload();assert.equal((await B.sync()).cancelled,false,'a sync never stops to ask');
    const open=b.reviews.open(),kept=(subject,ref)=>open.filter(review=>review.subject===subject&&review.ref===ref);let expectedReviews=0;
    for(const key of keys){
      const theirs=byA.notes[key],mine=byB.notes[key],live=b.notes[key]?.text,held=kept('note',key),label=`note ${key} (A ${theirs.kind}, B ${mine.kind})`;
      if(theirs.kind==='keep'&&mine.kind==='keep'){assert.equal(live,baseText(key),label);assert.equal(held.length,0,label);}
      else if(theirs.kind==='keep'||mine.kind==='keep'){
        const changed=theirs.kind==='keep'?mine:theirs;
        assert.equal(live,changed.kind==='edit'?changed.text:undefined,`${label}: a change made on one side only is taken`);assert.equal(held.length,0,`${label}: without a review`);
      }else if(theirs.kind==='delete'&&mine.kind==='delete'){assert.equal(live,undefined,label);assert.equal(held.length,0,label);}
      else if(theirs.kind==='delete'||mine.kind==='delete'){
        assert.equal(live,(theirs.kind==='edit'?theirs:mine).text,`${label}: an edited note is never deleted by a sync`);
        assert.deepEqual(held.map(review=>review.kept),[null],`${label}: its review offers the deletion`);expectedReviews+=1;
      }else if(theirs.paragraph!==mine.paragraph){
        assert.equal(held.length,0,`${label}: edits to different paragraphs need no review`);
        for(const line of [theirs.line,mine.line])assert.ok(String(live).split('\n\n').includes(line),`${label}: both edits are in the joined text`);
      }else{
        const [newer,older]=theirs.ms>mine.ms?[theirs,mine]:[mine,theirs];
        assert.equal(live,newer.text,`${label}: the newer edit shows`);
        assert.equal(held.length,1,`${label}: the other is kept for review`);assert.equal(held[0].kept.text,older.text,label);assert.equal(held[0].base?.text,baseText(key),`${label}: with what both last shared`);expectedReviews+=1;
      }
    }
    for(const date of dates){
      const theirs=byA.days[date],mine=byB.days[date],live=b.records.get(date)?.reflection,held=kept('savedDay',date),label=`Saved Day ${date} (A ${theirs.kind}, B ${mine.kind})`;
      if(theirs.kind==='keep'&&mine.kind==='keep'){assert.equal(live,`${date} as shared`,label);assert.equal(held.length,0,label);}
      else if(theirs.kind==='keep'||mine.kind==='keep'){assert.equal(live,(theirs.kind==='keep'?mine:theirs).reflection,`${label}: a change made on one side only is taken`);assert.equal(held.length,0,label);}
      else{
        const [newer,older]=theirs.ms>mine.ms?[theirs,mine]:[mine,theirs];
        assert.equal(live,newer.reflection,`${label}: the newer shows`);assert.deepEqual(held.map(review=>review.kept?.reflection),[older.reflection],`${label}: the other is kept for review`);expectedReviews+=1;
      }
    }
    for(const added of [byA.added,byB.added].filter(Boolean))assert.equal(b.notes[added]?.text,`written on ${added.slice(-1)}`,`a note added on one side arrives: ${added}`);
    assert.equal(open.length,expectedReviews,'nothing else is kept for review');
    // Every deleted note's text is still in Recently deleted on the device that deleted it.
    for(const [state,changes] of [[a,byA],[b,byB]])for(const key of keys)if(changes.notes[key].kind==='delete')assert.ok(state.notes[`~deleted ${key}`],`a deleted note stays in Recently deleted: ${key}`);
    const settled=snapshot(b);
    await B.upload();assert.equal((await A.sync()).cancelled,false);
    assert.deepEqual(snapshot(a),settled,'both devices end with the same notes, Saved Days and kept versions');
    assert.equal((await A.sync()).cancelled,false);assert.deepEqual(snapshot(a),settled,'a repeated sync changes nothing');
    assert.equal((await B.sync()).cancelled,false);assert.deepEqual(snapshot(b),settled,'nor does a sync of what this device uploaded');
  });
}

console.log(JSON.stringify({status:'PASS',suite:'sync-shared-base',mergeRuleCases,preflightVariants:preflightCases.length,coverage:['two-device Drive sync','a restore reaches every device and keeps reviews','Combining Drive’s newest from any location moves the shared base','versions kept for review travel and resolve everywhere','study session hand-off and takeover','a takeover is not undone by an upload saved before it','current protected deletion manifest','unified reconciliation preserves local defaults','explicit Saved-Day deletion choices','explicit conflict choices beat timestamps','non-today Active Session portability','incoming-only Active Session transfers automatically','checkpoint absence preserves local Active Session','A→B→A divergent sequential Combine','scratch note reconciliation before canonical commit','restore preflight flushes pending canonical state','stale reconciliation rebuild fence','file reconciliation Device Backup convergence','standalone file Replace exact replacement']},null,2));
