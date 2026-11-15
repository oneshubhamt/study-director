import type {BackupActionsHostModule} from '../../source/core/backup-actions-host.ts';
import type {BackupModule} from '../../source/core/backup.ts';
import type {BackupPresentationModule} from '../../source/core/backup-presentation.ts';
import type {DeviceBackupModule} from '../../source/core/device-backup.ts';
import type {DeviceFolderStorageModule} from '../../source/core/device-folder-storage.ts';
import type {ExportsModule} from '../../source/core/exports.ts';
import type {BackupControlsInput,BackupProtectionHostInput,DeviceBackupCompositionInput} from '../backup-actions-host.ts';
import type {DeviceBackupInput} from '../device-backup.ts';
import type {ProtectionInput} from '../exports.ts';

declare const host:BackupActionsHostModule;
declare const backupRuntime:ReturnType<BackupModule['createRuntime']>;
declare const exportsModule:ExportsModule;
declare const processing:ReturnType<ExportsModule['createCoordinator']>;
declare const protection:ReturnType<ExportsModule['createProtection']>;
declare const presentation:ReturnType<BackupPresentationModule['createPresentation']>;
declare const device:ReturnType<DeviceBackupModule['createController']>;
declare const deviceModule:DeviceBackupModule;
declare const storageModule:DeviceFolderStorageModule;
type Token=Readonly<{revision:number}>;
declare const protectionStorage:ProtectionInput<Token>['storage'];
declare const protectionInteractions:ProtectionInput<Token>['interactions'];

const protectionInput=Object.freeze({
  module:exportsModule,processing,storage:protectionStorage,interactions:protectionInteractions,settingKey:'backupProtection',
  mutation:Object.freeze({remember:()=>true,canMutate:()=>true,issueToken:()=>({revision:1}),assertToken:(_token:Token|null)=>{}}),
  environment:Object.freeze({window,backgroundBlocker:()=>false}),
  view:Object.freeze({document,maxStatusMessageChars:1000,clampText:(value:unknown)=>String(value),resolveSettingNotice:()=>{},publishSettingError:(_message:string)=>{},fullyInitialized:()=>true,wakeBackground:(_reason:string)=>{},refreshProviders:()=>{},renderProfile:()=>{}})
}) satisfies Readonly<BackupProtectionHostInput<Token>>;
const protectionHost=host.createProtectionHost(protectionInput);

const controlsInput=Object.freeze({
  document,controller:backupRuntime.controller,processing,protection:protectionHost,device:()=>device,providers:backupRuntime.providers,presentation,
  verifiedAt:(_source:'device-folder'|'google-drive')=>'',timeLabel:(value:string)=>value,capture:(_scope:string,_error:unknown)=>{},resolveFileOpen:()=>{},foregroundChanged:()=>{},scheduleSyncStatus:()=>{},renderProfile:()=>{},firstStartOpen:()=>false,renderFirstStart:()=>{},scheduleUpdate:(_delay:number)=>{},connectDevice:()=>{},connectDrive:()=>{},openHistory:()=>{}
}) satisfies Readonly<BackupControlsInput>;
host.createControls(controlsInput);

const deviceEngine=Object.freeze({
  backup:(id:string)=>backupRuntime.providers.backup(id),
  cancelForeground:(reason?:string,id?:string)=>backupRuntime.providers.cancelForeground(reason,id),
  disconnect:(id:string)=>backupRuntime.providers.disconnect(id),
  forget:(id:string)=>backupRuntime.providers.forget(id),
  locationStatus:(id:string)=>backupRuntime.providers.locationStatus(id),
  register:(location:Parameters<DeviceBackupInput['engine']['register']>[0])=>backupRuntime.providers.register(location),
  subscribeStatus:(listener:()=>void)=>backupRuntime.providers.subscribeStatus(listener)
}) satisfies DeviceBackupInput['engine'];
const deviceEnvironment=Object.freeze({
  backgroundBlocker:()=>false,canMutate:()=>true,clearTimeout:(handle:number)=>window.clearTimeout(handle),
  setTimeout:(callback:()=>void,ms:number)=>window.setTimeout(callback,ms),showDirectoryPicker:undefined,
  withLock:<T>(operation:()=>Promise<T>)=>operation()
}) satisfies DeviceBackupInput['environment'];
const deviceHooks=Object.freeze({
  capture:(_scope:string,_error:unknown)=>{},chooseRepository:async()=>null,
  render:(_state:Parameters<DeviceBackupInput['hooks']['render']>[0])=>{},
  repositoryOwner:()=>({profile:'profile',scope:'scope',device:'device',name:'Study Director'}),
  sourceRevision:()=>'',verifiedAt:()=>null
}) satisfies DeviceBackupInput['hooks'];
const deviceSettings=Object.freeze({
  read:async(_key:string)=>null,remove:async(_key:string)=>true,
  write:async(_key:string,_value:Parameters<DeviceBackupInput['settings']['write']>[1])=>true
}) satisfies DeviceBackupInput['settings'];
const deviceComposition=Object.freeze({
  module:deviceModule,storageModule,
  configuration:Object.freeze({metadataKey:'deviceFolder',pickerId:'study-director-device-backup',settingsTimeoutMs:10_000}),
  engine:deviceEngine,environment:deviceEnvironment,hooks:deviceHooks,presentation,settings:deviceSettings,
  storage:Object.freeze({
    checksum:(file:Blob,options:Parameters<DeviceBackupCompositionInput['storage']['checksum']>[1])=>processing.run('checksum',{value:file},options),
    owner:()=>({profile:'profile',scope:'scope',device:'device'}),
    inspectManifest:backupRuntime.repository.inspectManifest,
    identities:Object.freeze({prefix:'Study Director ',objects:'objects',checkpoints:'checkpoints',commits:'commits'}),
    limits:Object.freeze({maintenanceAssertionMarginMs:1,maintenanceMaxAgeMs:2,publicationRenewMs:3,publicationStaleMs:4,publicationAssertionMarginMs:5,publicationMaxAgeMs:6,responseTimeoutMs:7}),
    environment:Object.freeze({canMutate:()=>true,clearTimeout:(handle:number)=>window.clearTimeout(handle),now:()=>Date.now(),setTimeout:(callback:()=>void,ms:number)=>window.setTimeout(callback,ms),yieldTask:async()=>{}})
  })
}) satisfies Readonly<DeviceBackupCompositionInput>;
host.createDeviceBackup(deviceComposition);
