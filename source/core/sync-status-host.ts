import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {BackupStatusInput,LocationView,OperationView} from '../../types/backup-presentation.ts';
import type {SyncStatusHostContract,SyncStatusHostInput,SyncStatusHostController} from '../../types/sync-status-host.ts';

const sdSyncStatusHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'sync-status-host','study-director.sync-status-host-module'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
const {exactFrozenObject:exactObject}=registry.contracts,freeze=Object.freeze;

interface ConnectCardState {
  readonly token:number;
  readonly profile:string;
  readonly startedAt:number;
  phase:'signing-in'|'signed-in'|'failed';
  error:string;
  readonly seen:{sync:boolean;upload:boolean};
  readonly kept:number;
  lastStatus:string;
}
interface ConnectionState {readonly token:number;readonly profile:string}

function createController(input:Readonly<SyncStatusHostInput>):Readonly<SyncStatusHostController>{
  exactObject(input,['document','providers','presentation','device','protection','keptVersions','profileKey','profileEmail','profileName','deviceName','markDriveRequested','storageIssues','unsupportedDataHeld','backupReminder','updateReady','sessionElsewhere','sessionReady','unseen','actions','environment','capture'],'Sync status host input');
  if(!Object.isFrozen(input.presentation)||!Object.isFrozen(input.actions)||!Object.isFrozen(input.environment))throw new TypeError('Sync status host providers must be frozen.');
  const {document,presentation,environment}=input;
  let sequence=0,connection:ConnectionState|null=null,card:ConnectCardState|null=null;
  let renderTimer:number|null=null,settleTimer:number|null=null,hideTimer:number|null=null,lastRing='',installed=false;

  const element=(id:string)=>document.getElementById(id) as HTMLElement|null;
  const currentProfile=()=>String(input.profileKey()||'');

  function clearHideTimer(){
    if(hideTimer!==null)environment.clearTimeout(hideTimer);
    hideTimer=null;
  }
  function reconcileProfile(){
    const profile=currentProfile();
    if(connection&&connection.profile!==profile)connection=null;
    if(card&&card.profile!==profile){clearHideTimer();card=null;}
    return profile;
  }
  function isConnecting(profile=currentProfile()){
    return !!connection&&connection.profile===profile;
  }
  function namedTurnDevice(drive:LocationView|null):LocationView|null{
    if(!drive?.sync)return drive;
    return {...drive,sync:{...drive.sync,turnDevice:drive.sync.turnDevice?input.deviceName(drive.sync.turnDevice):''}};
  }
  function runningOperation():OperationView|null{
    for(const [id,kind] of [['external-sync','sync'],['backup-operation',''],['external-backup','upload']] as const){
      const event=presentation.read('google-drive',id);
      if(event&&event.lifecycle==='running')return {kind:kind||(event.kind==='sync'?'sync':'upload'),message:String(event.message||''),progress:event.progress||null};
    }
    return null;
  }
  function statusInput():BackupStatusInput{
    const profile=reconcileProfile(),rawDrive=input.providers().locationStatus('google-drive'),drive=namedTurnDevice(rawDrive);
    let device=null,protection=null,storage:readonly {source?:string;label?:string;message?:string;level?:string}[]=[];
    try{device=input.device()?.status()||null;}catch{/* Device Backup is deferred during startup. */}
    try{protection=input.protection()?.status()||null;}catch{/* Backup protection is deferred during startup. */}
    try{storage=input.storageIssues();}catch{/* Storage health is deferred during startup. */}
    const connecting=isConnecting(profile),email=input.profileEmail();
    const deviceView:LocationView|null=device&&device.supported?{
      connected:device.connected,mode:device.mode,backingUp:device.backingUp,busy:device.busy,
      maintenanceBusy:device.maintenanceBusy,retryBackoffCapped:device.retryBackoffCapped,
      ...(device.lastBackupAt?{lastBackupAt:device.lastBackupAt}:{})
    }:null;
    const storageView=storage.map(issue=>({
      ...(issue.source===undefined?{}:{source:issue.source}),
      ...(issue.label===undefined?{}:{label:issue.label}),
      ...(issue.message===undefined?{}:{message:issue.message}),
      ...(issue.level===undefined?{}:{level:issue.level})
    }));
    return {
      online:environment.online(),
      drive:drive?{...drive,setUp:drive.connected||drive.wasConnected||!!email,connecting}:connecting?{connecting:true}:null,
      device:deviceView,
      passwordNeeded:!!protection&&protection.enabled&&!protection.unlocked,
      newerData:input.unsupportedDataHeld(),
      kept:input.keptVersions()?.count()||0,
      storage:storageView,
      reminder:input.backupReminder(),
      updateReady:input.updateReady(),
      sessionElsewhere:input.sessionElsewhere(),
      sessionReady:input.sessionReady(),
      operation:runningOperation(),
      unseen:input.unseen()
    };
  }
  function drawStatusHost(host:HTMLElement,model:ReturnType<typeof presentation.status>){
    if(host.dataset['ring']!==model.ring)host.dataset['ring']=model.ring;
    if((host.dataset['badge']||'')!==model.badge)host.dataset['badge']=model.badge;
    host.toggleAttribute('data-slow',model.slow);
    const many=(value:number)=>value>9?'9+':String(value);
    const badge=host.querySelector<HTMLElement>('.status-badge');
    const text=model.badge==='review'&&model.count>1?many(model.count):model.badge==='info'&&model.unseen>1?many(model.unseen):['error','warning'].includes(model.badge)?'!':model.badge==='update'?'↑':'';
    if(badge&&badge.textContent!==text)badge.textContent=text;
  }
  function renderPanel(model:ReturnType<typeof presentation.status>){
    const dialog=document.getElementById('profile-dialog');if(!(dialog instanceof HTMLDialogElement)||!dialog.open)return;
    const headline=element('profile-status-headline');if(headline&&headline.textContent!==model.headline)headline.textContent=model.headline;
    const detail=element('profile-status-detail');if(detail)detail.textContent=model.detail;
    const primary=document.getElementById('profile-status-primary');
    if(primary instanceof HTMLButtonElement){
      primary.hidden=!model.action;
      if(model.action){primary.textContent=model.action.label;primary.dataset['syncAction']=model.action.action;primary.classList.toggle('profile-act-quiet',model.action.action==='sync-now');}
    }
    const list=element('profile-status-items'),key=JSON.stringify(model.items);
    if(list&&list.dataset['key']!==key){
      list.dataset['key']=key;
      list.replaceChildren(...model.items.map(item=>{
        const row=document.createElement('li');row.className='profile-status-item';row.dataset['tone']=item.tone;row.dataset['item']=item.id;
        const mark=document.createElement('span');mark.className='profile-status-mark';mark.setAttribute('aria-hidden','true');
        const text=document.createElement('span');text.className='profile-status-text';text.textContent=item.text;
        const button=document.createElement('button');button.type='button';button.className='profile-act ui-btn';button.dataset['action']='sync-status-action';button.dataset['syncAction']=item.action;button.textContent=item.actionLabel;
        row.append(mark,text,button);return row;
      }));
    }
  }
  function schedule(){
    if(renderTimer!==null)return false;
    renderTimer=environment.setTimeout(()=>{renderTimer=null;render();},0);
    return true;
  }
  function render(){
    renderTimer=null;
    let model:ReturnType<typeof presentation.status>;
    try{model=presentation.status(statusInput());}
    catch(error){input.capture('sync-status.render',error);return false;}
    const hosts:HTMLElement[]=[];
    for(const id of ['profile-tag','profile-badge','profile-avatar']){const host=element(id);if(host)hosts.push(host);}
    if(lastRing==='syncing'&&model.ring==='synced'){
      if(settleTimer!==null)environment.clearTimeout(settleTimer);
      for(const host of hosts)host.classList.add('status-settle');
      settleTimer=environment.setTimeout(()=>{settleTimer=null;for(const host of hosts)host.classList.remove('status-settle');},1400);
    }
    lastRing=model.ring;
    for(const host of hosts)drawStatusHost(host,model);
    const name=input.profileName(),tag=element('profile-tag'),badge=element('profile-badge');
    if(tag){tag.title=`${model.label} — profile and sync`;tag.setAttribute('aria-label',`Profile: ${name} · ${model.label}`);}
    if(badge){badge.title=model.label;badge.setAttribute('aria-label',`Profile: ${name} · ${model.label}`);}
    renderPanel(model);renderConnectCard();return model;
  }
  function startConnectCard(profile:string,token:number){
    clearHideTimer();
    card={token,profile,startedAt:environment.now(),phase:'signing-in',error:'',seen:{sync:false,upload:false},kept:input.keptVersions()?.count()||0,lastStatus:''};
  }
  function endConnectCard(){
    clearHideTimer();
    const had=card!==null;card=null;
    const root=element('drive-connect-card');if(root)root.hidden=true;
    return had;
  }
  function settleConnection(token:number,profile:string,ok:boolean){
    if(!connection||connection.token!==token||connection.profile!==profile||currentProfile()!==profile)return false;
    connection=null;
    if(card&&card.token===token&&card.profile===profile&&card.phase==='signing-in'){
      if(ok)card.phase='signed-in';
      else{
        const event=presentation.read('google-drive','backup-status');
        card.phase='failed';
        card.error=String(event?.message||'').replace(/^Connection failed:\s*/u,'')||'Sign-in didn’t finish.';
      }
    }
    schedule();return true;
  }
  function connectDriveForProfile(){
    const profile=currentProfile(),token=++sequence;
    input.markDriveRequested();connection={token,profile};startConnectCard(profile,token);schedule();
    let result:ReturnType<ReturnType<typeof input.providers>['connect']>;
    try{result=input.providers().connect('google-drive');}
    catch(error){settleConnection(token,profile,false);throw error;}
    void Promise.resolve(result).then(value=>{settleConnection(token,profile,value===true);},()=>{settleConnection(token,profile,false);});
    return result;
  }
  function renderConnectCard(){
    const profile=reconcileProfile(),state=card;
    if(!state||state.profile!==profile)return null;
    let model:ReturnType<typeof presentation.connectProgress>;
    try{
      const drive=namedTurnDevice(input.providers().locationStatus('google-drive')),operation=runningOperation();
      if(drive?.sync?.syncing||operation?.kind==='sync')state.seen.sync=true;
      if(operation?.kind==='upload'&&['upload','commit','complete'].includes(String(operation.progress?.stage||'')))state.seen.upload=true;
      model=presentation.connectProgress({phase:state.phase,error:state.error,startedAt:state.startedAt,online:environment.online(),drive,operation,seen:state.seen,keptNew:Math.max(0,(input.keptVersions()?.count()||0)-state.kept)});
    }catch(error){input.capture('drive-connect-card.render',error);const root=element('drive-connect-card');if(root)root.hidden=true;return false;}
    const root=element('drive-connect-card');
    if(root){
      root.hidden=false;root.dataset['tone']=model.tone;
      const title=element('drive-connect-title');if(title&&title.textContent!==model.title)title.textContent=model.title;
      const status=element('drive-connect-status');if(status&&state.lastStatus!==model.status){state.lastStatus=model.status;status.textContent=model.status;}
      const inline=model.action?.step?model.action:null,list=element('drive-connect-steps'),key=JSON.stringify([model.steps,inline]);
      if(list&&list.dataset['key']!==key){
        list.dataset['key']=key;
        list.replaceChildren(...model.steps.map(step=>{
          const item=document.createElement('li');item.dataset['state']=step.state;if(step.state==='active')item.setAttribute('aria-current','step');
          const label=document.createElement('span');label.textContent=step.label||'';item.append(label);
          if(inline&&inline.step===step.id){const link=document.createElement('button');link.type='button';link.className='drive-connect-step-action';link.dataset['action']='sync-status-action';link.dataset['syncAction']=inline.action;link.textContent=inline.label;item.append(link);}
          return item;
        }));
      }
      const bar=element('drive-connect-bar'),showBar=model.tone==='working'&&state.phase!=='signing-in'&&!model.steps.some(step=>step.state==='waiting');
      if(bar){
        bar.hidden=!showBar;bar.dataset['mode']=model.fraction===null?'indeterminate':'determinate';
        if(bar.firstElementChild instanceof HTMLElement)bar.firstElementChild.style.width=model.fraction===null?'':`${Math.round(model.fraction*100)}%`;
      }
      const detail=element('drive-connect-detail');if(detail){detail.hidden=!model.detail;if(detail.textContent!==model.detail)detail.textContent=model.detail;}
      const action=document.getElementById('drive-connect-action');
      if(action instanceof HTMLButtonElement){action.hidden=!model.action||!!inline;if(model.action&&!inline){action.dataset['syncAction']=model.action.action;if(action.textContent!==model.action.label)action.textContent=model.action.label;}}
    }
    if(model.done&&hideTimer===null){
      const expected=state;
      hideTimer=environment.setTimeout(()=>{
        hideTimer=null;
        if(card===expected&&currentProfile()===expected.profile)endConnectCard();
      },6000);
    }
    return model;
  }
  function connectCardOpen(){reconcileProfile();return card!==null;}
  async function action(event:Event){
    const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-sync-action]'):null;
    const kind=String(target?.dataset['syncAction']||'');
    if(!['sync-now','retry','sign-in'].includes(kind))input.actions.closeProfilePanel();
    try{
      switch(kind){
        case 'sync-now':case 'retry':input.providers().scheduleSharedSync('google-drive',kind==='retry'?'sync-retry':'sync-now',{skipTurn:kind==='sync-now'});schedule();return true;
        case 'sign-in':return await connectDriveForProfile();
        case 'enter-password':return await input.actions.enterPassword();
        case 'unlock-sync':return await input.providers().unlockSync('google-drive');
        case 'check-update':return await input.actions.checkUpdate();
        case 'apply-update':return await input.actions.applyUpdate();
        case 'review-sync':return await input.providers().reviewSync('google-drive');
        case 'review-kept':return await input.keptVersions()?.review();
        case 'device-permission':return await input.actions.connectDevice();
        case 'open-execute':return await input.actions.openExecute();
        case 'continue-session':return await input.actions.continueSession();
        case 'open-data':return await input.actions.openData();
        default:return false;
      }
    }catch(error){input.capture('sync-status.action',error);return false;}
  }
  function install(){
    if(installed)return false;installed=true;
    for(const type of ['online','offline'])environment.window.addEventListener(type,schedule);
    environment.window.addEventListener('online',()=>{try{input.providers().wakeBackground('online');}catch(error){input.capture('backup-provider.online-wake',error);}});
    document.addEventListener('visibilitychange',()=>{if(environment.visible())schedule();});
    environment.setInterval(()=>{if(environment.visible())schedule();},30*1000);
    input.providers().subscribeStatus(schedule);
    presentation.subscribe(schedule);
    schedule();return true;
  }
  return freeze({format:'study-director.sync-status-host' as const,contractVersion:1 as const,schedule,render,renderConnectCard,action,connectDriveForProfile,endConnectCard,connectCardOpen,install});
}
const createModule=():SyncStatusHostContract=>freeze({format:'study-director.sync-status-host-module' as const,contractVersion:1 as const,createController});
registry.define('sync-status-host',1,createModule);return createModule;
})();
export type SyncStatusHostModule=ReturnType<typeof sdSyncStatusHostFactory>;
