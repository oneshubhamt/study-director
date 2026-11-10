import type {NativeCapabilitiesController,NativeCapabilitiesInput,NativeCapabilitiesStatus,NativeNavigatorPort} from './native-capabilities.ts';
export interface CapabilityViewsInput{
  readonly document:Document;readonly window:Window;
  readonly notices:Readonly<{publish(id:string,input:Readonly<{visible:boolean;kind:'installation';title:string;message:string;actionLabel:string}>):unknown}>;
}
export interface StorageHealthLimitPort{readonly storageCriticalRatio:number;readonly storageWarningRatio:number}
export interface StorageNavigatorPort extends NativeNavigatorPort{readonly storage?:NativeNavigatorPort['storage']&Readonly<{estimate?():PromiseLike<Readonly<{usage?:number;quota?:number}>>}>}
export interface CapabilityStorageInput{
  readonly document:Document;readonly navigator:StorageNavigatorPort;readonly limits:StorageHealthLimitPort;
  readonly controller:()=>NativeCapabilitiesController|null;
  readonly storageSizeLabel:(bytes:number)=>string;
  readonly markStorageHealthError:(source:string,reason:string,options?:Readonly<{level?:'warn'}>)=>unknown;
  readonly markStorageHealthOk:(source:string)=>unknown;
  readonly renderStorageHealth:()=>unknown;
}
export interface StorageEstimateSnapshot{readonly persisted:boolean|null;readonly usageBytes:number|null;readonly quotaBytes:number|null}
export interface CapabilityInstallationInput{
  readonly document:Document;readonly window:Window;readonly controller:()=>NativeCapabilitiesController|null;
  readonly goTab:(name:string,options:Readonly<{source:string}>)=>Promise<boolean>;
  readonly preferredScrollBehavior:()=>ScrollBehavior;
}
export interface ActiveSessionRepositoryPort{settled():PromiseLike<unknown>;load():PromiseLike<Readonly<{storage?:Readonly<{idb?:unknown}>;value?:unknown}>|null>}
export interface CapabilityBadgeInput{
  readonly controller:()=>NativeCapabilitiesController|null;
  readonly activeSession:()=>ActiveSessionRepositoryPort;
  readonly persistedActiveSessionUnfinished:(value:unknown)=>boolean;
  readonly capture:(scope:string,error:unknown)=>unknown;
}
export interface CanonicalCommitBadgeEvent{readonly entityType?:unknown;readonly operation?:unknown;readonly value?:unknown}
export interface CapabilityControllerInput{
  readonly module:Readonly<{createController(input:Readonly<NativeCapabilitiesInput>):Readonly<NativeCapabilitiesController>}>;
  readonly configuration:Readonly<{installNoticeKey:string;wakePreferenceKey:string}>;
  readonly environment:Readonly<{document:Document;navigator:NativeNavigatorPort;window:Window}>;
  readonly hooks:Readonly<{
    capture(scope:string,error:unknown):unknown;
    isTimerRunning():boolean;
    readPreference(key:string):unknown;
    writePreference(key:string,value:boolean):unknown;
    render(state:NativeCapabilitiesStatus):unknown;
  }>;
}
