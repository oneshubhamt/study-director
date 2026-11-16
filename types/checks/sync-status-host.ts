import type {SyncStatusHostModule} from '../../source/core/sync-status-host.ts';
import type {BackupModule} from '../../source/core/backup.ts';
import type {BackupPresentationModule} from '../../source/core/backup-presentation.ts';
import type {DeviceBackupModule} from '../../source/core/device-backup.ts';
import type {SyncStatusHostInput} from '../sync-status-host.ts';

declare const host:SyncStatusHostModule;
declare const backupRuntime:ReturnType<BackupModule['createRuntime']>;
declare const presentation:ReturnType<BackupPresentationModule['createPresentation']>;
declare const device:ReturnType<DeviceBackupModule['createController']>;

const input=Object.freeze({
  document,
  providers:()=>backupRuntime.providers,
  presentation,
  device:()=>device,
  protection:()=>Object.freeze({status:()=>Object.freeze({enabled:false,unlocked:true})}),
  keptVersions:()=>Object.freeze({count:()=>0,review:()=>true}),
  profileKey:()=> 'profile-a',
  profileEmail:()=> '',
  profileName:()=> 'Student',
  deviceName:(id:string)=>id,
  markDriveRequested:()=>{},
  storageIssues:()=>Object.freeze([]),
  unsupportedDataHeld:()=>false,
  backupReminder:()=> '',
  updateReady:()=>false,
  sessionElsewhere:()=> '',
  sessionReady:()=> '',
  unseen:()=>0,
  actions:Object.freeze({
    closeProfilePanel:()=>{},enterPassword:()=>true,checkUpdate:()=>true,applyUpdate:()=>true,
    connectDevice:()=>true,openExecute:()=>true,continueSession:()=>true,openData:()=>true
  }),
  environment:Object.freeze({
    window,now:()=>Date.now(),online:()=>true,visible:()=>true,
    setTimeout:(callback:()=>void,delay:number)=>window.setTimeout(callback,delay),
    clearTimeout:(handle:number|null)=>{if(handle!==null)window.clearTimeout(handle);},
    setInterval:(callback:()=>void,delay:number)=>window.setInterval(callback,delay)
  }),
  capture:(_scope:string,_error:unknown)=>{}
}) satisfies Readonly<SyncStatusHostInput>;

host.createController(input);
