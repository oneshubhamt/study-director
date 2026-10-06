(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
// The Device Folder is one location of the backup engine. This controller
// owns only what is particular to it: the chosen folder, its permission,
// remembering it across launches, and the status row the app renders. Backing
// up, Version History, restore, cleanup, integrity checks and automatic
// timing all run through the engine, the same way as for Google Drive.
registry.define('device-backup',1,()=>{
  const freeze=Object.freeze;
  const ID='device-folder',LABEL='Device Folder',FORMAT='study-director.device-backup-settings',VERSION=3;
  // A stored folder with no recorded baseline still backs up on its own.
  const EPOCH='1970-01-01T00:00:00.000Z';
  function createController(input){
    exactObject(input,['configuration','engine','environment','hooks','presentation','settings','transport'],'Device-backup input');
    exactObject(input.configuration,['metadataKey','pickerId','settingsTimeoutMs'],'Device-backup configuration');
    exactObject(input.environment,['canMutate','clearTimeout','setTimeout','showDirectoryPicker'],'Device-backup environment');
    functions(input.engine,['backup','cancelForeground','disconnect','forget','locationStatus','register','subscribeStatus'],'Device-backup engine port');
    functions(input.settings,['read','remove','write'],'Device-backup settings port');
    functions(input.hooks,['capture','chooseCheckpoint','render','sourceRevision','verifiedAt'],'Device-backup hooks');
    if(typeof input.transport!=='function')throw new TypeError('Device-backup transport port is invalid.');
    if(!Object.isFrozen(input.presentation)||['feedback','notice','read','resolve','reset'].some(key=>typeof input.presentation[key]!=='function'))throw new TypeError('Backup presentation port is invalid.');
    const {configuration:config,engine,environment,settings,hooks,presentation}=input;
    const supported=typeof environment.showDirectoryPicker==='function';
    let installed=false,handle=null,permission='unknown',baseline='',mode=supported?'off':'unsupported',settingsUnverified=supported,connectionListener=null,connecting=false,permissionNoticeShown=false;

    function capture(scope,error){try{hooks.capture(scope,error);}catch{}}
    const connected=()=>supported&&!!handle&&permission==='granted';
    const sourceRevision=()=>{try{const value=String(hooks.sourceRevision()||'');return Number.isFinite(Date.parse(value))?value:'';}catch{return '';}};
    function message(){
      const running=presentation.read(ID),feedback=presentation.read(ID,'backup-status');
      return ((running?.lifecycle==='running'?running:null)||feedback||(running?.lifecycle==='failed'?running:null))?.message||'';
    }
    function snapshot(){
      const engineState=supported?engine.locationStatus(ID):null;
      return freeze({
        format:'study-director.device-backup-status',contractVersion:1,
        installed,supported,mode,connected:connected(),permission,folderName:handle&&typeof handle.name==='string'?handle.name:'',message:message(),
        busy:engineState?.busy===true||connecting,cancellable:engineState?.cancellable===true,foregroundKind:connecting?'connect':String(engineState?.foregroundKind||''),
        backingUp:engineState?.backingUp===true,maintenanceBusy:engineState?.maintenanceBusy===true,pending:engineState?.waiting===true,nextEligibleAt:String(engineState?.nextEligibleAt||''),
        retryAttempt:Number(engineState?.retryAttempt)||0,retryBackoffCapped:engineState?.retryBackoffCapped===true,
        lastBackupAt:String(hooks.verifiedAt()||'')||null,hasOperationSummary:!!presentation.read(ID)&&!presentation.read(ID,'backup-status')
      });
    }
    function publish(){const state=snapshot();try{hooks.render(state);}catch(error){capture('device-backup.render',error);}return state;}
    function connectionChanged(){
      if(connected()){permissionNoticeShown=false;presentation.resolve(ID,'permission');}
      try{connectionListener?.();}catch(error){capture('device-backup.connection',error);}
      publish();
    }
    function feedback(text,ok=true){presentation.feedback(ID,String(text||''),ok);publish();}
    function permissionMessage(){return permission==='prompt'?'Folder permission needs to be renewed. Choose Allow access.':'Folder access is blocked by the browser. Choose Allow access or update this site’s folder permission.';}
    // Someone who backs up to a folder hears once per launch that it needs
    // their permission again; the status row keeps the Allow access button.
    function permissionNeeded(){
      mode='permission';
      if(!permissionNoticeShown){permissionNoticeShown=true;presentation.notice(ID,'permission',`${LABEL} needs your permission again to keep backing up.`);}
    }
    function bounded(operation,label){
      return new Promise((resolve,reject)=>{
        const timer=environment.setTimeout(()=>reject(Object.assign(new Error(`${label} did not respond in time.`),{code:'DEVICE_SETTINGS_TIMEOUT'})),config.settingsTimeoutMs);
        Promise.resolve(operation).then(value=>{environment.clearTimeout(timer);resolve(value);},error=>{environment.clearTimeout(timer);reject(error);});
      });
    }
    function normalizeSettings(value){
      if(!value||typeof value!=='object'||value.format!==FORMAT||Number(value.version)!==VERSION||value.enabled!==true)return null;
      const stored=value.directoryHandle;
      if(!stored||typeof stored.getDirectoryHandle!=='function'||typeof stored.queryPermission!=='function')return null;
      return freeze({directoryHandle:stored,baseline:Number.isFinite(Date.parse(value.sourceRevision||''))?String(value.sourceRevision):''});
    }
    const settingsValue=()=>({format:FORMAT,version:VERSION,enabled:true,directoryHandle:handle,sourceRevision:baseline});
    async function query(target=handle){
      if(!target||typeof target.queryPermission!=='function')return 'denied';
      try{const result=await target.queryPermission({mode:'readwrite'});return ['granted','prompt','denied'].includes(result)?result:'denied';}
      catch(error){capture('device-backup.permission-query',error);return 'denied';}
    }
    async function request(target=handle){
      if(!target||typeof target.requestPermission!=='function')return 'denied';
      try{const result=await target.requestPermission({mode:'readwrite'});return ['granted','prompt','denied'].includes(result)?result:'denied';}
      catch(error){capture('device-backup.permission-request',error);return 'denied';}
    }
    function forgetFolder(text=''){
      handle=null;permission='unknown';baseline='';mode=supported?'off':'unsupported';
      presentation.resolve(ID,'permission');if(text)presentation.feedback(ID,text,false);
    }
    // A folder deleted or moved outside the app is forgotten, so the row
    // offers to choose one again instead of failing every backup.
    let missingHandled=null;
    function folderMissing(){
      if(missingHandled)return missingHandled;
      missingHandled=(async()=>{
        try{await settings.remove(config.metadataKey);}catch(error){capture('device-backup.missing-folder-settings',error);}
        try{await engine.forget(ID);}catch(error){capture('device-backup.missing-folder-forget',error);}
        forgetFolder('The backup folder is no longer available. Choose the backup folder again.');connectionChanged();
      })().finally(()=>{missingHandled=null;});
      return missingHandled;
    }
    const watchMissing=fn=>async(...args)=>{try{return await fn(...args);}catch(error){if(error&&error.code==='DEVICE_FOLDER_MISSING')void folderMissing();throw error;}};
    function guardTransport(transport){
      const out={};
      for(const [key,value] of Object.entries(transport))out[key]=typeof value==='function'?key==='beginOperation'?options=>guardTransport(value(options)):watchMissing(value):value;
      return freeze(out);
    }
    const transport=guardTransport(input.transport(()=>handle));
    async function authorize({operation=''}={}){
      if(operation==='disconnect')return;
      if(!handle)throw new Error('Choose the backup folder first.');
      if(permission!=='granted'){permission=await query();if(permission==='prompt')permission=await request();if(permission!=='granted'){permissionNeeded();publish();throw new Error('Folder permission is required. Choose Allow access.');}mode='connected';connectionChanged();}
    }
    async function disconnectFolder(){
      await settings.remove(config.metadataKey);forgetFolder();
    }
    if(supported&&!engine.register(freeze({
      id:ID,label:LABEL,hosted:true,
      connected,backgroundAvailable:connected,
      automaticBaseline:()=>connected()?baseline||EPOCH:'',
      subscribeConnection:listener=>{connectionListener=listener;},
      authorize,disconnect:disconnectFolder,disconnectLabel:'Turn off',
      repository:freeze({...transport,choose:(choices,{mode:kind='restore-version'}={})=>choices.length<2?choices[0]?.id||null:hooks.chooseCheckpoint(choices,freeze({mode:kind}))})
    })))throw new Error('Device Folder backup location could not be registered.');
    if(supported)engine.subscribeStatus(()=>{if(installed)publish();});

    async function install(){
      if(installed)return snapshot();
      installed=true;
      if(!supported)return publish();
      try{
        const stored=normalizeSettings(await bounded(settings.read(config.metadataKey),'Device Folder settings'));settingsUnverified=false;
        if(!stored){mode='off';return publish();}
        handle=stored.directoryHandle;baseline=stored.baseline;permission=await query();
        if(permission==='granted')mode='connected';else permissionNeeded();
      }catch(error){
        settingsUnverified=true;mode='error';capture('device-backup.restore-settings',error);
        presentation.feedback(ID,'Automatic Device Folder backup settings could not be read. Normal app saving continues.',false);
      }
      connectionChanged();return snapshot();
    }
    // Permission can change while the app is open (another tab, the browser's
    // site settings); it is checked again whenever the app comes back.
    async function refreshPermission(){
      if(!supported||!installed)return snapshot();
      if(settingsUnverified){installed=false;return install();}
      if(!handle)return snapshot();
      const before=permission;permission=await query();
      if(permission===before)return snapshot();
      if(permission==='granted')mode='connected';else permissionNeeded();
      connectionChanged();return snapshot();
    }
    // The folder picker or permission prompt opens from the click itself,
    // before anything is awaited, so the browser allows it.
    async function connect(){
      if(!supported)return publish();
      if(!environment.canMutate()){feedback('Take control in this tab before connecting a backup folder.',false);return snapshot();}
      if(connecting||snapshot().busy)return snapshot();
      const reconnect=!!handle;let pending;
      try{pending=Promise.resolve(reconnect?request():environment.showDirectoryPicker({id:config.pickerId,mode:'readwrite',startIn:'documents'}));}
      catch(error){pending=Promise.reject(error);}
      connecting=true;feedback('Connecting backup folder…');
      let initial=false;
      try{
        if(reconnect){
          permission=await pending;
          if(permission!=='granted'){permissionNeeded();feedback(permissionMessage(),false);return snapshot();}
          mode='connected';presentation.feedback(ID,'');return snapshot();
        }
        const chosen=await pending;
        if(!chosen||typeof chosen.getDirectoryHandle!=='function')throw new Error('The selected folder is not writable.');
        let granted=await query(chosen);if(granted!=='granted')granted=await request(chosen);
        if(granted!=='granted')throw new Error('Write permission was not granted for the selected folder.');
        const previous=handle;handle=chosen;permission='granted';
        try{
          // A folder that already holds backups is kept as it is: this device's
          // data goes in with its next change, or with Back up now.
          const versions=(await transport.list({kind:'commit'})).items.length;
          if(previous!==chosen)await engine.forget(ID);
          baseline=versions?sourceRevision():'';initial=!versions;
          await settings.write(config.metadataKey,settingsValue());settingsUnverified=false;mode='connected';
          presentation.feedback(ID,versions?'Existing Study Director backups found. Choose Versions to recover one, or Back up now to keep this device’s current data.':'');
        }catch(error){handle=previous;permission=previous?await query(previous):'unknown';throw error;}
      }catch(error){
        if(error&&error.name==='AbortError')presentation.feedback(ID,handle?'':'Folder selection was cancelled.');
        else{capture('device-backup.connect',error);presentation.feedback(ID,error?.code==='DEVICE_FOLDER_MISSING'?error.message:`${String(error&&error.message||'The backup folder could not be used safely.')} Normal app saving continues.`,false);}
        return snapshot();
      }finally{connecting=false;connectionChanged();}
      if(initial)await engine.backup(ID);
      return publish();
    }
    async function disconnect(){
      if(!environment.canMutate()){feedback('Take control in this tab before turning off device backup.',false);return snapshot();}
      if(!handle)return snapshot();
      const done=await engine.disconnect(ID);
      if(!done&&handle)feedback('Automatic device backup could not be turned off. Try again; normal app saving continues.',false);
      connectionChanged();return snapshot();
    }
    // Clearing browser data removes the stored folder while this page still
    // holds it. It is written back once local data is whole again, so a later
    // launch finds the same folder.
    async function rememberAfterStorageReset(){
      if(!supported||!handle||!environment.canMutate())return false;
      try{await settings.write(config.metadataKey,settingsValue());settingsUnverified=false;return true;}
      catch(error){capture('device-backup.storage-reset-remember',error);return false;}
    }
    return freeze({
      format:'study-director.device-backup',contractVersion:1,
      install,status:snapshot,connect,disconnect,refreshPermission,rememberAfterStorageReset,
      backupNow:()=>supported?engine.backup(ID):Promise.resolve(false),
      cancelForeground:reason=>supported?engine.cancelForeground(reason,ID):false
    });
  }
  return freeze({format:'study-director.device-backup-module',contractVersion:1,createController});
});
})();
