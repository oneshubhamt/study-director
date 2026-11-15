import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {BackupMaintenanceHostContract,BackgroundMaintenanceController,BackgroundMaintenanceInput,BusyOwner,RepositoryMaintenanceController,RepositoryMaintenanceEntry,RepositoryMaintenanceInput} from '../../types/backup-maintenance-host.ts';
import type {MaintenanceState} from '../../types/repository-background.ts';

const sdBackupMaintenanceHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'backup-maintenance-host','study-director.backup-maintenance-host-module'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
const {exactFrozenObject:exactObject}=registry.contracts,freeze=Object.freeze;

function createBackground(input:Readonly<BackgroundMaintenanceInput>):Readonly<BackgroundMaintenanceController>{
  exactObject(input,['lifecycle','environment','authority','foreground','data','diagnostics','backgroundOwners','scheduleAssetMaintenance','intervals'],'Background maintenance input');
  const {lifecycle,environment,authority,foreground,data,diagnostics,intervals}=input;
  let foregroundWatch:number|null=null,ownersInstalled=false;
  const group=lifecycle.createGroup((id,error)=>diagnostics.capture('background.owner.'+id,error,'warn'));
  function backgroundBlocker(options:Readonly<{housekeeping?:boolean}>={}):string{
    const housekeeping=options.housekeeping!==false;
    if(!authority.canMutate())return 'awaiting-control';
    if(!authority.fullyInitialized())return 'startup';
    return housekeeping&&authority.storageResetUnresolved()?'storage-reset':'';
  }
  function ownerBusy(owner:BusyOwner,field:'busy'|'active'='busy'):boolean{
    try{return !!owner.status()?.[field];}
    catch(error){diagnostics.capture('maintenance.foreground-status',error,'warn');return true;}
  }
  function foregroundBusy():boolean{
    return foreground.pwaReserved()||ownerBusy(foreground.mutation,'active')||ownerBusy(foreground.attachmentIngest)||ownerBusy(foreground.exports)||ownerBusy(foreground.backupController)||ownerBusy(foreground.providers);
  }
  function upkeepBlocker(options:Readonly<{housekeeping?:boolean}>={}):string{
    const blocker=backgroundBlocker(options);if(blocker)return blocker;
    if(authority.unsupportedDataHeld())return 'unsupported-data';
    if(!foregroundBusy())return '';
    if(foregroundWatch===null)foregroundWatch=environment.setTimeout(foregroundChanged,intervals.foregroundRecheckMs);
    return 'foreground-busy';
  }
  function installOwners():void{
    if(ownersInstalled)return;
    group.register('canonical',freeze({wake:(trigger:string)=>job.wake(trigger,true)}));
    for(const [id,owner] of input.backgroundOwners()){if(!owner||typeof owner.wake!=='function')throw new TypeError('Background owner '+id+' is invalid.');group.register(id,owner);}
    ownersInstalled=true;
  }
  function wake(trigger:string='eligibility'):boolean{
    if(!authority.fullyInitialized())return false;
    installOwners();group.wake(trigger);return true;
  }
  function foregroundChanged():boolean{
    if(foregroundWatch===null)return false;
    environment.clearTimeout(foregroundWatch);foregroundWatch=null;
    if(foregroundBusy()){foregroundWatch=environment.setTimeout(foregroundChanged,intervals.foregroundRecheckMs);return false;}
    return wake('foreground-released');
  }
  const job=lifecycle.createJob({
    environment,
    isAvailable:()=>upkeepBlocker({housekeeping:false})||true,
    retryMs:intervals.failureRetryMs,
    capture:error=>diagnostics.capture('maintenance.schedule',error,'error'),
    execute:async({trigger,nextEligibleAt})=>{
      if(foregroundBusy())return freeze({status:'skipped',reason:'foreground-busy'});
      const traceId=diagnostics.start('data-maintenance','Canonical storage',freeze({background:true,trigger,nextEligibleAt,actionable:true}));
      diagnostics.mark('data-maintenance-eligibility',freeze({trigger,nextEligibleAt,actionable:true}),traceId);
      const foregroundCheck=()=>{if(foregroundBusy())throw Object.assign(new Error('Data maintenance yielded.'),{code:'DATA_MAINTENANCE_YIELDED',reason:'foreground-busy'});};
      const workBudget=lifecycle.createWorkBudget({now:environment.now,milliseconds:20000,check:foregroundCheck,yieldError:()=>Object.assign(new Error('Data maintenance yielded.'),{code:'DATA_MAINTENANCE_YIELDED',reason:'budget'})});
      try{
        const raw=await data.maintenance.run({check:foregroundCheck,workBudget}),status=String(raw.status||'failed'),reason='reason' in raw?String(raw.reason||''):'';
        const result=freeze({...raw,status,reason});
        diagnostics.finish(freeze({status,result:status,reason}),traceId);
        if(status==='yielded')schedule(15000,reason||'yielded');
        else if(status==='completed'){
          try{data.notes.purgeExpiredTrash();}catch(error){diagnostics.capture('maintenance.trash',error,'warn');}
          input.scheduleAssetMaintenance(intervals.assetCleanupDelayMs);schedule(intervals.maintenanceMs,'interval');
        }else if(status==='skipped'&&reason==='recent'){
          const lastRun=Date.parse(String('lastRun' in raw?raw.lastRun||'':'')),remaining=Number.isFinite(lastRun)?Math.max(1000,lastRun+intervals.maintenanceMs-environment.now()):intervals.maintenanceMs;
          schedule(remaining,'interval');
        }else if(status==='failed'||reason==='indexeddb-unavailable')job.schedule(intervals.failureRetryMs,'retry','replace');
        return result;
      }catch(error){diagnostics.fail(error,freeze({background:true}),traceId);throw error;}
    }
  });
  function schedule(delay:number=1200,trigger:string='scheduled'):boolean{
    if(!authority.fullyInitialized())return false;
    return job.schedule(Math.max(0,Number(delay)||0),trigger);
  }
  async function waitForClosedTabLease(owner:Readonly<{canMutate():boolean}>,mutation:Readonly<{foreignActive():boolean}>,limitMs:number=25000):Promise<boolean>{
    for(let waited=0;waited<limitMs&&owner.canMutate()&&mutation.foreignActive();waited+=250)await new Promise<void>(resolve=>environment.setTimeout(resolve,250));
    return !mutation.foreignActive();
  }
  return freeze({format:'study-director.background-maintenance-host' as const,contractVersion:1 as const,job,backgroundBlocker,upkeepBlocker,foregroundBusy,watchingForeground:()=>foregroundWatch!==null,foregroundChanged,wake,waitForClosedTabLease,schedule});
}

const FORMAT='study-director.repository-maintenance-pending' as const,VERSION=4 as const,PROVIDER=/^[a-z][a-z0-9-]{0,40}$/u,REQUEST=/^[a-f0-9-]{36}$/u;
function createRepositoryMaintenance(input:Readonly<RepositoryMaintenanceInput>):Readonly<RepositoryMaintenanceController>{
  exactObject(input,['meta','metadataName','diagnostics','environment'],'Repository maintenance input');
  let writeChain=Promise.resolve();
  const reason=(value:unknown)=>{const text=String(value||'requested').trim().toLowerCase();return /^[a-z][a-z0-9-]{0,47}$/u.test(text)?text:'requested';};
  const iso=(value:unknown,fallback:string='')=>{const text=String(value||'');return Number.isFinite(Date.parse(text))?new Date(text).toISOString():fallback;};
  function normalize(value:unknown){
    const row=value&&typeof value==='object'?value as {format?:unknown;version?:unknown;entries?:unknown}:null,entries:RepositoryMaintenanceEntry[]=[],seen=new Set<string>();
    const rows=row?.format===FORMAT&&Number(row.version)===VERSION&&Array.isArray(row.entries)?row.entries:[];
    for(const raw of rows){
      const item=raw&&typeof raw==='object'?raw as Record<string,unknown>:Object.create(null) as Record<string,unknown>;
      const providerId=String(item['providerId']||''),requestedAt=iso(item['requestedAt']),nextEligibleAt=iso(item['nextEligibleAt'],requestedAt),why=reason(item['reason']),repositoryScope=String(item['repositoryScope']||''),requestId=String(item['requestId']||'');
      if(!PROVIDER.test(providerId)||seen.has(providerId)||!requestedAt||!nextEligibleAt||repositoryScope.length>320||requestId&&!REQUEST.test(requestId))continue;
      seen.add(providerId);entries.push(freeze({providerId,requestedAt,nextEligibleAt,reason:why,repositoryScope,requestId}));
    }
    return freeze({format:FORMAT,version:VERSION,entries:freeze(entries)});
  }
  async function read(options:Readonly<{throwOnError?:boolean}>={}){
    try{return normalize(await input.meta.read(input.metadataName));}
    catch(error){input.diagnostics.capture('backup.repository-maintenance-read',error,'warn');if(options.throwOnError)throw error;return normalize(null);}
  }
  function same(expected:MaintenanceState|null,previous:MaintenanceState|null):boolean{
    if(!expected!==!previous)return false;if(!expected||!previous)return true;
    return (['requestId','requestedAt','nextEligibleAt','reason','repositoryScope'] as const).every(key=>String(previous[key]||'')===String(expected[key]||''));
  }
  function mutate(providerId:string,mode:'mark'|'clear',state:Readonly<{reason?:string;nextEligibleAt?:string;repositoryScope?:string;newRequest?:boolean}>={},expected:MaintenanceState|null|undefined=undefined):Promise<boolean|'superseded'>{
    const id=String(providerId||'');if(!PROVIDER.test(id))return Promise.resolve(false);
    const task=writeChain.then(()=>input.meta.transaction<boolean|'superseded'>('readwrite',(view,_tx,finish)=>{
      const handle=view.get(input.metadataName);let outcome:boolean|'superseded'=true;
      handle.request.onerror=()=>finish(false,handle.request.error||new Error('Maintenance intent could not be read.'));
      handle.request.onsuccess=()=>{
        try{
          const current=normalize(handle.value()),byId=new Map(current.entries.map(entry=>[entry.providerId,entry] as const)),previous=byId.get(id)||null;
          if(expected!==undefined&&!same(expected,previous)){outcome='superseded';return;}
          if(mode==='mark'){
            const now=input.environment.nowIso(),requestedAt=previous?.requestedAt||now,nextEligibleAt=iso(state.nextEligibleAt,now),why=reason(state.reason||previous?.reason||'catch-up'),repositoryScope=String(state.repositoryScope??previous?.repositoryScope??'').slice(0,320);
            const requestId=state.newRequest!==true&&expected!==undefined&&previous?.requestId?previous.requestId:input.environment.uuid();
            byId.set(id,freeze({providerId:id,requestedAt,nextEligibleAt,reason:why,repositoryScope,requestId}));
          }else byId.delete(id);
          const next=freeze({format:FORMAT,version:VERSION,entries:freeze([...byId.values()].sort((a,b)=>a.providerId.localeCompare(b.providerId)))});
          const write=next.entries.length?view.put(input.metadataName,next):view.remove(input.metadataName);write.onerror=()=>finish(false,write.error||new Error('Maintenance intent could not be saved.'));
        }catch(error){finish(false,error);}
      };
      _tx.oncomplete=()=>finish(true,outcome);
    },{strict:true,abortMessage:'Maintenance intent transaction aborted'})).catch(error=>{input.diagnostics.capture('backup.repository-maintenance-write',error,'warn');return false;});
    writeChain=task.then(()=>{});return task;
  }
  const hooks=freeze({
    read:async(providerId:string)=>(await read({throwOnError:true})).entries.find(entry=>entry.providerId===String(providerId||''))||null,
    mark:(providerId:string,state:{reason:string;nextEligibleAt:string;repositoryScope:string;newRequest?:boolean},expected?:MaintenanceState|null)=>mutate(providerId,'mark',state,expected),
    clear:(providerId:string,expected?:MaintenanceState|null)=>mutate(providerId,'clear',{},expected)
  });
  return freeze({format:'study-director.repository-maintenance-host' as const,contractVersion:1 as const,hooks,read});
}
const createModule=():BackupMaintenanceHostContract=>freeze({format:'study-director.backup-maintenance-host-module',contractVersion:1,createBackground,createRepositoryMaintenance});
registry.define('backup-maintenance-host',1,createModule);return createModule;
})();
export type BackupMaintenanceHostModule=ReturnType<typeof sdBackupMaintenanceHostFactory>;
