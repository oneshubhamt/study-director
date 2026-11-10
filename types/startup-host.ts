import type {OwnershipInput} from './ownership.ts';
import type {OwnershipModule} from '../source/core/ownership.ts';
import type {ActivationContract,ActivationEvent,ActivationKind,StartupCoordinator,StartupLifecycleInput,StartupLifecycleModule} from './startup.ts';

export interface ActivationInput{capture(scope:string,error:unknown,severity?:'error'):unknown}
export type OwnershipController=ReturnType<OwnershipModule['createOwnershipController']>;
export interface OwnershipHydrationInput{
  hydratePlanData():unknown|PromiseLike<unknown>;
  hydratePlanRuntime():unknown;
  renderSavedPlans():unknown;
  hydratePrimary(options:Readonly<{sameTabReload:boolean}>):unknown|PromiseLike<unknown>;
  censusUnsupported():unknown|PromiseLike<unknown>;
  hydrateSavedDrafts(options:Readonly<{forcePreferences:true;failClosed:true}>):unknown|PromiseLike<unknown>;
}
export interface OwnershipLifecycleInput{
  isReady():boolean;
  resumeStorageReset():unknown;
}
export interface OwnershipPassThroughHooks{
  render:OwnershipInput['hooks']['render'];
  refreshStorage:OwnershipInput['hooks']['refreshStorage'];
  stopExecution:OwnershipInput['hooks']['stopExecution'];
  resume:OwnershipInput['hooks']['resume'];
  refreshCore:OwnershipInput['hooks']['refreshCore'];
  scheduleMaintenance:OwnershipInput['hooks']['scheduleMaintenance'];
  practiceRender:OwnershipInput['hooks']['practiceRender'];
  blocked:OwnershipInput['hooks']['blocked'];
  peerStorageReset:(detectedAt:string)=>unknown;
  invalidate:OwnershipInput['hooks']['invalidate'];
  flush:OwnershipInput['hooks']['flush'];
  settled:OwnershipInput['hooks']['settled'];
}
export interface OwnershipHostInput{
  readonly module:OwnershipModule;
  readonly config:OwnershipInput['config'];
  readonly environment:OwnershipInput['environment'];
  readonly local:OwnershipInput['local'];
  readonly diagnostics:OwnershipInput['diagnostics'];
  readonly activation:ActivationContract;
  readonly reloadHint:()=>boolean;
  readonly lifecycle:Readonly<OwnershipLifecycleInput>;
  readonly hydration:Readonly<OwnershipHydrationInput>;
  readonly hooks:Readonly<OwnershipPassThroughHooks>;
}
export interface StartupHostCoordinatorInput{
  readonly module:StartupLifecycleModule;
  readonly environment:StartupLifecycleInput['environment'];
  readonly diagnostics:StartupLifecycleInput['diagnostics'];
  readonly activation:ActivationContract;
  readonly ownership:OwnershipController;
  readonly timer:StartupLifecycleInput['timer'];
  readonly flushers:StartupLifecycleInput['flushers'];
  readonly startup:StartupLifecycleInput['startup'];
}
export interface StartupHostModule{
  readonly format:'study-director.startup-host-module';readonly contractVersion:1;
  createActivation(input:Readonly<ActivationInput>):Readonly<ActivationContract>;
  createOwnershipController(input:Readonly<OwnershipHostInput>):Readonly<OwnershipController>;
  createCoordinator(input:Readonly<StartupHostCoordinatorInput>):Readonly<StartupCoordinator>;
}
export type {ActivationEvent,ActivationKind};
