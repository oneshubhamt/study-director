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
// timing all run through the engine, the same way as for every location.
registry.define('device-backup',1,()=>{
  const freeze=Object.freeze;
  const ID='device-folder',LABEL='Device Folder',FORMAT='study-director.device-folder-settings',VERSION=4;
  // A stored folder with no recorded baseline still backs up on its own.
  const EPOCH='1970-01-01T00:00:00.000Z';
  function createController(input){
    exactObject(input,['configuration','engine','environment','hooks','presentation','settings','transport'],'Device-backup input');
    exactObject(input.configuration,['metadataKey','pickerId','settingsTimeoutMs'],'Device-backup configuration');
    exactObject(input.environment,['backgroundBlocker','canMutate','clearTimeout','setTimeout','showDirectoryPicker','withLock'],'Device-backup environment');
    functions(input.engine,['backup','cancelForeground','disconnect','forget','locationStatus','register','subscribeStatus'],'Device-backup engine port');
    functions(input.settings,['read','remove','write'],'Device-backup settings port');
    functions(input.hooks,['capture','chooseRepository','render','repositoryOwner','sourceRevision','verifiedAt'],'Device-backup hooks');
    if(typeof input.transport!=='function')throw new TypeError('Device-backup transport port is invalid.');
    if(!Object.isFrozen(input.presentation)||['current','feedback','notice','read','resolve','reset'].some(key=>typeof input.presentation[key]!=='function'))throw new TypeError('Backup presentation port is invalid.');
    const {configuration:config,engine,environment,settings,hooks,presentation}=input;
    const supported=typeof environment.showDirectoryPicker==='function';
    let installed=false,handle=null,permission='unknown',baseline='',mode=supported?'off':'unsupported',settingsUnverified=supported,connectionListener=null,connecting=false,permissionNoticeShown=false;
    // The repository folder inside the chosen folder this profile and device
    // use; '' until it is settled (found, moved in or made).
    let repositoryName='',preparing=null,oldFolder=false;

    function capture(scope,error){try{hooks.capture(scope,error);}catch{}}
    const connected=()=>supported&&!!handle&&permission==='granted'&&!!repositoryName;
    const sourceRevision=()=>{try{const value=String(hooks.sourceRevision()||'');return Number.isFinite(Date.parse(value))?value:'';}catch{return '';}};
    function snapshot(){
      const engineState=supported?engine.locationStatus(ID):null;
      return freeze({
        format:'study-director.device-backup-status',contractVersion:1,
        installed,supported,mode,connected:connected(),permission,folderName:handle&&typeof handle.name==='string'?handle.name:'',
        busy:engineState?.busy===true||connecting||!!preparing,cancellable:engineState?.cancellable===true,foregroundKind:connecting?'connect':preparing?'prepare':String(engineState?.foregroundKind||''),
        backingUp:engineState?.backingUp===true,maintenanceBusy:engineState?.maintenanceBusy===true,paused:engineState?.paused===true,locked:engineState?.locked===true,pending:engineState?.waiting===true,nextEligibleAt:String(engineState?.nextEligibleAt||''),
        retryAttempt:Number(engineState?.retryAttempt)||0,retryBackoffCapped:engineState?.retryBackoffCapped===true,repositoryName,oldFolder,
        lastBackupAt:String(hooks.verifiedAt()||'')||null,
        // The row's inline note shows the location's messages; this says whether it has one.
        hasNote:!!presentation.current(ID)
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
      if(!value||typeof value!=='object'||value.format!==FORMAT||Number(value.version)!==VERSION)return null;
      const stored=value.directoryHandle;
      if(!stored||typeof stored.getDirectoryHandle!=='function'||typeof stored.queryPermission!=='function')return null;
      return freeze({directoryHandle:stored,baseline:Number.isFinite(Date.parse(value.baseline||''))?String(value.baseline):''});
    }
    // The folder and the change from which it backs up on its own; when it last
    // backed up lives in the verified-copy record.
    const settingsValue=()=>({format:FORMAT,version:VERSION,directoryHandle:handle,baseline});
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
      handle=null;permission='unknown';baseline='';repositoryName='';oldFolder=false;mode=supported?'off':'unsupported';
      presentation.resolve(ID,'permission');if(text)presentation.feedback(ID,text,false);
      publish();
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
    const {layout:rawLayout,...engineTransport}=input.transport(()=>handle,()=>repositoryName);
    const transport=guardTransport(engineTransport),layout=guardTransport(rawLayout);
    // Settles which repository folder this profile and device use: its own
    // (known by the marker inside), the folder of earlier versions moved into a
    // new one named for the profile and device, one the person picks from those
    // already there (only when choosing a folder), or a new one. Only the tab
    // that writes prepares it, one at a time (a Web Lock), so two tabs opened
    // together never move the same files.
    function prepareRepository({choose=false}={}){
      if(repositoryName)return Promise.resolve(repositoryName);
      if(preparing)return preparing;
      if(!environment.canMutate())return Promise.reject(Object.assign(new Error('Another tab is writing; it prepares the backup folder.'),{name:'AbortError'}));
      const target=handle;
      preparing=environment.withLock(async()=>{
        publish();
        const mine=hooks.repositoryOwner(),found=await layout.inspect();
        if(handle!==target)throw Object.assign(new Error('The backup folder changed.'),{name:'AbortError'});
        const mineRows=found.repositories.filter(row=>row.scope===mine.scope&&row.device===mine.device);
        // A move whose old folder has since gone is finished with what it has.
        const own=mineRows.find(row=>!row.moving)||(!found.legacy&&mineRows[0])||null;
        // Folders of other devices can be taken over (after a browser data
        // clear this device has a new id); other profiles here keep theirs.
        const offered=found.repositories.filter(row=>row.device!==mine.device);
        let name='';
        if(own){
          name=own.name;
          // The profile took another id (a Drive library from another device).
          if(own.profile!==mine.profile||own.moving)await layout.claim(own.name);
        }else if(found.legacy&&found.legacy.versions>0){
          presentation.feedback(ID,'Moving backups to a folder named for this profile and device…');publish();
          name=await layout.move(mine.name,{onProgress:(done,total)=>{presentation.feedback(ID,`Moving backups to “${mine.name}”… ${done} of ${total} files`);publish();}});
          presentation.feedback(ID,`Backups moved to “${name}”.`);
        }else if(choose&&offered.length){
          const picked=await hooks.chooseRepository(offered);
          if(picked===null)throw Object.assign(new Error('Folder selection was cancelled.'),{name:'AbortError'});
          name=picked?await layout.claim(picked):await layout.create(mine.name);
        }else name=await layout.create(mine.name);
        // The old folder goes once its versions are in this one (a move that
        // could not delete it), or when it never held a version.
        if(found.legacy&&(!found.legacy.versions||own?.movedFrom===found.legacy.name))await layout.removeLegacy().catch(error=>capture('device-backup.remove-old-folder',error));
        // Whether the folder of earlier versions is still there (diagnostics).
        oldFolder=found.legacy?await layout.legacyPresent().catch(()=>true):false;
        if(handle!==target)throw Object.assign(new Error('The backup folder changed.'),{name:'AbortError'});
        repositoryName=name;return name;
      }).finally(()=>{preparing=null;connectionChanged();});
      return preparing;
    }
    function prepareFailed(error){
      if(error?.name==='AbortError')return;
      capture('device-backup.prepare',error);presentation.feedback(ID,`${String(error?.message||'The backup folder could not be prepared.')} Normal app saving continues.`,false);publish();
    }
    // In the background it waits for the shared gate (start-up finished, this
    // tab writes, no browser-data clear unresolved); wake() tries again when
    // the gate opens.
    function prepareInBackground(){
      if(!connectedFolder()||repositoryName||preparing)return;
      let blocked='';try{blocked=String(environment.backgroundBlocker()||'');}catch(error){capture('device-backup.background-gate',error);blocked='unavailable';}
      if(blocked)return;
      prepareRepository().catch(prepareFailed);
    }
    // Back up now also finishes preparing the folder (a move that stopped).
    async function backupNow(){
      if(!supported)return false;
      if(connectedFolder()&&!repositoryName){try{await prepareRepository();}catch(error){prepareFailed(error);return false;}}
      return engine.backup(ID);
    }
    const connectedFolder=()=>supported&&!!handle&&permission==='granted';
    async function authorize({operation=''}={}){
      if(operation==='disconnect')return;
      if(!handle)throw new Error('Choose the backup folder first.');
      if(permission!=='granted'){permission=await query();if(permission==='prompt')permission=await request();if(permission!=='granted'){permissionNeeded();publish();throw new Error('Folder permission is required. Choose Allow access.');}mode='connected';connectionChanged();}
      await prepareRepository();
    }
    async function disconnectFolder(){
      await settings.remove(config.metadataKey);forgetFolder();
    }
    if(supported&&!engine.register(freeze({
      id:ID,label:LABEL,hosted:true,
      connected,backgroundAvailable:connected,
      automaticBaseline:()=>connected()?baseline||EPOCH:'',
      automaticConfigured:()=>supported&&!!handle,
      subscribeConnection:listener=>{connectionListener=listener;},
      authorize,disconnect:disconnectFolder,disconnectLabel:'Turn off',
      repository:transport
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
      connectionChanged();prepareInBackground();return snapshot();
    }
    // Permission can change while the app is open (another tab, the browser's
    // site settings); it is checked again whenever the app comes back.
    async function refreshPermission(){
      if(!supported||!installed)return snapshot();
      if(settingsUnverified){installed=false;return install();}
      if(!handle)return snapshot();
      const before=permission;permission=await query();
      if(permission===before){prepareInBackground();return snapshot();}
      if(permission==='granted')mode='connected';else permissionNeeded();
      connectionChanged();prepareInBackground();return snapshot();
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
          mode='connected';presentation.feedback(ID,'');prepareInBackground();return snapshot();
        }
        const chosen=await pending;
        if(!chosen||typeof chosen.getDirectoryHandle!=='function')throw new Error('The selected folder is not writable.');
        let granted=await query(chosen);if(granted!=='granted')granted=await request(chosen);
        if(granted!=='granted')throw new Error('Write permission was not granted for the selected folder.');
        if(preparing)await preparing.catch(()=>{});
        const previous=handle,previousName=repositoryName;handle=chosen;permission='granted';repositoryName='';
        try{
          await prepareRepository({choose:true});
          // A folder that already holds backups is kept as it is: this device's
          // data goes in with its next change, or with Back up now.
          const versions=(await transport.list({kind:'commit'})).items.length;
          if(previous!==chosen)await engine.forget(ID);
          baseline=versions?sourceRevision():'';initial=!versions;
          await settings.write(config.metadataKey,settingsValue());settingsUnverified=false;mode='connected';
          presentation.feedback(ID,versions?'Existing Study Director backups found. Open Version History to recover one, or Back up now to keep this device’s current data.':'');
        }catch(error){handle=previous;repositoryName=previous?previousName:'';permission=previous?await query(previous):'unknown';throw error;}
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
    // Delete everywhere: this profile's backup folder in the Device Folder is
    // deleted and Device Folder backup is turned off. Returns the deleted
    // folder's name, or '' when there was none to reach.
    async function deleteBackups(){
      if(!supported||!handle)return '';
      if(preparing)await preparing.catch(()=>{});
      if(permission!=='granted'||!repositoryName)return '';
      const folder=handle,name=repositoryName;
      if(!await engine.disconnect(ID))throw new Error('Device Folder backup could not be turned off, so its backups were not deleted.');
      try{await folder.removeEntry(name,{recursive:true});}catch(error){if(error?.name!=='NotFoundError')throw error;}
      return name;
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
      install,status:snapshot,connect,disconnect,refreshPermission,rememberAfterStorageReset,deleteBackups,
      backupNow,wake:()=>{prepareInBackground();return true;},
      cancelForeground:reason=>supported?engine.cancelForeground(reason,ID):false
    });
  }
  return freeze({format:'study-director.device-backup-module',contractVersion:1,createController});
});
})();
