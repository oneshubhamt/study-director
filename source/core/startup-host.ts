import type {OwnershipViewsInput} from '../../types/startup-host.ts';
import type {OwnershipState,OwnershipStatus} from '../../types/ownership.ts';
import type {StartupStagesInput,StartupDraftHydrationInput} from '../../types/startup-host.ts';
import type {StartupLifecycleInput} from '../../types/startup.ts';
import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {ActivationContract,ActivationEvent,ActivationKind,ActivationKinds} from '../../types/startup.ts';
import type {OwnershipHostInput,StartupHostCoordinatorInput,StartupHostModule as StartupHostContract} from '../../types/startup-host.ts';

const sdStartupHostFactory=(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:ModuleRegistration<'startup-host','study-director.startup-host-module'>|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
const freeze=Object.freeze;

function createActivation(input:Readonly<{capture(scope:string,error:unknown,severity?:'error'):unknown}>):Readonly<ActivationContract>{
  exactObject(input,['capture'],'Startup activation input');
  functions(input,['capture'],'Startup activation diagnostics');
  const kinds:Readonly<ActivationKinds>=freeze({
    ORDINARY_FOCUS:'ordinary-focus',VISIBILITY_RETURN:'visibility-return',BACKGROUND:'background',
    OWNERSHIP_TAKEOVER:'ownership-takeover',DATE_ROLLOVER:'date-rollover',EXIT:'exit'
  });
  const valid=new Set<ActivationKind>(Object.values(kinds));
  const listeners=new Set<(event:Readonly<ActivationEvent>)=>unknown>();
  let sequence=0,last:Readonly<ActivationEvent>|null=null;
  function publish(kind:ActivationKind,source='',options:Readonly<{destructive?:boolean}>={}){
    if(!valid.has(kind))throw new TypeError(`Unknown Study Director activation kind: ${kind}`);
    const event=freeze({
      format:'study-director.activation-event' as const,contractVersion:1 as const,sequence:++sequence,kind,
      source:String(source||kind),destructive:options.destructive===true,at:new Date().toISOString()
    });
    last=event;
    listeners.forEach(listener=>{try{listener(event);}catch(error){input.capture('activation.listener',error,'error');}});
    return event;
  }
  function subscribe(listener:(event:Readonly<ActivationEvent>)=>unknown){
    if(typeof listener!=='function')throw new TypeError('Activation listener must be a function.');
    listeners.add(listener);return ()=>listeners.delete(listener);
  }
  function status(){return freeze({format:'study-director.activation-status' as const,contractVersion:1 as const,sequence,last,kinds});}
  return freeze({format:'study-director.activation-contract' as const,contractVersion:1 as const,kinds,publish,subscribe,status});
}

function createOwnershipController(input:Readonly<OwnershipHostInput>){
  exactObject(input,['module','config','environment','local','diagnostics','activation','reloadHint','lifecycle','hydration','hooks'],'Startup ownership host input');
  if(typeof input.reloadHint!=='function')throw new TypeError('Startup ownership reload hint must be a function.');
  exactObject(input.lifecycle,['isReady','resumeStorageReset'],'Startup ownership lifecycle');
  functions(input.lifecycle,['isReady','resumeStorageReset'],'Startup ownership lifecycle');
  exactObject(input.hydration,['hydratePlanData','hydratePlanRuntime','renderSavedPlans','hydratePrimary','censusUnsupported','hydrateSavedDrafts'],'Startup ownership hydration');
  functions(input.hydration,['hydratePlanData','hydratePlanRuntime','renderSavedPlans','hydratePrimary','censusUnsupported','hydrateSavedDrafts'],'Startup ownership hydration');
  exactObject(input.hooks,['render','refreshStorage','stopExecution','resume','refreshCore','scheduleMaintenance','practiceRender','blocked','peerStorageReset','invalidate','flush','settled'],'Startup ownership hooks');
  functions(input.hooks,['render','refreshStorage','stopExecution','resume','refreshCore','scheduleMaintenance','practiceRender','blocked','peerStorageReset','invalidate','flush','settled'],'Startup ownership hooks');
  if(!Object.isFrozen(input.config)||!Object.isFrozen(input.environment)||!Object.isFrozen(input.local)||!Object.isFrozen(input.diagnostics)||!Object.isFrozen(input.activation)||!Object.isFrozen(input.lifecycle)||!Object.isFrozen(input.hydration)||!Object.isFrozen(input.hooks))throw new TypeError('Startup ownership contracts must be frozen.');
  if(input.module.format!=='study-director.ownership'||input.module.contractVersion!==1)throw new TypeError('Ownership module is unavailable or incompatible.');
  if(input.activation.format!=='study-director.activation-contract'||input.activation.contractVersion!==1)throw new TypeError('Activation contract is unavailable or incompatible.');
  const controller=input.module.createOwnershipController(freeze({
    config:input.config,
    environment:input.environment,
    local:input.local,
    diagnostics:input.diagnostics,
    hooks:freeze({
      render:input.hooks.render,
      refreshStorage:input.hooks.refreshStorage,
      stopExecution:input.hooks.stopExecution,
      isInitialized:input.lifecycle.isReady,
      hydrate:async(options:Readonly<{sameTabReload:boolean}>)=>{
        await input.hydration.hydratePlanData();
        input.hydration.hydratePlanRuntime();
        input.hydration.renderSavedPlans();
        const result=await input.hydration.hydratePrimary(freeze({sameTabReload:!!options.sameTabReload||input.reloadHint()}));
        input.activation.publish(input.activation.kinds.OWNERSHIP_TAKEOVER,'app-ownership',{destructive:true});
        if(input.lifecycle.isReady())input.lifecycle.resumeStorageReset();
        return result;
      },
      finalizeHydration:async()=>{
        await input.hydration.censusUnsupported();
        await input.hydration.hydrateSavedDrafts(freeze({forcePreferences:true,failClosed:true}));
      },
      resume:input.hooks.resume,
      refreshCore:input.hooks.refreshCore,
      scheduleMaintenance:input.hooks.scheduleMaintenance,
      practiceRender:input.hooks.practiceRender,
      blocked:input.hooks.blocked,
      peerStorageReset:(detectedAt:string)=>{void Promise.resolve().then(()=>input.hooks.peerStorageReset(detectedAt)).catch(error=>input.diagnostics.capture('storage-reset.peer',error,'error'));},
      invalidate:input.hooks.invalidate,
      flush:input.hooks.flush,
      settled:input.hooks.settled
    })
  }));
  if(!Object.isFrozen(controller)||controller.format!=='study-director.app-ownership-controller'||controller.contractVersion!==1)throw new TypeError('App ownership controller is unavailable or incompatible.');
  return controller;
}

function createCoordinator(input:Readonly<StartupHostCoordinatorInput>){
  exactObject(input,['module','environment','diagnostics','activation','ownership','timer','flushers','startup'],'Startup coordinator host input');
  if(!Object.isFrozen(input.environment)||!Object.isFrozen(input.diagnostics)||!Object.isFrozen(input.activation)||!Object.isFrozen(input.ownership)||!Object.isFrozen(input.timer)||!Object.isFrozen(input.flushers)||!Object.isFrozen(input.startup))throw new TypeError('Startup coordinator contracts must be frozen.');
  if(input.module.format!=='study-director.startup-lifecycle'||input.module.contractVersion!==1)throw new TypeError('Startup lifecycle module is unavailable or incompatible.');
  const coordinator=input.module.createCoordinator(freeze({
    environment:input.environment,
    diagnostics:input.diagnostics,
    activation:freeze({publish:(kind:ActivationKind,source?:string,options?:Readonly<{destructive?:boolean}>)=>input.activation.publish(kind,source,options)}),
    ownership:freeze({
      install:input.ownership.install,evaluate:input.ownership.evaluate,canMutate:input.ownership.canMutate,hasControl:input.ownership.hasControl,
      writeLease:input.ownership.writeLease,flushAndRelease:input.ownership.flushAndRelease,transitionReleasing:input.ownership.transitionReleasing,
      release:input.ownership.release,setPrimary:input.ownership.setPrimary
    }),
    timer:input.timer,
    flushers:input.flushers,
    startup:input.startup
  }));
  if(!Object.isFrozen(coordinator))throw new TypeError('Startup lifecycle coordinator is unavailable.');
  return coordinator;
}

function createOwnershipViews(ports:Readonly<OwnershipViewsInput>){
const {document,OWNERSHIP_STATES,AppOwnership,NoticeCoordinator,appCanMutate,claimAppControl,setPlanStatus}=ports;
let ownershipBanner:HTMLDivElement|null=null;
function renderOwnershipBanner(){
  const mutationStatus=ports.mutationStatus();
  const recoveryFault=String(mutationStatus&&mutationStatus.recoveryFault||'').trim();
  const recoveryKind=String(mutationStatus&&mutationStatus.recoveryKind||'');
  const transient=([
    OWNERSHIP_STATES.RESOLVING,OWNERSHIP_STATES.ACQUIRING,
    OWNERSHIP_STATES.HYDRATING,OWNERSHIP_STATES.RELEASING
  ] as readonly OwnershipState[]).includes(AppOwnership.state);
  if(!recoveryFault&&(AppOwnership.state===OWNERSHIP_STATES.PRIMARY||transient)){
    if(ownershipBanner){ownershipBanner.remove();ownershipBanner=null;}
    return;
  }
  const bannerState=recoveryFault?`recovery-fault:${recoveryKind||'data'}`:AppOwnership.state;
  if(ownershipBanner&&ownershipBanner.dataset['ownershipState']===bannerState)return;
  if(ownershipBanner){ownershipBanner.remove();ownershipBanner=null;}
  ownershipBanner=document.createElement('div');
  ownershipBanner.className='ownership-banner ui-card on';
  ownershipBanner.dataset['ownershipState']=bannerState;
  ownershipBanner.setAttribute('role','status');
  const copy=document.createElement('div');
  copy.className='ownership-copy';
  const title=document.createElement('b');
  title.textContent=recoveryFault?(recoveryKind==='library-clear'?'Library data recovery required':'Data recovery required'):AppOwnership.state===OWNERSHIP_STATES.FAULTED?'Study Director control unavailable':'Study Director controlled elsewhere';
  const body=document.createElement('span');
  body.textContent=recoveryFault
    ? recoveryKind==='library-clear'?'Study Director retained the Library-clear journal. Reload to complete recovery. Do not clear site data.':'Study Director retained the recovery journal. Reload to complete recovery. Do not clear site data.'
    : AppOwnership.state===OWNERSHIP_STATES.FAULTED
    ? 'Study Director write ownership could not be established safely. Browsing remains available; retry after browser storage recovers.'
    : 'Another live tab controls Study Director writes. This tab remains read-only until you take control.';
  copy.append(title,body);
  ownershipBanner.appendChild(copy);
  if(!recoveryFault&&AppOwnership.state===OWNERSHIP_STATES.SECONDARY){
    const btn=document.createElement('button');
    btn.className='mini-btn ui-btn primary';
    btn.type='button';
    btn.textContent='Take control';
    btn.addEventListener('click',()=>claimAppControl(true));
    ownershipBanner.appendChild(btn);
  }
  document.body.appendChild(ownershipBanner);
}
function renderOwnershipUi(){
  if(!appCanMutate())NoticeCoordinator.stopSound();
  if(ports.ready())ports.syncPlanAccess();
  ports.projectOwnership();
  renderOwnershipBanner();
  ports.wakeBackground('ownership');
  void ports.syncWake();
}

function requirePrimaryTab(event:Event|null,reason='change this tab'){
  if(AppOwnership.canMutate())return true;
  if(event){event.preventDefault();event.stopPropagation();}
  return AppOwnership.requirePrimary(reason);
}
function renderPrimaryTabBlock(status:OwnershipStatus,reason:string){
  if(status.hydrating){
    setPlanStatus('Reloading the latest canonical state from storage before enabling this tab.',false);
    return;
  }
  if(([OWNERSHIP_STATES.RESOLVING,OWNERSHIP_STATES.ACQUIRING,OWNERSHIP_STATES.RELEASING] as readonly OwnershipState[]).includes(status.state)){
    setPlanStatus('Study Director ownership is being resolved. Try again after the transfer finishes.',false);
    return;
  }
  if(status.state===OWNERSHIP_STATES.FAULTED){
    setPlanStatus(`Study Director control is unavailable because its ownership record failed. Restore browser storage before trying to ${reason}.`,false);
    return;
  }
  renderOwnershipBanner();
  setPlanStatus(`Study Director control is in another tab. Take control here to ${reason}.`,false);
}

return freeze({renderOwnershipBanner,renderOwnershipUi,requirePrimaryTab,renderPrimaryTabBlock});
}

function createStages(p:Readonly<StartupStagesInput>):StartupLifecycleInput['startup']{
 let clockInterval:number|null=null,headerInterval:number|null=null;
 return freeze({...p.stages,
  prepareCanonicalData:()=>{if(!p.profileSafe())throw Object.assign(new Error('The device profile list could not be read safely. Profile-owned storage was not opened for use.'),{code:'STUDY_DIRECTOR_PROFILE_REGISTRY_UNREADABLE'});return p.census();},
  restoreAppearance:()=>{if(p.preferencesHydrated()){p.applyProtectedAppearance();return;}p.restoreTheme();p.restorePresentation();p.restoreFontScale();},
  recoverInterruptedRestore:async()=>{await p.hydratePlan();if(await p.readRestoreJournal().catch(()=>null))await p.waitForClosedTabLease();return p.recoverRestore();},
  startClock:()=>{p.tickClock();if(clockInterval===null)clockInterval=p.setInterval(p.tickClock,1000);},
  startHeaderClock:()=>{p.updateHeader();if(headerInterval===null)headerInterval=p.setInterval(p.updateHeader,60000);},
  showEmptyIfNeeded:()=>{if(!p.hasTasks())p.showEmpty();},
  restoreActiveSession:async()=>{const restored=p.canMutate()?await p.restoreSession():false;await p.refreshBadge();return restored;},
  inspectStorage:async()=>{const state=await p.inspectStorage();await p.offerInstallNotice();return state;},
  verifyReady:async()=>{if(!(await p.topology()).usable)throw new Error('Canonical database topology is unavailable.');return freeze({canonical:true});},
  markReady:async proof=>{
   if(!proof||typeof proof!=='object'||!('canonical' in proof)||proof.canonical!==true)throw new Error('Canonical startup proof is unavailable.');
   p.setFastFenceReady(false);try{await p.reseedEpoch();p.setFastFenceReady(true);}catch(error){p.capture('startup.canonical-mutation-epoch',error,'warn');}
   await p.reconcileChangeClock();p.resumeStorageReset();p.installBackground();p.scheduleMaintenance();p.wakeBackground('startup');p.installSessionWatch();void p.refreshKeptVersions();p.announceUnsupported();p.renderUnsupported();
   void Promise.resolve(p.collectProfiles()).then(result=>{if(result.error)p.capture('profiles.collect',result.error,'warn');});p.askProfilePassword();
   void p.collectFiles().catch(error=>p.capture('backup.file-cleanup',error,'warn'));
   p.document.documentElement.dataset['studyDirectorCanonicalBaseline']='verified';p.document.documentElement.dataset['studyDirectorStartupState']='ready';p.document.documentElement.dataset['studyDirectorReady']='true';p.notices.dismiss('startup-failure');
   p.window.dispatchEvent(new CustomEvent('studydirector:canonicalstatus',{detail:proof}));p.window.dispatchEvent(new CustomEvent('studydirector:startupready',{detail:freeze({version:p.version,canonical:true})}));
   p.preloadInsights();void p.confirmBoot().catch(error=>p.capture('pwa.boot-confirmation',error,'warn'));p.setTimeout(()=>{void p.offerDeviceRecovery().catch(error=>p.capture('backup.device-recovery-offer',error,'warn'));},0);return proof;
  },
  reportFailure:failure=>{
   p.document.documentElement.dataset['studyDirectorStartupState']='failed';p.document.documentElement.dataset['studyDirectorReady']='false';
   if(p.reportUnsupported()){p.setPlanStatus('This profile needs a newer version of Study Director. Its data is left as it is.',false);return;}
   if(failure.causeCode==='STUDY_DIRECTOR_PROFILE_REGISTRY_UNREADABLE'){
    const message='Study Director could not safely identify the active local profile. Profile-owned data was left unopened. Reload once; if this continues, update or recover the browser data before creating or replacing profiles.';
    p.notices.publish('startup-failure',{visible:true,kind:'safety',title:'Profile list could not be read safely',message,compact:p.noticeCanCompact(message)});p.setPlanStatus('Startup stopped before profile data opened. Do not create or replace profiles until the device profile list is recovered.',false);return;
   }
   const message='Study Director could not safely finish loading your stored data. Your existing data has not been replaced. Reload or restore from backup if the problem continues.';
   p.notices.publish('startup-failure',{visible:true,kind:'safety',title:'Study Director could not finish starting',message,compact:p.noticeCanCompact(message)});p.setPlanStatus(`Startup stopped safely at ${String(failure.stage||'startup')}. Reload the app before making changes.`,false);
  },
  clearFailure:()=>{p.notices.dismiss('startup-failure');p.document.documentElement.dataset['studyDirectorStartupState']='initializing';},
  reconcileLifecycle:()=>p.reconcileLifecycle('app-restart-ready',{date:p.getReviewDate(),autoDate:p.document.getElementById('day-date')?.dataset['autoDate']==='1'})
 });
}
function createDraftHydration(p:Readonly<StartupDraftHydrationInput>){
 return async({forcePreferences=false,failClosed=false}:{forcePreferences?:boolean;failClosed?:boolean}={})=>{
  let planError:unknown=null,preferencesError:unknown=null;
  try{await p.hydratePlan();}catch(error){planError=error;p.capture('startup.plan-hydrate',error,'error');p.markStorageError('planDraft',error instanceof Error?error.message:'Saved Plan data could not be hydrated.');}
  try{await p.hydratePreferences({force:forcePreferences});}catch(error){preferencesError=error;p.capture('startup.preferences-hydrate',error,'error');p.markStorageError('personalPreferences',error instanceof Error?error.message:'Personal settings could not be hydrated.');}
  if(planError)p.projectPlan({fallback:true});else{p.projectPlan();p.renderSavedPlans();}
  if(!preferencesError){const qi=p.document.querySelector<HTMLTextAreaElement|HTMLInputElement>('#quote-input'),q=p.quote()||'';if(qi&&q){qi.value=q;p.quoteChanged({markChanged:false});}}
  const failure=planError||preferencesError;if(failure&&failClosed)throw failure;return !failure;
 };
}
function createWake(p:Readonly<{quiesced():boolean;sync():unknown}>){return ()=>p.quiesced()?false:p.sync();}

const createModule=():StartupHostContract=>freeze({
  format:'study-director.startup-host-module',contractVersion:1,createOwnershipViews,createStages,createDraftHydration,createWake,createActivation,createOwnershipController,createCoordinator
});
registry.define('startup-host',1,createModule);return createModule;
})();
export type StartupHostModule=ReturnType<typeof sdStartupHostFactory>;
