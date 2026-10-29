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
  const localWrites={pending:0,all:0,sessionBytes:0},idbWrites={recovery:0},idbReads={metaGetAll:0,boundedMetaGetAll:0,unboundedMetaGetAll:0},idbDurability={strict:0,normal:0,strictStores:[],normalStores:[]},validationCalls={within:0,clamp:0};
  const stores=sharedStores||{area:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()};
  const localStorage={
    getItem(key){if(controls.failLocalGetKeys?.has?.(key))throw new Error('QA_FIXTURE local recovery read failure');return sharedLocal.has(key)?JSON.stringify(sharedLocal.get(key)):null;},
    setItem(key,text){if(controls.failLocal||controls.failLocalSetKeys?.has?.(key))throw new Error('QA_FIXTURE local recovery write failure');if(key==='recovery')localWrites.sessionBytes+=Buffer.byteLength(text);localWrites.all++;if(key==='pending')localWrites.pending++;sharedLocal.set(key,JSON.parse(text));},
    removeItem(key){if(controls.failLocalRemove||controls.failLocalRemoveKeys?.has?.(key))throw new Error('QA_FIXTURE local recovery removal failure');sharedLocal.delete(key);}
  };
  const storeMap=name=>{const map=({area:stores.area,daily:stores.daily,summary:stores.summary,session:stores.session,meta:stores.meta})[name];if(!map)throw new Error('Unknown test store: '+name);return map;};
  const runTransaction=(names,mode,operation,durability='normal')=>new Promise((resolve,reject)=>{
    idbDurability[durability]++;
    idbDurability[`${durability}Stores`].push(Array.isArray(names)?[...names]:[names]);
    if(controls.failSessionWrite&&((Array.isArray(names)&&names.includes('session'))||names==='session')){reject(new Error('Injected session write failure'));return;}
    if(mode==='readwrite'&&((Array.isArray(names)&&names.includes('area'))||names==='area')&&controls.failNextAreaWrite){controls.failNextAreaWrite=false;reject(new Error('QA_FIXTURE injected note write failure'));return;}
    if(mode==='readwrite'&&((Array.isArray(names)&&names.includes('daily'))||names==='daily')&&controls.failNextDailyWrite){controls.failNextDailyWrite=false;reject(new Error('QA_FIXTURE injected daily-record write failure'));return;}
    if(mode==='readwrite'&&names==='meta'&&controls.failNextMetaOnlyWrite){controls.failNextMetaOnlyWrite=false;reject(new Error('QA_FIXTURE injected appMeta-only write failure'));return;}
    if(mode==='readwrite'&&((Array.isArray(names)&&names.includes('meta'))||names==='meta')&&controls.failNextMetaWrite){controls.failNextMetaWrite=false;reject(new Error('QA_FIXTURE injected appMeta write failure'));return;}
    let settled=false,outstanding=0,completed=false;
    const finish=(ok,value)=>{if(settled)return;settled=true;ok?resolve(value):reject(value instanceof Error?value:new Error(String(value||'transaction failed')))};
    // Like IndexedDB, the transaction completes once no request is outstanding,
    // so requests issued from a callback still belong to it.
    const complete=()=>queueMicrotask(()=>{if(!completed&&outstanding===0){completed=true;tx.oncomplete?.();}});
    const request=run=>{const req={result:undefined,error:null,onsuccess:null,onerror:null};outstanding++;queueMicrotask(()=>{try{run(req);}finally{outstanding--;complete();}});return req;};
    const tx={oncomplete:null,onabort:null,onerror:null,objectStore(name){
      const map=storeMap(name);
      const inRange=(key,range)=>!range||(String(key)>=range.lower&&String(key)<=range.upper);
      return {
        get(key){return request(req=>{req.result=map.get(key);req.onsuccess?.();});},
        add(value,key){const resolved=key===undefined?(value.key??value.date??value.id):key;return request(req=>{if(map.has(resolved)){req.error=new Error('QA_FIXTURE ConstraintError: key already exists');req.onerror?.();return;}map.set(resolved,structuredClone(value));req.onsuccess?.();});},
        count(){return request(req=>{req.result=map.size;req.onsuccess?.();});},
        put(value,key){if(name==='meta'&&value.key==='dataMaintenance'&&value.value?.status==='completed'&&controls.failNextMaintenanceCompletion){controls.failNextMaintenanceCompletion=false;const req={error:new Error('QA_FIXTURE maintenance completion write failure'),onerror:null};queueMicrotask(()=>req.onerror?.());return req;}const resolved=key===undefined?(name==='session'?value.id:(value.key??value.date??value.id)):key;if(name==='meta'&&value?.value?.format==='study-director.area-note-recovery')idbWrites.recovery++;map.set(resolved,structuredClone(value));return {};},
        getAll(range=null){if(name==='meta'){idbReads.metaGetAll++;range?idbReads.boundedMetaGetAll++:idbReads.unboundedMetaGetAll++;}return request(req=>{req.result=[...map.entries()].filter(([key])=>inRange(key,range)).map(([,value])=>structuredClone(value));req.onsuccess?.();});},
        getAllKeys:name==='daily'&&controls.dailyKeyEnumeration!==true?undefined:function(range=null,count=Infinity){return request(req=>{req.result=[...map.keys()].filter(key=>inRange(key,range)).sort().slice(0,count);req.onsuccess?.();});},
        openCursor(){const entries=[...map.entries()];let index=0;const req={result:undefined,error:null,onsuccess:null,onerror:null};const pump=()=>{if(index>=entries.length){req.result=null;req.onsuccess?.({target:req});return;}const [key,value]=entries[index];req.result={key,value:structuredClone(value),update(next){map.set(key,structuredClone(next));return {};},delete(){map.delete(key);return {};},continue(){index++;pump();}};req.onsuccess?.({target:req});};queueMicrotask(pump);return req;},
        delete:key=>{if(key&&typeof key==='object'&&'lower' in key&&'upper' in key){for(const candidate of [...map.keys()])if(String(candidate)>=String(key.lower)&&String(candidate)<=String(key.upper))map.delete(candidate);}else map.delete(key);return request(req=>{req.onsuccess?.();});},clear:()=>{map.clear();return {};}
      };
    }};
    try{operation(tx,(ok=true,value=true)=>finish(ok,value));complete();}catch(error){finish(false,error)}
  });
  const transaction=(names,mode,operation)=>runTransaction(names,mode,operation,'normal');
  const strictTransaction=(names,mode,operation)=>runTransaction(names,mode,operation,'strict');
  const storeTransaction=(name,mode,operation)=>transaction(name,mode,(tx,finish)=>operation(tx.objectStore(name),tx,finish));
  const strictStoreTransaction=(name,mode,operation)=>strictTransaction(name,mode,(tx,finish)=>operation(tx.objectStore(name),tx,finish));
  const indexedDb=freeze({
    transaction,strictTransaction,storeTransaction,strictStoreTransaction,isAvailable:()=>true,lifecycle:()=>freeze({startedFresh:false,resets:Number(controls.storageResets)||0,lastResetAt:''}),
    get:async(name,key)=>{await controls.onStorageRead?.({store:name,kind:'get',key});const value=structuredClone(storeMap(name).get(key)||null);if(name==='session')await controls.onSessionRead?.();return value;},
    getAll:async name=>{await controls.onStorageRead?.({store:name,kind:'list'});if(name==='area')await controls.onAreaRead?.();return [...storeMap(name).values()].map(value=>structuredClone(value));},
    getAllIfPresent:async name=>[...storeMap(name).values()].map(value=>structuredClone(value)),
    hasStore:async name=>Object.hasOwn(stores,name),
    topology:async()=>freeze({version:9,stores:freeze(Object.keys(stores)),current:true,newer:false,usable:true})
  });
  const normalizeTs=(value,fallback='')=>{const parsed=Date.parse(String(value||''));return Number.isFinite(parsed)?new Date(parsed).toISOString():fallback};
  const installationIdentity=freeze({format:'study-director.installation-identity',contractVersion:4,getId:()=> 'inst_test'});
  const KeyedRecord=freeze({create:()=>Object.create(null),clone:value=>Object.assign(Object.create(null),structuredClone(value||{}))});
  const dailyRecordCodec=controls.dailyRecordCodec||freeze({
    buildDailyRecordSummary:v=>v,
    sanitizeCurrentDailyRecord:v=>v&&typeof v==='object'&&Number(v.version)===1?v:null,
    sanitizeCurrentNote:(source,key)=>{if(!source||typeof source!=='object'||Number(source.version)!==3)return null;const clean={version:3,key:String(source.key||key||''),label:String(source.label??''),text:String(source.text??''),updatedAt:String(source.updatedAt??'')},linked='links' in source,links=linked?source.links:null;if(linked&&(!Array.isArray(links)||!links.length||new Set(links).size!==links.length||links.some(id=>!noteKeys.isId(id)||id===noteKeys.id(clean.key))))return null;if(linked)clean.links=[...links];return noteKeys.isKey(clean.key)&&clean.label.trim()&&Object.keys(source).length===(linked?6:5)?clean:null;},
    noteKeys:noteKeys,
    materializeDailyRecordView:v=>v,
    sanitizeDailyRecordSummary:v=>v,
    materializeDailyRecordSummary:v=>v
  });
  const personalDataCodec=freeze({
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
  const hooks=freeze({canMutate:()=>controls.owned!==false,getOwnershipRevision:()=>Number(controls.ownershipRevision)||1,issueWriteToken:()=>{if(controls.owned===false)throw Object.assign(new Error('Ownership lost'),{code:'OWNERSHIP'});return freeze({revision:1});},assertWriteToken:()=>{if(controls.owned===false)throw Object.assign(new Error('Ownership lost'),{code:'OWNERSHIP'});return true;},isOwnershipLostError:e=>e.code==='OWNERSHIP',capture:(...args)=>controls.onDiagnostic?.(...args),onStorageOk:()=>{},onStorageError:(...args)=>controls.onStorageError?.(...args),onNotesChanged:()=>{},onNoteSyncState:()=>{},onNoteConflict:info=>controls.onNoteConflict?.(info),onDailyRecordsChanged:()=>{},onDatasetRevisionChanged:()=>{},onCanonicalCommit:event=>controls.onCanonicalCommit?.(event)});
  const limits=freeze({backupImportBatchSize:PRODUCTION_LIMITS.backupImportBatchSize,maxAreaNameChars:160,maxNoteChars:1000000,localRescueBytes:PRODUCTION_LIMITS.localRescueBytes,noteRescueBytes:PRODUCTION_LIMITS.noteRescueBytes,noteTrashDays:PRODUCTION_LIMITS.noteTrashDays,maxNotes:1000,fallbackDailyRecordsBytes:4*1024*1024,deletionRecoveryBytes:64*1024,maxImportRecords:1000,maxScheduleChars:2*1024*1024,backupMaxFileBytes:512*1024*1024,backupMaxCompressedBytes:512*1024*1024,maxBackupFilenameChars:240,maxPendingReviews:PRODUCTION_LIMITS.maxPendingReviews});
  const dataContract=freeze({schemas:freeze({LocalRecoveryEnvelope:freeze({version:1}),ActiveSession:freeze({version:1}),DailyRecord:freeze({version:1}),DailySummary:freeze({version:1}),Note:freeze({version:3,trashKeyPrefix:'~deleted '})})});
  const IDBKeyRange=freeze({bound:(lower,upper)=>freeze({lower:String(lower),upper:String(upper)})});
  const context=vm.createContext({console,structuredClone,Buffer,setTimeout:timerSet,clearTimeout:timerClear,queueMicrotask,Date:ClockDate,Promise,Map,Set,Object,Array,String,Number,Math,JSON,RegExp,Error,RangeError,IDBKeyRange,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,localStorage,crypto:globalThis.crypto,globalThis:null});context.globalThis=context;
  vm.runInContext(fs.readFileSync('source/core/internal.js','utf8'),context,{filename:'internal.js'});vm.runInContext(persistence,context,{filename:'source/core/persistence.ts'});vm.runInContext(appMetaSource,context,{filename:'source/core/app-meta.ts'});vm.runInContext(repositoryJournals,context,{filename:'source/core/repository-journals.ts'});vm.runInContext(readScript('source/core/save-lane.ts'),context,{filename:'source/core/save-lane.ts'});vm.runInContext(notesRepository,context,{filename:'source/core/repositories-notes.ts'});vm.runInContext(repositories,context,{filename:'source/core/repositories.ts'});vm.runInContext(recordCodecs,context,{filename:'source/core/record-codecs.ts'});
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
  return {app,appMetaGateway:gateway,repositoryMeta,journalMeta,indexedDb,localWrites,idbWrites,idbReads,idbDurability,validationCalls,sharedLocal,stores};
}
