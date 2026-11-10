import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {DataBootstrapHostModule as DataBootstrapHostContract,ConfigurationInput,BootstrapConfiguration,LocalStorageKeys,SessionStorageKeys,AppMetaKeys,ExternalRepositoryIdentities,RuntimeDataContract,EntityDefinition,EntityType,InstallationInput,NamingInput,IndexedDbInput,MetadataInput,MetadataOwners,RepositoryCompositionInput,RepositoryComposition,UnsupportedDataInput,UnsupportedDataController,UnsupportedDataState} from '../../types/data-bootstrap-host.ts';
import type {Limits} from '../../types/record-models.ts';
import type {MetaDefinition} from '../../types/app-meta.ts';
import type {StoreNames} from '../../types/persistence.ts';

const sdDataBootstrapHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'data-bootstrap-host','study-director.data-bootstrap-host-module'>|undefined;
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable.');
const freeze=Object.freeze;
const objectRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const stringValue=(value:unknown,label:string)=>{if(typeof value!=='string'||!value)throw new TypeError(`${label} must be a non-empty string.`);return value;};
function exactStringRecord(value:unknown,keys:readonly string[],label:string){
  if(!objectRecord(value))throw new TypeError(`${label} must be an object.`);
  const actual=Object.keys(value).sort(),expected=[...keys].sort();
  if(actual.length!==expected.length||actual.some((key,index)=>key!==expected[index]))throw new TypeError(`${label} is incomplete or contains unexpected fields.`);
  return freeze(Object.fromEntries(keys.map(key=>[key,stringValue(value[key],`${label}.${key}`)])));
}
const LOCAL_KEYS=freeze(['recovery','appOwner','mutationLock','storageHealth','installationId','deletionRecovery','fallbackDailyRecords','noteRescue','fontScale','keepScreenAwake','installNoticeShown','systemAlerts','theme','presentation','pwaUpdateCheck','insightsWindow','libraryView','driveSession','profiles'] satisfies readonly (keyof LocalStorageKeys)[]);
const SESSION_KEYS=freeze(['appTab','pwaReload','notifications'] satisfies readonly (keyof SessionStorageKeys)[]);
const META_KEYS=freeze(['planDraft','planLibrary','personalPreferences','canonicalMutationEpoch','backupPreparationUnitPrefix','insightsDatasetRevision','dataMaintenance','savedDayDeletionPrefix','noteDeletionPrefix','attachmentDeletionPrefix','pendingReviewPrefix','libraryClearJournalState','libraryClearJournalPayloadPrefix','restoreJournalState','restoreJournalPayload','mutationLease','verifiedRecoveryBackups','backupProtection','attachmentIntegrityAudit','deviceFolder','repositoryIntegrityScrub','managedProviderBackupPending','repositoryMaintenancePending','reconciliationBase','reconciliationBaseNotePrefix','reconciliationBaseDayPrefix'] satisfies readonly (keyof AppMetaKeys)[]);
const EXTERNAL_KEYS=freeze(['deviceFolderPickerId','backupFolderPrefix','deviceFolderObjects','deviceFolderCheckpoints','deviceFolderCommits','driveFolder','driveFolderMarker','driveFolderProfileMarker','driveDeletedProfileMarker','driveFileSecurityMarker','driveFileDigestMarker','driveRepositoryMarker','driveRepositoryVersionMarker','driveRepositoryKindMarker','driveRepositoryIdMarker','driveAppVersionMarker','driveExportedAtMarker'] satisfies readonly (keyof ExternalRepositoryIdentities)[]);
const STORE_KEYS=freeze(['dailyRecords','dailySummaries','notes','activeSessions','appMeta','assets'] satisfies readonly (keyof StoreNames)[]);

function createConfiguration(input:Readonly<ConfigurationInput>):Readonly<BootstrapConfiguration>{
  if(!input||!Object.isFrozen(input)||!Object.isFrozen(input.raw))throw new TypeError('Data bootstrap configuration input must be frozen.');
  const profileScope=input.profileScope;
  if(!profileScope||typeof profileScope.scoped!=='function'||typeof profileScope.registryKey!=='string'||typeof profileScope.separator!=='string'||!(profileScope.pattern instanceof RegExp))throw new TypeError('Profile scope is unavailable or incompatible.');
  const limitsRaw=input.raw.productionLimits;
  if(!objectRecord(limitsRaw))throw new TypeError('Production limits are unavailable.');
  const APP_LIMITS=freeze({...limitsRaw}) as unknown as Limits;
  const requiredLimits=['richAssetMaxBytes','richAssetMaxPerDocument','richAssetMaxBytesPerDocument','richAssetMaxDimensionPx','richAssetMaxPixels','attachmentPdfAudioMaxBytes','maxImportRecords','maxNotes'] as const;
  for(const key of requiredLimits)if(!Number.isFinite(Number((APP_LIMITS as unknown as Record<string,unknown>)[key]))||Number((APP_LIMITS as unknown as Record<string,unknown>)[key])<=0)throw new TypeError(`Production limit ${key} is invalid.`);
  const asset=input.richText.assetPolicy;
  if(APP_LIMITS.richAssetMaxBytes!==asset.maxBytes||APP_LIMITS.richAssetMaxPerDocument!==asset.maxPerDocument||APP_LIMITS.richAssetMaxBytesPerDocument!==asset.maxBytesPerDocument||APP_LIMITS.richAssetMaxDimensionPx!==asset.maxDimensionPx||APP_LIMITS.richAssetMaxPixels!==asset.maxPixels)throw new Error('Rich-text asset limits differ from the production-limit manifest.');
  if(input.attachments.limits?.maxImage!==APP_LIMITS.richAssetMaxBytes||input.attachments.limits?.maxPdfAudio!==APP_LIMITS.attachmentPdfAudioMaxBytes)throw new Error('Attachment limits differ from the production-limit manifest.');

  const rawLocal=exactStringRecord(input.raw.localStorageKeys,LOCAL_KEYS,'Local storage keys') as unknown as LocalStorageKeys;
  if(!Array.isArray(input.raw.deviceWideStorageKeys))throw new TypeError('Device-wide storage keys are invalid.');
  const deviceWide=freeze(input.raw.deviceWideStorageKeys.map(value=>String(value))) as readonly (keyof LocalStorageKeys)[];
  if(deviceWide.some(name=>!LOCAL_KEYS.includes(name)))throw new TypeError('Device-wide storage keys contain an unknown identity.');
  const STORAGE_KEYS=freeze(Object.fromEntries(LOCAL_KEYS.map(name=>[name,deviceWide.includes(name)?rawLocal[name]:profileScope.scoped(rawLocal[name])]))) as unknown as Readonly<LocalStorageKeys>;
  const SESSION_STORAGE_KEYS=exactStringRecord(input.raw.sessionStorageKeys,SESSION_KEYS,'Session storage keys') as unknown as Readonly<SessionStorageKeys>;
  const APP_META_KEYS=exactStringRecord(input.raw.appMetaKeys,META_KEYS,'AppMeta keys') as unknown as Readonly<AppMetaKeys>;
  const EXTERNAL_REPOSITORY_IDENTITIES=exactStringRecord(input.raw.externalRepositoryIdentities,EXTERNAL_KEYS,'External repository identities') as unknown as Readonly<ExternalRepositoryIdentities>;
  const DB_STORES=exactStringRecord(input.raw.indexedDbStoreNames,STORE_KEYS,'IndexedDB store names') as unknown as Readonly<StoreNames>;

  if(!objectRecord(input.raw.appMetaRegistry))throw new TypeError('AppMeta runtime registry is unavailable.');
  const APP_META_REGISTRY=freeze(Object.fromEntries(Object.entries(input.raw.appMetaRegistry).map(([name,value])=>{
    if(!objectRecord(value))throw new TypeError(`AppMeta registry family ${name} is invalid.`);
    const definition=freeze({...value}) as unknown as MetaDefinition;
    if(definition.name!==name||!['exact','prefix'].includes(definition.kind)||!definition.key||!definition.owner||!definition.validatorOwner||!definition.schema||!definition.protection)throw new TypeError(`AppMeta registry family ${name} is incomplete.`);
    return [name,definition];
  })));

  if(!objectRecord(input.raw.runtimeDataContract))throw new TypeError('Runtime data contract is unavailable.');
  const rawContract=input.raw.runtimeDataContract,rawStorage=rawContract['storage'],rawSchemas=rawContract['schemas'];
  if(!objectRecord(rawStorage)||!objectRecord(rawStorage['stores'])||!objectRecord(rawSchemas))throw new TypeError('Runtime data contract storage or schemas are invalid.');
  const stores=freeze(Object.fromEntries(STORE_KEYS.map(id=>{
    const value=rawStorage['stores'] as Record<string,unknown>,row=value[id];
    if(!objectRecord(row))throw new TypeError(`Runtime store ${id} is invalid.`);
    return [id,freeze({key:stringValue(row['key'],`Runtime store ${id}.key`),schema:stringValue(row['schema'],`Runtime store ${id}.schema`)})];
  })));
  const schemas=freeze(Object.fromEntries(Object.entries(rawSchemas).map(([id,value])=>{
    if(!objectRecord(value))throw new TypeError(`Runtime schema ${id} is invalid.`);
    return [id,freeze(id==='LocalRecoveryEnvelope'?{...value,key:STORAGE_KEYS.recovery}:{...value})];
  })));
  const dbName=stringValue(rawStorage['dbName'],'Runtime database name'),dbVersion=Number(rawStorage['dbVersion']);
  if(!Number.isSafeInteger(dbVersion)||dbVersion<1)throw new TypeError('Runtime database version is invalid.');
  const DATA_CONTRACT=freeze({...rawContract,storage:freeze({...rawStorage,dbName,dbVersion,stores}),schemas}) as unknown as Readonly<RuntimeDataContract>;
  const activeSession=DATA_CONTRACT.schemas.ActiveSession;
  if(typeof activeSession.key!=='string'||!activeSession.key)throw new TypeError('Active-session identity is invalid.');

  const APP_CONFIG=freeze({
    appName:'Study Director',
    attribution:'Shubham Tiwari with ChatGPT',
    defaultName:'Student',
    storagePrefix:'studyDirector',
    factorySchedule:`05:30 | 90 | Morning Routine: Wake-up + Exercise + Freshen-up | support | Routine | block | 1
07:00 | 120 | Deep Study Block 1 | work | Core Subject | block | 1
09:00 | 30 | Breakfast + Short Break | fixed | Meal | |
09:30 | 120 | Class / Lecture / Primary Study | work | Main Course | block | 1
11:30 | 60 | Practice Questions / Application Work | work | Practice | questions | 25
12:30 | 60 | Lunch + Rest | fixed | Meal | |
13:30 | 120 | Deep Study Block 2 | work | Secondary Subject | block | 1
15:30 | 60 | Review + Error Notebook | work | Revision | block | 1
16:30 | 45 | Break / Walk / Snack | fixed | Break | |
17:15 | 90 | Test Practice / Writing Practice | work | Assessment | block | 1
18:45 | 45 | Light Revision / Flashcards | work | Revision | block | 1
19:30 | 60 | Dinner + Recovery | fixed | Meal | |
20:30 | 60 | Daily Review + Tomorrow Planning | support | Planning | block | 1
21:30 | 480 | Sleep | fixed | Rest | |`
  });
  const FACTORY_DEFAULTS=freeze({studentName:APP_CONFIG.defaultName,scheduleText:APP_CONFIG.factorySchedule});
  const DB_DAILY_RECORD_STORE=DB_STORES.dailyRecords,DB_DAILY_SUMMARY_STORE=DB_STORES.dailySummaries,DB_NOTES_STORE=DB_STORES.notes,DB_ACTIVE_SESSION_STORE=DB_STORES.activeSessions,DB_APP_META_STORE=DB_STORES.appMeta,DB_ASSET_STORE=DB_STORES.assets;
  const ENTITY_DEFINITIONS:Readonly<Record<EntityType,Readonly<EntityDefinition>>>=freeze({
    dailyRecord:freeze({schema:DATA_CONTRACT.schemas.DailyRecord.version,idField:'date',store:DB_DAILY_RECORD_STORE,backupLimit:APP_LIMITS.maxImportRecords}),
    note:freeze({schema:DATA_CONTRACT.schemas.Note.version,idField:'key',store:DB_NOTES_STORE,backupLimit:APP_LIMITS.maxNotes}),
    activeSession:freeze({schema:DATA_CONTRACT.schemas.ActiveSession.version,idField:'id',fixedId:activeSession.key,store:DB_ACTIVE_SESSION_STORE,backupLimit:1})
  });
  const BACKUP_ENTITY_TYPES=freeze(Object.keys(ENTITY_DEFINITIONS) as EntityType[]);
  const entityDefinition=(type:unknown)=>typeof type==='string'&&Object.hasOwn(ENTITY_DEFINITIONS,type)?ENTITY_DEFINITIONS[type as EntityType]:null;
  const entityIdentity=(type:unknown,value:unknown)=>{
    const definition=entityDefinition(type);if(!definition)return '';
    const row=objectRecord(value)?value:null;
    return String(definition.fixedId||(row?row[definition.idField]:undefined)||'').trim();
  };
  return freeze({
    APP_VERSION:String(input.release||''),APP_CONFIG,APP_LIMITS,ProfileScope:profileScope,
    DEVICE_WIDE_STORAGE_KEYS:deviceWide,STORAGE_KEYS,SESSION_STORAGE_KEYS,APP_META_KEYS,EXTERNAL_REPOSITORY_IDENTITIES,APP_META_REGISTRY,
    DATA_CONTRACT,DB_STORES,DB_NAME:profileScope.scoped(dbName),DB_VER:dbVersion,
    DB_DAILY_RECORD_STORE,DB_DAILY_SUMMARY_STORE,DB_NOTES_STORE,DB_ACTIVE_SESSION_STORE,DB_APP_META_STORE,DB_ASSET_STORE,
    ACTIVE_SESSION_ID:activeSession.key,ENTITY_DEFINITIONS,BACKUP_ENTITY_TYPES,FACTORY_DEFAULTS,entityDefinition,entityIdentity
  });
}

function createInstallationIdentity(input:Readonly<InstallationInput>){
  const identity=input.module.createInstallationIdentity(freeze({local:input.local,keys:freeze({installationId:input.installationKey}),describe:()=>input.module.describeDevice(input.navigator)}));
  if(!Object.isFrozen(identity)||identity.format!=='study-director.installation-identity'||identity.contractVersion!==4)throw new TypeError('Installation identity is unavailable or incompatible.');
  return identity;
}
function createNaming(input:Readonly<NamingInput>){
  const {module,identity,currentProfile,repositories}=input;
  const deviceName=(id:unknown,others:Iterable<unknown>=[])=>String(id||'')===identity.getId()?'This device':module.deviceName(id,[...others,identity.getId()]);
  function backupFolderName({device=false}:Readonly<{device?:boolean}>={}){
    const plain=(value:unknown)=>device?String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/gu,'').replace(/[^\x20-\x7e]+/gu,' '):String(value||'');
    const clean=(value:unknown)=>plain(value).replace(/[\u0000-\u001f\\/:*?"<>|]+/gu,' ').replace(/\s+/gu,' ').trim().replace(/[. ]+$/u,'').slice(0,48).trim();
    const profile=currentProfile(),parts=[clean(profile?.name),device?clean(module.deviceName(identity.getId()).replace(' · ',' '))||'Device':''].filter(Boolean),separator=device?' - ':' – ';
    return parts.length?`${repositories.backupFolderPrefix}${separator}${parts.join(separator)}`:repositories.driveFolder;
  }
  return freeze({deviceName,backupFolderName});
}
function createIndexedDb(input:Readonly<IndexedDbInput>){
  const indexedDb=input.module.createIndexedDb(freeze({config:freeze({...input.config,stores:freeze({...input.config.stores})}),hooks:freeze({...input.hooks})}));
  if(!Object.isFrozen(indexedDb)||indexedDb.format!=='study-director.indexeddb-primitives'||indexedDb.contractVersion!==2)throw new TypeError('IndexedDB primitives are unavailable or incompatible.');
  return indexedDb;
}
function createAppMetaGateway(input:Parameters<DataBootstrapHostContract['createAppMetaGateway']>[0]){
  const gateway=input.module.create({indexedDb:freeze({transaction:input.indexedDb.transaction,strictTransaction:input.indexedDb.strictTransaction,get:input.indexedDb.get,getAll:input.indexedDb.getAll}),store:input.store,registry:input.registry});
  if(!Object.isFrozen(gateway)||gateway.format!=='study-director.app-meta-gateway'||gateway.contractVersion!==1)throw new TypeError('AppMeta gateway is unavailable or incompatible.');
  return gateway;
}
function createMetadataOwners(input:Readonly<MetadataInput>):Readonly<MetadataOwners>{
  const repositoryValidators=input.repositoriesModule.createAppMetaValidators(input.repositoryValidatorInput);
  const journalValidators=input.journalsModule.createAppMetaValidators(freeze({limits:input.journalLimits}));
  const hostValidators=input.hostMetadataModule.createAppMetaValidators(input.hostValidatorInput);
  input.gateway.registerValidators('repositories',repositoryValidators);
  input.gateway.registerValidators('journals',journalValidators);
  input.gateway.registerValidators('host',hostValidators);
  const owners=freeze({
    RepositoryAppMeta:input.gateway.bind('repositories'),JournalAppMeta:input.gateway.bind('repository-journals'),HostAppMeta:input.gateway.bind('host'),
    ExportsAppMeta:input.gateway.bind('exports'),DeviceFolderAppMeta:input.gateway.bind('device-backup'),BackupAppMeta:input.gateway.bind('backup')
  });
  for(const owner of Object.values(owners))if(!Object.isFrozen(owner)||owner.format!=='study-director.app-meta-owner'||owner.contractVersion!==1)throw new TypeError('AppMeta owner capability is unavailable or incompatible.');
  return owners;
}
function createRepositoryComposition(input:Readonly<RepositoryCompositionInput>):Readonly<RepositoryComposition>{
  const RepositoryJournals=input.journalsModule.create(freeze({appMeta:input.journal.appMeta,limits:input.journal.limits,helpers:freeze(input.journal.helpers),clock:freeze(input.journal.clock)}));
  const AppData=input.repositoriesModule.createAppData(freeze({...input.appData,journals:RepositoryJournals}));
  if(!Object.isFrozen(AppData)||AppData.format!=='study-director.app-data'||AppData.contractVersion!==1)throw new Error('Study Director AppData facade is unavailable or incompatible.');
  return freeze({RepositoryJournals,AppData});
}

function createUnsupportedData(input:Readonly<UnsupportedDataInput>):Readonly<UnsupportedDataController>{
  const {dataContract,stores,indexedDb,appMeta,profiles,profileScope,notices}=input;
  const schemaVersion=(schema:unknown)=>{const match=/\.v(\d+)$/u.exec(String(schema||''));return match?Number(match[1]):0;};
  const recordStores=freeze(Object.entries(dataContract.storage.stores).filter(([id])=>id!=='appMeta').map(([id,value])=>freeze([stores[id as keyof StoreNames],schemaVersion(value.schema),id==='dailySummaries'?'summaryVersion':'version'] as const)));
  const envelopeVersion=Number(dataContract.schemas.AppMeta?.version)||1;
  const fields=(value:unknown)=>objectRecord(value)?value:null;
  const recordVerdict=(max:number,field:string)=>(value:unknown)=>{
    const row=fields(value),version=Number(row?.[field]);
    return row&&version===max?'':version>max?'newer':'unreadable';
  };
  function metaVerdict(value:unknown){
    const row=fields(value),key=String(row?.['key']||'');if(!key)return '';
    if(Number(row?.['version'])>envelopeVersion)return 'newer';
    const family=appMeta.resolve(key);if(!family)return 'unknown';
    if(appMeta.readable(value))return '';
    const content=fields(row?.['value']),newer=!!content&&Number(content['version'])>schemaVersion(family.schema);
    return freeze({reason:newer?'newer':'unreadable',replaceable:family.protection==='operational'});
  }
  let blocked:UnsupportedDataState['blocked']=null;
  async function census(){
    const topology=await indexedDb.topology();
    if(topology.newer&&!topology.usable){
      blocked=freeze({version:topology.version,missing:freeze([...topology.missing]),changed:freeze([...topology.changed])});
      throw Object.assign(new Error(`This profile was saved by a newer version of Study Director (database ${topology.version}), which this version cannot open.`),{code:'STUDY_DIRECTOR_PROFILE_NEEDS_UPDATE'});
    }
    for(const [store,max,field] of recordStores)await indexedDb.unsupported.scan(store,recordVerdict(max,field));
    for(const [from,to] of [[stores.dailyRecords,stores.dailySummaries],[stores.dailySummaries,stores.dailyRecords]] as const)for(const key of indexedDb.unsupported.keys(from))indexedDb.unsupported.hold(to,key,'same-day');
    await indexedDb.unsupported.scan(stores.appMeta,metaVerdict);
    return summary();
  }
  function summary():Readonly<UnsupportedDataState>{
    const keys=(store:string)=>indexedDb.unsupported.keys(store),days=new Set([...keys(stores.dailyRecords),...keys(stores.dailySummaries)].map(String));
    const meta=keys(stores.appMeta).filter(key=>{const family=appMeta.resolve(key);return !family||family.protection!=='operational';}).length;
    const items=freeze({days:days.size,notes:keys(stores.notes).length,attachments:keys(stores.assets).length,sessions:keys(stores.activeSessions).length,settings:meta});
    const total=Object.values(items).reduce((sum,count)=>sum+count,0),stored=indexedDb.unsupported.summary();
    return freeze({total,held:stored.total,protected:stored.protected,stores:stored.stores,reasons:stored.reasons,items,blocked});
  }
  const held=()=>indexedDb.unsupported.summary().protected>0;
  function describe(state:UnsupportedDataState=summary()){
    const rows:readonly [keyof UnsupportedDataState['items'],string][]=freeze([['days','Saved Day'],['notes','note'],['attachments','attachment'],['sessions','study session'],['settings','setting']]);
    const parts=rows.filter(([id])=>state.items[id]>0).map(([id,label])=>`${state.items[id]} ${label}${state.items[id]===1?'':'s'}`);
    return parts.length>1?`${parts.slice(0,-1).join(', ')} and ${parts.at(-1)}`:parts[0]||'';
  }
  let noticeShown=false;
  function announce(){
    const state=summary();if(!state.total||noticeShown)return false;noticeShown=true;
    notices.emit(freeze({source:'unsupported-data',id:'held',severity:'warning',lifecycle:'succeeded',foreground:false,tier:'blocking',surface:'toast',dismissible:true,title:'Some data is from a newer version',message:`This device has ${describe(state)} saved by a newer version of Study Director. This version leaves them exactly as they are and works with everything else; Drive sync waits until the app is updated.`,action:freeze({label:'Update app',opens:true,run:()=>void input.checkUnsupportedUpdate()})}));
    return true;
  }
  function reportBlocked(){
    if(!blocked)return false;
    const others=profiles.list().filter(row=>row.scope!==profileScope.scope);
    notices.emit(freeze({source:'unsupported-data',id:'blocked',severity:'warning',lifecycle:'succeeded',foreground:false,tier:'blocking',surface:'toast',dismissible:false,title:'This profile needs a newer version',message:'This profile was saved by a newer version of Study Director, which changed how its data is stored. This version leaves it exactly as it is. Update the app to open it, or use another profile meanwhile.',action:freeze({label:'Check for update',opens:true,run:()=>void Promise.resolve(input.checkForUpdate()).catch(error=>input.capture('unsupported-data.update-check',error))}),secondaryAction:others.length?freeze({label:`Open ${others[0]?.name||'another profile'}`,run:()=>{try{profiles.switchTo(others[0]!.id);}catch(error){input.capture('unsupported-data.switch-profile',error);}}}):freeze({label:'Start a new profile',run:()=>{try{profiles.add();}catch(error){input.capture('unsupported-data.add-profile',error);}}})}));
    return true;
  }
  return freeze({census,summary,held,describe,announce,reportBlocked,blocked:()=>blocked});
}
const createModule=():DataBootstrapHostContract=>freeze({format:'study-director.data-bootstrap-host-module',contractVersion:1,createConfiguration,createInstallationIdentity,createNaming,createIndexedDb,createAppMetaGateway,createMetadataOwners,createRepositoryComposition,createUnsupportedData});
registry.define('data-bootstrap-host',1,createModule);return createModule;
})();
export type DataBootstrapHostModule=ReturnType<typeof sdDataBootstrapHostFactory>;
