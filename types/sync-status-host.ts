import type {BackupProviders,BackupPresentation,DeviceBackup} from './backup-actions-host.ts';

export interface SyncStatusStorageIssue {
  readonly source?:string;
  readonly label?:string;
  readonly message?:string;
  readonly level?:string;
}
export interface SyncStatusProtection {
  status():Readonly<{enabled:boolean;unlocked:boolean}>;
}
export interface SyncStatusKeptVersions {
  count():number;
  review():unknown;
}
export interface SyncStatusActions {
  closeProfilePanel():unknown;
  enterPassword():unknown;
  checkUpdate():unknown;
  applyUpdate():unknown;
  connectDevice():unknown;
  openExecute():unknown;
  continueSession():unknown;
  openData():unknown;
}
export interface SyncStatusEnvironment {
  readonly window:Window;
  now():number;
  online():boolean;
  visible():boolean;
  setTimeout(callback:()=>void,delay:number):number;
  clearTimeout(handle:number|null):void;
  setInterval(callback:()=>void,delay:number):number;
}
export interface SyncStatusHostInput {
  readonly document:Document;
  providers():BackupProviders;
  readonly presentation:BackupPresentation;
  device():Pick<DeviceBackup,'status'>|null;
  protection():SyncStatusProtection|null;
  keptVersions():SyncStatusKeptVersions|null;
  profileKey():string;
  profileEmail():string;
  profileName():string;
  deviceName(id:string):string;
  markDriveRequested():unknown;
  storageIssues():readonly SyncStatusStorageIssue[];
  unsupportedDataHeld():boolean;
  backupReminder():string;
  updateReady():boolean;
  sessionElsewhere():string;
  sessionReady():string;
  unseen():number;
  canMutate():boolean;
  readonly actions:Readonly<SyncStatusActions>;
  readonly environment:Readonly<SyncStatusEnvironment>;
  capture(scope:string,error:unknown):unknown;
}
export interface SyncStatusHostController {
  readonly format:'study-director.sync-status-host';
  readonly contractVersion:1;
  schedule():boolean;
  render():unknown;
  renderConnectCard():unknown;
  action(event:Event):Promise<unknown>;
  connectDriveForProfile():ReturnType<BackupProviders['connect']>;
  endConnectCard():boolean;
  connectCardOpen():boolean;
  install():boolean;
}
export interface SyncStatusHostContract {
  readonly format:'study-director.sync-status-host-module';
  readonly contractVersion:1;
  createController(input:Readonly<SyncStatusHostInput>):Readonly<SyncStatusHostController>;
}
