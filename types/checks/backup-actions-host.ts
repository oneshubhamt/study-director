import type {BackupActionsHostModule} from '../../source/core/backup-actions-host.ts';
import type {BackupModule} from '../../source/core/backup.ts';
import type {BackupPresentationModule} from '../../source/core/backup-presentation.ts';
import type {DeviceBackupModule} from '../../source/core/device-backup.ts';
import type {DeviceFolderStorageModule} from '../../source/core/device-folder-storage.ts';
import type {ExportsModule} from '../../source/core/exports.ts';
import type {BackupControlsInput,BackupProtectionHostInput,DeviceBackupCompositionInput} from '../backup-actions-host.ts';
import type {DeviceBackupInput} from '../device-backup.ts';
import type {FolderStorageInput} from '../device-folder-storage.ts';
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
declare const deviceInput:DeviceBackupInput;
declare const folderInput:FolderStorageInput;
type Token=Readonly<{revision:number}>;
declare const protectionStorage:ProtectionInput<Token>['storage'];
declare const protectionInteractions:ProtectionInput<Token>['interactions'];

const protectionInput=Object.freeze({
  module:exportsModule,processing,storage:protectionStorage,interactions:protectionInteractions,settingKey:'backupProtection',
  mutation:Object.freeze({remember:()=>true,canMutate:()=>true,issueToken:()=>({revision:1}),assertToken:(_token:Token|null)=>{}}),
  environment:Object.freeze({window,backgroundBlocker:()=>false}),
  view:Object.freeze({document,maxStatusMessageChars:1000,clampText:(value:unknown)=>String(value),resolveSettingNotice:()=>{},publishSettingError:(_message:string)=>{},fullyInitialized:()=>true,wakeBackground:(_reason:string)=>{},refreshProviders:()=>{},renderProfile:()=>{}})
}) satisfies Readonly<BackupProtectionHostInput<Token>>;
host.createProtectionHost(protectionInput);

const controlsInput=Object.freeze({
  document,controller:backupRuntime.controller,processing,protection,device:()=>device,providers:backupRuntime.providers,presentation,
  verifiedAt:(_source:'device-folder'|'google-drive')=>'',timeLabel:(value:string)=>value,surfaceError:(_error:unknown)=>{},capture:(_scope:string,_error:unknown)=>{},resolveFileOpen:()=>{},foregroundChanged:()=>{},scheduleSyncStatus:()=>{},renderProfile:()=>{},firstStartOpen:()=>false,renderFirstStart:()=>{},scheduleUpdate:(_delay:number)=>{},connectDevice:()=>{},connectDrive:()=>{},openHistory:()=>{}
}) satisfies Readonly<BackupControlsInput>;
host.createControls(controlsInput);

const deviceComposition=Object.freeze({
  module:deviceModule,storageModule,configuration:deviceInput.configuration,engine:deviceInput.engine,
  environment:deviceInput.environment,hooks:deviceInput.hooks,presentation:deviceInput.presentation,settings:deviceInput.settings,
  storage:Object.freeze({checksum:folderInput.checksum,owner:folderInput.owner,inspectManifest:folderInput.inspectManifest,identities:Object.freeze({prefix:folderInput.identities.prefix,objects:folderInput.identities.objects,checkpoints:folderInput.identities.checkpoints,commits:folderInput.identities.commits}),limits:folderInput.limits,environment:folderInput.environment})
}) satisfies Readonly<DeviceBackupCompositionInput>;
host.createDeviceBackup(deviceComposition);
