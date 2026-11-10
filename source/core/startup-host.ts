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
      peerStorageReset:input.hooks.peerStorageReset,
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

const createModule=():StartupHostContract=>freeze({
  format:'study-director.startup-host-module',contractVersion:1,createActivation,createOwnershipController,createCoordinator
});
registry.define('startup-host',1,createModule);return createModule;
})();
export type StartupHostModule=ReturnType<typeof sdStartupHostFactory>;
