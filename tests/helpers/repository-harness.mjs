import {repositoryStorage} from './repository-storage.mts';
import {readRuntimeSource} from './runtime-source.mjs';
import {readScript} from '../../build/source-script.mts';
import fs from 'node:fs';
import vm from 'node:vm';
import {APP_META_RUNTIME_REGISTRY} from '../../contracts/data-architecture.mjs';
import {PRODUCTION_LIMITS} from '../../contracts/production-limits.mjs';
import {noteKeys,fixtureNoteKey} from './note-ids.mjs';
import {testPendingReviewCodec} from './pending-review-codec.mjs';
import {RUNTIME_DATA_CONTRACT} from '../../contracts/canonical-identities.mjs';
const freeze=Object.freeze;
const appMetaSource=readScript('source/core/app-meta.ts');
const repositoryJournals=readScript('source/core/repository-journals.ts');
const notesRepository=readScript('source/core/repositories-notes.ts');
const repositories=readScript('source/core/repositories.ts');
const persistence=readScript('source/core/persistence.ts');
const recordCodecs=readScript('source/core/record-codecs.ts');
export function createHarness(sharedLocal=new Map(),sharedStores=null,controls={}){
  const ClockDate=controls.clock?.Date||Date;
  const timerSet=controls.clock?.setTimeout||setTimeout;
  const timerClear=controls.clock?.clearTimeout||clearTimeout;
  const {stores,localStorage,localWrites,idbReads,idbWrites,idbDurability,indexedDb}=repositoryStorage(sharedLocal,sharedStores,controls);
  const validationCalls={within:0,clamp:0};
  const normalizeTs=(value,fallback='')=>{const parsed=Date.parse(String(value||''));return Number.isFinite(parsed)?new Date(parsed).toISOString():fallback};
  const installationIdentity=freeze({format:'study-director.installation-identity',contractVersion:4,getId:()=> 'inst_test'});
  const KeyedRecord=freeze({create:()=>Object.create(null),clone:value=>Object.assign(Object.create(null),structuredClone(value||{}))});
  const dailyRecordCodec=controls.dailyRecordCodec||freeze({
    buildDailyRecordSummary:v=>v,
    sanitizeCurrentDailyRecord:v=>v&&typeof v==='object'&&Number(v.version)===1?v:null,
    sanitizeCurrentNote:(source,key)=>{if(!source||typeof source!=='object'||Number(source.version)!==3)return null;const clean={version:3,key:String(source.key||key||''),label:String(source.label??''),text:String(source.text??''),updatedAt:String(source.updatedAt??'')},linked='links' in source,links=linked?source.links:null;if(linked&&(!Array.isArray(links)||!links.length||new Set(links).size!==links.length||links.some(id=>!noteKeys.isId(id)||id===noteKeys.id(clean.key))))return null;if(linked)clean.links=[...links];return noteKeys.isKey(clean.key)&&clean.label.trim()&&Object.keys(source).length===(linked?6:5)?clean:null;},
    noteKeys:noteKeys,
    materializeDailyRecordView:v=>v,storedDailyRecordFields:v=>v,
    sanitizeDailyRecordSummary:v=>v,
    materializeDailyRecordSummary:v=>v
  });
  const personalDataCodec=freeze({
    normalize:value=>{if(!value||value.version!==2||!value.plans||!value.preferences)throw new Error('Invalid personal data');return structuredClone(value);},
    plans:value=>{if(!value||typeof value!=='object'||!Array.isArray(value.savedPlans))throw new Error('Invalid plan data');return structuredClone(value);},
    portablePreferences:value=>{if(!value||typeof value!=='object')throw new Error('Invalid portable preferences');return {version:2,studentName:value.studentName??null,theme:value.theme??null,presentation:value.presentation??null,quote:value.quote??null,practiceCueMode:value.practiceCueMode??null,fontScale:value.fontScale??null,practiceTargetMs:value.practiceTargetMs??null,nudge:value.nudge??null,updatedAt:value.updatedAt??null};},
    currentPortablePreferences:value=>{if(!value||typeof value!=='object'||Number(value.version)!==2)return null;const expected=['version','studentName','theme','presentation','quote','practiceCueMode','fontScale','practiceTargetMs','nudge','updatedAt'];return Object.keys(value).sort().join('|')===expected.sort().join('|')?structuredClone(value):null;}
  });
  const activeSessionCodec=freeze({canonicalize:v=>structuredClone(v),normalize:v=>structuredClone(v),sanitizeCurrent:v=>v?structuredClone(v):null,sanitizeSessionSnapshot:v=>v});
  const helpers=freeze({
    boundedInt:(v,{fallback=0}={})=>Number.isFinite(+v)?Math.floor(+v):fallback,boundedNumber:(v,{fallback=0}={})=>Number.isFinite(+v)?+v:fallback,
    clampText:(v,max=1e6)=>String(v??'').slice(0,max),clampEditorContent:(v,max=1e6)=>{validationCalls.clamp++;return String(v??'').slice(0,max)},editorContentWithinLimits:()=>{validationCalls.within++;return true},
    wipeObject:o=>{for(const k of Object.keys(o))delete o[k];return o;},isValidIsoDate:v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v)),isCanonicalScheduleText:()=>true,sameDataValue:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
    activeSessionScheduleFingerprint:()=> 'fp',normalizeAreaName:v=>String(v??'').trim().toLowerCase(),displayAreaName:v=>String(v??'').trim(),isoDateDay:()=>0,normalizeTimestamp:normalizeTs,jsonByteLength:value=>Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value))
  });
  const ownershipRevision=()=>Number(controls.ownershipRevision)||1;
  const hooks=freeze({canMutate:()=>controls.owned!==false,getOwnershipRevision:ownershipRevision,issueWriteToken:()=>{if(controls.owned===false)throw Object.assign(new Error('Ownership lost'),{code:'OWNERSHIP'});return freeze({revision:ownershipRevision()});},assertWriteToken:token=>{if(controls.owned===false||token?.revision!==ownershipRevision())throw Object.assign(new Error('Ownership lost'),{code:'OWNERSHIP'});return true;},isOwnershipLostError:e=>e.code==='OWNERSHIP',capture:(...args)=>controls.onDiagnostic?.(...args),onStorageOk:()=>{},onStorageError:(...args)=>controls.onStorageError?.(...args),onNotesChanged:()=>{},onNoteSyncState:()=>{},onNoteConflict:info=>controls.onNoteConflict?.(info),onDailyRecordsChanged:()=>{},onDatasetRevisionChanged:()=>{},onCanonicalCommit:event=>controls.onCanonicalCommit?.(event)});
  const limits=freeze({backupImportBatchSize:PRODUCTION_LIMITS.backupImportBatchSize,maxAreaNameChars:160,maxNoteChars:1000000,localRescueBytes:PRODUCTION_LIMITS.localRescueBytes,noteRescueBytes:PRODUCTION_LIMITS.noteRescueBytes,noteTrashDays:PRODUCTION_LIMITS.noteTrashDays,maxNotes:1000,fallbackDailyRecordsBytes:4*1024*1024,deletionRecoveryBytes:64*1024,maxImportRecords:1000,maxScheduleChars:2*1024*1024,backupMaxFileBytes:512*1024*1024,backupMaxCompressedBytes:512*1024*1024,maxBackupFilenameChars:240,maxPendingReviews:PRODUCTION_LIMITS.maxPendingReviews});
  const dataContract=freeze({schemas:freeze({LocalRecoveryEnvelope:freeze({version:1}),ActiveSession:freeze({version:1}),DailyRecord:freeze({version:1}),DailySummary:freeze({version:1}),Note:freeze({version:3,trashKeyPrefix:'~deleted '})})});
  const IDBKeyRange=freeze({bound:(lower,upper)=>freeze({lower:String(lower),upper:String(upper)})});
  const context=vm.createContext({console,structuredClone,Buffer,setTimeout:timerSet,clearTimeout:timerClear,queueMicrotask,Date:ClockDate,Promise,Map,Set,Object,Array,String,Number,Math,JSON,RegExp,Error,RangeError,IDBKeyRange,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,localStorage,crypto:globalThis.crypto,globalThis:null});context.globalThis=context;
  vm.runInContext(readRuntimeSource('source/core/internal.ts'),context,{filename:'internal.js'});vm.runInContext(persistence,context,{filename:'source/core/persistence.ts'});vm.runInContext(appMetaSource,context,{filename:'source/core/app-meta.ts'});vm.runInContext(repositoryJournals,context,{filename:'source/core/repository-journals.ts'});vm.runInContext(readScript('source/core/save-lane.ts'),context,{filename:'source/core/save-lane.ts'});vm.runInContext(notesRepository,context,{filename:'source/core/repositories-notes.ts'});vm.runInContext(repositories,context,{filename:'source/core/repositories.ts'});vm.runInContext(recordCodecs,context,{filename:'source/core/record-codecs.ts'});
  const registry=context[Symbol.for('studyDirector.internalModules.v1')];
  const local=registry.require('persistence',1).createLocalStorage();
  const appMetaModule=registry.require('app-meta',1),journalModule=registry.require('repository-journals',1),notesModule=registry.require('repositories-notes',1),saveLaneModule=registry.require('save-lane',1),module=registry.require('repositories',1);
  const decisionClock=freeze({nowMs:()=>new ClockDate().getTime()});
  const pendingReviewCodec=controls.pendingReviewCodec||testPendingReviewCodec(registry.require('record-codecs',1),{dataContract:RUNTIME_DATA_CONTRACT,personalDataCodec:freeze({...personalDataCodec,normalize:value=>structuredClone(value)}),dailyRecordCodec,activeSessionCodec});
  const metaKeys=freeze({planDraft:'planDraft',planLibrary:'planLibrary',personalPreferences:'personalPreferences',canonicalMutationEpoch:'canonicalMutationEpoch',backupPreparationUnitPrefix:'backupPreparationUnit:',insightsDatasetRevision:'insightsDatasetRevision',dataMaintenance:'dataMaintenance',savedDayDeletionPrefix:'savedDayDeletion:',noteDeletionPrefix:'noteDeletion:',attachmentDeletionPrefix:'attachmentDeletion:',pendingReviewPrefix:'pendingReview:'});
  const gateway=appMetaModule.create(freeze({indexedDb:freeze({transaction:indexedDb.transaction,strictTransaction:indexedDb.strictTransaction,get:indexedDb.get,getAll:indexedDb.getAll}),store:'meta',registry:APP_META_RUNTIME_REGISTRY}));
  gateway.registerValidators('repositories',module.createAppMetaValidators(freeze({limits,dataContract,personalDataCodec,pendingReviewCodec,helpers:freeze({isValidIsoDate:helpers.isValidIsoDate,isNoteId:noteKeys.isId,isNoteKey:noteKeys.isKey,normalizeTimestamp:helpers.normalizeTimestamp,sameDataValue:helpers.sameDataValue})})));
  gateway.registerValidators('journals',journalModule.createAppMetaValidators(freeze({limits})));
  const repositoryMeta=gateway.bind('repositories'),journalMeta=gateway.bind('repository-journals');
  const journals=journalModule.create(freeze({appMeta:journalMeta,limits,helpers:freeze({clampText:helpers.clampText}),clock:decisionClock}));
  const app=module.createAppData(freeze({local,indexedDb,appMeta:repositoryMeta,installationIdentity,dailyRecordCodec,activeSessionCodec,personalDataCodec,pendingReviewCodec,keyedRecord:KeyedRecord,journals,notesRepositoryModule:notesModule,saveLaneModule,clock:decisionClock,limits,dataContract,stores:freeze({dailyRecords:'daily',dailySummaries:'summary',notes:'area',activeSessions:'session',appMeta:'meta'}),keys:freeze({recovery:'recovery',fallbackDailyRecords:'fallback',noteRescue:'noteRescue',deletionRecovery:'deletionRecovery'}),metaKeys,activeSessionId:'active',helpers,hooks}));
  return {app,appMetaGateway:gateway,repositoryMeta,journalMeta,indexedDb,localWrites,idbWrites,idbReads,idbDurability,validationCalls,sharedLocal,stores,dataContract};
}
