import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {PrimitivesInput,WorkspaceRouterInput,RecentInput,SystemInput,SoundInput,BackupActionsInput,NavigationUIInput,DelegatedInput,WorkspaceHandler,WorkspaceDescriptor,WorkspaceOpenMeta,WorkspaceCloseMeta,NavigationContext,DepartureContext,NavigationOptions,TabConfig} from '../../types/foundation-host.ts';
import type {NotificationInput,BannerState,Lifecycle} from '../../types/notifications.ts';
import type {NoticeCoordinator,NotificationState,NotificationEvent,RecentState} from './notice-coordinator.ts';
const sdFoundationHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'foundation-host','study-director.foundation-host-module'>|undefined;
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable.');
const createModule=()=>{
function createPrimitives(ports:PrimitivesInput){
const {document,APP_LIMITS,CompletionModel}=ports;
const KeyedRecord=Object.freeze({
  create<T=unknown>(entries:Readonly<Record<string,T>>|null=null){
    const out:Record<string,T>=Object.create(null) as Record<string,T>;
    if(entries)Object.entries(entries).forEach(([key,value])=>{out[String(key)]=value;});
    return out;
  },
  has(record:object|null|undefined,key:unknown){return !!record&&Object.prototype.hasOwnProperty.call(record,String(key));},
  get<T,F=null>(record:Readonly<Record<string,T>>|null|undefined,key:unknown,fallback:F|null=null){return !!record&&Object.prototype.hasOwnProperty.call(record,String(key))?record[String(key)]:fallback;},
  clone<T>(record:Readonly<Record<string,T>>|null|undefined){return this.create(record&&typeof record==='object'?record:null);}
});
function textEl<K extends keyof HTMLElementTagNameMap>(tag:K,className?:string,text?:unknown){
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined&&text!==null)el.textContent=String(text);
  return el;
}
function on<T extends EventTarget>(el:T,type:string,handler:EventListenerOrEventListenerObject,options?:AddEventListenerOptions|boolean){el.addEventListener(type,handler,options);return el;}
function emptyMsg(text:unknown){
  return textEl('div','library-empty ui-status',text);
}
function setProgressSummary(el:HTMLElement|null,done:unknown,total:unknown,measure:string,suffix='',showZero=false){
  if(!el)return;
  const safeDone=Number(done);
  const safeTotal=Number(total);
  el.replaceChildren();
  if(Number.isFinite(safeDone)&&safeTotal>0){
    const pct=Math.round(CompletionModel.fromUnits(safeDone,safeTotal));
    el.append(textEl('span','hi',`${safeDone}/${safeTotal} ${measure||'units'}`),document.createTextNode(suffix||` · ${pct}%`));
  }else if(Number.isFinite(safeDone)&&(safeDone>0||showZero)){
    el.append(textEl('span','hi',`${safeDone} ${measure||'units'}`),document.createTextNode(suffix||' done'));
  }else{
    el.textContent='—';
  }
}
function setElementText(el:HTMLElement|null,value:unknown){
  if(!el)return false;
  const next=String(value??'');
  if(el.textContent===next)return false;
  el.textContent=next;
  return true;
}
function setElementValue(el:{value:string}|null,value:unknown){
  if(!el)return false;
  const next=String(value??'');
  if(el.value===next)return false;
  el.value=next;
  return true;
}
function setElementClass(el:HTMLElement|null,value:string){
  if(!el||el.className===value)return false;
  el.className=value;return true;
}
function setElementHidden(el:HTMLElement|null,value:unknown){
  const next=!!value;if(!el||el.hidden===next)return false;
  el.hidden=next;return true;
}
function setElementDisabled(el:{disabled:boolean}|null,value:unknown){
  const next=!!value;if(!el||el.disabled===next)return false;
  el.disabled=next;return true;
}
function setElementAttribute(el:Element|null,name:string,value:unknown){
  if(!el)return false;
  const next=String(value??'');
  if(el.getAttribute(name)===next)return false;
  el.setAttribute(name,next);return true;
}
function setElementStyle<K extends keyof CSSStyleDeclaration>(el:HTMLElement|null,name:K,value:CSSStyleDeclaration[K]){
  if(!el||el.style[name]===value)return false;
  el.style[name]=value;return true;
}
function setTextSafe(id:string,value:unknown){return setElementText(document.getElementById(id),value);}
function cachedElements(owner:{cache?:Record<string,HTMLElement|null>},spec:Readonly<Record<string,string>>){
  if(owner.cache)return owner.cache;
  const out:Record<string,HTMLElement|null>={};
  Object.entries(spec).forEach(([key,id])=>{out[key]=document.getElementById(id);});
  owner.cache=out;
  return out;
}
function clampText(value:unknown,max=APP_LIMITS.maxNoteChars){
  const text=String(value??'');
  const limit=Math.max(0,Number(max)||0);
  return text.length>limit?text.slice(0,limit):text;
}
function clampArray<T>(arr:readonly T[]|null|undefined,max:number){return Array.isArray(arr)?(arr as readonly T[]).slice(0,Math.max(0,Number(max)||0)):[];}
function wipeObject(obj:Record<string,unknown>|null|undefined){Object.keys(obj||{}).forEach(k=>delete obj![k]);}
function boundedInt(value:unknown,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={}){
  const n=Number(value);
  if(!Number.isFinite(n))return fallback;
  const i=Math.trunc(n);
  return Math.min(max,Math.max(min,i));
}
function boundedNumber(value:unknown,{min=-Number.MAX_SAFE_INTEGER,max=Number.MAX_SAFE_INTEGER,fallback=0}={}){
  const n=Number(value);
  if(!Number.isFinite(n))return fallback;
  return Math.min(max,Math.max(min,n));
}
function safeBoolean(value:unknown){
  if(value===true||value===1)return true;
  if(value===false||value===0||value===null||value===undefined)return false;
  const text=String(value).trim().toLowerCase();
  return text==='true'||text==='1'||text==='yes'||text==='y';
}
function finiteNumber(value:unknown,fallback=0){
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}
function optionalBoundedNumber(value:unknown,{min=-Number.MAX_SAFE_INTEGER,max=Number.MAX_SAFE_INTEGER,integer=false}={}){
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))return null;
  return value;
}
function optionalText(value:unknown,max:number){
  return typeof value==='string'&&value.length<=max?value:null;
}
function sameDataValue(left:unknown,right:unknown):boolean{
  if(Object.is(left,right))return true;
  if(!left||!right||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)!==Array.isArray(right))return false;
  if(Array.isArray(left))return Array.isArray(right)&&left.length===right.length&&(left as unknown[]).every((value,index)=>sameDataValue(value,(right as unknown[])[index]));
  const leftKeys=Object.keys(left).sort(),rightKeys=Object.keys(right).sort();
  return leftKeys.length===rightKeys.length&&leftKeys.every((key,index)=>key===rightKeys[index]&&sameDataValue((left as Record<string,unknown>)[key],(right as Record<string,unknown>)[key]));
}
return Object.freeze({KeyedRecord,textEl,on,emptyMsg,setProgressSummary,setElementText,setElementValue,setElementClass,setElementHidden,setElementDisabled,setElementAttribute,setElementStyle,setTextSafe,cachedElements,clampText,clampArray,wipeObject,boundedInt,boundedNumber,safeBoolean,finiteNumber,optionalBoundedNumber,optionalText,sameDataValue});
}
function createWorkspace(ports:WorkspaceRouterInput){
const WorkspaceRouteCoordinator=(()=>{
  const handlers=new Map<string,WorkspaceHandler>(),overlayKinds=new Set(['focus','pdf','audio']);
  const same=(a:WorkspaceDescriptor|null,b:WorkspaceDescriptor|null)=>{if(!a&&!b)return true;return !!a&&!!b&&a.kind===b.kind&&a.token===b.token&&(a.key||'')===(b.key||'');};
  const cleanKind=(value:unknown)=>String(value||'').trim().toLowerCase();
  function register(kind:string,handler:WorkspaceHandler){
    const id=cleanKind(kind);
    if(!/^[a-z][a-z0-9-]{1,31}$/.test(id)||!handler||!Object.isFrozen(handler)||typeof handler.current!=='function'||typeof handler.reconcile!=='function')return false;
    handlers.set(id,handler);return true;
  }
  function opened(descriptor:WorkspaceDescriptor,options:WorkspaceOpenMeta={}){
    const navigation=ports.navigation();if(!navigation?.workspace)return false;
    return options.replace===true?navigation.workspace.replace(descriptor,{url:options.url||null}):navigation.workspace.open(descriptor,{url:options.url||null});
  }
  function requestClose(descriptor:WorkspaceDescriptor){return !!ports.navigation()?.workspace?.close(descriptor);}
  function closed(descriptor:WorkspaceDescriptor,meta:WorkspaceCloseMeta={}){
    if(meta.fromHistory===true||meta.historyPending===true)return true;
    return !!ports.navigation()?.workspace?.drop(descriptor);
  }
  function externalCurrent(){
    for(const handler of handlers.values()){const value=handler.current();if(value)return value;}
    return null;
  }
  function current(){
    const prompt=typeof ports.interactions()?.historyDescriptor==='function'?ports.interactions().historyDescriptor():null;if(prompt)return prompt;
    const external=externalCurrent();if(external)return external;
    return typeof ports.overlay()?.historyDescriptor==='function'?ports.overlay().historyDescriptor():null;
  }
  async function reconcile(desired:WorkspaceDescriptor|null,context:NavigationContext){
    const target=desired&&typeof desired==='object'?desired:null;
    const prompt=typeof ports.interactions()?.historyDescriptor==='function'?ports.interactions().historyDescriptor():null;
    if(prompt){if(same(prompt,target))return prompt;ports.interactions().reconcileHistory(null);}
    if(target?.kind==='prompt')return current();
    for(const [kind,handler] of handlers){
      const active=handler.current();if(active&&!(target&&target.kind===kind&&same(active,target)))await handler.reconcile(null,context);
    }
    const overlayTarget=target&&overlayKinds.has(target.kind)?target:null;
    if(typeof ports.overlay()?.reconcile==='function')await ports.overlay().reconcile(overlayTarget);
    if(target&&!overlayKinds.has(target.kind)){
      const handler=handlers.get(target.kind);if(handler)await handler.reconcile(target,context);
    }
    return current();
  }
  return Object.freeze({register,opened,requestClose,closed,current,reconcile});
})();
const WorkspaceHistoryBridge=Object.freeze({
  opened:(descriptor:WorkspaceDescriptor,options:WorkspaceOpenMeta)=>WorkspaceRouteCoordinator.opened(descriptor,options),
  requestClose:(descriptor:WorkspaceDescriptor)=>WorkspaceRouteCoordinator.requestClose(descriptor),
  closed:(descriptor:WorkspaceDescriptor,meta:WorkspaceCloseMeta)=>WorkspaceRouteCoordinator.closed(descriptor,meta)
});
const WorkspaceHistoryPublic=Object.freeze({
  register:(kind:string,handler:WorkspaceHandler)=>WorkspaceRouteCoordinator.register(kind,handler),
  open:(descriptor:WorkspaceDescriptor,options:WorkspaceOpenMeta={})=>WorkspaceRouteCoordinator.opened(descriptor,options),
  replace:(descriptor:WorkspaceDescriptor,options:WorkspaceOpenMeta={})=>WorkspaceRouteCoordinator.opened(descriptor,{...options,replace:true}),
  close:(descriptor:WorkspaceDescriptor)=>WorkspaceRouteCoordinator.requestClose(descriptor),
  closed:(descriptor:WorkspaceDescriptor,meta:WorkspaceCloseMeta={})=>WorkspaceRouteCoordinator.closed(descriptor,meta)
});
return Object.freeze({WorkspaceRouteCoordinator,WorkspaceHistoryBridge,WorkspaceHistoryPublic});
}
function createNoticeViews(ports:{document:Document;notifications():Pick<NoticeCoordinator,'resolveEvent'|'emit'>;clampText(value:unknown,max:number):string;maxStatusMessageChars:number}){
const {document}=ports;
function renderNotificationSurfaces(state:NotificationState){
  const latest=new Map<string,NotificationEvent>();
  for(const event of state.events)if(event.surfaceId&&(!latest.has(event.surfaceId)||event.surfaceRevision>latest.get(event.surfaceId)!.surfaceRevision))latest.set(event.surfaceId,event);
  for(const node of document.querySelectorAll<HTMLElement>('[data-notification-key]'))if(!latest.has(node.id)){
    const previous:unknown=JSON.parse(node.dataset['notificationRevision']||'[]');
    if(Array.isArray(previous)&&node.textContent===previous[2]){node.textContent='';node.classList.remove('err','ok','warn');delete node.dataset['state'];}
    delete node.dataset['notificationRevision'];delete node.dataset['notificationKey'];
  }
  for(const [id,event] of latest){
    const node=document.getElementById(id);if(!node)continue;
    const message=event.dismissed&&!event.retainInline?'':event.message;
    const revision=JSON.stringify([event.deliveryId,event.lifecycle,message,event.severity]);if(node.dataset['notificationRevision']===revision)continue;
    node.dataset['notificationRevision']=revision;node.dataset['notificationKey']=event.key;node.textContent=message;
    node.classList.toggle('err',event.severity==='error');node.classList.toggle('warn',event.severity==='warning');node.classList.toggle('ok',event.lifecycle==='succeeded'&&event.severity!=='warning');
    node.dataset['state']=event.severity==='error'?'error':event.severity==='warning'?'warning':'success';
  }
}
function renderCoordinatedNotice(state:BannerState){
  const region=document.getElementById('notice-region');
  const storage=document.getElementById('storage-warning');
  const installation=document.getElementById('install-notice');
  const update=document.getElementById('pwa-update-control');
  const announcer=document.getElementById('install-notice-announcer');
  const active=state&&state.active||null;
  if(region){
    region.hidden=!active;
    region.dataset['noticeKind']=active&&active.kind||'';
    region.dataset['noticeId']=active&&active.id||'';
    region.dataset['noticeCompact']=active&&active.compact?'true':'false';
  }
  if(storage){storage.hidden=!active||!['critical','safety','storage'].includes(active.kind);}
  if(installation)installation.hidden=!active||active.kind!=='installation';
  if(update)update.hidden=!active||active.kind!=='update';
  const storageText=document.getElementById('storage-warning-text');
  if(storageText&&active&&['critical','safety','storage'].includes(active.kind))storageText.textContent=active.message;
  if(announcer){if(state?.announcement)announcer.textContent=state.announcement;else if(!active)announcer.textContent='';}
}
function noticeCanCompact(message:unknown){
  const text=String(message||'').trim();
  return !!text&&!text.includes('\n')&&text.length<=160;
}
function setStatus(id:string,msg:unknown,ok=true,lifecycle:Lifecycle|''=''){
  const source=id==='library-status'?'library':id==='notes-status'?'notes':'review';
  if(!msg)return ports.notifications().resolveEvent(source,'status-'+id);
  return ports.notifications().emit({source,id:'status-'+id,surfaceId:id,surface:'inline',foreground:false,cue:'none',severity:ok?'info':'error',lifecycle:lifecycle||(ok?'succeeded':'failed'),message:ports.clampText(msg,ports.maxStatusMessageChars)});
}
return Object.freeze({renderNotificationSurfaces,renderCoordinatedNotice,noticeCanCompact,setStatus});
}
function createRecent(ports:RecentInput){
const {document,sessionStorage,SESSION_STORAGE_KEYS,ProfileScope,NoticeCoordinator,AppDiagnostics,scheduleSyncStatus,closeProfilePanel}=ports;
const NotificationRecent=(()=>{
  // The three newest show; Show all lists the rest while the panel is open.
  const SHOWN=3;
  let highlight=new Set<string>(),all=false;
  function restore(){
    try{
      const parsed:unknown=JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEYS.notifications)||'null');
      const value=parsed as {version?:unknown;scope?:unknown;entries?:unknown}|null;
      if(value&&value.version===1&&value.scope===ProfileScope.scope&&Array.isArray(value.entries))NoticeCoordinator.restoreRecent(value.entries);
    }catch(error){AppDiagnostics.capture('notifications.recent-restore',error,'warn');}
  }
  function save(state:RecentState){
    try{
      if(!state.entries.length){sessionStorage.removeItem(SESSION_STORAGE_KEYS.notifications);return;}
      const entries=state.entries.map(({id,source,tier,severity,title,message,at,outcome,seen})=>({id,source,tier,severity,title,message,at,outcome,seen}));
      sessionStorage.setItem(SESSION_STORAGE_KEYS.notifications,JSON.stringify({version:1,scope:ProfileScope.scope,entries}));
    }catch(error){AppDiagnostics.capture('notifications.recent-save',error,'warn');}
  }
  function changed(state:RecentState){save(state);scheduleSyncStatus();render(state);}
  function time(at:number){try{return new Date(at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}catch{return '';}}
  // Rebuilt only when the entries change, so a focused button keeps focus.
  function render(state=NoticeCoordinator.recent()){
    const dialog=document.getElementById('profile-dialog');if(!(dialog as HTMLDialogElement|null)?.open)return;
    const list=document.getElementById('profile-recent-list'),empty=document.getElementById('profile-recent-empty'),clear=document.getElementById('profile-recent-clear');
    const group=document.getElementById('profile-recent-group'),more=document.getElementById('profile-recent-more'),total=state.entries.length;
    if(empty)empty.hidden=!!total;if(clear)clear.hidden=!total;if(group)group.hidden=!total;
    if(more){
      more.hidden=total<=SHOWN;more.setAttribute('aria-expanded',all?'true':'false');
      const label=all?'Show fewer':`Show all (${total})`;if(more.textContent!==label)more.textContent=label;
    }
    const shown=all?state.entries:state.entries.slice(0,SHOWN);
    const key=JSON.stringify([shown,[...highlight]]);if(!list||list.dataset['key']===key)return;list.dataset['key']=key;
    list.replaceChildren(...shown.map(entry=>{
      const row=document.createElement('li');row.className='profile-recent-item';row.dataset['tone']=entry.severity;row.dataset['tier']=entry.tier;
      if(highlight.has(entry.id))row.dataset['unseen']='true';
      // A live pop-up whose button opens something opens from anywhere on its row.
      if(entry.actionOpens){row.dataset['action']='recent-action';row.dataset['recentId']=entry.id;row.dataset['opens']='true';}
      const mark=document.createElement('span');mark.className='profile-recent-mark';mark.setAttribute('aria-hidden','true');
      const text=document.createElement('span');text.className='profile-recent-text';
      const title=document.createElement('strong');title.className='profile-recent-title';title.textContent=entry.title;text.append(title);
      if(entry.message){const message=document.createElement('span');message.className='profile-recent-message';message.textContent=entry.message;text.append(message);}
      const when=document.createElement('time');when.className='profile-recent-time';when.dateTime=new Date(entry.at).toISOString();when.textContent=time(entry.at);
      row.append(mark,text,when);
      if(entry.actionLabel){const button=document.createElement('button');button.type='button';button.className='profile-act ui-btn';button.dataset['action']='recent-action';button.dataset['recentId']=entry.id;button.textContent=entry.actionLabel;row.append(button);}
      return row;
    }));
  }
  // News that faded unseen stays marked while the panel is open.
  function opened(){const state=NoticeCoordinator.recent();highlight=new Set(state.entries.filter(entry=>entry.tier==='news'&&entry.outcome==='expired'&&!entry.seen).map(entry=>entry.id));render(state);NoticeCoordinator.markRecentSeen();}
  function closed(){highlight=new Set<string>();all=false;}
  function toggle(){all=!all;render();return true;}
  function run(ev:Event){
    const id=String((ev?.target as Element|null)?.closest?.<HTMLElement>('[data-recent-id]')?.dataset['recentId']||'');if(!id)return false;
    closeProfilePanel();return NoticeCoordinator.runRecentAction(id);
  }
  restore();
  return Object.freeze({changed,render,opened,closed,run,toggle,clear:()=>{NoticeCoordinator.clearRecent();return true;}});
})();
return Object.freeze({NotificationRecent});
}
function createSystem(ports:SystemInput){
const {window,document,navigator,location,NoticeCoordinator,Interactions,AppDiagnostics,appCanMutate}=ports;
const SystemNotifications=(()=>{
  let installed=false;
  function supported(){return 'Notification' in window&&!!window.Notification;}
  function permission(){return supported()?String(window.Notification.permission||'default'):'unsupported';}
  function preference(){return ports.readPreference()===true;}
  function enabled(){return preference()&&permission()==='granted';}
  function write(value:boolean){return ports.writePreference(value===true);}
  function status(){return Object.freeze({supported:supported(),permission:permission(),preference:preference(),enabled:enabled()});}
  function render(){
    const state=status(),button=document.getElementById('system-alert-toggle'),note=document.getElementById('system-alert-note');
    if(button){
      (button as HTMLButtonElement).disabled=!state.supported||state.permission==='denied';
      button.textContent=!state.supported?'Unavailable':state.permission==='denied'?'Blocked in browser':state.enabled?'On':'Enable';
      button.setAttribute('aria-pressed',state.enabled?'true':'false');
    }
    if(note){
      note.textContent=!state.supported
        ? 'This browser does not support system notifications. In-app cues and sounds still work.'
        : state.permission==='denied'
        ? 'Blocked in browser settings. Allow notifications for this site, then return to Study Director.'
        : state.enabled
        ? 'On · sound is controlled by your device.'
        : 'Off · browser permission required.';
    }
    const test=document.getElementById('system-alert-test');if(test)(test as HTMLButtonElement).disabled=!state.enabled;
    return state;
  }
  async function toggle(){
    if(!appCanMutate())return false;
    const before=status();
    if(!before.supported||before.permission==='denied'){render();return false;}
    if(before.enabled){
      write(false);render();
      Interactions.notify({source:'system-settings',key:'system-alerts',title:'System alerts off',message:'In-app Pomodoro cues and sounds remain available.'});
      return false;
    }
    let result=before.permission;
    if(result==='default'){
      try{result=await window.Notification.requestPermission();}
      catch(error){AppDiagnostics.capture('system-notifications.permission',error,'warn');result='default';}
    }
    if(!appCanMutate()){render();return false;}
    const accepted=result==='granted';write(accepted);render();
    Interactions.notify(accepted
      ? {source:'system-settings',key:'system-alerts',title:'System alerts enabled',message:'Timer and study reminders may now appear outside Study Director.'}
      : {source:'system-settings',key:'system-alerts',kind:'warning',title:'System alerts remain off',message:'You can continue using in-app cues and sounds.'});
    return accepted;
  }
  async function deliver(event:NotificationInput,isCurrent=()=>true,isSilent=()=>NoticeCoordinator.soundStatus().mode==='off'){
    if(!enabled()||!appCanMutate())return false;
    const options:NotificationOptions={
      body:String(event.message||''),tag:String(event.id||event.title||'study-director'),
      icon:new URL('./assets/icons/icon-192.png',location.href).href,
      badge:new URL('./assets/icons/favicon-32.png',location.href).href,
      data:{url:new URL('./',location.href).href}
    };
    try{
      if(navigator.serviceWorker&&typeof navigator.serviceWorker.getRegistration==='function'){
        const registration=await navigator.serviceWorker.getRegistration();
        if(!enabled()||!appCanMutate()||!isCurrent())return false;
        options.silent=isSilent();
        if(registration&&typeof registration.showNotification==='function'){
          await registration.showNotification(String(event.title||'Study Director'),options);return true;
        }
      }
      if(!enabled()||!appCanMutate()||!isCurrent())return false;
      options.silent=isSilent();new window.Notification(String(event.title||'Study Director'),options);return true;
    }catch(error){AppDiagnostics.capture('system-notifications.display',error,'warn');return false;}
  }
  async function notify(title:string,body:string,tag:string,occurrence:string,test=false){
    if(!enabled())return false;
    const event={source:'system',id:String(tag||title||'study-director'),occurrence,title,message:body,test};
    return NoticeCoordinator.deliverSystem(event,isCurrent=>deliver(event,isCurrent));
  }
  function test(){return notify('Study Director','Device notifications are working.','notification-test',String(Date.now()),true);}
  function install(){
    if(installed)return render();
    installed=true;document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});return render();
  }
  return Object.freeze({format:'study-director.system-notifications',contractVersion:1,install,status,render,toggle,notify,deliver,test});
})();
return Object.freeze({SystemNotifications});
}
function createSound(ports:SoundInput){
const {document,NoticeCoordinator,appCanMutate,persistProtectedPreferences}=ports;
function renderSoundSettings(){
  const state=NoticeCoordinator.soundStatus();
  document.querySelectorAll<HTMLInputElement>('input[name="app-sound-mode"]').forEach(input=>{input.checked=input.value===state.mode;});
  const note=document.getElementById('app-sound-status');
  if(note)note.textContent=state.readiness==='unavailable'?'Audio unavailable in this browser.':state.mode==='off'?'App sounds off.':state.readiness==='ready'?'Applies throughout the app.':'Sound becomes ready after an interaction.';
}
function setAppSoundMode(mode:'full'|'minimal'|'off'){
  if(!appCanMutate())return;
  NoticeCoordinator.setSoundMode(mode);persistProtectedPreferences({soundMode:mode});renderSoundSettings();
}
function handleSoundModeChange(event:Event){
  const target=event.target;
  const mode=target&&'value' in target?target.value:undefined;
  if(mode==='full'||mode==='minimal'||mode==='off')setAppSoundMode(mode);
}
return Object.freeze({renderSoundSettings,setAppSoundMode,handleSoundModeChange});
}
function createBackupActions(ports:BackupActionsInput){
const {document,AppDiagnostics,connectDeviceBackupWithRecovery,connectDriveForProfile,goTab,preferredScrollBehavior}=ports;
async function showBackupPresentation(source:string,kind:string){
  if(source==='device-folder'&&kind==='permission')return ports.device()?connectDeviceBackupWithRecovery():undefined;
  // Reconnecting straight from the toast keeps it to one click.
  if(kind==='permission'&&source!=='file'&&await (source==='google-drive'?connectDriveForProfile():ports.providers().connect(source)))return true;
  if(['history','restore-version','bring-in','remove-version'].includes(kind))return ports.history()?.open();
  // A review opens Combine, which waits while today's session runs.
  if(kind==='sync-review')return ports.providers().reviewSync(source);
  if(kind==='sync-password')return ports.providers().unlockSync(source);
  if(kind==='sync-newer')return ports.checkForUpdate().catch(error=>{AppDiagnostics.capture('backup.sync-newer-update-check',error,'warn');return false;});
  if(!await goTab('library',{source:'backup-notification'}))return false;
  ports.showData();
  // 'restore' shows every way back in: Device Folder where supported, Google
  // Drive, and the backup file import under Advanced.
  const target=document.getElementById(({file:'backup-file-heading','device-folder':'device-backup-status','google-drive':'backup-provider-row-status-google-drive',restore:'managed-backup-heading'} as Partial<Record<string,string>>)[source]||'');
  if(!target)return false;
  if(source==='restore')document.querySelector<HTMLDetailsElement>('.backup-advanced-disclosure')!.open=true;
  for(let node=target.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS')(node as HTMLDetailsElement).open=true;
  requestAnimationFrame(()=>target.scrollIntoView({block:source==='restore'?'start':'center',behavior:preferredScrollBehavior()}));return true;
}
async function openBackupRestore(){
  return showBackupPresentation('restore',ports.device().status().connected||ports.providers().connected('google-drive')?'history':'status');
}
function backupRestoreChoices(){return ports.device().status().supported?'your Device Folder, Google Drive or a backup file':'Google Drive or a backup file';}
return Object.freeze({showBackupPresentation,openBackupRestore,backupRestoreChoices});
}
function createNavigation(ports:NavigationUIInput){
const {document,window,clampText,flushPendingReviewSave,setStatus,refreshPnote,updateCD,isLiveTrackableTimer,refreshExecuteIdleDisplay,updateBreakMeter,renderScheduleOnPlanOpen,updateRealTimeAwareness,richTextSyncAll}=ports;
const NAV_HORIZONTAL_MEDIA_QUERY='(max-width: 900px), (hover: none) and (pointer: coarse) and (max-height: 600px)';
function preferredScrollBehavior(){
  return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
}
const UiTabRegistry=(()=>{
  const renderHooks=new Map<string,NonNullable<TabConfig["render"]>>();
  const readyHooks=new Map<string,NonNullable<TabConfig["ready"]>>();
  const TAB_ORDER=Object.freeze(['plan','execute','review','library','insights','guide']);
  const safeId=(id:unknown)=>String(id||'').trim().toLowerCase().match(/^[a-z][a-z0-9-]{0,40}$/)?.[0]||'';
  const findNav=()=>document.querySelector('.sb-nav');
  const findMain=()=>document.querySelector('.main');
  const items=()=>[...(findNav()?.querySelectorAll<HTMLButtonElement>('.nav-item[data-tab]')||[])];
  function enforceNavOrder(){
    const nav=findNav();
    if(!nav)return;
    items().sort((a,b)=>{
      const ai=TAB_ORDER.indexOf(a.dataset['tab']||''),bi=TAB_ORDER.indexOf(b.dataset['tab']||'');
      return (ai<0?999:ai)-(bi<0?999:bi);
    }).forEach(item=>nav.appendChild(item));
  }
  function sync(activeId:string){
    items().forEach(item=>{
      const active=item.dataset['tab']===activeId;
      item.classList.toggle('on',active);
      item.setAttribute('aria-selected',active?'true':'false');
      item.tabIndex=active?0:-1;
    });
  }
  function updateOrientation(){
    const nav=findNav();
    if(nav)nav.setAttribute('aria-orientation',window.matchMedia&&window.matchMedia(NAV_HORIZONTAL_MEDIA_QUERY).matches?'horizontal':'vertical');
  }
  function registerTab(config:TabConfig={}){
    const id=safeId(config.id);
    if(!id)return false;
    const label=clampText(config.label||id,40);
    const icon=clampText(config.icon||'◌',4);
    const nav=findNav();
    const main=findMain();
    if(!nav||!main)return false;
    let item=items().find(candidate=>candidate.dataset['tab']===id)||null;
    if(!item){
      item=document.createElement('button');
      item.className='nav-item ui-label';
      item.type='button';
      item.id='tab-'+id;
      item.setAttribute('role','tab');
      item.setAttribute('aria-controls','pane-'+id);
      item.setAttribute('aria-selected','false');
      item.tabIndex=-1;
      item.dataset['tab']=id;
      const iconEl=document.createElement('span');
      iconEl.className='nav-icon';
      iconEl.setAttribute('aria-hidden','true');
      iconEl.textContent=icon;
      item.append(iconEl,document.createTextNode(label));
      nav.appendChild(item);
    }
    enforceNavOrder();
    let pane=document.getElementById('pane-'+id);
    if(!pane){
      pane=(config.pane&&config.pane.nodeType===1)?config.pane:document.createElement('div');
      pane.id='pane-'+id;
      pane.classList.add('pane');
      main.appendChild(pane);
    }
    pane.setAttribute('role','tabpanel');
    pane.setAttribute('aria-labelledby','tab-'+id);
    const active=document.querySelector<HTMLButtonElement>('.nav-item.on')?.dataset['tab']===id;
    pane.hidden=!active;
    pane.style.display=active?'block':'none';
    if(typeof config.render==='function')renderHooks.set(id,config.render);
    if(typeof config.ready==='function')readyHooks.set(id,config.ready);
    updateOrientation();
    return true;
  }
  function handleKeydown(ev:KeyboardEvent){
    const target=ev.target as Element|null;
    const current=target&&typeof target.closest==='function'?target.closest<HTMLButtonElement>('.nav-item[data-tab]'):null;
    if(!current||!findNav()?.contains(current))return false;
    const all=items();
    const index=all.indexOf(current);
    let next=-1;
    if(['ArrowRight','ArrowDown'].includes(ev.key))next=(index+1)%all.length;
    else if(['ArrowLeft','ArrowUp'].includes(ev.key))next=(index-1+all.length)%all.length;
    else if(ev.key==='Home')next=0;
    else if(ev.key==='End')next=all.length-1;
    else if(ev.key==='Enter'||ev.key===' '){void goTab(current.dataset['tab'],{source:'keyboard'});ev.preventDefault();return true;}
    else return false;
    const nextItem=all[next];
    if(nextItem){all.forEach(item=>{item.tabIndex=item===nextItem?0:-1;});nextItem.focus();}
    ev.preventDefault();
    return true;
  }
  function renderTab(id:string,context:Partial<NavigationContext>={}){
    const hook=renderHooks.get(id);
    return hook?hook({...context,id,pane:document.getElementById('pane-'+id)}):null;
  }
  function readyTab(id:string,context:NavigationContext){
    const hook=readyHooks.get(id);
    return hook?hook(context):true;
  }
  return Object.freeze({registerTab,renderTab,readyTab,sync,updateOrientation,handleKeydown});
})();
const FEATURE_SCROLL_OWNERS=new Set(['review','library','insights']);
const shellTabScrollState=new Map<string,{windowTop:number;mainTop:number}>();
const navigationFocusState=new Map<number,{departingHadFocus:boolean}>();
const nextNavigationFrame=()=>new Promise<void>(resolve=>{
  let frame:number|null=null,timer:number|null=null;
  const finish=()=>{if(frame!==null)cancelAnimationFrame(frame);if(timer!==null)clearTimeout(timer);resolve();};
  // Hidden windows may receive no animation frames; startup must still settle.
  frame=requestAnimationFrame(finish);timer=setTimeout(finish,document.hidden?0:100);
});
function captureShellScroll(tab:string){
  if(FEATURE_SCROLL_OWNERS.has(tab))return;
  const root=document.scrollingElement||document.documentElement,main=document.querySelector('.main');
  shellTabScrollState.set(tab,Object.freeze({windowTop:Math.max(0,Number(root?.scrollTop)||Number(window.scrollY)||0),mainTop:Math.max(0,Number(main?.scrollTop)||0)}));
}
function applySharedScroll(state:{windowTop:number;mainTop:number}|null|undefined){
  const root=document.scrollingElement||document.documentElement,main=document.querySelector('.main');
  if(root)root.scrollTop=Math.max(0,Number(state?.windowTop)||0);
  if(main)main.scrollTop=Math.max(0,Number(state?.mainTop)||0);
}
function restoreShellScrollNow(tab:string,restore=true){
  if(FEATURE_SCROLL_OWNERS.has(tab))return;
  applySharedScroll(restore?shellTabScrollState.get(tab):null);
}
function captureNavigationState(context:NavigationContext){
  captureShellScroll(context.from);
  const pane=document.getElementById('pane-'+context.from);
  const active=document.activeElement;
  navigationFocusState.set(context.generation,Object.freeze({departingHadFocus:!!(pane&&active&&pane.contains(active))}));
}
const paneEntranceTimers=new Map<string,number>();
function markPaneEntrance(pane:HTMLElement){
  // Presentation-owned entrance: CSS animates the arriving pane's sections for
  // one beat. The marker is cleared afterwards so later re-renders stay still.
  // Insights renders progressively behind its own loading panel the first
  // time; animating that render made it about 300 ms slower, so a first open
  // arrives still. Reopened, it shows the view it kept and animates like any pane.
  if(pane.id==='pane-insights'&&(!pane.firstElementChild||pane.querySelector('.plugin-loading-panel')))return;
  clearTimeout(paneEntranceTimers.get(pane.id));
  pane.setAttribute('data-sd-enter','');
  paneEntranceTimers.set(pane.id,setTimeout(()=>{pane.removeAttribute('data-sd-enter');paneEntranceTimers.delete(pane.id);},900));
}
async function presentTabCommit(context:NavigationContext,update:()=>Promise<boolean>){
  // Primary tab changes are intentionally immediate. Navigation owns state,
  // history, focus, and readiness; visual snapshot transitions are not part of
  // the tab-commit contract.
  captureNavigationState(context);
  try{
    const result=await update();
    if(result===false)navigationFocusState.delete(context.generation);
    return result;
  }catch(error){
    navigationFocusState.delete(context.generation);
    throw error;
  }finally{
    if(!context.current())navigationFocusState.delete(context.generation);
  }
}
async function prepareTabDeparture(context:DepartureContext){
  if(context.from===context.to)return true;
  if(context.from==='library'&&!await ports.library().settleDiary())return false;
  if(context.from==='review'){
    if(flushPendingReviewSave({strict:true})===false)return false;
    try{await ports.reviewEditor().settled();}catch(error){
      const message=error&&typeof error==='object'&&'message' in error?error.message:undefined;
      setStatus('save-status',String(message||'Reflection could not be saved safely.'),false);return false;
    }
  }
  return true;
}
const navigationReadyByGeneration=new Map<number,Promise<boolean>>();
function commitTabView(context:NavigationContext){
  const tabName=String(context.to||'').trim();
  const pane=document.getElementById('pane-'+tabName);
  if(!pane)return false;
  const previousTab=String(context.from||document.querySelector('.pane.on')?.id||'').replace(/^pane-/,'');
  if(previousTab==='library'&&tabName!=='library'){ports.library().deactivate({diarySettled:true});ports.attachments().close();}
  if(previousTab==='review'&&tabName!=='review')ports.review().deactivate();
  ports.clearPreview(tabName);
  const activeNav=[...document.querySelectorAll<HTMLButtonElement>('.nav-item[data-tab]')].find(item=>item.dataset['tab']===tabName)||null;
  UiTabRegistry.sync(tabName);
  document.querySelectorAll<HTMLElement>('.pane').forEach(p=>{p.classList.remove('on');p.style.display='none';p.hidden=true;});
  pane.classList.add('on');pane.style.display='block';pane.hidden=false;
  if(previousTab!==tabName)markPaneEntrance(pane);
  document.documentElement.dataset['sdArea']=tabName;
  if(tabName==='execute'){
    refreshPnote({force:true});
    updateCD();
    if(!isLiveTrackableTimer())refreshExecuteIdleDisplay(new Date(),{force:true});
    if(ports.paused())updateBreakMeter();
    ports.renderPacer();
    ports.startTimerPresentation();
  }else ports.stopTimerPresentation();
  if(tabName==='review')ports.review().activate({restoreScroll:context.restoreScroll&&previousTab!=='review',immediateScroll:true});
  if(tabName==='plan'){renderScheduleOnPlanOpen();updateRealTimeAwareness(null,{force:true});}
  if(tabName==='insights')applySharedScroll(null);
  else restoreShellScrollNow(tabName,context.restoreScroll!==false);
  const waits:Promise<unknown>[]=[];
  if(tabName==='library'){
    waits.push(Promise.resolve(ports.library().activate({restoreScroll:context.restoreScroll&&previousTab!=='library',immediateScroll:true})));
    void ports.attachments().refresh();
  }
  const pluginReady=ports.requestPluginTab(tabName);
  if(pluginReady)waits.push(Promise.resolve(pluginReady));
  UiTabRegistry.renderTab(tabName,context);
  ports.applyOwnership();
  richTextSyncAll();
  if(activeNav&&window.matchMedia&&window.matchMedia(NAV_HORIZONTAL_MEDIA_QUERY).matches){
    requestAnimationFrame(()=>activeNav.scrollIntoView({block:'nearest',inline:'nearest',behavior:preferredScrollBehavior()}));
  }
  navigationReadyByGeneration.set(context.generation,Promise.all(waits).then(()=>true));
  return true;
}
async function waitForTabReady(context:NavigationContext){
  const ready=navigationReadyByGeneration.get(context.generation);
  try{
    if(ready)await ready;
    await UiTabRegistry.readyTab(context.to,context);
    if(!context.current())return false;
    if(context.restoreScroll!==false&&!FEATURE_SCROLL_OWNERS.has(context.to)){
      await nextNavigationFrame();
      if(!context.current())return false;
      restoreShellScrollNow(context.to,true);
    }else{
      await nextNavigationFrame();
      await nextNavigationFrame();
      if(!context.current())return false;
    }
    const focus=navigationFocusState.get(context.generation);
    const pane=document.getElementById('pane-'+context.to);
    const active=document.activeElement;
    const destinationOwnsFocus=!!(pane&&active&&pane.contains(active));
    if(!destinationOwnsFocus&&(context.traversal||focus?.departingHadFocus)){
      const nav=[...document.querySelectorAll<HTMLButtonElement>('.nav-item[data-tab]')].find(item=>item.dataset['tab']===context.to)||null;
      nav?.focus({preventScroll:true});
    }
    return true;
  }finally{
    navigationReadyByGeneration.delete(context.generation);
    navigationFocusState.delete(context.generation);
  }
}
function goTab(name:string|undefined,options:NavigationOptions={}){
  const controller=ports.controller();if(!controller)return Promise.resolve(false);
  return controller.request(name,options).then(result=>{
    if(result.ok===true&&result.reason==='same-tab')UiTabRegistry.sync(result.tab);
    return result.ok===true;
  });
}
return Object.freeze({NAV_HORIZONTAL_MEDIA_QUERY,preferredScrollBehavior,UiTabRegistry,presentTabCommit,prepareTabDeparture,commitTabView,waitForTabReady,goTab});
}
function createDelegated(ports:DelegatedInput){
const {document,goTab,setStudyQuality,requirePrimaryTab,CLICK_ACTIONS,CHANGE_ACTIONS,INPUT_ACTIONS,BLUR_ACTIONS,KEYDOWN_ACTIONS,OWNER_REQUIRED_CLICK_ACTIONS,OWNER_REQUIRED_CHANGE_ACTIONS,OWNER_REQUIRED_INPUT_ACTIONS,OWNER_REQUIRED_BLUR_ACTIONS,OWNER_REQUIRED_KEYDOWN_ACTIONS,UiTabRegistry,Pomodoro}=ports;
function actionNeedsAppControl(action:string|undefined,set:ReadonlySet<string>){return !!(action&&set&&set.has(action));}
function handleDelegatedClick(ev:MouseEvent){
  const target=ev.target as HTMLElement|null;if(!target||typeof target.closest!=='function')return;
  const tabEl=target.closest<HTMLElement>('[data-tab]');
  if(tabEl){
    ev.preventDefault();
    void goTab(tabEl.dataset['tab'],{source:'primary-tab'});
    return;
  }
  const qualityEl=target.closest<HTMLElement>('[data-quality]');
  if(qualityEl){
    if(!requirePrimaryTab(ev,'rate or edit this review'))return;
    ev.preventDefault();
    const raw=qualityEl.dataset['quality'];
    setStudyQuality(raw===''?null:Number(raw));
    return;
  }
  const actionEl=target.closest<HTMLElement>('[data-action]');
  if(!actionEl)return;
  const action=actionEl.dataset['action'];
  if(actionNeedsAppControl(action,OWNER_REQUIRED_CLICK_ACTIONS)&&!requirePrimaryTab(ev,'run timers or save changes'))return;
  const handler=action&&CLICK_ACTIONS[action];
  if(handler){ev.preventDefault();handler(ev);}
}
function handleDelegatedChange(ev:Event){
  const target=ev.target as HTMLElement|null;if(!target||typeof target.closest!=='function')return;
  const action=target.dataset['change'];
  if(actionNeedsAppControl(action,OWNER_REQUIRED_CHANGE_ACTIONS)&&!requirePrimaryTab(ev,'save or import changes'))return;
  const handler=action&&CHANGE_ACTIONS[action];
  if(handler)handler(ev);
}
function handleDelegatedInput(ev:Event){
  const target=ev.target as HTMLElement|null;if(!target||typeof target.closest!=='function')return;
  if(target instanceof HTMLTextAreaElement){ports.editedTextarea();}
  const action=target.dataset['input'];
  if(actionNeedsAppControl(action,OWNER_REQUIRED_INPUT_ACTIONS)&&!requirePrimaryTab(ev,'edit saved drafts'))return;
  const handler=action&&INPUT_ACTIONS[action];
  if(handler)handler(ev);
}
function handleDelegatedBlur(ev:FocusEvent){
  const target=ev.target as HTMLElement|null;if(!target||typeof target.closest!=='function')return;
  const action=target.dataset['blur'];
  if(actionNeedsAppControl(action,OWNER_REQUIRED_BLUR_ACTIONS)&&!requirePrimaryTab(ev,'edit saved drafts'))return;
  const handler=action&&BLUR_ACTIONS[action];
  if(handler)handler(ev);
}
function handleDelegatedKeydown(ev:KeyboardEvent){
  const target=ev.target as HTMLElement|null;if(!target||typeof target.closest!=='function')return;
  if(UiTabRegistry.handleKeydown(ev))return;
  if(ev.key==='Escape'&&document.getElementById('nudge-overlay')?.classList.contains('on')){
    Pomodoro.stop({dismiss:true,audio:false});
    ev.preventDefault();
    ev.stopPropagation();
    return;
  }
  const action=target.dataset['keydown'];
  if(actionNeedsAppControl(action,OWNER_REQUIRED_KEYDOWN_ACTIONS)&&!requirePrimaryTab(ev,'edit saved drafts'))return;
  const handler=action&&KEYDOWN_ACTIONS[action];
  if(handler&&handler(ev)===false){
    ev.preventDefault();
    ev.stopPropagation();
  }
}
return Object.freeze({actionNeedsAppControl,handleDelegatedClick,handleDelegatedChange,handleDelegatedInput,handleDelegatedBlur,handleDelegatedKeydown});
}
return Object.freeze({format:'study-director.foundation-host-module',contractVersion:1,createPrimitives,createWorkspace,createNoticeViews,createRecent,createSystem,createSound,createBackupActions,createNavigation,createDelegated});
};
registry.define('foundation-host',1,createModule);return createModule;
})();
export type FoundationHostModule=ReturnType<typeof sdFoundationHostFactory>;
