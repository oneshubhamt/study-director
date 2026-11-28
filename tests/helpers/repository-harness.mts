import type {StorageControls} from './repository-storage.mts';
import type {RecordCodecsModule} from '../../source/core/record-codecs.ts';
import type {createFakeClock} from './fake-clock.mts';
import {repositoryStorage} from './repository-storage.mts';
import {method,registeredExports} from './registered-exports.mts';
import {readRuntimeSource} from './runtime-source.mts';
import {readScript} from '../../build/source-script.mts';
import vm from 'node:vm';
import {APP_META_RUNTIME_REGISTRY} from '../../contracts/data-architecture.mts';
import {PRODUCTION_LIMITS} from '../../contracts/production-limits.mts';
import {noteKeys} from './note-ids.mts';
import {testPendingReviewCodec} from './pending-review-codec.mts';
import {RUNTIME_DATA_CONTRACT} from '../../contracts/canonical-identities.mts';
const freeze=Object.freeze;
const appMetaSource=readScript('source/core/app-meta.ts');
const repositoryJournals=readScript('source/core/repository-journals.ts');
const notesRepository=readScript('source/core/repositories-notes.ts');
const repositories=readScript('source/core/repositories.ts');
const persistence=readScript('source/core/persistence.ts');
const recordCodecs=readScript('source/core/record-codecs.ts');
// The VM executes the actual repository modules. The record codecs below are
// deliberately reduced fixture validators, not the production canonical schema.
// Keep VM exports unknown at the boundary until a caller inspects the capability.
type FixtureClock=Pick<ReturnType<typeof createFakeClock>,'Date'|'setTimeout'|'clearTimeout'>;
type DailyFixtureCodec={
  buildDailyRecordSummary(value:unknown):unknown;
  sanitizeCurrentDailyRecord(value:unknown):unknown;
  sanitizeCurrentNote(value:unknown,key?:unknown):unknown;
  noteKeys:typeof noteKeys;
  materializeDailyRecordView(value:unknown):unknown;
  storedDailyRecordFields(value:unknown):unknown;
  sanitizeDailyRecordSummary(value:unknown):unknown;
  materializeDailyRecordSummary(value:unknown):unknown;
};
export type RepositoryControls=StorageControls&{
  clock?:FixtureClock;owned?:boolean;ownershipRevision?:number;
  dailyRecordCodec?:DailyFixtureCodec;pendingReviewCodec?:ReturnType<typeof testPendingReviewCodec>;
  onDiagnostic?:(...args:unknown[])=>void;onStorageError?:(...args:unknown[])=>void;
  onNoteConflict?:(info:unknown)=>void;onCanonicalCommit?:(event:unknown)=>void;
};
type FixtureNote={version:number;key:string;label:string;text:string;updatedAt:string;links?:unknown[]};
function field(value:unknown,key:string):unknown{
  return value!==null&&typeof value==='object'?Reflect.get(value,key):undefined;
}
const clone=<T,>(value:T):T=>structuredClone(value);
export function createHarness(sharedLocal=new Map<string,unknown>(),sharedStores:Parameters<typeof repositoryStorage>[1]=null,controls:RepositoryControls={}){
  const ClockDate=controls.clock?.Date||Date;
  const timerSet=controls.clock?.setTimeout||setTimeout;
  const timerClear=controls.clock?.clearTimeout||clearTimeout;
  const {stores,localStorage,localWrites,idbReads,idbWrites,idbDurability,indexedDb}=repositoryStorage(sharedLocal,sharedStores,controls);
  const validationCalls={within:0,clamp:0};
  const normalizeTs=(value:unknown,fallback:string|null='')=>{const parsed=Date.parse(String(value||''));return Number.isFinite(parsed)?new Date(parsed).toISOString():fallback};
  const installationIdentity=freeze({format:'study-director.installation-identity',contractVersion:4,getId:()=> 'inst_test'});
  const KeyedRecord=freeze({create:<T,>():Record<string,T>=>Object.create(null) as Record<string,T>,clone:(value:unknown)=>Object.assign(Object.create(null) as Record<string,unknown>,structuredClone(value||{}))});
  const dailyRecordCodec:DailyFixtureCodec=controls.dailyRecordCodec||freeze({
    buildDailyRecordSummary:(value:unknown)=>value,
    sanitizeCurrentDailyRecord:(value:unknown)=>value&&typeof value==='object'&&Number(field(value,'version'))===1?value:null,
    sanitizeCurrentNote:(source:unknown,key?:unknown)=>{
      if(!source||typeof source!=='object'||Number(field(source,'version'))!==3)return null;
      const clean:FixtureNote={version:3,key:String(field(source,'key')||key||''),label:String(field(source,'label')??''),text:String(field(source,'text')??''),updatedAt:String(field(source,'updatedAt')??'')};
      const linked='links' in source,links=linked?field(source,'links'):null;
      if(linked){
        if(!Array.isArray(links))return null;
        const ids:unknown[]=links;
        if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!noteKeys.isId(id)||id===noteKeys.id(clean.key)))return null;
        clean.links=[...ids];
      }
      return noteKeys.isKey(clean.key)&&clean.label.trim()&&Object.keys(source).length===(linked?6:5)?clean:null;
    },
    noteKeys,
    materializeDailyRecordView:(value:unknown)=>value,storedDailyRecordFields:(value:unknown)=>value,
    sanitizeDailyRecordSummary:(value:unknown)=>value,materializeDailyRecordSummary:(value:unknown)=>value
  });
  const personalDataCodec=freeze({
    normalize:(value:unknown)=>{if(!value||field(value,'version')!==2||!field(value,'plans')||!field(value,'preferences'))throw new Error('Invalid personal data');return structuredClone(value);},
    plans:(value:unknown)=>{if(!value||typeof value!=='object'||!Array.isArray(field(value,'savedPlans')))throw new Error('Invalid plan data');return structuredClone(value);},
    portablePreferences:(value:unknown)=>{
      if(!value||typeof value!=='object')throw new Error('Invalid portable preferences');
      return {version:2,studentName:field(value,'studentName')??null,theme:field(value,'theme')??null,presentation:field(value,'presentation')??null,quote:field(value,'quote')??null,practiceCueMode:field(value,'practiceCueMode')??null,fontScale:field(value,'fontScale')??null,practiceTargetMs:field(value,'practiceTargetMs')??null,nudge:field(value,'nudge')??null,updatedAt:field(value,'updatedAt')??null};
    },
    currentPortablePreferences:(value:unknown)=>{
      if(!value||typeof value!=='object'||Number(field(value,'version'))!==2)return null;
      const expected=['version','studentName','theme','presentation','quote','practiceCueMode','fontScale','practiceTargetMs','nudge','updatedAt'];
      return Object.keys(value).sort().join('|')===expected.sort().join('|')?structuredClone(value):null;
    }
  });
  const activeSessionCodec=freeze({canonicalize:clone,normalize:clone,sanitizeCurrent:(value:unknown)=>value?structuredClone(value):null,sanitizeSessionSnapshot:(value:unknown)=>value});
  const helpers=freeze({
    boundedInt:(value:unknown,{fallback=0}:{fallback?:number}={})=>Number.isFinite(Number(value))?Math.floor(Number(value)):fallback,
    boundedNumber:(value:unknown,{fallback=0}:{fallback?:number}={})=>Number.isFinite(Number(value))?Number(value):fallback,
    clampText:(value:unknown,max=1e6)=>String(value??'').slice(0,max),
    clampEditorContent:(value:unknown,max=1e6)=>{validationCalls.clamp++;return String(value??'').slice(0,max)},
    editorContentWithinLimits:()=>{validationCalls.within++;return true},
    wipeObject:<T extends Record<string,unknown>>(value:T)=>{for(const key of Object.keys(value))delete value[key];return value;},
    isValidIsoDate:(value:unknown)=>/^\d{4}-\d{2}-\d{2}$/.test(String(value)),isCanonicalScheduleText:()=>true,
    sameDataValue:(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b),
    activeSessionScheduleFingerprint:()=> 'fp',normalizeAreaName:(value:unknown)=>String(value??'').trim().toLowerCase(),
    displayAreaName:(value:unknown)=>String(value??'').trim(),isoDateDay:()=>0,normalizeTimestamp:normalizeTs,
    jsonByteLength:(value:unknown)=>Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value))
  });
  const ownershipRevision=()=>Number(controls.ownershipRevision)||1;
  const hooks=freeze({canMutate:()=>controls.owned!==false,getOwnershipRevision:ownershipRevision,issueWriteToken:()=>{if(controls.owned===false)throw Object.assign(new Error('Ownership lost'),{code:'OWNERSHIP'});return freeze({revision:ownershipRevision()});},assertWriteToken:(token:unknown)=>{if(controls.owned===false||field(token,'revision')!==ownershipRevision())throw Object.assign(new Error('Ownership lost'),{code:'OWNERSHIP'});return true;},isOwnershipLostError:(error:unknown)=>field(error,'code')==='OWNERSHIP',capture:(...args:unknown[])=>controls.onDiagnostic?.(...args),onStorageOk:()=>{},onStorageError:(...args:unknown[])=>controls.onStorageError?.(...args),onNotesChanged:()=>{},onNoteSyncState:()=>{},onNoteConflict:(info:unknown)=>controls.onNoteConflict?.(info),onDailyRecordsChanged:()=>{},onDatasetRevisionChanged:()=>{},onCanonicalCommit:(event:unknown)=>controls.onCanonicalCommit?.(event)});
  const limits=freeze({backupImportBatchSize:PRODUCTION_LIMITS.backupImportBatchSize,maxAreaNameChars:160,maxNoteChars:1000000,localRescueBytes:PRODUCTION_LIMITS.localRescueBytes,noteRescueBytes:PRODUCTION_LIMITS.noteRescueBytes,noteTrashDays:PRODUCTION_LIMITS.noteTrashDays,maxNotes:1000,fallbackDailyRecordsBytes:4*1024*1024,deletionRecoveryBytes:64*1024,maxImportRecords:1000,maxScheduleChars:2*1024*1024,backupMaxFileBytes:512*1024*1024,backupMaxCompressedBytes:512*1024*1024,maxBackupFilenameChars:240,maxPendingReviews:PRODUCTION_LIMITS.maxPendingReviews});
  const dataContract=freeze({schemas:freeze({LocalRecoveryEnvelope:freeze({version:1}),ActiveSession:freeze({version:1}),DailyRecord:freeze({version:1}),DailySummary:freeze({version:1}),Note:freeze({version:3,trashKeyPrefix:'~deleted '})})});
  const IDBKeyRange=freeze({bound:(lower:unknown,upper:unknown)=>freeze({lower:String(lower),upper:String(upper)})});
  const context=vm.createContext({console,structuredClone,Buffer,setTimeout:timerSet,clearTimeout:timerClear,queueMicrotask,Date:ClockDate,Promise,Map,Set,Object,Array,String,Number,Math,JSON,RegExp,Error,RangeError,IDBKeyRange,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,localStorage,crypto:globalThis.crypto,globalThis:null});context['globalThis']=context;
  vm.runInContext(readRuntimeSource('source/core/internal.ts'),context,{filename:'internal.js'});vm.runInContext(persistence,context,{filename:'source/core/persistence.ts'});vm.runInContext(appMetaSource,context,{filename:'source/core/app-meta.ts'});vm.runInContext(repositoryJournals,context,{filename:'source/core/repository-journals.ts'});vm.runInContext(readScript('source/core/save-lane.ts'),context,{filename:'source/core/save-lane.ts'});vm.runInContext(notesRepository,context,{filename:'source/core/repositories-notes.ts'});vm.runInContext(repositories,context,{filename:'source/core/repositories.ts'});vm.runInContext(recordCodecs,context,{filename:'source/core/record-codecs.ts'});
  const local=method(registeredExports(context,'persistence'),'createLocalStorage')();
  const appMetaModule=registeredExports(context,'app-meta'),journalModule=registeredExports(context,'repository-journals'),notesModule=registeredExports(context,'repositories-notes'),saveLaneModule=registeredExports(context,'save-lane'),module=registeredExports(context,'repositories');
  const decisionClock=freeze({nowMs:()=>new ClockDate().getTime()});
  const createPendingReviewCodec=method(registeredExports(context,'record-codecs'),'createPendingReviewCodec') as RecordCodecsModule['createPendingReviewCodec'];
  const pendingReviewCodec=controls.pendingReviewCodec||testPendingReviewCodec({createPendingReviewCodec},{dataContract:RUNTIME_DATA_CONTRACT,personalDataCodec:freeze({...personalDataCodec,normalize:clone}),dailyRecordCodec,activeSessionCodec});
  const metaKeys=freeze({planDraft:'planDraft',planLibrary:'planLibrary',personalPreferences:'personalPreferences',canonicalMutationEpoch:'canonicalMutationEpoch',backupPreparationUnitPrefix:'backupPreparationUnit:',insightsDatasetRevision:'insightsDatasetRevision',dataMaintenance:'dataMaintenance',savedDayDeletionPrefix:'savedDayDeletion:',noteDeletionPrefix:'noteDeletion:',attachmentDeletionPrefix:'attachmentDeletion:',pendingReviewPrefix:'pendingReview:'});
  const gateway=method(appMetaModule,'create')(freeze({indexedDb:freeze({transaction:indexedDb.transaction,strictTransaction:indexedDb.strictTransaction,get:indexedDb.get,getAll:indexedDb.getAll}),store:'meta',registry:APP_META_RUNTIME_REGISTRY}));
  method(gateway,'registerValidators')('repositories',method(module,'createAppMetaValidators')(freeze({limits,dataContract,personalDataCodec,pendingReviewCodec,helpers:freeze({isValidIsoDate:helpers.isValidIsoDate,isNoteId:noteKeys.isId,isNoteKey:noteKeys.isKey,normalizeTimestamp:helpers.normalizeTimestamp,sameDataValue:helpers.sameDataValue})})));
  method(gateway,'registerValidators')('journals',method(journalModule,'createAppMetaValidators')(freeze({limits})));
  const repositoryMeta=method(gateway,'bind')('repositories'),journalMeta=method(gateway,'bind')('repository-journals');
  const journals=method(journalModule,'create')(freeze({appMeta:journalMeta,limits,helpers:freeze({clampText:helpers.clampText}),clock:decisionClock}));
  const app=method(module,'createAppData')(freeze({local,indexedDb,appMeta:repositoryMeta,installationIdentity,dailyRecordCodec,activeSessionCodec,personalDataCodec,pendingReviewCodec,keyedRecord:KeyedRecord,journals,notesRepositoryModule:notesModule,saveLaneModule,clock:decisionClock,limits,dataContract,stores:freeze({dailyRecords:'daily',dailySummaries:'summary',notes:'area',activeSessions:'session',appMeta:'meta'}),keys:freeze({recovery:'recovery',fallbackDailyRecords:'fallback',noteRescue:'noteRescue',deletionRecovery:'deletionRecovery'}),metaKeys,activeSessionId:'active',helpers,hooks}));
  return {app,appMetaGateway:gateway,repositoryMeta,journalMeta,indexedDb,localWrites,idbWrites,idbReads,idbDurability,validationCalls,sharedLocal,stores,dataContract};
}
