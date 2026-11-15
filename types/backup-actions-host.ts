import type {BackupModule} from '../source/core/backup.ts';
import type {BackupPresentationModule} from '../source/core/backup-presentation.ts';
import type {DeviceBackupModule} from '../source/core/device-backup.ts';
import type {DeviceFolderStorageModule} from '../source/core/device-folder-storage.ts';
import type {ExportsModule} from '../source/core/exports.ts';
import type {DeviceBackupInput,DeviceStatus} from './device-backup.ts';
import type {FolderStorageInput} from './device-folder-storage.ts';
import type {ProtectionInput} from './exports.ts';

export type BackupRuntime=ReturnType<BackupModule['createRuntime']>;
export type BackupController=BackupRuntime['controller'];
export type BackupProviders=BackupRuntime['providers'];
export type BackupPresentation=ReturnType<BackupPresentationModule['createPresentation']>;
export type ExportCoordinator=ReturnType<ExportsModule['createCoordinator']>;
export type BackupProtection=ReturnType<ExportsModule['createProtection']>;
export type DeviceBackup=ReturnType<DeviceBackupModule['createController']>;
export type DeviceStorageInput=Omit<FolderStorageInput,'folder'|'identities'>&Readonly<{identities:Omit<FolderStorageInput['identities'],'root'>}>;

export interface BackupProtectionHostInput<Token>{
  readonly module:ExportsModule;
  readonly processing:ExportCoordinator;
  readonly storage:ProtectionInput<Token>['storage'];
  readonly interactions:ProtectionInput<Token>['interactions'];
  readonly settingKey:string;
  readonly mutation:Readonly<{
    remember():boolean;canMutate():boolean;issueToken():Token|null;assertToken(token:Token|null):void;
  }>;
  readonly environment:Readonly<{window:Window;backgroundBlocker():string|boolean}>;
  readonly view:Readonly<{
    document:Document;maxStatusMessageChars:number;clampText(value:unknown,max:number):string;
    resolveSettingNotice():unknown;publishSettingError(message:string):unknown;
    fullyInitialized():boolean;wakeBackground(reason:string):unknown;refreshProviders():unknown;renderProfile():unknown;
  }>;
}
export interface BackupProtectionHost{
  readonly format:'study-director.backup-protection-host';readonly contractVersion:1;
  readonly protection:BackupProtection;
  backgroundAvailability():string|boolean;
  surfaceError(error:unknown):boolean;
  withPassword<T>(open:()=>T|PromiseLike<T>):Promise<Awaited<T>>;
  manage():Promise<unknown>;
  refresh():Promise<unknown>;
  install():boolean;
}

export interface BackupControlsInput{
  readonly document:Document;
  readonly controller:BackupController;
  readonly processing:ExportCoordinator;
  readonly protection:BackupProtection;
  device():DeviceBackup|null;
  readonly providers:BackupProviders;
  readonly presentation:BackupPresentation;
  verifiedAt(source:'device-folder'|'google-drive'):string;
  timeLabel(value:string):string;
  surfaceError(error:unknown):unknown;
  capture(scope:string,error:unknown):unknown;
  resolveFileOpen():unknown;
  foregroundChanged():unknown;
  scheduleSyncStatus():unknown;
  renderProfile():unknown;
  firstStartOpen():boolean;
  renderFirstStart():unknown;
  scheduleUpdate(delay:number):unknown;
  connectDevice():unknown;
  connectDrive():unknown;
  openHistory():unknown;
}
export interface BackupControls{
  readonly format:'study-director.backup-controls';readonly contractVersion:1;
  install():boolean;
  renderFile():void;renderDrive():void;renderDevice(state:DeviceStatus):void;renderActions():void;
  toggleSettings(kind:unknown):boolean;
  backUpEverywhere():Promise<boolean>;
  withPassword<T>(open:()=>T|PromiseLike<T>):Promise<Awaited<T>>;
  openHistory():Promise<unknown>;manageProtection():Promise<unknown>;
  exportLocal():ReturnType<BackupController['exportLocal']>;
  importLocal(event:Event):ReturnType<BackupController['importLocal']>|false;
  pickImportFile():Promise<boolean>;
  cancelStandalone(reason?:string):boolean;
  connectDevice():unknown;cancelDevice(reason?:string):boolean;disconnectDevice():Promise<unknown>|unknown;
  connectDrive():unknown;cancelDrive(reason?:string):boolean;disconnectDrive():Promise<unknown>|unknown;
}

export interface DeviceBackupCompositionInput{
  readonly module:DeviceBackupModule;
  readonly storageModule:DeviceFolderStorageModule;
  readonly configuration:DeviceBackupInput['configuration'];
  readonly engine:DeviceBackupInput['engine'];
  readonly environment:DeviceBackupInput['environment'];
  readonly hooks:DeviceBackupInput['hooks'];
  readonly presentation:DeviceBackupInput['presentation'];
  readonly settings:DeviceBackupInput['settings'];
  readonly storage:DeviceStorageInput;
}

export interface BackupActionsHostContract{
  readonly format:'study-director.backup-actions-host-module';readonly contractVersion:1;
  createProtectionHost<Token>(input:Readonly<BackupProtectionHostInput<Token>>):Readonly<BackupProtectionHost>;
  createControls(input:Readonly<BackupControlsInput>):Readonly<BackupControls>;
  createDeviceBackup(input:Readonly<DeviceBackupCompositionInput>):Readonly<DeviceBackup>;
}
