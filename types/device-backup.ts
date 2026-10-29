import type {DeviceFolderStorageModule} from '../source/core/device-folder-storage.ts';
import type {FolderDirectory,FolderOwner} from './device-folder-storage.ts';
export type FolderStorage=ReturnType<DeviceFolderStorageModule['createStorage']>;
export interface ChosenFolder extends FolderDirectory{name:string;queryPermission(options:{mode:'readwrite'}):Promise<PermissionState>;requestPermission?(options:{mode:'readwrite'}):Promise<PermissionState>;removeEntry(name:string,options?:{recursive:boolean}):Promise<void>}
export type FolderSettings={format:'study-director.device-folder-settings';version:4;directoryHandle:ChosenFolder|null;baseline:string};
export type DeviceMode='off'|'unsupported'|'permission'|'connected'|'error';
export type LocationStatus={busy:boolean;cancellable:boolean;foregroundKind:string;backingUp:boolean;maintenanceBusy:boolean;paused:boolean;locked:boolean;waiting:boolean;nextEligibleAt:string;retryAttempt:number;retryBackoffCapped:boolean};
export type DeviceStatus=Readonly<{format:'study-director.device-backup-status';contractVersion:1;installed:boolean;supported:boolean;mode:DeviceMode;connected:boolean;permission:PermissionState|'unknown';folderName:string;busy:boolean;cancellable:boolean;foregroundKind:string;backingUp:boolean;maintenanceBusy:boolean;paused:boolean;locked:boolean;pending:boolean;nextEligibleAt:string;retryAttempt:number;retryBackoffCapped:boolean;repositoryName:string;lastBackupAt:string|null;hasNote:boolean}>;
export type DeviceLocation={id:'device-folder';label:'Device Folder';hosted:true;connected():boolean;backgroundAvailable():boolean;automaticBaseline():string;subscribeConnection(listener:()=>void):void;authorize(options?:{operation?:string}):Promise<void>;disconnect():Promise<void>;disconnectLabel:string;repository:Omit<FolderStorage,'layout'>};
export interface DeviceBackupInput{
 configuration:{metadataKey:string;pickerId:string;settingsTimeoutMs:number};
 engine:{backup(id:string):Promise<boolean>;cancelForeground(reason?:string,id?:string):boolean;disconnect(id:string):Promise<boolean>;forget(id:string):Promise<boolean>;locationStatus(id:string):LocationStatus|null;register(location:DeviceLocation):boolean;subscribeStatus(listener:()=>void):()=>void};
 environment:{backgroundBlocker():string|boolean;canMutate():boolean;clearTimeout(handle:number):void;setTimeout(callback:()=>void,ms:number):number;showDirectoryPicker:((options:{id:string;mode:'readwrite';startIn:'documents'})=>Promise<ChosenFolder>)|undefined;withLock<T>(operation:()=>Promise<T>):Promise<T>};
 hooks:{capture(scope:string,error:unknown):void;chooseRepository(rows:Awaited<ReturnType<FolderStorage['layout']['inspect']>>['repositories']):Promise<string|null>;render(state:DeviceStatus):void;repositoryOwner():FolderOwner&{name:string};sourceRevision():string;verifiedAt():string|null};
 settings:{read(key:string):Promise<unknown>;remove(key:string):Promise<unknown>;write(key:string,value:FolderSettings):Promise<unknown>};
 presentation:{current(id:string):unknown;feedback(id:string,text:string,ok?:boolean):unknown;notice(id:string,kind:string,text:string):unknown;read(id:string,kind?:string):unknown;resolve(id:string,kind:string):unknown;reset(id:string):unknown};
 transport(folder:()=>ChosenFolder|null,root:()=>string):FolderStorage;
}
