import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {CanonicalCommitBadgeEvent,CapabilityBadgeInput,CapabilityControllerInput,CapabilityInstallationInput,CapabilityStorageInput,CapabilityViewsInput,StorageEstimateSnapshot} from '../../types/capabilities-host.ts';
import type {NativeCapabilitiesController,NativeCapabilitiesStatus} from '../../types/native-capabilities.ts';
const sdCapabilitiesHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'capabilities-host','study-director.capabilities-host-module'>|undefined;
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable.');
const createModule=()=>{
function createViews(ports:CapabilityViewsInput){
  const {document,window,notices}=ports;
  let lastInstallationProjectionKey='';
  function renderInstallationProjection(state:NativeCapabilitiesStatus){
    const noticeAction=document.getElementById('install-notice-action') as HTMLButtonElement|null;
    if(noticeAction){
      noticeAction.textContent=state.installationAction==='install'?'Install app':'How to install';
      noticeAction.disabled=state.installInspecting||state.installationState==='installing';
    }
    notices.publish('installation',{
      visible:state.installNoticeVisible,kind:'installation',title:'Install Study Director',
      message:'Install for easier access and a dedicated app window.',
      actionLabel:state.installationAction==='install'?'Install app':'How to install'
    });
    const signature=[state.installationState,state.installationAction,state.installInspecting,state.installFeedback,state.installHelpRequested,state.installNoticeVisible].join('|');
    if(signature!==lastInstallationProjectionKey){
      lastInstallationProjectionKey=signature;
      window.dispatchEvent(new CustomEvent('studydirector:installationchange',{detail:state}));
    }
  }
  function renderNativeCapabilities(state:NativeCapabilitiesStatus|null|undefined){
    if(!state)return;
    const local=document.getElementById('local-data-status');
    const protect=document.getElementById('protect-local-data') as HTMLButtonElement|null;
    const protectedMode=state.storageMode==='protected';
    const retryMode=state.storageMode==='standard'&&state.storageRequestSupported;
    if(local){
      local.hidden=retryMode;
      local.textContent=protectedMode?'Protected':state.storageMode==='unsupported'?'Browser-managed':state.storageBusy?'Checking…':'Browser-managed';
      local.classList.toggle('protected',protectedMode);local.classList.toggle('standard',!protectedMode);
      local.title=state.storageMessage||'';
    }
    if(protect){
      protect.hidden=!retryMode;protect.disabled=state.storageBusy;protect.textContent=state.storageBusy?'Trying…':'Try protection';
      protect.title=state.storageMessage||'Ask the browser to keep Study Director local data in persistent storage.';
    }
    const wakeSetting=document.getElementById('wake-setting');
    const wakeToggle=document.getElementById('keep-screen-awake') as HTMLInputElement|null;
    const wakeIndicator=document.getElementById('wake-lock-indicator');
    if(wakeSetting)wakeSetting.hidden=false;
    if(wakeToggle){wakeToggle.disabled=!state.wakeSupported;wakeToggle.checked=state.keepAwake;wakeToggle.setAttribute('aria-checked',state.keepAwake?'true':'false');}
    if(wakeIndicator){
      wakeIndicator.textContent=!state.wakeSupported?'Unavailable':state.wakeAcquired?'Active':state.keepAwake?'Enabled':'Off';
      wakeIndicator.classList.toggle('enabled',state.keepAwake&&!state.wakeAcquired);
      wakeIndicator.classList.toggle('active',state.wakeAcquired);
    }
    renderInstallationProjection(state);
  }
  return Object.freeze({renderInstallationProjection,renderNativeCapabilities});
}
function createStorage(ports:CapabilityStorageInput){
  const {document,navigator,limits,controller,storageSizeLabel,markStorageHealthError,markStorageHealthOk,renderStorageHealth}=ports;
  let estimate:Readonly<StorageEstimateSnapshot>=Object.freeze({persisted:null,usageBytes:null,quotaBytes:null});
  let checkedAt=0;
  function snapshot(){return estimate;}
  function lastCheckedAt(){return checkedAt;}
  async function inspectStorageCapability(){
    if(!navigator.storage)return null;
    checkedAt=Date.now();
    let persisted:boolean|null=null,rawEstimate:Readonly<{usage?:number;quota?:number}>|null=null;
    try{
      const native=controller();
      if(native){
        const nativeState=await native.inspectStorage();
        persisted=nativeState.storageMode==='protected'?true:nativeState.storageMode==='standard'?false:null;
      }
    }catch{}
    try{if(typeof navigator.storage.estimate==='function')rawEstimate=await navigator.storage.estimate();}catch{}
    const usage=Number(rawEstimate?.usage),quota=Number(rawEstimate?.quota);
    const ratio=Number.isFinite(usage)&&Number.isFinite(quota)&&quota>0?usage/quota:null;
    const use=document.getElementById('local-storage-use');
    if(use)use.textContent=Number.isFinite(usage)?`Browser storage estimate: ${storageSizeLabel(usage)}${ratio!==null?` of ${storageSizeLabel(quota)}`:''}`:'';
    const payload=Object.freeze({version:1,persisted:persisted===true,usageBytes:Number.isFinite(usage)?usage:null,quotaBytes:Number.isFinite(quota)?quota:null,usageRatio:ratio,checkedAt:new Date().toISOString()});
    estimate=Object.freeze({persisted,usageBytes:payload.usageBytes,quotaBytes:payload.quotaBytes});
    if(ratio!==null&&ratio>=limits.storageCriticalRatio){
      markStorageHealthError('capacity',`Storage is ${Math.round(ratio*100)}% full (${storageSizeLabel(usage)} of ${storageSizeLabel(quota)}). Export a backup and free browser storage before continuing.`);
    }else if(ratio!==null&&ratio>=limits.storageWarningRatio){
      markStorageHealthError('capacity',`Storage usage is ${Math.round(ratio*100)}%. Export a recent backup and monitor available browser storage.`,{level:'warn'});
    }else markStorageHealthOk('capacity');
    return payload;
  }
  async function protectLocalData(){
    const native=controller();if(!native)return false;
    const state=await native.protectLocalData();
    const persisted=state.storageMode==='protected'?true:state.storageMode==='standard'?false:null;
    estimate=Object.freeze({...estimate,persisted});
    renderStorageHealth();
    return persisted===true;
  }
  return Object.freeze({snapshot,lastCheckedAt,inspectStorageCapability,protectLocalData});
}
function createInstallation(ports:CapabilityInstallationInput){
  const {document,window,controller,goTab,preferredScrollBehavior}=ports;
  async function openInstallationGuide(){
    const native=controller();if(!native)return false;
    native.revealInstallHelp();
    if(!await goTab('guide',{source:'install-guide'}))return false;
    window.requestAnimationFrame(()=>document.getElementById('guide-install-card')?.scrollIntoView({block:'center',behavior:preferredScrollBehavior()}));
    return true;
  }
  async function runInstallationAction(options:Readonly<{dismissNotice?:boolean}>={}){
    const native=controller();if(!native)return false;
    const state=native.status();
    if(state.installationAction==='install')return native.promptInstall();
    if(state.installationAction==='help'||state.installationAction==='find'){
      if(options.dismissNotice===true)native.dismissInstallNotice();
      return openInstallationGuide();
    }
    return false;
  }
  function dismissInstallNotice(){return controller()?.dismissInstallNotice()??null;}
  function setKeepAwake(value:unknown){const native=controller();return native?native.setKeepAwake(value):Promise.resolve(null);}
  async function offerInstallNotice(){const native=controller();return native?native.offerInstallNotice():null;}
  return Object.freeze({openInstallationGuide,runInstallationAction,dismissInstallNotice,setKeepAwake,offerInstallNotice});
}
function createBadge(ports:CapabilityBadgeInput){
  const {controller,activeSession,persistedActiveSessionUnfinished,capture}=ports;
  function syncFromCanonicalCommit(event:CanonicalCommitBadgeEvent|null|undefined){
    const native=controller();
    if(!native||event?.entityType!=='activeSession')return false;
    const badgeActive=event.operation==='delete'?false:persistedActiveSessionUnfinished(event.value);
    if(native.status().badgeActive!==badgeActive)void native.updateBadge(badgeActive);
    return true;
  }
  async function refreshPersistedSessionBadge(){
    const native=controller();if(!native)return false;
    try{
      const repository=activeSession();
      await repository.settled();
      const loaded=await repository.load();
      const confirmed=!!(loaded?.storage?.idb&&persistedActiveSessionUnfinished(loaded.value));
      return native.updateBadge(confirmed);
    }catch(error){capture('native.badge-refresh',error);return native.updateBadge(false);}
  }
  return Object.freeze({syncFromCanonicalCommit,refreshPersistedSessionBadge});
}
function createController(ports:CapabilityControllerInput):Readonly<NativeCapabilitiesController>{
  const controller=ports.module.createController(Object.freeze({configuration:ports.configuration,environment:ports.environment,hooks:ports.hooks}));
  if(!Object.isFrozen(controller)||controller.format!=='study-director.native-capabilities'||controller.contractVersion!==1){
    throw new Error('Study Director native-capabilities controller is unavailable or incompatible.');
  }
  return controller;
}
return Object.freeze({format:'study-director.capabilities-host-module',contractVersion:1,createViews,createStorage,createInstallation,createBadge,createController});
};
registry.define('capabilities-host',1,createModule);return createModule;
})();
export type CapabilitiesHostModule=ReturnType<typeof sdCapabilitiesHostFactory>;
