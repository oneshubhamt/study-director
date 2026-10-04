import fs from 'node:fs';
import vm from 'node:vm';
import {APP_META_RUNTIME_REGISTRY} from '../../contracts/data-architecture.mjs';
import {PRODUCTION_LIMITS} from '../../contracts/production-limits.mjs';
const freeze=Object.freeze;
const appMetaSource=fs.readFileSync('source/core/app-meta.js','utf8');
const repositoryJournals=fs.readFileSync('source/core/repository-journals.js','utf8');
const areaNotesRepository=fs.readFileSync('source/core/repositories-area-notes.js','utf8');
const repositories=fs.readFileSync('source/core/repositories.js','utf8');
const persistence=fs.readFileSync('source/core/persistence.js','utf8');
export function createHarness(sharedLocal=new Map(),sharedStores=null,controls={}){
  const ClockDate=controls.clock?.Date||Date;
  const timerSet=controls.clock?.setTimeout||setTimeout;
  const timerClear=controls.clock?.clearTimeout||clearTimeout;
  const localWrites={pending:0,all:0,sessionBytes:0},idbWrites={recovery:0},idbReads={metaGetAll:0,boundedMetaGetAll:0,unboundedMetaGetAll:0},idbDurability={strict:0,normal:0,strictStores:[],normalStores:[]},validationCalls={within:0,clamp:0};
  const stores=sharedStores||{area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()};
  const localStorage={
    getItem(key){if(controls.failLocalGetKeys?.has?.(key))throw new Error('QA_FIXTURE local recovery read failure');return sharedLocal.has(key)?JSON.stringify(sharedLocal.get(key)):null;},
    setItem(key,text){if(controls.failLocal||controls.failLocalSetKeys?.has?.(key))throw new Error('QA_FIXTURE local recovery write failure');if(key==='recovery')localWrites.sessionBytes+=Buffer.byteLength(text);localWrites.all++;if(key==='pending')localWrites.pending++;sharedLocal.set(key,JSON.parse(text));},
    removeItem(key){if(controls.failLocalRemove||controls.failLocalRemoveKeys?.has?.(key))throw new Error('QA_FIXTURE local recovery removal failure');sharedLocal.delete(key);}
  };
  const storeMap=name=>name==='area'?stores.area:name==='sync'?stores.sync:name==='tombstones'?stores.tombstones:name==='reflection'?stores.reflection:name==='daily'?stores.daily:name==='summary'?stores.summary:name==='session'?stores.session:stores.meta;
  const runTransaction=(names,mode,operation,durability='normal')=>new Promise((resolve,reject)=>{
    idbDurability[durability]++;
    idbDurability[`${durability}Stores`].push(Array.isArray(names)?[...names]:[names]);
    if(controls.failSessionWrite&&((Array.isArray(names)&&names.includes('session'))||names==='session')){reject(new Error('Injected session write failure'));return;}
    if(mode==='readwrite'&&((Array.isArray(names)&&names.includes('area'))||names==='area')&&controls.failNextAreaWrite){controls.failNextAreaWrite=false;reject(new Error('QA_FIXTURE injected area-note write failure'));return;}
    if(mode==='readwrite'&&((Array.isArray(names)&&names.includes('daily'))||names==='daily')&&controls.failNextDailyWrite){controls.failNextDailyWrite=false;reject(new Error('QA_FIXTURE injected daily-record write failure'));return;}
    if(mode==='readwrite'&&names==='meta'&&controls.failNextMetaOnlyWrite){controls.failNextMetaOnlyWrite=false;reject(new Error('QA_FIXTURE injected appMeta-only write failure'));return;}
    if(mode==='readwrite'&&((Array.isArray(names)&&names.includes('meta'))||names==='meta')&&controls.failNextMetaWrite){controls.failNextMetaWrite=false;reject(new Error('QA_FIXTURE injected appMeta write failure'));return;}
    let settled=false;
    const finish=(ok,value)=>{if(settled)return;settled=true;ok?resolve(value):reject(value instanceof Error?value:new Error(String(value||'transaction failed')))};
    const tx={oncomplete:null,onabort:null,onerror:null,objectStore(name){
      const map=storeMap(name);
      return {
        get(key){const req={result:undefined,error:null,onsuccess:null,onerror:null};queueMicrotask(()=>{req.result=map.get(key);req.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});return req;},
        put(value,key){if(name==='meta'&&value.key==='dataMaintenance'&&value.value?.status==='completed'&&controls.failNextMaintenanceCompletion){controls.failNextMaintenanceCompletion=false;const req={error:new Error('QA_FIXTURE maintenance completion write failure'),onerror:null};queueMicrotask(()=>req.onerror?.());return req;}const resolved=key===undefined?(name==='session'?value.id:(value.key??value.date??value.id)):key;if(name==='meta'&&value?.value?.format==='study-director.area-note-recovery')idbWrites.recovery++;map.set(resolved,structuredClone(value));return {};},
        getAll(range=null){if(name==='meta'){idbReads.metaGetAll++;range?idbReads.boundedMetaGetAll++:idbReads.unboundedMetaGetAll++;}const req={result:undefined,error:null,onsuccess:null,onerror:null};queueMicrotask(()=>{req.result=[...map.entries()].filter(([key])=>!range||(String(key)>=range.lower&&String(key)<=range.upper)).map(([,value])=>structuredClone(value));req.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});return req;},
        getAllKeys:controls.dailyKeyEnumeration===true&&name==='daily'?function(){const req={result:undefined,error:null,onsuccess:null,onerror:null};queueMicrotask(()=>{req.result=[...map.keys()];req.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});return req;}:undefined,
        openCursor(){const entries=[...map.entries()];let index=0;const req={result:undefined,error:null,onsuccess:null,onerror:null};const pump=()=>{if(index>=entries.length){req.result=null;req.onsuccess?.({target:req});return;}const [key,value]=entries[index];req.result={key,value:structuredClone(value),update(next){map.set(key,structuredClone(next));return {};},continue(){index++;pump();}};req.onsuccess?.({target:req});};queueMicrotask(pump);return req;},
        delete:key=>{if(key&&typeof key==='object'&&'lower' in key&&'upper' in key){for(const candidate of [...map.keys()])if(String(candidate)>=String(key.lower)&&String(candidate)<=String(key.upper))map.delete(candidate);}else map.delete(key);const req={error:null,onsuccess:null,onerror:null};queueMicrotask(()=>{req.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());});return req;},clear:()=>{map.clear();return {};}
      };
    }};
    try{operation(tx,(ok=true,value=true)=>finish(ok,value));queueMicrotask(()=>{if(!settled&&typeof tx.oncomplete==='function')tx.oncomplete();});}catch(error){finish(false,error)}
  });
  const transaction=(names,mode,operation)=>runTransaction(names,mode,operation,'normal');
  const strictTransaction=(names,mode,operation)=>runTransaction(names,mode,operation,'strict');
  const storeTransaction=(name,mode,operation)=>transaction(name,mode,(tx,finish)=>operation(tx.objectStore(name),tx,finish));
  const strictStoreTransaction=(name,mode,operation)=>strictTransaction(name,mode,(tx,finish)=>operation(tx.objectStore(name),tx,finish));
  const indexedDb=freeze({
    transaction,strictTransaction,storeTransaction,strictStoreTransaction,isAvailable:()=>true,
    get:async(name,key)=>{await controls.onStorageRead?.({store:name,kind:'get',key});const value=structuredClone(storeMap(name).get(key)||null);if(name==='session')await controls.onSessionRead?.();return value;},
    getAll:async name=>{await controls.onStorageRead?.({store:name,kind:'list'});if(name==='area')await controls.onAreaRead?.();return [...storeMap(name).values()].map(value=>structuredClone(value));},
    getAllIfPresent:async name=>controls.retiredLegacyStores&&['sync','tombstones','reflection'].includes(name)?[]:[...storeMap(name).values()].map(value=>structuredClone(value)),
    hasStore:async name=>!(controls.retiredLegacyStores&&['sync','tombstones','reflection'].includes(name)),
    topology:async()=>freeze({version:controls.retiredLegacyStores?7:6,stores:freeze(controls.retiredLegacyStores?['daily','summary','area','session','meta']:['daily','summary','area','session','meta','sync','tombstones','reflection']),legacyStores:freeze(controls.retiredLegacyStores?[]:['sync','tombstones','reflection']),current:!!controls.retiredLegacyStores}),
    retireLegacyStores:async()=>{controls.retiredLegacyStores=true;stores.sync.clear();stores.tombstones.clear();stores.reflection.clear();return freeze({status:'retired',version:7,removed:3});}
  });
  const normalizeTs=(value,fallback='')=>{const parsed=Date.parse(String(value||''));return Number.isFinite(parsed)?new Date(parsed).toISOString():fallback};
  const installationIdentity=freeze({format:'study-director.installation-identity',contractVersion:3,getId:()=> 'inst_test'});
  const KeyedRecord=freeze({create:()=>Object.create(null),clone:value=>Object.assign(Object.create(null),structuredClone(value||{}))});
  const dailyRecordCodec=controls.dailyRecordCodec||freeze({
    buildDailyRecordSummary:v=>v,
    sanitizeCurrentDailyRecord:v=>v&&typeof v==='object'&&Number(v.version)===1?v:null,
    sanitizeCurrentAreaNote:(source,key)=>source&&typeof source==='object'&&Number(source.version)===2?{version:2,key:String(source.key??key??''),label:String(source.label??source.key??key??''),text:String(source.text??''),updatedAt:String(source.updatedAt??'')}:null,
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
  const compatibilityCodec=freeze({
    format:'study-director.compatibility-codecs',contractVersion:1,
    dailyRecord:v=>v&&typeof v==='object'?{...structuredClone(v),version:1}:null,
    areaNote:(source,key)=>source&&typeof source==='object'?{version:2,key:String(source.key??key??''),label:String(source.label??source.key??key??''),text:String(source.text??''),updatedAt:String(source.updatedAt??'')}:null,
    activeSession:v=>v?{id:'active',type:'activeSession',version:1,revision:Number(v.revision)||1,date:String(v.date||''),status:v.status==='suspended'?'suspended':'active',scheduleText:String(v.scheduleText||''),snapshot:structuredClone(v.snapshot),suspendedAt:v.suspendedAt??null,updatedAt:String(v.updatedAt||'2026-09-17T10:00:00.000Z')}:null,
    localRecoveryEnvelope:v=>v&&v.shell?{version:1,revision:Number(v.revision||v.shell.revision)||1,shell:{id:'active',type:'activeSession',version:1,revision:Number(v.revision||v.shell.revision)||1,date:String(v.shell.date||''),status:v.shell.status==='suspended'?'suspended':'active',scheduleText:String(v.shell.scheduleText||''),suspendedAt:v.shell.suspendedAt??null,updatedAt:String(v.updatedAt||v.shell.updatedAt||'2026-09-17T10:00:00.000Z')},snapshot:structuredClone(v.snapshot),updatedAt:String(v.updatedAt||v.shell.updatedAt||'2026-09-17T10:00:00.000Z')}:null,
    protectedPreferences:v=>v&&typeof v==='object'&&Number(v.version)===1?structuredClone(v):null,
    personalData:v=>v&&typeof v==='object'?{...structuredClone(v),version:2}:null
  });
  const helpers=freeze({
    boundedInt:(v,{fallback=0}={})=>Number.isFinite(+v)?Math.floor(+v):fallback,boundedNumber:(v,{fallback=0}={})=>Number.isFinite(+v)?+v:fallback,
    clampText:(v,max=1e6)=>String(v??'').slice(0,max),clampEditorContent:(v,max=1e6)=>{validationCalls.clamp++;return String(v??'').slice(0,max)},editorContentWithinLimits:()=>{validationCalls.within++;return true},
    wipeObject:o=>{for(const k of Object.keys(o))delete o[k];return o;},isValidIsoDate:v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v)),isCanonicalScheduleText:()=>true,sameDataValue:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
    activeSessionScheduleFingerprint:()=> 'fp',normalizeAreaName:v=>String(v??'').trim().toLowerCase(),displayAreaName:v=>String(v??'').trim(),isoDateDay:()=>0,normalizeTimestamp:normalizeTs,jsonByteLength:value=>Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value))
  });
  const hooks=freeze({canMutate:()=>controls.owned!==false,getOwnershipRevision:()=>Number(controls.ownershipRevision)||1,issueWriteToken:()=>{if(controls.owned===false)throw Object.assign(new Error('Ownership lost'),{code:'OWNERSHIP'});return freeze({revision:1});},assertWriteToken:()=>{if(controls.owned===false)throw Object.assign(new Error('Ownership lost'),{code:'OWNERSHIP'});return true;},isOwnershipLostError:e=>e.code==='OWNERSHIP',capture:(...args)=>controls.onDiagnostic?.(...args),onStorageOk:()=>{},onStorageError:(...args)=>controls.onStorageError?.(...args),onNotesChanged:()=>{},onNoteSyncState:()=>{},onNoteConflict:()=>{},onDailyRecordsChanged:()=>{},onDatasetRevisionChanged:()=>{},onCanonicalCommit:event=>controls.onCanonicalCommit?.(event)});
  const limits=freeze({backupImportBatchSize:PRODUCTION_LIMITS.backupImportBatchSize,maxImportAreaNotes:1000,maxAreaNameChars:160,maxNoteChars:1000000,maxOngoingNotes:1000,fallbackDailyRecordsBytes:4*1024*1024,deletionRecoveryBytes:64*1024,maxImportRecords:1000,maxScheduleChars:2*1024*1024,backupMaxFileBytes:512*1024*1024,backupMaxCompressedBytes:512*1024*1024,maxBackupFilenameChars:240});
  const dataContract=freeze({schemas:freeze({LocalRecoveryEnvelope:freeze({version:1}),ActiveSession:freeze({version:1}),DailyRecord:freeze({version:1}),DailySummary:freeze({version:1}),AreaNote:freeze({version:2})})});
  const IDBKeyRange=freeze({bound:(lower,upper)=>freeze({lower:String(lower),upper:String(upper)})});
  const context=vm.createContext({console,structuredClone,Buffer,setTimeout:timerSet,clearTimeout:timerClear,queueMicrotask,Date:ClockDate,Promise,Map,Set,Object,Array,String,Number,Math,JSON,RegExp,Error,RangeError,IDBKeyRange,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,localStorage,crypto:globalThis.crypto,globalThis:null});context.globalThis=context;
  vm.runInContext(fs.readFileSync('source/core/internal.js','utf8'),context,{filename:'internal.js'});vm.runInContext(persistence,context,{filename:'persistence.js'});vm.runInContext(appMetaSource,context,{filename:'app-meta.js'});vm.runInContext(repositoryJournals,context,{filename:'repository-journals.js'});vm.runInContext(areaNotesRepository,context,{filename:'repositories-area-notes.js'});vm.runInContext(repositories,context,{filename:'repositories.js'});
  const registry=context[Symbol.for('studyDirector.internalModules.v1')];
  const local=registry.require('persistence',1).createLocalStorage();
  const appMetaModule=registry.require('app-meta',1),journalModule=registry.require('repository-journals',1),areaNotesModule=registry.require('repositories-area-notes',1),module=registry.require('repositories',1);
  const decisionClock=freeze({nowMs:()=>new ClockDate().getTime()});
  const metaKeys=freeze({dailyRecordMigration:'dailyRecordMigration',planDraft:'planDraft.v1',planLibrary:'planLibrary.v1',personalPreferences:'personalPreferences.v1',canonicalMutationEpoch:'canonicalMutationEpoch.v1',backupPreparationUnitPrefix:'backupPreparationUnit.v1:',insightsDatasetRevision:'insightsDatasetRevision',dataMaintenance:'dataMaintenance',areaNoteRecoveryPrefix:'areaNoteRecovery.v1:',savedDayDeletionPrefix:'savedDayDeletion.v1:',areaNoteDeletionPrefix:'areaNoteDeletion.v1:',attachmentDeletionPrefix:'attachmentDeletion.v1:'});
  const obsoleteMetaKeys=freeze(['reflectionDraftMigration.v1','repositoryMaintenancePending.v1']);
  const gateway=appMetaModule.create(freeze({indexedDb:freeze({transaction:indexedDb.transaction,strictTransaction:indexedDb.strictTransaction,get:indexedDb.get,getAll:indexedDb.getAll}),store:'meta',registry:APP_META_RUNTIME_REGISTRY}));
  gateway.registerValidators('repositories',module.createAppMetaValidators(freeze({limits,dataContract,dailyRecordCodec,personalDataCodec,helpers:freeze({isValidIsoDate:helpers.isValidIsoDate,normalizeAreaName:helpers.normalizeAreaName,normalizeTimestamp:helpers.normalizeTimestamp,sameDataValue:helpers.sameDataValue})})));
  gateway.registerValidators('journals',journalModule.createAppMetaValidators(freeze({limits})));
  const repositoryMeta=gateway.bind('repositories'),compatibilityMeta=gateway.bind('compatibility'),journalMeta=gateway.bind('repository-journals');
  const journals=journalModule.create(freeze({appMeta:journalMeta,limits,helpers:freeze({clampText:helpers.clampText}),clock:decisionClock}));
  const app=module.createAppData(freeze({local,indexedDb,appMeta:repositoryMeta,compatibilityAppMeta:compatibilityMeta,installationIdentity,dailyRecordCodec,activeSessionCodec,compatibilityCodec,personalDataCodec,keyedRecord:KeyedRecord,journals,areaNotesRepositoryModule:areaNotesModule,clock:decisionClock,limits,dataContract,stores:freeze({dailyRecords:'daily',dailySummaries:'summary',areaNotes:'area',activeSessions:'session',appMeta:'meta'}),legacyStores:freeze({syncQueue:'sync',tombstones:'tombstones'}),keys:freeze({recovery:'recovery',fallbackDailyRecords:'fallback',areaNoteRescue:'areaNoteRescue',deletionRecovery:'deletionRecovery',legacySyncEmergency:'syncEmergency'}),legacyKeys:freeze({areaNotesPending:'pending'}),metaKeys,obsoleteMetaKeys,activeSessionId:'active',helpers,hooks}));
  return {app,appMetaGateway:gateway,repositoryMeta,compatibilityMeta,journalMeta,indexedDb,localWrites,idbWrites,idbReads,idbDurability,validationCalls,sharedLocal,stores};
}
