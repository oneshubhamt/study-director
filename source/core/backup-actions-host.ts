import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {BackupActionsHostContract,BackupControls,BackupControlsInput,BackupProtectionHost,BackupProtectionHostInput,DeviceBackupCompositionInput} from '../../types/backup-actions-host.ts';
import type {DeviceBackupInput,DeviceStatus} from '../../types/device-backup.ts';

const sdBackupActionsHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'backup-actions-host','study-director.backup-actions-host-module'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
const {exactFrozenObject:exactObject}=registry.contracts,freeze=Object.freeze;

function createProtectionHost<Token>(input:Readonly<BackupProtectionHostInput<Token>>):Readonly<BackupProtectionHost>{
  exactObject(input,['module','processing','storage','interactions','settingKey','mutation','environment','view'],'Backup protection host input');
  if(!Object.isFrozen(input.module)||input.module.format!=='study-director.exports-module'||input.module.contractVersion!==1)throw new TypeError('Backup protection exports module is unavailable or incompatible.');
  if(!Object.isFrozen(input.processing)||!Object.isFrozen(input.mutation)||!Object.isFrozen(input.environment)||!Object.isFrozen(input.view))throw new TypeError('Backup protection host providers must be frozen.');
  const {document}=input.view;
  let ready=false,installed=false;
  function surfaceError(error:unknown){
    const hint=document.getElementById('backup-protection-hint');if(!hint)return false;
    hint.hidden=false;
    const fields=error&&typeof error==='object'?error as {message?:unknown}:null;
    const message=input.view.clampText(String(fields?.message||error||'Backup encryption could not be updated.'),input.view.maxStatusMessageChars);
    input.view.publishSettingError(message);return true;
  }
  const protection=input.module.createProtection<Token>({
    processing:input.processing,storage:input.storage,interactions:input.interactions,settingKey:input.settingKey,
    remember:input.mutation.remember,canMutate:input.mutation.canMutate,issueToken:input.mutation.issueToken,assertToken:input.mutation.assertToken,
    onState:state=>{
      input.view.resolveSettingNotice();
      const nextReady=!state.enabled||state.unlocked,restored=nextReady&&!ready;ready=nextReady;
      if(input.view.fullyInitialized()){if(restored)input.view.wakeBackground('encryption-unlocked');input.view.refreshProviders();}
      const label=document.getElementById('backup-protection-status');if(label)label.textContent=state.enabled?(state.unlocked?'On':'Not entered yet'):'Off';
      const button=document.getElementById('manage-backup-protection');if(button)button.textContent=state.enabled?(state.unlocked?'Change or remove…':'Enter password…'):'Set password…';
      const hint=document.getElementById('backup-protection-hint');if(hint){hint.className='backup-inline-note ui-helper';hint.textContent='Sync and encrypted backups wait until this profile’s backup password is entered.';hint.hidden=!state.enabled||state.unlocked;}
      if(input.view.fullyInitialized())input.view.renderProfile();
    }
  });
  if(!Object.isFrozen(protection))throw new Error('Study Director backup protection is unavailable or incompatible.');
  function backgroundAvailability(){return input.environment.backgroundBlocker()||(ready?true:'locked');}
  async function withPassword<T>(open:()=>T|PromiseLike<T>):Promise<Awaited<T>>{
    try{const state=protection.status();if(state.enabled&&!state.unlocked)await protection.ask();}catch(error){surfaceError(error);}
    return await open();
  }
  async function manage(){try{return await protection.manage();}catch(error){if(!(error&&typeof error==='object'&&(error as {name?:unknown}).name==='AbortError'))surfaceError(error);return false;}}
  async function refresh(){try{return await protection.refresh();}catch(error){surfaceError(error);throw error;}}
  function install(){
    if(installed)return false;installed=true;
    input.environment.window.addEventListener('pagehide',()=>protection.lock());
    input.environment.window.addEventListener('pageshow',event=>{if(event.persisted)void refresh().catch(()=>{});});
    return true;
  }
  return freeze({format:'study-director.backup-protection-host' as const,contractVersion:1 as const,protection,backgroundAvailability,surfaceError,withPassword,manage,refresh,install});
}

function createControls(input:Readonly<BackupControlsInput>):Readonly<BackupControls>{
  exactObject(input,['document','controller','processing','protection','device','providers','presentation','verifiedAt','timeLabel','surfaceError','capture','resolveFileOpen','foregroundChanged','scheduleSyncStatus','renderProfile','firstStartOpen','renderFirstStart','scheduleUpdate','connectDevice','connectDrive','openHistory'],'Backup controls input');
  if(!Object.isFrozen(input.controller)||!Object.isFrozen(input.processing)||!Object.isFrozen(input.protection)||!Object.isFrozen(input.providers)||!Object.isFrozen(input.presentation))throw new TypeError('Backup controls providers must be frozen.');
  const {document,controller,processing,protection,providers,presentation}=input;
  let installed=false,fileWorkHold:ReturnType<typeof providers.suspendBackground>|null=null;
  const button=(id:string)=>{const node=document.getElementById(id);return node instanceof HTMLButtonElement?node:null;};
  const element=(id:string)=>{const node=document.getElementById(id);return node instanceof HTMLElement?node:null;};

  function renderFile(){
    const state=controller.status(),exporting=state.standaloneExportActive;
    const exportButton=button('download-backup'),cancel=button('cancel-standalone-import'),importCancel=button('cancel-backup-import'),note=element('backup-file-status');
    if(exportButton){exportButton.disabled=exporting;exportButton.setAttribute('aria-busy',exporting?'true':'false');exportButton.textContent=exporting?'Preparing backup…':'Export backup…';}
    if(cancel)cancel.hidden=!(exporting||processing.status().fileBusy);
    if(importCancel)importCancel.hidden=!state.importHoldsBackground;
    if(note){const event=presentation.current('file'),message=presentation.summary(event);note.hidden=!message;if(note.textContent!==message)note.textContent=message;note.dataset['state']=event?.severity==='error'?'error':'ok';}
  }
  function toggleSettings(kind:unknown){
    if(kind!=='device'&&kind!=='drive')return false;
    const panel=element(`${kind}-backup-settings-panel`),settings=button(`${kind}-backup-settings`);
    if(!panel||!settings||settings.hidden)return false;
    panel.hidden=!panel.hidden;settings.setAttribute('aria-expanded',panel.hidden?'false':'true');return !panel.hidden;
  }
  function renderDrive(){
    const state=providers.locationStatus('google-drive');if(!state)return;
    const status=element('backup-provider-row-status-google-drive'),connect=button('connect-drive-backup'),cancel=button('cancel-drive-backup'),settings=button('drive-backup-settings'),panel=element('drive-backup-settings-panel'),last=element('drive-backup-settings-last'),disconnect=button('disconnect-drive-backup');
    const connected=state.connected,working=state.busy||state.backingUp;
    if(status){status.textContent=presentation.locationLabel('google-drive',state);status.classList.toggle('protected',connected&&!working);status.classList.toggle('standard',!connected||working);}
    if(connect){const label=state.wasConnected?'Reconnect':'Connect';connect.hidden=connected;connect.textContent=label;connect.disabled=state.engineBusy;connect.setAttribute('aria-label',`${label} Google Drive`);}
    if(cancel){cancel.hidden=!state.cancellable;cancel.disabled=!state.cancellable;}
    if(settings){settings.hidden=!connected;settings.disabled=state.engineBusy;settings.setAttribute('aria-expanded',panel&&!panel.hidden?'true':'false');}
    if(panel&&!connected)panel.hidden=true;
    if(last){const at=input.verifiedAt('google-drive');last.textContent=at?`Last backup ${input.timeLabel(at)}`:'No backup yet';}
    if(disconnect)disconnect.disabled=state.engineBusy;
    renderActions();input.renderProfile();if(input.firstStartOpen())input.renderFirstStart();
  }
  function renderActions(){
    const group=element('backup-shared-actions'),backupNow=button('backup-now'),versions=button('open-version-history');if(!group)return;
    const rows=['device-folder','google-drive'].map(id=>providers.locationStatus(id)).filter(row=>row!==null);
    const connected=rows.some(row=>row.connected===true),busy=rows.some(row=>row.busy===true||row.engineBusy===true),recovering=rows.some(row=>row.busy===true&&['history','restore-version','bring-in','remove-version'].includes(String(row.foregroundKind||'')));
    const syncText=rows.some(row=>row.sync?.syncing===true)?'Syncing with Google Drive…':'';
    group.hidden=!connected;
    if(backupNow){backupNow.disabled=busy;backupNow.title=busy&&syncText?syncText:rows.some(row=>row.maintenanceBusy)?'Background backup maintenance will yield to Back up now.':'';}
    if(versions){versions.disabled=busy&&!recovering;versions.title=recovering?'Reopen the active recovery operation.':busy&&syncText?syncText:'';}
  }
  async function backUpEverywhere(){
    let done=false;const device=input.device();
    if(device?.status().connected)done=await device.backupNow()!==false||done;
    if(providers.connected('google-drive'))done=await providers.backup('google-drive')!==false||done;
    return done;
  }
  function renderDevice(state:DeviceStatus){
    input.scheduleSyncStatus();
    const status=element('device-backup-status'),actions=element('device-backup-actions'),connect=button('connect-device-backup'),cancel=button('cancel-device-backup'),settings=button('device-backup-settings'),panel=element('device-backup-settings-panel'),settingsState=element('device-backup-settings-state'),folderName=element('device-backup-folder-name'),repositoryName=element('device-backup-repository-name'),settingsLast=element('device-backup-settings-last'),disconnect=button('disconnect-device-backup'),note=element('device-backup-note');
    const connected=state.connected===true,operationBusy=state.busy||state.maintenanceBusy===true,recoveryActive=state.busy===true&&['history','restore-version','bring-in'].includes(String(state.foregroundKind||'')),last=state.lastBackupAt?input.timeLabel(state.lastBackupAt):'';
    if(status){status.textContent=presentation.locationLabel('device-folder',state);status.classList.toggle('protected',connected&&!operationBusy);status.classList.toggle('standard',!connected||operationBusy);status.title=state.lastBackupAt||'';}
    if(actions)actions.hidden=!state.supported;
    if(connect){connect.hidden=connected;connect.disabled=operationBusy;connect.textContent=state.mode==='permission'?'Allow access':'Choose folder…';}
    if(cancel){cancel.hidden=state.cancellable!==true;cancel.disabled=state.cancellable!==true;}
    if(settings){settings.hidden=!connected;settings.disabled=operationBusy;settings.setAttribute('aria-expanded',panel&&!panel.hidden?'true':'false');}
    if(panel&&!connected)panel.hidden=true;
    if(settingsState)settingsState.textContent=connected?'On':'Off';
    if(folderName)folderName.textContent=state.folderName||'Connected folder';
    if(repositoryName)repositoryName.textContent=state.repositoryName||'—';
    if(settingsLast)settingsLast.textContent=last?`Last backup ${last}`:'No backup yet';
    if(disconnect){disconnect.hidden=!connected;disconnect.disabled=operationBusy;}
    if(note){
      const fallback=state.mode==='unsupported'?'Automatic folder backup is unavailable in this browser. Portable and Google Drive backups still work.':connected?(state.pending?'Changes wait for the next automatic backup.':'Your automatic backup is up to date.'):'';
      const message=state.hasNote?'':fallback;note.hidden=!message||recoveryActive;if(note.textContent!==message)note.textContent=message;
    }
    renderActions();if(state.installed&&!operationBusy)input.scheduleUpdate(250);
  }
  function renderPresentation(){
    renderFile();
    for(const source of ['device-folder','google-drive'] as const){
      const note=element(`backup-operation-note-${source}`);if(!note)continue;
      const event=presentation.current(source),message=presentation.summary(event);note.hidden=!message;if(note.textContent!==message)note.textContent=message;
      const failed=event?.severity==='error';note.dataset['state']=failed?'error':'ok';note.classList.toggle('ui-status',failed);note.classList.toggle('err',failed);
    }
  }
  function syncFileHold(){
    const state=controller.status(),active=!!(state.importHoldsBackground||state.standaloneExportActive);
    if(active&&!fileWorkHold){
      try{fileWorkHold=providers.suspendBackground('file-backup');if(fileWorkHold)void Promise.resolve(fileWorkHold.settled).catch(()=>{});}
      catch(error){fileWorkHold=null;input.capture('backup.file-hold',error);}
    }else if(!active&&fileWorkHold){
      const hold=fileWorkHold;fileWorkHold=null;try{hold.release();}catch(error){input.capture('backup.file-hold-release',error);}
    }
    input.foregroundChanged();
  }
  function install(){
    if(installed)return false;installed=true;
    controller.subscribeStatus(()=>{renderFile();syncFileHold();});
    presentation.subscribe(renderPresentation);
    renderFile();syncFileHold();return true;
  }
  async function withPassword<T>(open:()=>T|PromiseLike<T>):Promise<Awaited<T>>{
    try{const state=protection.status();if(state.enabled&&!state.unlocked)await protection.ask();}catch(error){input.surfaceError(error);}
    return await open();
  }
  const openHistory=()=>withPassword(()=>input.openHistory());
  async function manageProtection(){try{return await protection.manage();}catch(error){if(!(error&&typeof error==='object'&&(error as {name?:unknown}).name==='AbortError'))input.surfaceError(error);return false;}}
  const exportLocal=()=>controller.exportLocal();
  function importLocal(event:Event){
    if(!(event.target instanceof HTMLInputElement))return false;
    return controller.importLocal({target:event.target});
  }
  async function pickImportFile(){
    const inputNode=document.getElementById('import-file');
    if(!(inputNode instanceof HTMLInputElement)){presentation.condition('file','file-open','Could not open backup: the file input is unavailable.');return false;}
    try{const file=await processing.open(inputNode);if(!file)return false;input.resolveFileOpen();await controller.importLocal({target:{files:[file],value:''}});return true;}
    catch(error){if(error&&typeof error==='object'&&(error as {name?:unknown}).name==='AbortError')return false;const fields=error&&typeof error==='object'?error as {message?:unknown}:null;presentation.condition('file','file-open','Could not open backup: '+String(fields?.message||error));return false;}
  }
  const cancelStandalone=(reason?:string)=>controller.cancelStandalone(reason);
  const connectDevice=()=>input.connectDevice();
  const cancelDevice=(reason?:string)=>input.device()?.cancelForeground(reason)??false;
  const disconnectDevice=()=>input.device()?.disconnect()??false;
  const connectDrive=()=>input.connectDrive();
  const cancelDrive=(reason?:string)=>providers.cancelForeground(reason,'google-drive');
  const disconnectDrive=()=>providers.disconnect('google-drive');
  return freeze({format:'study-director.backup-controls' as const,contractVersion:1 as const,install,renderFile,renderDrive,renderDevice,renderActions,toggleSettings,backUpEverywhere,withPassword,openHistory,manageProtection,exportLocal,importLocal,pickImportFile,cancelStandalone,connectDevice,cancelDevice,disconnectDevice,connectDrive,cancelDrive,disconnectDrive});
}

function createDeviceBackup(input:Readonly<DeviceBackupCompositionInput>){
  exactObject(input,['module','storageModule','configuration','engine','environment','hooks','presentation','settings','storage'],'Device Backup host input');
  if(!Object.isFrozen(input.module)||input.module.format!=='study-director.device-backup-module'||input.module.contractVersion!==1)throw new TypeError('Device Backup module is unavailable or incompatible.');
  if(!Object.isFrozen(input.storageModule)||input.storageModule.format!=='study-director.device-folder-storage-module'||input.storageModule.contractVersion!==1)throw new TypeError('Device Folder storage module is unavailable or incompatible.');
  const storage=input.storage;
  if(!Object.isFrozen(storage)||!Object.isFrozen(storage.identities)||!Object.isFrozen(storage.environment)||!Object.isFrozen(storage.limits))throw new TypeError('Device Folder storage providers must be frozen.');
  const controller=input.module.createController(freeze({
    configuration:input.configuration,engine:input.engine,environment:input.environment,hooks:input.hooks,presentation:input.presentation,settings:input.settings,
    transport:(folder:Parameters<DeviceBackupInput['transport']>[0],repository:Parameters<DeviceBackupInput['transport']>[1])=>input.storageModule.createStorage(freeze({
      folder,identities:freeze({root:repository,...storage.identities}),owner:storage.owner,checksum:storage.checksum,inspectManifest:storage.inspectManifest,environment:storage.environment,limits:storage.limits
    }))
  }));
  if(!Object.isFrozen(controller)||controller.format!=='study-director.device-backup'||controller.contractVersion!==1)throw new Error('Study Director automatic device backup is unavailable or incompatible.');
  return controller;
}

const createModule=():BackupActionsHostContract=>freeze({format:'study-director.backup-actions-host-module',contractVersion:1,createProtectionHost,createControls,createDeviceBackup});
registry.define('backup-actions-host',1,createModule);
return createModule;
})();
export type BackupActionsHostModule=ReturnType<typeof sdBackupActionsHostFactory>;
