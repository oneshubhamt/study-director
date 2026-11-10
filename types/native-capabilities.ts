export type TaskPriority='user-visible'|'background';
export interface TaskSchedulerOptions{readonly signal?:AbortSignal;readonly priority?:TaskPriority}
export interface TaskSchedulerEnvironment{
  readonly scheduler?:Readonly<{
    postTask?(callback:()=>void,options:Readonly<{priority:'background';signal?:AbortSignal}>):PromiseLike<unknown>;
    yield?():PromiseLike<unknown>;
  }>;
  readonly performance:Pick<Performance,'now'>;
  setTimeout(callback:()=>void,delay:number):number;
}
export interface TaskScheduler{
  yieldTask(options?:TaskSchedulerOptions):Promise<void>;
  budget(milliseconds?:number):()=>boolean;
}
export interface WakeLockSentinelPort{
  readonly released:boolean;
  release():PromiseLike<void>;
  addEventListener?(type:'release',listener:()=>void,options?:AddEventListenerOptions|boolean):void;
}
export interface NavigatorStoragePort{
  persisted?():PromiseLike<boolean>;
  persist?():PromiseLike<boolean>;
}
export interface InstalledRelatedApp{readonly platform?:string}
export interface NativeNavigatorPort{
  readonly userAgent?:string;
  readonly platform?:string;
  readonly maxTouchPoints?:number;
  readonly standalone?:boolean;
  readonly userAgentData?:Readonly<{platform?:string}>;
  readonly storage?:NavigatorStoragePort;
  readonly wakeLock?:Readonly<{request(kind:'screen'):PromiseLike<WakeLockSentinelPort>}>;
  setAppBadge?(value:number):PromiseLike<void>;
  clearAppBadge?():PromiseLike<void>;
  getInstalledRelatedApps?():PromiseLike<readonly InstalledRelatedApp[]>;
}
export interface InstallPromptChoice{readonly outcome?:string}
export interface InstallPromptEventPort{
  preventDefault?():void;
  prompt():PromiseLike<void>;
  readonly userChoice?:PromiseLike<InstallPromptChoice>;
}
export interface InstallCaptureStatus{readonly prompt?:InstallPromptEventPort|null;readonly installed?:boolean}
export interface InstallCaptureEvent{readonly type?:string;readonly prompt?:InstallPromptEventPort|null}
export interface InstallCaptureBridge{
  status():InstallCaptureStatus|null|undefined;
  subscribe(listener:(event:InstallCaptureEvent|null|undefined)=>void):unknown;
}
export interface NativeCapabilitiesInput{
  readonly configuration:Readonly<{installNoticeKey:string;wakePreferenceKey:string}>;
  readonly environment:Readonly<{document:Document;navigator:NativeNavigatorPort;window:Window}>;
  readonly hooks:Readonly<{
    capture(scope:string,error:unknown):unknown;
    isTimerRunning():boolean;
    readPreference(key:string):unknown;
    render(state:NativeCapabilitiesStatus):unknown;
    writePreference(key:string,value:boolean):unknown;
  }>;
}
export type StorageMode='checking'|'unsupported'|'protected'|'standard';
export type InstallationState='opened-as-app'|'installed'|'installing'|'available'|'manual';
export type InstallationAction='install'|'find'|'help'|'none';
export interface NativeCapabilitiesStatus{
  readonly format:'study-director.native-capabilities-status';readonly contractVersion:1;
  readonly installed:boolean;readonly revision:number;
  readonly storageStatusSupported:boolean;readonly storageRequestSupported:boolean;readonly storageMode:StorageMode;readonly storageBusy:boolean;readonly storageMessage:string;
  readonly wakeSupported:boolean;readonly keepAwake:boolean;readonly wakeAcquired:boolean;readonly wakeRequesting:boolean;
  readonly installedRelatedAppsSupported:boolean;readonly installInspecting:boolean;readonly installAvailable:boolean;readonly standalone:boolean;
  readonly installedConfirmed:boolean;readonly installationState:InstallationState;readonly installationLabel:string;
  readonly installationAction:InstallationAction;readonly installationActionLabel:string;readonly installationSummary:string;
  readonly installationContext:string;readonly installationSteps:readonly string[];readonly installationFallback:readonly string[];
  readonly installationInstructions:string;readonly installFeedback:string;readonly installHelpRequested:boolean;readonly installNoticeVisible:boolean;
  readonly iosGuidance:boolean;readonly installMessage:string;readonly badgeSupported:boolean;readonly badgeActive:boolean;
}
export interface SyncWakeOptions{readonly forceCycle?:boolean}
export interface NativeCapabilitiesController{
  readonly format:'study-director.native-capabilities';readonly contractVersion:1;
  install():NativeCapabilitiesStatus;
  status():NativeCapabilitiesStatus;
  inspectStorage():Promise<NativeCapabilitiesStatus>;
  protectLocalData():Promise<NativeCapabilitiesStatus>;
  inspectInstallation():Promise<NativeCapabilitiesStatus>;
  promptInstall():Promise<boolean>;
  revealInstallHelp():NativeCapabilitiesStatus;
  offerInstallNotice():Promise<NativeCapabilitiesStatus>;
  dismissInstallNotice():NativeCapabilitiesStatus;
  setKeepAwake(value:unknown):Promise<NativeCapabilitiesStatus>;
  syncWake(options?:SyncWakeOptions):Promise<boolean>;
  updateBadge(active:unknown):Promise<boolean>;
}
