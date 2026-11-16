import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createFakeClock} from './fake-clock.mjs';
import {createMemoryDirectory} from './memory-directory.mjs';

// A Device Folder test world: the production controller, backup engine,
// folder storage, retention and cleanup on an in-memory folder and a fake
// clock. Only checkpoint preparation is a stand-in: each backup writes one
// small object, a JSON manifest and the real commit marker through the
// engine's own executor. `protection` (optional) seals the object and the
// manifest the way backup encryption does.
const freeze=Object.freeze;
export const MINUTE=60*1000,DAY=24*60*MINUTE;
const sha256=async blob=>Buffer.from(await webcrypto.subtle.digest('SHA-256',await blob.arrayBuffer())).toString('hex');
// Each profile and device has its own repository folder in the chosen folder;
// earlier versions kept one folder of a fixed name, which is moved into it.
export const LEGACY_ROOT='Study-Director-Automatic-Backup-Repository',REPOSITORY_NAME='Study Director - QA - Test Device',QA_DEVICE='inst_qa_test_mve00000_abcdef01',QA_PROFILE='prof_qa_mve00000_abcdef01';
export const IDENTITIES=freeze({root:REPOSITORY_NAME,legacyRoot:LEGACY_ROOT,prefix:'Study Director',objects:'objects',checkpoints:'checkpoints',commits:'commits'});

// Each world numbers its versions apart, as random ids would be.
let worlds=0;
// `manifestVersion` is the format this world's backups are written in (10 is
// current; 9, 8 and 1 to 5 are the released ones this build still reads).
// lock: a Web Lock shared with another world, as two tabs of one browser share it.
export function sharedLock(){let chain=Promise.resolve();return work=>{const run=chain.then(()=>work());chain=run.catch(()=>{});return run;};}
export function createDeviceFolderWorld({start='2026-10-06T08:00:00.000Z',supported=true,protection=null,device=QA_DEVICE,profile=QA_PROFILE,name=REPOSITORY_NAME,manifestVersion=10,lock=sharedLock()}={}){
  // Who this page is (profile and device), and the answer to "use one of the
  // backup folders already here?" (null cancels, '' starts a new one).
  const worldNumber=++worlds;
  let owner=freeze({profile,scope:'',device,name}),repositoryChoice=rows=>rows[0].name;const repositoryChoices=[];
  const clock=createFakeClock(start),clockNow=()=>clock.now(),notices=[],published=[],verified=new Map(),settingsStore=new Map(),rendered=[],captures=[];
  let current=new clock.Date(clock.now()-MINUTE).toISOString(),localEmpty=false,canMutate=true,pickerResult=null,pickerCalls=0,sequence=0,durablePending=null,registeredProvider=null;
  const context={Object,Symbol,TypeError,Error,Date:clock.Date,AbortController,Blob,File,Promise,Map,Set,WeakMap,TextEncoder,Uint8Array,JSON,Math,Number,String,Array,console,crypto:webcrypto,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,DOMException};
  context.globalThis=context;vm.createContext(context);
  for(const name of ['internal','operation-lifecycle','repository-policy','repository-background','managed-repository','backup-provider','backup-recovery-host','notice-coordinator','backup-presentation','device-folder-storage','device-backup','host-metadata'])vm.runInContext(fs.readFileSync(`source/core/${name}.js`,'utf8'),context,{filename:`source/core/${name}.js`});
  const registry=context[Symbol.for('studyDirector.internalModules.v1')],lifecycle=registry.require('operation-lifecycle',1),background=registry.require('repository-background',1,freeze({lifecycle})),policy=registry.require('repository-policy',1);
  // Retention, classification and cleanup are the production repository rules.
  const unused=()=>{throw new Error('Unexpected repository I/O in the Device Folder test.');};
  const rules=registry.require('managed-repository',1).createEngine(freeze({
    codec:freeze({countShape:value=>value,utf8Bytes:value=>new TextEncoder().encode(String(value)),compressionSupported:()=>false,assetIds:()=>[]}),
    ports:freeze({
      configuration:freeze({backupVersion:1,limits:freeze({}),logicalCaptureFormat:'qa.capture',logicalCaptureVersion:1}),
      persistence:freeze({reconciliationBaseRead:unused,reconciliationBaseWrite:unused,personalFingerprint:unused,personalFields:unused,dayFingerprints:unused,semanticDayFingerprints:unused,sessionFingerprint:unused,sessionContentFingerprint:unused}),assets:freeze({get:unused,verifyAliases:unused}),
      files:freeze({protect:unused,unprotect:unused,run:unused,scope:unused}),
      checkpoint:freeze({capture:unused,beginPreparation:unused,readPreparationUnits:unused,finalizePreparation:unused,establishPreparationBaseline:unused,assertCurrent:unused,inspectVerifiedCapture:unused,verifyVerifiedCapture:unused,currentImportSignal:unused}),
      domain:freeze({clampText:value=>String(value)}),environment:freeze({throwIfAborted:unused,yieldTask:async()=>{}}),diagnostics:freeze({capture:()=>{}})
    })
  }));
  const calendar=at=>{const date=new Date(at),day=(date.getUTCDay()+6)%7,monday=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()-day));return freeze({localDate:at.slice(0,10),weekStart:monday.toISOString().slice(0,10),month:at.slice(0,7),utcOffsetMinutes:0});};
  async function publish(_history,options,executor){
    const exportedAt=new clock.Date(clock.now()).toISOString(),sourceRevision=current,checkpointId='cp_'+(worldNumber*0x100000+(++sequence)).toString(16).padStart(32,'0'),role=options.retention?.role==='before-restore'?'before-restore':'normal';
    const seal=async raw=>protection?(await protection.protect({blob:raw,filename:'backup'},{interactive:options.interactive!==false,signal:options.signal})).blob:raw;
    const blob=await seal(new Blob([`library at ${sourceRevision}`])),objectId='obj_'+(await sha256(new Blob([sourceRevision]))).slice(0,32),storedChecksum=await sha256(blob),reused=options.availableObjectIds instanceof Set&&options.availableObjectIds.has(objectId);
    const entry=freeze({objectId,blob,storedBytes:blob.size,storedChecksum,reused,checkProtection:async()=>{}}),prepared=freeze({exportedAt,objects:freeze([entry])});
    if(!reused)await executor.writeObject(entry,prepared);
    const manifest=freeze({format:'study-director.backup-repository-checkpoint',version:manifestVersion,checkpoint:freeze({checkpointId,createdAt:exportedAt,originInstallationId:'qa'}),exportedAt,sourceRevision,logicalFingerprint:storedChecksum,counts:freeze({dailyRecord:1,note:1}),encrypted:!!protection,
      retention:freeze({role,purpose:role==='before-restore'?options.retention.purpose:'',protectedUntil:role==='before-restore'?new Date(clock.now()+7*DAY).toISOString():'',calendar:calendar(exportedAt)}),objects:freeze([freeze({objectId,storedBytes:blob.size,storedChecksum})])});
    await executor.writeManifest(freeze({blob:await seal(new Blob([JSON.stringify(manifest)])),manifest,exportedAt,checkSource:async()=>{},checkProtection:async()=>{}}));
    const marker={format:'study-director.backup-repository-commit',version:1,checkpointId,exportedAt,sourceRevision,manifestVersion},markerBlob=new Blob([JSON.stringify(marker)]);
    await executor.commit(freeze({...marker,blob:markerBlob,size:markerBlob.size,digest:await sha256(markerBlob),checkSource:async()=>{},checkProtection:async()=>{}}));
    published.push(freeze({checkpointId,sourceRevision,role,at:clock.now()}));
    const committedResult=await executor.onCommitted(freeze({sourceRevision,exportedAt,publication:freeze({name:checkpointId+'.sdcheckpoint'}),manifest}));
    const cleanupResult=executor.cleanup?await executor.cleanup(freeze({manifest})):null;
    return freeze({checkpointId,manifest,sourceRevision,exportedAt,publication:freeze({name:checkpointId+'.sdcheckpoint'}),objectsWritten:reused?0:1,objectsReused:reused?1:0,writtenBytes:blob.size,attachmentBytesWritten:0,committedResult,cleanupResult,warning:''});
  }
  // As the real reader does, a manifest this build cannot interpret is marked
  // unreadable (repositoryUnreadable); a locked one is not.
  const unreadable=error=>Object.assign(error,{repositoryUnreadable:true});
  const inspectManifest=async(file,options={})=>{const opened=protection?(await protection.unprotect(file,{interactive:options.interactive!==false})).blob:file;let value;try{value=JSON.parse(await opened.text());}catch(error){throw unreadable(error);}if(value.format!=='study-director.backup-repository-checkpoint')throw unreadable(new Error('not a manifest'));if(![1,2,3,4,5,8,9,10].includes(value.version))throw unreadable(new Error('Backup manifest version is not supported by this build.'));return value;};
  const notSupported=()=>{throw new Error('Restore is covered by the browser and repository-restore suites.');};
  const pipeline=freeze({noteObject:notSupported,readNote:notSupported,readSession:notSupported,createPublication:notSupported,publish,publishInline:publish,inspectManifest,inspect:notSupported,bringIn:notSupported,restoreVersion:notSupported,verifyCheckpoint:notSupported,sharedBase:async()=>null,establishBase:notSupported,verifyObject:notSupported,scrub:notSupported,cleanup:rules.cleanup,inspectCommit:rules.inspectCommit,
    retention:rules.retention,validatePolicy:rules.validatePolicy,classifyState:rules.classifyState,activeProtected:rules.activeProtected,selectRetention:rules.selectRetention,projectHistory:rules.projectHistory,
    markCompleted:({copy})=>{if(copy)verified.set(copy.source,freeze({at:new clock.Date(clock.now()).toISOString(),sourceRevision:copy.sourceRevision}));}});
  const coordinator=registry.require('notice-coordinator',1).createCoordinator(freeze({setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout}));
  const notifications=freeze({...coordinator,emit:raw=>{notices.push(raw);return coordinator.emit(raw);}});
  const presentation=registry.require('backup-presentation',1).createPresentation(freeze({notifications}));
  const noop=()=>{};
  const runtime=registry.require('backup-provider',1,freeze({repositoryPolicy:policy})).createRuntime(freeze({background:freeze({format:background.format,contractVersion:1,createCoordinator:background.createCoordinator,maintenance:background.maintenance,maintenanceActionable:background.maintenanceActionable}),repository:pipeline,ports:freeze({
    configuration:freeze({appVersion:'qa'}),controller:freeze({beginImport:noop,cancelImport:noop,finishImport:noop}),exports:freeze({followProtection:async()=>false,protect:async file=>{const value=typeof file==='function'?await file():file;return freeze({...value,encrypted:false,protectionId:'',checkProtection:async()=>{}});},unprotect:async blob=>freeze({blob,encrypted:false}),run:async(type,data)=>{assert.equal(type,'checksum');return sha256(data.value);}}),domain:freeze({clampText:value=>String(value||'')}),view:freeze({presentation}),
    ownership:freeze({canShare:()=>true,canRunBackground:()=>!canMutate?'awaiting-control':protection&&protection.status().enabled&&!protection.status().unlocked?'locked':true,requireMutationControl:()=>{if(!canMutate)throw new Error('Take control first.');}}),environment:freeze({setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout}),
    diagnostics:freeze({capture:(scope,error)=>captures.push(freeze({scope,message:String(error?.message||error)})),start:()=>'trace',mark:noop,finish:noop,fail:noop})
  })}));
  const pending=registry.require('backup-recovery-host',1).createPendingStore(freeze({sourceRevision:()=>current,diagnostics:freeze({capture:noop}),storage:freeze({read:async()=>durablePending,write:async value=>{durablePending=value;},remove:async()=>{durablePending=null;}})}));
  runtime.configurePendingBackupRetry(pending);
  const maintenance=new Map();
  runtime.configureRepositoryMaintenance(freeze({read:async id=>maintenance.get(id)||null,mark:async(id,state)=>{maintenance.set(id,freeze({...state,providerId:id}));return true;},clear:async id=>{maintenance.delete(id);return true;}}));
  runtime.configureAutomaticBackup(freeze({covered:id=>verified.get(id)?.sourceRevision||'',current:()=>current,ready:async()=>!localEmpty}));
  let folder=null;
  const storageFor=(folderPort,repositoryPort=()=>IDENTITIES.root)=>registry.require('device-folder-storage',1).createStorage(freeze({
    folder:folderPort,identities:freeze({...IDENTITIES,root:repositoryPort}),checksum:(blob)=>sha256(blob),inspectManifest,owner:()=>owner,
    environment:freeze({canMutate:()=>canMutate,now:()=>clock.now(),setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,yieldTask:async()=>{}}),
    limits:freeze({publicationMaxAgeMs:policy.protocol.publicationMaxAgeMs,publicationAssertionMarginMs:policy.protocol.publicationAssertionMarginMs,publicationRenewMs:policy.protocol.publicationRenewMs,publicationStaleMs:policy.protocol.publicationStaleMs,maintenanceMaxAgeMs:policy.protocol.maintenanceMaxAgeMs,maintenanceAssertionMarginMs:policy.protocol.maintenanceAssertionMarginMs,responseTimeoutMs:10*1000})
  }));
  const identity=value=>value,metaKeys=freeze(Object.fromEntries(['verifiedRecoveryBackups','backupProtection','attachmentIntegrityAudit','deviceFolder','repositoryIntegrityScrub','managedProviderBackupPending','repositoryMaintenancePending','reconciliationBase','reconciliationBaseNotePrefix','reconciliationBaseDayPrefix'].map(name=>[name,name])));
  const settingsValid=registry.require('host-metadata',1).createAppMetaValidators(freeze({keys:metaKeys,same:(a,b)=>JSON.stringify(a)===JSON.stringify(b),normalizers:freeze({verifiedRecovery:identity,attachmentIntegrity:identity,repositoryIntegrity:identity,reconciliationBase:identity,reconciliationBaseNote:identity,reconciliationBaseDays:identity})})).deviceFolder;
  const showDirectoryPicker=supported?()=>{pickerCalls+=1;if(pickerResult instanceof Error)return Promise.reject(pickerResult);return Promise.resolve(pickerResult);}:null;
  const controller=registry.require('device-backup',1).createController(freeze({
    configuration:freeze({metadataKey:'deviceFolder',pickerId:'study-director-device-backup',settingsTimeoutMs:10*1000}),
    engine:freeze({backup:id=>runtime.backup(id),cancelForeground:(reason,id)=>runtime.cancelForeground(reason,id),disconnect:id=>runtime.disconnect(id),forget:id=>runtime.forget(id),locationStatus:id=>runtime.locationStatus(id),register:config=>{registeredProvider=config;return runtime.register(config);},subscribeStatus:listener=>runtime.subscribeStatus(listener)}),
    environment:freeze({backgroundBlocker:()=>canMutate?'':'awaiting-control',canMutate:()=>canMutate,clearTimeout:clock.clearTimeout,setTimeout:clock.setTimeout,showDirectoryPicker,withLock:lock}),
    hooks:freeze({capture:(scope,error)=>captures.push(freeze({scope,message:String(error?.message||error)})),chooseRepository:async rows=>{repositoryChoices.push([...rows]);return repositoryChoice(rows);},render:state=>rendered.push(state),repositoryOwner:()=>owner,sourceRevision:()=>current,verifiedAt:()=>verified.get('device-folder')?.at||''}),
    presentation,
    // Writes pass the app's own stored-record validator, as the real store does.
    settings:freeze({read:async key=>settingsStore.get(key)||null,write:async(key,value)=>{if(!settingsValid(value,{key}))throw new Error(`appMeta ${key} value is not canonical.`);settingsStore.set(key,value);return true;},remove:async key=>{settingsStore.delete(key);return true;}}),
    transport:(folderPort,repositoryPort)=>storageFor(folderPort,repositoryPort)
  }));
  // A browser directory handle with readwrite permission state.
  function directory({permission='granted',grant='granted'}={}){
    const faults={corruptReadOf:new Set()},handle=createMemoryDirectory({now:clockNow,faults});
    Object.assign(handle,{faults,permission,requests:0,queryPermission:async()=>handle.permission,requestPermission:async()=>{handle.requests+=1;handle.permission=grant;return grant;}});
    return handle;
  }
  // Real work (hashing, file reads) finishes between timers, so simulated time
  // moves from one due timer to the next only once the work started by the
  // previous one has settled.
  const idle=()=>!runtime.status().busy&&!controller.status().busy&&runtime.backgroundStatus().every(row=>!row.busy&&!row.running);
  // Waits for real work (up to 20 s of wall time), never for simulated time.
  async function settle(){const until=Date.now()+20000;let quiet=0;for(let turn=0;quiet<3&&Date.now()<until;turn++){await new Promise(resolve=>setImmediate(resolve));if(turn%25===24)quiet=idle()?quiet+1:0;}}
  async function tick(ms){
    const target=clock.now()+ms;
    for(;;){await settle();const next=clock.nextAt();if(next===null||next>target)break;await clock.advance(Math.max(0,next-clock.now()));}
    await clock.advance(Math.max(0,target-clock.now()));await settle();
  }
  // Writes one committed version straight into the folder, as another build
  // would (no cleanup runs): `version` is its manifest format, and a version
  // this build cannot read (newer than 8) is still listed.
  async function plant(handle,{version=5,at=clock.now()-DAY,role='normal',folderName=owner.name}={}){
    const root=await handle.getDirectoryHandle(folderName,{create:true}),exportedAt=new Date(at).toISOString(),checkpointId='cp_'+(worldNumber*0x100000+0x80000+(++sequence)).toString(16).padStart(32,'0');
    const manifest={format:'study-director.backup-repository-checkpoint',version,checkpoint:{checkpointId,createdAt:exportedAt,originInstallationId:'qa'},exportedAt,sourceRevision:exportedAt,logicalFingerprint:await sha256(new Blob([checkpointId])),counts:{dailyRecord:2,note:3},encrypted:false,
      retention:{role,purpose:role==='before-restore'?'before-restore':'',protectedUntil:role==='before-restore'?new Date(at+7*DAY).toISOString():'',calendar:calendar(exportedAt)},objects:[]};
    const write=async(directory,name,blob)=>{const file=await (await root.getDirectoryHandle(directory,{create:true})).getFileHandle(name,{create:true}),writable=await file.createWritable();await writable.write(blob);await writable.close();};
    await write(IDENTITIES.checkpoints,checkpointId+'.sdcheckpoint',new Blob([JSON.stringify(manifest)]));
    await write(IDENTITIES.commits,checkpointId+'.sdcommit',new Blob([JSON.stringify({format:'study-director.backup-repository-commit',version:1,checkpointId,exportedAt,sourceRevision:exportedAt,manifestVersion:version})]));
    return checkpointId;
  }
  async function commits(handle,folderName=owner.name){try{const root=await handle.getDirectoryHandle(folderName);return (await root.getDirectoryHandle(IDENTITIES.commits)).names();}catch{return [];}}
  async function locks(handle,folderName=owner.name){const root=await handle.getDirectoryHandle(folderName);return (await root.getDirectoryHandle(IDENTITIES.objects)).names().filter(name=>/\.sd(?:publication|maintenance)$/u.test(name));}
  return {
    clock,runtime,controller,published,verified,settingsStore,notices,rendered,captures,directory,tick,settle,commits,locks,storageFor,plant,providerConfiguration:()=>registeredProvider,
    get pickerCalls(){return pickerCalls;},
    get repositoryChoices(){return repositoryChoices;},
    setOwner:value=>{owner=freeze({...owner,...value});},chooseRepositoryWith:fn=>{repositoryChoice=fn;},
    // The file name the next backup's object will have.
    nextObjectName:async()=>'obj_'+(await sha256(new Blob([current]))).slice(0,32)+'.sdobject',
    choose:value=>{pickerResult=value;value?.useClock?.(clockNow);},
    change:(urgent=false)=>{current=new clock.Date(clock.now()).toISOString();runtime.noteChange({urgent});},
    setLocalEmpty:value=>{localEmpty=value;},setCanMutate:value=>{canMutate=value;},
    store:(handle,baseline='')=>settingsStore.set('deviceFolder',{format:'study-director.device-folder-settings',version:4,directoryHandle:handle,baseline}),
    // The message the Device Folder row's inline note shows.
    note:()=>presentation.current('device-folder')?.message||'',
    permissionNotices:()=>notices.filter(raw=>raw.source==='device-folder'&&raw.id==='permission')
  };
}
