import {readCoreScript,coreScriptPath} from './core-script.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createFakeClock} from './fake-clock.mts';
import {createMemoryDirectory} from './memory-directory.mts';

// A Device Folder test world: the production controller, backup engine,
// folder storage, retention and cleanup on an in-memory folder and a fake
// clock. Only checkpoint preparation is a stand-in: each backup writes one
// small object, a JSON manifest and the real commit marker through the
// engine's own executor. `protection` (optional) seals the object and the
// manifest the way backup encryption does.
import {method,registeredExports} from './registered-exports.mts';
import {field} from './repository-safety-ports.mts';
import {required} from './repository-note-ports.mts';
import {jsonObject,jsonArray,jsonString} from './verification/read-verification.mts';
import {numberValue} from './asset-storage-port.mts';
type Owner={profile:string;scope:string;device:string;name:string};
type FolderChoice=Record<string,unknown>&{name:string;versions:unknown};
type MemoryFolder=ReturnType<typeof createMemoryDirectory>;
type FolderOptions={permission?:string;grant?:string};
type ProtectionOptions={interactive?:boolean;signal?:unknown};
type PublishOptions={retention?:{role?:string;purpose?:string};interactive?:boolean;signal?:unknown;availableObjectIds?:unknown};
type FolderPort=()=>unknown|Promise<unknown>;
type LockWork=()=>unknown|Promise<unknown>;
type WorldOptions={start?:string;supported?:boolean;protection?:unknown;device?:string;profile?:string;name?:string;lock?:(work:LockWork)=>Promise<unknown>};
function blobValue(value:unknown):Blob{assert.ok(value instanceof Blob,'Expected fixture blob');return value;}
function recordChoices(value:unknown):FolderChoice[]{return Array.from(jsonArray(value),entry=>{const row=jsonObject(entry);return {...row,name:jsonString(row['name']),versions:row['versions']};});}
function errorText(error:unknown){return String(field(error,'message')||error);}
const freeze=Object.freeze;
export const MINUTE=60*1000,DAY=24*60*MINUTE;
const sha256=async (blob:Blob)=>Buffer.from(await webcrypto.subtle.digest('SHA-256',await blob.arrayBuffer())).toString('hex');
// Each profile and device has its own repository folder in the chosen folder;
// earlier versions kept one folder of a fixed name, which is moved into it.
export const LEGACY_ROOT='Study-Director-Automatic-Backup-Repository',REPOSITORY_NAME='Study Director - QA - Test Device',QA_DEVICE='inst_qa_test_mve00000_abcdef01',QA_PROFILE='prof_qa_mve00000_abcdef01';
export const IDENTITIES=freeze({root:REPOSITORY_NAME,prefix:'Study Director',objects:'objects',checkpoints:'checkpoints',commits:'commits'});

// Each world numbers its versions apart, as random ids would be.
let worlds=0;
// lock: a Web Lock shared with another world, as two tabs of one browser share it.
export function sharedLock(){let chain:Promise<unknown>=Promise.resolve();return (work:LockWork)=>{const run=chain.then(()=>work());chain=run.catch(()=>{});return run;};}
export function createDeviceFolderWorld({start='2026-10-06T08:00:00.000Z',supported=true,protection=null,device=QA_DEVICE,profile=QA_PROFILE,name=REPOSITORY_NAME,lock=sharedLock()}:WorldOptions={}){
  const manifestVersion=9;
  // Who this page is (profile and device), and the answer to "use one of the
  // backup folders already here?" (null cancels, '' starts a new one).
  const worldNumber=++worlds;
  let owner:Readonly<Owner>=freeze({profile,scope:'',device,name}),repositoryChoice:(rows:FolderChoice[])=>unknown=rows=>required(rows[0]).name;const repositoryChoices:FolderChoice[][]=[];
  const clock=createFakeClock(start),clockNow=()=>clock.now(),notices:unknown[]=[],published:Readonly<{checkpointId:string;sourceRevision:string;role:string;at:number}>[]=[],verified=new Map<string,Readonly<{at:string;sourceRevision:string}>>(),settingsStore=new Map<string,unknown>(),rendered:unknown[]=[],captures:Readonly<{scope:string;message:string}>[]=[];
  const captureOrigin=()=>{const revision=ownerRevision;return ()=>{if(!canMutate||ownerRevision!==revision)throw new Error('QA removal origin changed');};};
  let current=new clock.Date(clock.now()-MINUTE).toISOString(),localEmpty=false,canMutate=true,ownerRevision=0,pickerResult:unknown=null,pickerCalls=0,sequence=0,durablePending:unknown=null,registeredProvider:unknown=null;
  const context={Object,Symbol,TypeError,Error,Date:clock.Date,AbortController,Blob,File,Promise,Map,Set,WeakMap,TextEncoder,Uint8Array,JSON,Math,Number,String,Array,console,crypto:webcrypto,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,DOMException};
  Reflect.set(context,'globalThis',context);vm.createContext(context);
  for(const name of ['internal','operation-lifecycle','repository-policy','repository-background','managed-repository','backup-provider','backup-recovery-host','notice-coordinator','backup-presentation','device-folder-storage','device-backup','backup-actions-host','host-metadata'])vm.runInContext(readCoreScript(name),context,{filename:coreScriptPath(name)});
  const module=(name:string,input?:unknown)=>registeredExports(context,name,input),lifecycle=module('operation-lifecycle'),background=module('repository-background',freeze({lifecycle})),policy=module('repository-policy'),protocol=jsonObject(field(policy,'protocol'));
  const limits=freeze({...Object.fromEntries(['publicationMaxAgeMs','publicationAssertionMarginMs','publicationRenewMs','publicationStaleMs','maintenanceMaxAgeMs','maintenanceAssertionMarginMs'].map(key=>[key,numberValue(protocol[key])])),responseTimeoutMs:10*1000});
  // Retention, classification and cleanup are the production repository rules.
  const unused=()=>{throw new Error('Unexpected repository I/O in the Device Folder test.');};
  const rules=method(module('managed-repository'),'createEngine')(freeze({
    codec:freeze({countShape:(value:unknown)=>value,utf8Bytes:(value:unknown)=>new TextEncoder().encode(String(value)),compressionSupported:()=>false,assetIds:()=>[]}),
    ports:freeze({
      configuration:freeze({backupVersion:1,limits:freeze({}),logicalCaptureFormat:'qa.capture',logicalCaptureVersion:1}),
      persistence:freeze({reconciliationBaseRead:unused,reconciliationBaseWrite:unused,personalFingerprint:unused,personalFields:unused,dayFingerprints:unused,semanticDayFingerprints:unused,sessionFingerprint:unused,sessionContentFingerprint:unused}),assets:freeze({get:unused,verifyAliases:unused}),
      files:freeze({protect:unused,unprotect:unused,run:unused,scope:unused}),
      checkpoint:freeze({capture:unused,beginPreparation:unused,readPreparationUnits:unused,finalizePreparation:unused,establishPreparationBaseline:unused,assertCurrent:unused,inspectVerifiedCapture:unused,verifyVerifiedCapture:unused,currentImportSignal:unused}),
      domain:freeze({clampText:(value:unknown)=>String(value)}),environment:freeze({throwIfAborted:unused,yieldTask:async()=>{}}),diagnostics:freeze({capture:()=>{}})
    })
  }));
  const calendar=(at:string)=>{const date=new Date(at),day=(date.getUTCDay()+6)%7,monday=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()-day));return freeze({localDate:at.slice(0,10),weekStart:monday.toISOString().slice(0,10),month:at.slice(0,7),utcOffsetMinutes:0});};
  async function publish(_history:unknown,options:PublishOptions,executor:unknown){
    const exportedAt=new clock.Date(clock.now()).toISOString(),sourceRevision=current,checkpointId='cp_'+(worldNumber*0x100000+(++sequence)).toString(16).padStart(32,'0'),role=options.retention?.role==='before-restore'?'before-restore':'normal';
    const seal=async(raw:Blob)=>protection?blobValue(field(await method(protection,'protect')({blob:raw,filename:'backup'},{interactive:options.interactive!==false,signal:options.signal}),'blob')):raw;
    const blob=await seal(new Blob([`library at ${sourceRevision}`])),objectId='obj_'+(await sha256(new Blob([sourceRevision]))).slice(0,32),storedChecksum=await sha256(blob),reused=options.availableObjectIds instanceof Set&&options.availableObjectIds.has(objectId);
    const entry=freeze({objectId,blob,storedBytes:blob.size,storedChecksum,reused,checkProtection:async()=>{}}),prepared=freeze({exportedAt,objects:freeze([entry])});
    if(!reused)await method(executor,'writeObject')(entry,prepared);
    const manifest=freeze({format:'study-director.backup-repository-checkpoint',version:manifestVersion,checkpoint:freeze({checkpointId,createdAt:exportedAt,originInstallationId:'qa'}),exportedAt,sourceRevision,logicalFingerprint:storedChecksum,counts:freeze({dailyRecord:1,note:1}),encrypted:!!protection,
      retention:freeze({role,purpose:role==='before-restore'?options.retention?.purpose:'',protectedUntil:role==='before-restore'?new Date(clock.now()+7*DAY).toISOString():'',calendar:calendar(exportedAt)}),objects:freeze([freeze({objectId,storedBytes:blob.size,storedChecksum})])});
    await method(executor,'writeManifest')(freeze({blob:await seal(new Blob([JSON.stringify(manifest)])),manifest,exportedAt,checkSource:async()=>{},checkProtection:async()=>{}}));
    const marker={format:'study-director.backup-repository-commit',version:1,checkpointId,exportedAt,sourceRevision,manifestVersion},markerBlob=new Blob([JSON.stringify(marker)]);
    await method(executor,'commit')(freeze({...marker,blob:markerBlob,size:markerBlob.size,digest:await sha256(markerBlob),checkSource:async()=>{},checkProtection:async()=>{}}));
    published.push(freeze({checkpointId,sourceRevision,role,at:clock.now()}));
    const committedResult=await method(executor,'onCommitted')(freeze({sourceRevision,exportedAt,publication:freeze({name:checkpointId+'.sdcheckpoint'}),manifest}));
    const cleanupResult=field(executor,'cleanup')?await method(executor,'cleanup')(freeze({manifest})):null;
    return freeze({checkpointId,manifest,sourceRevision,exportedAt,publication:freeze({name:checkpointId+'.sdcheckpoint'}),objectsWritten:reused?0:1,objectsReused:reused?1:0,writtenBytes:blob.size,attachmentBytesWritten:0,committedResult,cleanupResult,warning:''});
  }
  // As the real reader does, a manifest this build cannot interpret is marked
  // unreadable (repositoryUnreadable); a locked one is not.
  const unreadable=(error:unknown)=>Object.assign(error instanceof Error?error:new Error(String(error)),{repositoryUnreadable:true});
  const inspectManifest=async(file:Blob,options:ProtectionOptions={})=>{const opened=protection?blobValue(field(await method(protection,'unprotect')(file,{interactive:options.interactive!==false}),'blob')):file;let value:Record<string,unknown>;try{const parsed:unknown=JSON.parse(await opened.text());value=jsonObject(parsed);}catch(error){throw unreadable(error);}if(value['format']!=='study-director.backup-repository-checkpoint')throw unreadable(new Error('not a manifest'));if(value['version']!==9)throw unreadable(new Error('Backup manifest version is not supported by this build.'));return value;};
  const notSupported=()=>{throw new Error('Restore is covered by the browser and repository-restore suites.');};
  const pipeline=freeze({noteObject:notSupported,readNote:notSupported,readSession:notSupported,createPublication:notSupported,publish,publishInline:publish,inspectManifest,inspect:notSupported,bringIn:notSupported,restoreVersion:notSupported,verifyCheckpoint:notSupported,sharedBase:async()=>null,establishBase:notSupported,verifyObject:notSupported,scrub:notSupported,cleanup:field(rules,'cleanup'),inspectCommit:field(rules,'inspectCommit'),
    retention:field(rules,'retention'),validatePolicy:field(rules,'validatePolicy'),classifyState:field(rules,'classifyState'),activeProtected:field(rules,'activeProtected'),selectRetention:field(rules,'selectRetention'),projectHistory:field(rules,'projectHistory'),
    markCompleted:({copy}:{copy?:{source:string;sourceRevision:string}})=>{if(copy)verified.set(copy.source,freeze({at:new clock.Date(clock.now()).toISOString(),sourceRevision:copy.sourceRevision}));}});
  const coordinator=method(module('notice-coordinator'),'createCoordinator')(freeze({setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout}));
  const notifications=freeze({...jsonObject(coordinator),emit:(raw:unknown)=>{notices.push(raw);return method(coordinator,'emit')(raw);}});
  const presentation=method(module('backup-presentation'),'createPresentation')(freeze({notifications}));
  const noop=()=>{};
  const runtime=method(module('backup-provider',freeze({repositoryPolicy:policy})),'createRuntime')(freeze({background:freeze({format:field(background,'format'),contractVersion:1,createCoordinator:field(background,'createCoordinator'),maintenance:field(background,'maintenance'),maintenanceActionable:field(background,'maintenanceActionable')}),repository:pipeline,ports:freeze({
    configuration:freeze({appVersion:'qa'}),controller:freeze({beginImport:noop,cancelImport:noop,finishImport:noop}),exports:freeze({followProtection:async()=>false,protect:async (file:unknown)=>{const value:unknown=typeof file==='function'?await Reflect.apply(file,undefined,[]):file;return freeze({...jsonObject(value),encrypted:false,protectionId:'',checkProtection:async()=>{}});},unprotect:async (blob:Blob)=>freeze({blob,encrypted:false}),run:async(type:string,data:{value:Blob})=>{assert.equal(type,'checksum');return sha256(data.value);}}),domain:freeze({clampText:(value:unknown)=>String(value||'')}),view:freeze({presentation}),
    ownership:freeze({canShare:()=>true,canRunBackground:()=>!canMutate?'awaiting-control':protection&&field(method(protection,'status')(),'enabled')&&!field(method(protection,'status')(),'unlocked')?'locked':true,requireMutationControl:()=>{if(!canMutate)throw new Error('Take control first.');},runExclusive:async(_kind:string,operation:(authority:{assert:()=>void})=>unknown)=>operation({assert:captureOrigin()})}),environment:freeze({setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout}),
    diagnostics:freeze({capture:(scope:string,error:unknown)=>captures.push(freeze({scope,message:errorText(error)})),start:()=>'trace',mark:noop,finish:noop,fail:noop})
  })}));
  const pending=method(module('backup-recovery-host'),'createPendingStore')(freeze({sourceRevision:()=>current,diagnostics:freeze({capture:noop}),storage:freeze({read:async()=>durablePending,write:async (value:unknown)=>{durablePending=value;},remove:async()=>{durablePending=null;}})}));
  method(runtime,'configurePendingBackupRetry')(pending);
  const maintenance=new Map<string,unknown>();
  method(runtime,'configureRepositoryMaintenance')(freeze({read:async (id:string)=>maintenance.get(id)||null,mark:async(id:string,state:unknown)=>{maintenance.set(id,freeze({...jsonObject(state),providerId:id}));return true;},clear:async (id:string)=>{maintenance.delete(id);return true;}}));
  method(runtime,'configureAutomaticBackup')(freeze({covered:(id:string)=>verified.get(id)?.sourceRevision||'',current:()=>current,ready:async()=>!localEmpty}));
  const storageFor=(folderPort:FolderPort,repositoryPort:()=>string=()=>IDENTITIES.root)=>method(module('device-folder-storage'),'createStorage')(freeze({
    folder:folderPort,identities:freeze({...IDENTITIES,root:repositoryPort}),checksum:(blob:Blob)=>sha256(blob),inspectManifest,owner:()=>owner,
    environment:freeze({canMutate:()=>canMutate,now:()=>clock.now(),setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,yieldTask:async()=>{}}),
    limits
  }));
  const identity=(value:unknown)=>value,metaKeys=freeze(Object.fromEntries(['verifiedRecoveryBackups','backupProtection','attachmentIntegrityAudit','deviceFolder','repositoryIntegrityScrub','managedProviderBackupPending','repositoryMaintenancePending','reconciliationBase','reconciliationBaseNotePrefix','reconciliationBaseDayPrefix'].map(name=>[name,name])));
  const validators=method(module('host-metadata'),'createAppMetaValidators')(freeze({keys:metaKeys,same:(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b),normalizers:freeze({verifiedRecovery:identity,attachmentIntegrity:identity,repositoryIntegrity:identity,reconciliationBase:identity,reconciliationBaseNote:identity,reconciliationBaseDays:identity})}));
  const showDirectoryPicker=supported?()=>{pickerCalls+=1;if(pickerResult instanceof Error)return Promise.reject(pickerResult);return Promise.resolve(pickerResult);}:undefined;
  const controller=method(module('backup-actions-host'),'createDeviceBackup')(freeze({
    module:module('device-backup'),storageModule:module('device-folder-storage'),
    configuration:freeze({metadataKey:'deviceFolder',pickerId:'study-director-device-backup',settingsTimeoutMs:10*1000}),
    engine:freeze({backup:(id:string)=>method(runtime,'backup')(id),cancelForeground:(reason:unknown,id:string)=>method(runtime,'cancelForeground')(reason,id),disconnect:(id:string)=>method(runtime,'disconnect')(id),forget:(id:string)=>method(runtime,'forget')(id),locationStatus:(id:string)=>method(runtime,'locationStatus')(id),register:(config:unknown)=>{registeredProvider=config;return method(runtime,'register')(config);},subscribeStatus:(listener:unknown)=>method(runtime,'subscribeStatus')(listener)}),
    environment:freeze({backgroundBlocker:()=>canMutate?'':'awaiting-control',canMutate:()=>canMutate,clearTimeout:clock.clearTimeout,setTimeout:clock.setTimeout,showDirectoryPicker,withLock:lock}),
    hooks:freeze({capture:(scope:string,error:unknown)=>captures.push(freeze({scope,message:errorText(error)})),chooseRepository:async (raw:unknown)=>{const rows=recordChoices(raw);repositoryChoices.push([...rows]);return repositoryChoice(rows);},render:(state:unknown)=>rendered.push(state),repositoryOwner:()=>owner,sourceRevision:()=>current,verifiedAt:()=>verified.get('device-folder')?.at||''}),
    presentation,
    settings:freeze({read:async (key:string)=>settingsStore.get(key)||null,write:async(key:string,value:unknown)=>{if(!method(validators,'deviceFolder')(value,{key}))throw new Error(`appMeta ${key} value is not canonical.`);settingsStore.set(key,value);return true;},remove:async (key:string)=>{settingsStore.delete(key);return true;}}),
    storage:freeze({
      identities:freeze({prefix:IDENTITIES.prefix,objects:IDENTITIES.objects,checkpoints:IDENTITIES.checkpoints,commits:IDENTITIES.commits}),
      checksum:(blob:Blob)=>sha256(blob),inspectManifest,owner:()=>owner,
      environment:freeze({canMutate:()=>canMutate,now:()=>clock.now(),setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,yieldTask:async()=>{}}),
      limits
    })
  }));
  // A browser directory handle with readwrite permission state.  // A browser directory handle with readwrite permission state.
  function directory({permission='granted',grant='granted'}:FolderOptions={}){
    const faults={corruptReadOf:new Set<string>()},handle=Object.assign(createMemoryDirectory({now:clockNow,faults}),{faults,permission,requests:0});
    return Object.assign(handle,{queryPermission:async()=>handle.permission,requestPermission:async()=>{handle.requests+=1;handle.permission=grant;return grant;}});
  }
  // Real work (hashing, file reads) finishes between timers, so simulated time
  // moves from one due timer to the next only once the work started by the
  // previous one has settled.
  const idle=()=>!field(method(runtime,'status')(),'busy')&&!field(method(controller,'status')(),'busy')&&jsonArray(method(runtime,'backgroundStatus')()).every(row=>!field(row,'busy')&&!field(row,'running'));
  // Waits for real work (up to 20 s of wall time), never for simulated time.
  async function settle(){const until=Date.now()+20000;let quiet=0;for(let turn=0;quiet<3&&Date.now()<until;turn++){await new Promise(resolve=>setImmediate(resolve));if(turn%25===24)quiet=idle()?quiet+1:0;}}
  async function tick(ms:number){
    const target=clock.now()+ms;
    for(;;){await settle();const next=clock.nextAt();if(next===null||next>target)break;await clock.advance(Math.max(0,next-clock.now()));}
    await clock.advance(Math.max(0,target-clock.now()));await settle();
  }
  // Writes one committed version straight into the folder, as another build
  // would (no cleanup runs): `version` is its manifest format, and a version
  // this build cannot read (newer than 8) is still listed.
  async function plant(handle:MemoryFolder,{version=9,at=clock.now()-DAY,role='normal',folderName=owner.name}:{version?:number;at?:number;role?:string;folderName?:string}={}){
    const root=await handle.getDirectoryHandle(folderName,{create:true}),exportedAt=new Date(at).toISOString(),checkpointId='cp_'+(worldNumber*0x100000+0x80000+(++sequence)).toString(16).padStart(32,'0');
    const manifest={format:'study-director.backup-repository-checkpoint',version,checkpoint:{checkpointId,createdAt:exportedAt,originInstallationId:'qa'},exportedAt,sourceRevision:exportedAt,logicalFingerprint:await sha256(new Blob([checkpointId])),counts:{dailyRecord:2,note:3},encrypted:false,
      retention:{role,purpose:role==='before-restore'?'before-restore':'',protectedUntil:role==='before-restore'?new Date(at+7*DAY).toISOString():'',calendar:calendar(exportedAt)},objects:[]};
    const write=async(directory:string,name:string,blob:Blob)=>{const file=await (await root.getDirectoryHandle(directory,{create:true})).getFileHandle(name,{create:true}),writable=await file.createWritable();await writable.write(blob);await writable.close();};
    await write(IDENTITIES.checkpoints,checkpointId+'.sdcheckpoint',new Blob([JSON.stringify(manifest)]));
    await write(IDENTITIES.commits,checkpointId+'.sdcommit',new Blob([JSON.stringify({format:'study-director.backup-repository-commit',version:1,checkpointId,exportedAt,sourceRevision:exportedAt,manifestVersion:version})]));
    return checkpointId;
  }
  async function commits(handle:MemoryFolder,folderName=owner.name){try{const root=await handle.getDirectoryHandle(folderName);return (await root.getDirectoryHandle(IDENTITIES.commits)).names();}catch{return [];}}
  async function locks(handle:MemoryFolder,folderName=owner.name){const root=await handle.getDirectoryHandle(folderName);return (await root.getDirectoryHandle(IDENTITIES.objects)).names().filter(name=>/\.sd(?:publication|maintenance)$/u.test(name));}
  return {
    clock,runtime,controller,published,verified,settingsStore,notices,rendered,captures,directory,tick,settle,commits,locks,storageFor,plant,providerConfiguration:()=>registeredProvider,
    get pickerCalls(){return pickerCalls;},
    get repositoryChoices(){return repositoryChoices;},
    setOwner:(value:Partial<Owner>)=>{owner=freeze({...owner,...value});},chooseRepositoryWith:(fn:(rows:FolderChoice[])=>unknown)=>{repositoryChoice=fn;},
    // The file name the next backup's object will have.
    nextObjectName:async()=>'obj_'+(await sha256(new Blob([current]))).slice(0,32)+'.sdobject',
    choose:(value:unknown)=>{pickerResult=value;if(typeof field(value,'useClock')==='function')method(value,'useClock')(clockNow);},
    change:(urgent=false)=>{current=new clock.Date(clock.now()).toISOString();method(runtime,'noteChange')({urgent});},
    setLocalEmpty:(value:boolean)=>{localEmpty=value;},setCanMutate:(value:boolean)=>{if(canMutate!==value)ownerRevision++;canMutate=value;},captureOrigin,
    store:(handle:MemoryFolder,baseline='')=>settingsStore.set('deviceFolder',{format:'study-director.device-folder-settings',version:4,directoryHandle:handle,baseline}),
    // The message the Device Folder row's inline note shows.
    note:()=>field(method(presentation,'current')('device-folder'),'message')||'',
    permissionNotices:()=>notices.filter(raw=>field(raw,'source')==='device-folder'&&field(raw,'id')==='permission')
  };
}
