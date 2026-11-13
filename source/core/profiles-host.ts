import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {ProfileEntry,ProfilesController,ProfilesInput,ProfilesModulePort} from '../../types/profiles.ts';

interface ProfilesControllerHostInput{readonly module:ProfilesModulePort;readonly ports:ProfilesInput['ports']}
interface PanelActionsInput{
  readonly document:Document;
  getStudentName():string;normalizeStudentName(value:unknown):string;applyStudentName(value:string):string;persistUserDefaultName(value:string):unknown;
  renderPanel():unknown;reportError(error:unknown):unknown;
  readonly recent:Readonly<{opened():unknown;closed():unknown}>;
}
interface FirstStartInput{
  readonly document:Document;readonly profiles:ProfilesController;
  readonly backupProtection:Readonly<{enable(password:string):PromiseLike<unknown>}>;
  readonly provider:Readonly<{locationStatus(id:'google-drive'):Readonly<{connected?:boolean;engineBusy?:boolean}>|null}>;
  connectDriveForProfile():boolean|PromiseLike<boolean>;
  getStudentName():string;isDefaultStudentName(value:string):boolean;applyStudentName(value:string):string;persistUserDefaultName(value:string):unknown;renderProfile():unknown;reportError(error:unknown):unknown;
}
interface FirstStartController{
  open():boolean;close():void;render():void;connect():Promise<boolean>;finish():Promise<boolean>;skip():boolean;confirmField():void;key(event:KeyboardEvent):boolean;joined():void;isOpen():boolean;
}
interface LifecycleInput{
  readonly profiles:ProfilesController;readonly firstStart:FirstStartController;
  settleCurrentProfile():PromiseLike<boolean>;getStudentName():string;isDefaultStudentName(value:string):boolean;canonicalLocalRecoveryEmpty():PromiseLike<boolean|null>;
  renderProfile():unknown;appCanMutate():boolean;reportError(error:unknown):unknown;
  readonly backupProtection:Readonly<{ask():PromiseLike<unknown>}>;setBackupProtectionSurfaceError(error:unknown):unknown;
}
interface DriveLibraryInfo{readonly email?:unknown;readonly folder?:unknown;readonly found?:unknown;readonly mine?:unknown;readonly library?:Readonly<{notes?:number;savedAt?:string}>|null}
interface DriveBindingInput{
  readonly profiles:ProfilesController;
  readonly interactions:Readonly<{confirm(input:Readonly<Record<string,unknown>>):Promise<boolean>;notify(input:Readonly<Record<string,unknown>>):unknown}>;
  clearBaseline():PromiseLike<unknown>;renderProfile():unknown;endConnectCard():unknown;firstStartJoined():unknown;capture(scope:string,error:unknown):unknown;
  storageHealthTime(value:string):string;now():number;
}
interface DriveBindingController{
  markRequested():void;bind(info:DriveLibraryInfo|null|undefined):Promise<'refuse'|'continue'|'claim'|'adopt'>;
}
interface DeleteLibraryControl{deleteLibrary():PromiseLike<unknown>}
interface DeletionInput{
  readonly profiles:ProfilesController;
  readonly provider:Readonly<{
    locationStatus(id:'google-drive'):Readonly<{connected?:boolean;waiting?:boolean;sync?:Readonly<{syncedAt?:unknown;syncing?:unknown}>}>|null;
    suspendBackground(reason:string):Readonly<{release():unknown;settled?:PromiseLike<unknown>}>|null;
  }>;
  readonly device:Readonly<{status():Readonly<{connected?:boolean}>;deleteBackups():PromiseLike<unknown>}>;
  readonly interactions:Readonly<{choose(input:Readonly<Record<string,unknown>>):Promise<unknown>;confirm(input:Readonly<Record<string,unknown>>):Promise<boolean>;notify(input:Readonly<Record<string,unknown>>):unknown}>;
  capture(scope:string,error:unknown):unknown;getStudentName():string;renderProfile():unknown;verifiedSourceRevision():string;currentBackupSourceRevision():string;
}
interface ProfileDeletionInfo{readonly profile?:unknown}

interface ProfileViewsInput{
 document:Document;Profiles:ProfilesController;APP_LIMITS:{maxStudentNameChars:number};FACTORY_DEFAULTS:{studentName:string};
 clampText(value:unknown,max:number):string;appCanMutate():boolean;scheduleSyncStatus():unknown;
 driveStatus():{connected?:boolean;engineBusy?:boolean}|null;protectionStatus():{enabled:boolean;unlocked:boolean};deviceName():string;
 AppDiagnostics:{capture(scope:string,error:unknown,level:'warn'):unknown};Interactions:{notify(input:{key:string;title:string;message:string}):unknown};
 connectDrive():unknown;disconnectDrive():unknown;
}
interface ProfileSettlementInput{
 AppOwnership:{canMutate():boolean};AppMutationCoordinator:{settled():PromiseLike<unknown>};appCanMutate():boolean;
 PlanDraftEditor:{flush(options:{strictDurability:true}):boolean|PromiseLike<boolean>};PlanData:{settled():PromiseLike<unknown>};
 settleAttachmentWriters():PromiseLike<unknown>;deletionRecovery:{flush():PromiseLike<boolean>};
 AppDiagnostics:{capture(scope:string,error:unknown,level:'error'):unknown};setPlanStatus(message:string,ok:boolean):unknown;
}

const sdProfilesHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'profiles-host','study-director.profiles-host-module'>|undefined;
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable.');
const createModule=()=>{
function createPlatform(p:Readonly<{indexedDB:IDBFactory;window:Window;localStorage:Storage;storage:StorageManager|undefined;now():number;random(bytes:number):string;reload():void}>):ProfilesInput['ports']['platform']{
 return Object.freeze({
  deleteDatabase:(name:string)=>new Promise((resolve,reject)=>{const request=p.indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve(true);request.onerror=()=>reject(request.error||new Error('A removed profile could not be deleted.'));request.onblocked=()=>reject(new Error('Profile deletion is waiting for another open Study Director tab. Close the other tabs and retry; your recovery data remains protected.'));}),
  listen:(handler:(key:string|null)=>void)=>{const listener=(event:StorageEvent)=>{if(event.storageArea===p.localStorage)handler(event.key);};p.window.addEventListener('storage',listener);return ()=>p.window.removeEventListener('storage',listener);},
  now:p.now,random:p.random,reload:p.reload,
  removeDirectory:async(name:string)=>{const root=await p.storage?.getDirectory?.();if(!root)return;try{await root.removeEntry(name,{recursive:true});}catch(error){if(!(error instanceof Error)||error.name!=='NotFoundError')throw error;}}
 });
}

function createViews(ports:Readonly<ProfileViewsInput>){
const {document,Profiles,APP_LIMITS,FACTORY_DEFAULTS,clampText,appCanMutate,scheduleSyncStatus,AppDiagnostics,Interactions}=ports;
function normalizeStudentName(name:unknown){
  const clean=clampText(String(name||'').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu,' ').trim().replace(/\s+/g,' '),APP_LIMITS.maxStudentNameChars);
  return clean || FACTORY_DEFAULTS.studentName;
}

function applyStudentName(name:unknown){
  const clean=normalizeStudentName(name),mine=Profiles.current();
  // The device-wide profile registry mirrors the synced personal name, but
  // read-only/secondary tabs must never rewrite that device authority.
  // Commit the registry mirror before presenting the new name in this tab.
  if(mine&&mine.name!==clean&&appCanMutate())Profiles.rename(clean);
  document.querySelectorAll('[data-student-name]').forEach(el=>{
    if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)el.value=clean;
    else el.textContent=clean;
  });
  const meta=document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if(meta)meta.setAttribute('content',`${clean} Study Director`);
  renderProfileBadge();
  return clean;
}
function getStudentNameFromDisplay(){
  return normalizeStudentName(document.querySelector('.profile-tag-name')?.textContent||'');
}
function isDefaultStudentName(name:unknown){
  return normalizeStudentName(name)===FACTORY_DEFAULTS.studentName;
}
/* PROFILE: the name tag, the phone letter circle, the Profile panel and the
   first-start form (Add profile opens the same form). The name is the
   library's own (personal preferences, synced); the device's profile list
   mirrors it for the list and the circle. */
function profileInitial(name:unknown){return (Array.from(String(name||'').trim())[0]||'?').toLocaleUpperCase();}
function profileSince(row:Readonly<ProfileEntry>|null|undefined){const at=Date.parse(row?.createdAt||'');return Number.isFinite(at)?new Date(at).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'';}
// Two profiles with the same name are told apart by their Google account, or by when they were made.
function profileLabel(row:Readonly<ProfileEntry>,rows=Profiles.list()){
  const name=row?.name||'New profile',alike=rows.some(other=>other.scope!==row.scope&&(other.name||'New profile')===name);
  return {name,meta:row?.email||(alike&&profileSince(row)?`since ${profileSince(row)}`:'')};
}
function renderProfileBadge(){
  const letter=profileInitial(getStudentNameFromDisplay());
  for(const glyph of document.querySelectorAll('.profile-badge-letter,.profile-avatar-letter'))if(glyph.textContent!==letter)glyph.textContent=letter;
  scheduleSyncStatus();
}

function renderProfilePanel(){
  const dialog=document.querySelector<HTMLDialogElement>('#profile-dialog');if(!dialog?.open)return;
  const mine=Profiles.current(),rows=Profiles.list(),drive=ports.driveStatus(),email=mine?.email||'',protection=ports.protectionStatus();
  // Sync state is the Sync & backups section's; the subtitle names the account.
  const subtitle=document.getElementById('profile-subtitle');if(subtitle){subtitle.textContent=email;subtitle.hidden=!email;}
  const driveValue=document.getElementById('profile-drive-value'),driveAction=document.querySelector<HTMLButtonElement>('#profile-drive-action');
  if(driveValue)driveValue.textContent=drive?.connected?(email||'Connected'):email?`${email} · Signed out`:'Not connected';
  if(driveAction){driveAction.textContent=drive?.connected?'Disconnect':email?'Sign in':'Connect';driveAction.dataset['state']=drive?.connected?'connected':'';driveAction.disabled=!!drive?.engineBusy;}
  const passwordValue=document.getElementById('profile-password-value'),passwordAction=document.getElementById('profile-password-action');
  if(passwordValue)passwordValue.textContent=protection.enabled?(protection.unlocked?'On':'On · Not entered on this device yet'):'Off';
  if(passwordAction)passwordAction.textContent=protection.enabled?(protection.unlocked?'Change…':'Enter…'):'Set…';
  const list=document.getElementById('profile-list'),locked=Profiles.unsupported();
  const unsupportedNote=document.getElementById('profile-unsupported');if(unsupportedNote)unsupportedNote.hidden=!locked;
  const add=document.querySelector<HTMLButtonElement>('#profile-add');if(add)add.disabled=locked;
  const remove=document.querySelector<HTMLButtonElement>('#profile-delete');if(remove)remove.disabled=locked;
  if(list){
    list.replaceChildren(...rows.map(row=>{
      const item=document.createElement('li'),current=row.scope===mine?.scope,{name,meta}=profileLabel(row,rows);item.className='profile-item'+(current?' current':'');
      const avatar=document.createElement('span');avatar.className='profile-item-avatar';avatar.setAttribute('aria-hidden','true');avatar.textContent=profileInitial(name);
      const text=document.createElement('span');text.className='profile-item-text';const strong=document.createElement('strong');strong.textContent=name;text.append(strong);
      if(meta){const small=document.createElement('small');small.textContent=meta;text.append(small);}
      let end;
      if(current){end=document.createElement('span');end.className='profile-item-tag ui-label';end.textContent='This profile';}
      else{end=document.createElement('button');end.type='button';end.className='profile-act ui-btn profile-switch';end.textContent='Switch';end.dataset['action']='switch-profile';end.dataset['profile']=row.id;end.setAttribute('aria-label',`Switch to ${name}`);end.disabled=locked;}
      item.append(avatar,text,end);return item;
    }));
  }
  const device=document.getElementById('profile-device');if(device)device.textContent=`This device: ${ports.deviceName()||'this browser'}`;
  renderProfileBadge();
}
function renderProfile(){renderProfileBadge();renderProfilePanel();}
function reportProfileActionError(error:unknown){
  AppDiagnostics.capture('profile.action',error,'warn');
  Interactions.notify({key:'profile-action',title:'Profile change stopped',message:'Study Director could not safely update the local profile list. Your current profile remains authoritative; retry after browser storage recovers.'});
}

async function profileDriveAction(){return ports.driveStatus()?.connected?ports.disconnectDrive():ports.connectDrive();}
return Object.freeze({profileDriveAction,normalizeStudentName,applyStudentName,getStudentNameFromDisplay,isDefaultStudentName,profileInitial,profileSince,profileLabel,renderProfileBadge,renderProfilePanel,renderProfile,reportProfileActionError});
}
function createSettlement(ports:Readonly<ProfileSettlementInput>){
const {AppOwnership,AppMutationCoordinator,appCanMutate,PlanDraftEditor,PlanData,settleAttachmentWriters,deletionRecovery,AppDiagnostics,setPlanStatus}=ports;
async function settleCurrentProfileWriters(){
  if(!AppOwnership.canMutate())throw new Error('Study Director does not currently have write control.');
  // A mutation already owned by this tab is allowed to finish; only after it
  // settles do we require the ordinary unblocked write state.
  await AppMutationCoordinator.settled();
  if(!appCanMutate())throw new Error('Study Director could not reach a safe write state.');
  if(await Promise.resolve(PlanDraftEditor.flush({strictDurability:true}))===false)throw new Error('The current Plan draft could not be saved.');
  await PlanData.settled();
  // This existing writer barrier closes/settles rich-text and Diary edits,
  // Notes, the current reflection and Active Session.
  await settleAttachmentWriters();
  if(await deletionRecovery.flush()!==true)throw new Error('Pending deletions could not be saved.');
  await AppMutationCoordinator.settled();
  return true;
}
async function settleCurrentProfileBeforeReload(){
  try{return await settleCurrentProfileWriters();}
  catch(error){
    AppDiagnostics.capture('profiles.pre-reload-settlement',error,'error');
    setPlanStatus('Profile change stopped because current work could not be safely saved. Keep this tab open and retry after storage recovers.',false);
    return false;
  }
}
return Object.freeze({settleCurrentProfileWriters,settleCurrentProfileBeforeReload});
}

function createController(input:ProfilesControllerHostInput){
  return input.module.createController(Object.freeze({ports:input.ports}));
}
function createPanelActions(ports:PanelActionsInput){
  const {document}=ports;
  const input=()=>document.getElementById('profile-name-input') as HTMLInputElement|null;
  function saveName(){
    const field=input();if(!field)return false;
    const before=ports.getStudentName(),raw=String(field.value||'').trim();if(!raw){field.value=before;return false;}
    if(ports.normalizeStudentName(raw)===before)return true;
    try{
      const clean=ports.applyStudentName(raw);field.value=clean;ports.persistUserDefaultName(clean);return true;
    }catch(error){
      field.value=before;ports.reportError(error);ports.renderPanel();return false;
    }
  }
  function startRename(){
    const button=document.getElementById('profile-name-button') as HTMLButtonElement|null,field=input();
    if(!button||!field)return false;
    field.value=ports.getStudentName();button.hidden=true;field.hidden=false;field.focus();field.select();return true;
  }
  function finishRename(){
    saveName();
    const button=document.getElementById('profile-name-button') as HTMLButtonElement|null,field=input();
    if(field)field.hidden=true;if(button)button.hidden=false;
  }
  function handleNameKey(event:KeyboardEvent){
    const field=event.target instanceof HTMLInputElement?event.target:null,button=document.getElementById('profile-name-button') as HTMLButtonElement|null;
    if(!field)return true;
    if(event.key==='Enter'){event.preventDefault();field.blur();button?.focus();return false;}
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();field.value=ports.getStudentName();field.blur();button?.focus();return false;}
    return true;
  }
  function open(){
    const dialog=document.getElementById('profile-dialog') as HTMLDialogElement|null;if(!dialog||dialog.open)return false;
    const field=input();if(field)field.value=ports.getStudentName();
    dialog.showModal();ports.renderPanel();ports.recent.opened();return true;
  }
  function close(){const dialog=document.getElementById('profile-dialog') as HTMLDialogElement|null;if(dialog?.open)dialog.close();}
  function install(){
    document.getElementById('first-start-form')?.addEventListener('submit',event=>event.preventDefault());
    document.getElementById('first-start-dialog')?.addEventListener('cancel',event=>event.preventDefault());
    document.getElementById('profile-dialog')?.addEventListener('close',()=>{finishRename();ports.recent.closed();});
  }
  return Object.freeze({open,close,install,startRename,finishRename,handleNameKey,saveName});
}
function createFirstStart(ports:FirstStartInput):Readonly<FirstStartController>{
  const {document,profiles}=ports;let joined=false;
  const node=(id:string)=>document.getElementById(id);
  const field=(id:string)=>document.getElementById(id) as HTMLInputElement|null;
  function showError(message:string){const box=node('first-start-error');if(!box)return;box.textContent=message;box.hidden=!message;}
  function password():Readonly<{value:string;error?:never}|{value?:never;error:string}>{
    const value=String(field('first-start-password')?.value||''),confirm=String(field('first-start-confirm')?.value||'');
    if(!value)return {value:''};
    if(value.length<12)return {error:'Use at least 12 characters for the backup password, or leave it empty.'};
    if(value.length>1024)return {error:'Use at most 1024 characters for the backup password.'};
    if(value!==confirm)return {error:'The two passwords do not match.'};
    return {value};
  }
  async function applyPassword(){
    const chosen=password();
    if(chosen.error){showError(chosen.error);field(chosen.error.includes('match')?'first-start-confirm':'first-start-password')?.focus();return false;}
    if(chosen.value)await ports.backupProtection.enable(chosen.value);
    return true;
  }
  function applyName(){
    const raw=String(field('first-start-name')?.value||'').trim();if(!raw||joined)return;
    const clean=ports.applyStudentName(raw);ports.persistUserDefaultName(clean);
  }
  function render(){
    const mine=profiles.current(),adding=!!(mine&&mine.from!==null);
    const eyebrow=node('first-start-eyebrow'),title=node('first-start-title'),note=node('first-start-note'),skip=node('first-start-skip');
    if(eyebrow)eyebrow.textContent=adding?'New profile':'Welcome';
    if(title)title.textContent=adding?'Add a profile':'Personalise Study Director';
    if(note)note.textContent=adding?'A profile has its own notes, days, plans and backups on this device. Add a password to encrypt its backups, and Google Drive to sync it across devices.':'Everything stays on this device. Add a password to encrypt backups, and Google Drive to sync your devices.';
    if(skip)skip.textContent=adding?'Cancel':'Skip';
    const drive=ports.provider.locationStatus('google-drive'),button=node('first-start-drive') as HTMLButtonElement|null,driveNote=node('first-start-drive-note');
    if(button){button.textContent=drive?.connected?'Google Drive connected':'Connect Google Drive';button.disabled=!!drive?.connected||!!drive?.engineBusy;button.classList.toggle('connected',!!drive?.connected);}
    if(driveNote)driveNote.textContent=drive?.connected?(joined?'Your library is coming to this device.':profiles.current()?.email||'Synced through your Google account.'):'Keeps your devices in sync. You can connect later.';
  }
  function open(){
    const dialog=node('first-start-dialog') as HTMLDialogElement|null;if(!dialog||dialog.open)return false;
    joined=false;showError('');
    for(const id of ['first-start-password','first-start-confirm']){const item=field(id);if(item)item.value='';}
    const name=ports.getStudentName(),nameField=field('first-start-name'),confirmField=node('first-start-confirm-field');
    if(nameField)nameField.value=ports.isDefaultStudentName(name)?'':name;
    if(confirmField)confirmField.hidden=true;
    render();dialog.showModal();setTimeout(()=>field('first-start-name')?.focus(),0);return true;
  }
  function close(){const dialog=node('first-start-dialog') as HTMLDialogElement|null;if(dialog?.open)dialog.close();}
  function fail(error:unknown){
    ports.reportError(error);showError('This profile could not be updated safely. Retry after storage recovers.');return false;
  }
  async function connect(){
    try{
      showError('');if(!await applyPassword())return false;
      const raw=String(field('first-start-name')?.value||'').trim();if(raw)profiles.rename(raw);
      const ok=await ports.connectDriveForProfile();render();return ok;
    }catch(error){return fail(error);}
  }
  async function finish(){
    try{
      showError('');if(!await applyPassword())return false;
      applyName();profiles.finishFirstStart();close();ports.renderProfile();return true;
    }catch(error){return fail(error);}
  }
  function skip(){
    try{
      const mine=profiles.current();if(mine&&mine.from!==null)return profiles.remove();
      profiles.finishFirstStart();close();ports.renderProfile();return true;
    }catch(error){return fail(error);}
  }
  function confirmField(){const confirmation=node('first-start-confirm-field');if(confirmation)confirmation.hidden=!String(field('first-start-password')?.value||'');}
  function key(event:KeyboardEvent){if(event.key==='Enter'&&event.target instanceof HTMLInputElement){event.preventDefault();void finish();return false;}return true;}
  return Object.freeze({open,close,render,connect,finish,skip,confirmField,key,joined:()=>{joined=true;render();},isOpen:()=>!!(node('first-start-dialog') as HTMLDialogElement|null)?.open});
}
function createLifecycle(ports:LifecycleInput){
  const fail=(error:unknown)=>{ports.reportError(error);return false;};
  async function switchProfile(event:unknown){
    try{
      const target=event&&typeof event==='object'&&'target' in event?(event as {target?:unknown}).target:null;
      const element=target instanceof Element?target.closest<HTMLElement>('[data-profile]'):null;
      const id=String(element?.dataset['profile']||'');if(!id)return false;
      if(await ports.settleCurrentProfile()!==true)return false;
      return ports.profiles.switchTo(id);
    }catch(error){return fail(error);}
  }
  async function addProfile(){
    try{
      if(await ports.settleCurrentProfile()!==true)return false;
      return ports.profiles.add();
    }catch(error){return fail(error);}
  }
  async function startProfile(){
    const name=ports.getStudentName(),named=!ports.isDefaultStudentName(name);let mine=ports.profiles.current();
    if(!mine)mine=ports.profiles.ensure(named?name:'',{fresh:!named&&await ports.canonicalLocalRecoveryEmpty()===true});
    else if(named)ports.profiles.rename(name);
    ports.renderProfile();if(mine?.fresh&&ports.appCanMutate())ports.firstStart.open();
  }
  function askProfilePassword(){
    if(ports.profiles.list().length<2||ports.firstStart.isOpen()||!ports.appCanMutate())return;
    void Promise.resolve(ports.backupProtection.ask()).catch(ports.setBackupProtectionSurfaceError);
  }
  return Object.freeze({switchProfile,addProfile,startProfile,askProfilePassword});
}
function createDriveBinding(ports:DriveBindingInput):Readonly<DriveBindingController>{
  let connectRequestedAt=0,libraryQuestion:Promise<boolean>|null=null;
  const CHOICE_WINDOW_MS=5*60*1000;
  function markRequested(){connectRequestedAt=ports.now();}
  async function record(email:string,folder:string){
    const mine=ports.profiles.current();if(!mine)return;
    if(mine.folder!==folder)await ports.clearBaseline();
    ports.profiles.setAccount({email,folder});ports.renderProfile();
  }
  function askToJoin(email:string,library:DriveLibraryInfo['library']){
    const notes=Number.isFinite(library?.notes)?`${library?.notes} note${library?.notes===1?'':'s'}`:'',when=library?.savedAt?ports.storageHealthTime(library.savedAt):'';
    const summary=[notes,when&&`synced ${when}`].filter(Boolean).join(', ');
    return ports.interactions.confirm({
      title:'Continue with your library?',
      message:`${email||'This Google account'} already holds a Study Director library${summary?` (${summary})`:''}.`,
      details:['It comes to this device and is combined with anything already here. Nothing is lost; where both differ, one is shown and the other kept for review.','Choose Not now if this library is not yours.'],
      confirmLabel:'Continue with your library',cancelLabel:'Not now'
    });
  }
  async function bind(info:DriveLibraryInfo|null|undefined):Promise<'refuse'|'continue'|'claim'|'adopt'>{
    const refuse=(message:string)=>{ports.endConnectCard();ports.interactions.notify({key:'drive-profile-refused',title:'Google Drive was not used',message});ports.renderProfile();return 'refuse' as const;};
    try{
      const mine=ports.profiles.current();if(!mine)return 'refuse';
      const email=String(info?.email||''),folder=String(info?.folder||''),found=String(info?.found||''),others=ports.profiles.list().filter(row=>row.scope!==mine.scope);
      const owner=others.find(row=>(!!email&&row.email===email)||(!!found&&row.id===found));
      if(owner)return refuse(`This Google account holds ${owner.name||'another profile'}’s library on this device. Each profile syncs with its own Google account.`);
      if(info?.mine){await record(email,folder);return 'continue';}
      if(!found&&(!info?.library||!others.length)){await record(email,folder);return 'claim';}
      if(ports.now()-connectRequestedAt>CHOICE_WINDOW_MS)return refuse(`${email||'This Google account'} already holds a Study Director library. Connect Google Drive again to choose whether to continue with it.`);
      libraryQuestion??=askToJoin(email,info?.library).finally(()=>{libraryQuestion=null;});
      if(!await libraryQuestion){ports.endConnectCard();ports.renderProfile();return 'refuse';}
      if(found&&!ports.profiles.adopt(found))return refuse('That library belongs to another profile on this device.');
      ports.firstStartJoined();await record(email,folder);return found?'adopt':'claim';
    }catch(error){
      ports.capture('profile.drive-binding',error);
      return refuse('The local profile list could not be updated safely. Retry after browser storage recovers.');
    }
  }
  return Object.freeze({markRequested,bind});
}
function createDeletion(ports:DeletionInput){
  let libraryControl:DeleteLibraryControl|null=null,deletionQuestion:Promise<boolean>|null=null;
  async function deleteHere({drive=false}:Readonly<{drive?:boolean}>={}){
    let hold:Readonly<{release():unknown;settled?:PromiseLike<unknown>}>|null=null;
    try{
      hold=ports.provider.suspendBackground('profile-delete');
      if(hold?.settled)await hold.settled;
      if(drive){if(!libraryControl)throw new Error('Google Drive is not ready yet. Try again in a moment.');await libraryControl.deleteLibrary();}
      await ports.device.deleteBackups();return ports.profiles.remove();
    }catch(error){
      ports.capture('profile.delete',error);
      ports.interactions.notify({key:'profile-delete',title:'The profile was not deleted',message:`${String(error instanceof Error?error.message:error)} Nothing was removed from this device; try again.`});
      return false;
    }finally{hold?.release();}
  }
  async function deleteThisProfile(){
    try{
      const mine=ports.profiles.current();if(!mine)return false;
      const name=ports.getStudentName(),last=ports.profiles.list().length<2,drive=ports.provider.locationStatus('google-drive'),synced=!!(drive?.connected&&drive.sync?.syncedAt&&!drive.waiting&&!drive.sync?.syncing),folder=ports.device.status();
      const afterwards=last?' A new, empty profile starts afterwards.':'';
      const choice=await ports.interactions.choose({
        title:`Delete ${name}?`,message:last?'This is the only profile on this device.':'Other profiles on this device are not changed.',
        choices:[
          {value:'device',label:'Remove from this device',description:(synced?`Its data stays in ${mine.email||'Google Drive'} and in any Device Folder backups.`:'Its data is deleted from this device. Google Drive and Device Folder backups, if any, stay where they are.')+afterwards,kind:'caution'},
          {value:'everywhere',label:'Delete everywhere',description:`Here, in Google Drive (to its Trash) and in this device’s Device Folder backups. Other devices remove it when they next sign in.${afterwards}`,kind:'danger'}
        ]
      });
      if(choice==='device'){
        if(!synced&&!await ports.interactions.confirm({title:`Remove ${name} from this device?`,message:'This profile is not fully synced to Google Drive. Removing it deletes its notes, Saved Days, plans and attachments from this device for good.',details:['Its Device Folder backups and backup files, if any, stay where they are.'],confirmLabel:'Remove from this device',danger:true}))return false;
        return ports.profiles.remove();
      }
      if(choice!=='everywhere')return false;
      if(mine.email&&!drive?.connected){ports.interactions.notify({key:'profile-delete',title:'Sign in to Google Drive first',message:`${name}’s library is in ${mine.email}. Sign in from the Profile panel, then delete the profile everywhere.`});return false;}
      const places=[drive?.connected?`its library in ${mine.email||'Google Drive'} moves to the Drive Trash, where it can be brought back for 30 days`:'',folder.connected?'its Device Folder backups on this device are deleted':''].filter(Boolean);
      const ok=await ports.interactions.confirm({
        title:`Delete ${name} everywhere?`,message:`Its notes, Saved Days, plans, reflections and attachments are deleted from this device${places.length?`; ${places.join('; ')}`:''}.`,
        details:['Other devices remove this profile the next time they sign in to Google Drive.',...(last?['A new, empty profile starts afterwards.']:[])],confirmLabel:'Delete everywhere',danger:true
      });
      return ok?deleteHere({drive:!!drive?.connected}):false;
    }catch(error){
      ports.capture('profile.delete',error);
      ports.interactions.notify({key:'profile-delete',title:'The profile was not deleted',message:'The local profile list could not be updated safely. Nothing was removed; retry after browser storage recovers.'});
      return false;
    }
  }
  async function driveProfileDeleted(info:ProfileDeletionInfo|null|undefined){
    const mine=ports.profiles.current();if(!mine||String(info?.profile||'')!==mine.id||deletionQuestion)return false;
    const name=ports.getStudentName(),synced=ports.verifiedSourceRevision();
    if(synced&&synced===ports.currentBackupSourceRevision())return deleteHere();
    deletionQuestion=ports.interactions.confirm({
      title:`${name} was deleted on another device`,message:'This device has changes that never reached Google Drive.',
      details:['Delete here too: they are deleted with the profile, and so are its Device Folder backups on this device.','Keep on this device: the profile stays here and stops syncing. Connecting Google Drive again starts a new library.'],
      confirmLabel:'Delete here too',cancelLabel:'Keep on this device',danger:true
    }).finally(()=>{deletionQuestion=null;});
    if(await deletionQuestion)return deleteHere();
    ports.profiles.renew();ports.renderProfile();
    ports.interactions.notify({key:'profile-kept',title:`${name} is kept on this device`,message:'It no longer syncs with Google Drive. Connect Google Drive again to start a new library.'});
    return false;
  }
  function setLibraryControl(control:unknown){
    libraryControl=control&&typeof control==='object'&&'deleteLibrary' in control&&typeof (control as {deleteLibrary?:unknown}).deleteLibrary==='function'?control as DeleteLibraryControl:null;
  }
  return Object.freeze({deleteThisProfile,driveProfileDeleted,deleteHere,setLibraryControl});
}
return Object.freeze({format:'study-director.profiles-host-module',contractVersion:1,createPlatform,createViews,createSettlement,createController,createPanelActions,createFirstStart,createLifecycle,createDriveBinding,createDeletion});
};
registry.define('profiles-host',1,createModule);return createModule;
})();
export type ProfilesHostModule=ReturnType<typeof sdProfilesHostFactory>;
