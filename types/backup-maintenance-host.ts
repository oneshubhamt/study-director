import type {MetaOwner} from './app-meta.ts';
import type {MaintenanceHooks} from './backup-provider.ts';
import type {Job,LifecycleModule} from './lifecycle.ts';
import type {RepositoriesModule} from '../source/core/repositories.ts';

type AppData=ReturnType<RepositoriesModule['createAppData']>;
export type BusyStatus=Readonly<{busy?:boolean;active?:unknown}>;
export interface BusyOwner{status():BusyStatus}
export interface WakeOwner{wake(trigger:string):unknown}
export interface BackgroundMaintenanceInput{
  readonly lifecycle:LifecycleModule;
  readonly environment:Readonly<{now():number;setTimeout(callback:()=>void,delay:number):number;clearTimeout(handle:number):void}>;
  readonly authority:Readonly<{canMutate():boolean;fullyInitialized():boolean;storageResetUnresolved():boolean;unsupportedDataHeld():boolean}>;
  readonly foreground:Readonly<{pwaReserved():boolean;mutation:BusyOwner;attachmentIngest:BusyOwner;exports:BusyOwner;backupController:BusyOwner;providers:BusyOwner}>;
  readonly data:Readonly<{maintenance:Pick<AppData['maintenance'],'run'|'status'>;notes:Pick<AppData['notes'],'purgeExpiredTrash'>}>;
  readonly diagnostics:Readonly<{
    capture(scope:string,error:unknown,level:'warn'|'error'):unknown;
    start(kind:string,label:string,details:Readonly<Record<string,unknown>>):string;
    mark(kind:string,details:Readonly<Record<string,unknown>>,traceId:string):unknown;
    finish(details:Readonly<Record<string,unknown>>,traceId:string):unknown;
    fail(error:unknown,details:Readonly<Record<string,unknown>>,traceId:string):unknown;
  }>;
  readonly backgroundOwners:()=>readonly (readonly [string,WakeOwner])[];
  scheduleAssetMaintenance(delay:number):unknown;
  readonly intervals:Readonly<{maintenanceMs:number;failureRetryMs:number;assetCleanupDelayMs:number;foregroundRecheckMs:number}>;
}
export interface BackgroundMaintenanceController{
  readonly format:'study-director.background-maintenance-host';readonly contractVersion:1;
  readonly job:Readonly<Job<{status:string;reason?:string;lastRun?:string;version?:number;completedAt?:string;phase?:number}>>;
  backgroundBlocker(options?:Readonly<{housekeeping?:boolean}>):string;
  upkeepBlocker(options?:Readonly<{housekeeping?:boolean}>):string;
  foregroundBusy():boolean;
  foregroundChanged():boolean;
  wake(trigger?:string):boolean;
  waitForClosedTabLease(owner:Readonly<{canMutate():boolean}>,mutation:Readonly<{foreignActive():boolean}>,limitMs?:number):Promise<boolean>;
  schedule(delay?:number,trigger?:string):boolean;
}
export interface RepositoryMaintenanceInput{
  readonly meta:MetaOwner;
  readonly metadataName:string;
  readonly diagnostics:Readonly<{capture(scope:string,error:unknown,level:'warn'):unknown}>;
  readonly environment:Readonly<{nowIso():string;uuid():string}>;
}
export interface RepositoryMaintenanceController{
  readonly format:'study-director.repository-maintenance-host';readonly contractVersion:1;
  readonly hooks:Readonly<MaintenanceHooks>;
  read(options?:Readonly<{throwOnError?:boolean}>):Promise<Readonly<{format:'study-director.repository-maintenance-pending';version:4;entries:readonly import('./repository-background.ts').MaintenanceState[]}> >;
}
export interface BackupMaintenanceHostContract{
  readonly format:'study-director.backup-maintenance-host-module';readonly contractVersion:1;
  createBackground(input:Readonly<BackgroundMaintenanceInput>):Readonly<BackgroundMaintenanceController>;
  createRepositoryMaintenance(input:Readonly<RepositoryMaintenanceInput>):Readonly<RepositoryMaintenanceController>;
}
