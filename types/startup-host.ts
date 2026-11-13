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
  createOwnershipViews(input:Readonly<OwnershipViewsInput>):Readonly<{renderOwnershipBanner():void;renderOwnershipUi():void;requirePrimaryTab(event:Event|null,reason?:string):boolean;renderPrimaryTabBlock(status:import('./ownership.ts').OwnershipStatus,reason:string):void}>;
  createStages(input:Readonly<StartupStagesInput>):StartupLifecycleInput['startup'];
  createDraftHydration(input:Readonly<StartupDraftHydrationInput>):(options?:{forcePreferences?:boolean;failClosed?:boolean})=>Promise<boolean>;
  createWake(input:Readonly<{quiesced():boolean;sync():unknown}>):()=>unknown;
  createActivation(input:Readonly<ActivationInput>):Readonly<ActivationContract>;
  createOwnershipController(input:Readonly<OwnershipHostInput>):Readonly<OwnershipController>;
  createCoordinator(input:Readonly<StartupHostCoordinatorInput>):Readonly<StartupCoordinator>;
}
export type {ActivationEvent,ActivationKind};
export interface StartupStagesInput{
 document:Document;window:Window;version:string;notices:Pick<import('../source/core/notice-coordinator.ts').NoticeCoordinator,'dismiss'|'publish'>;
 stages:Pick<StartupLifecycleInput['startup'],'bindDom'|'recoverInterruptedLibraryClear'|'loadNotes'|'hydrateDrafts'|'previewPlan'|'refreshCoreUi'|'renderRecovery'|'checkBackup'|'openInitialTab'|'applyLaunchRoute'|'showNameSetup'>;
 profileSafe():boolean;census():unknown;preferencesHydrated():boolean;applyProtectedAppearance():unknown;restoreTheme():unknown;restorePresentation():unknown;restoreFontScale():unknown;
 hydratePlan():PromiseLike<unknown>;readRestoreJournal():Promise<unknown>;waitForClosedTabLease():PromiseLike<unknown>;recoverRestore():PromiseLike<unknown>;
 tickClock():unknown;updateHeader():unknown;setInterval(callback:()=>unknown,ms:number):number;setTimeout(callback:()=>unknown,ms:number):number;
 hasTasks():boolean;showEmpty():unknown;canMutate():boolean;restoreSession():PromiseLike<boolean>;refreshBadge():PromiseLike<unknown>;inspectStorage():PromiseLike<unknown>;offerInstallNotice():PromiseLike<unknown>;topology():PromiseLike<{usable:boolean}>;
 setFastFenceReady(value:boolean):void;reseedEpoch():PromiseLike<unknown>;capture(scope:string,error:unknown,level:'warn'|'error'):unknown;reconcileChangeClock():PromiseLike<unknown>;resumeStorageReset():unknown;
 installBackground():unknown;scheduleMaintenance():unknown;wakeBackground(reason:string):unknown;installSessionWatch():unknown;refreshKeptVersions():PromiseLike<unknown>;announceUnsupported():unknown;renderUnsupported():unknown;
 collectProfiles():PromiseLike<{error?:unknown}>;askProfilePassword():unknown;collectFiles():Promise<unknown>;preloadInsights():unknown;confirmBoot():Promise<unknown>;offerDeviceRecovery():Promise<unknown>;
 reportUnsupported():boolean;setPlanStatus(message:string,ok:boolean):unknown;noticeCanCompact(message:string):boolean;getReviewDate():string;reconcileLifecycle(kind:string,options:{date:string;autoDate:boolean}):unknown;
}
export interface StartupDraftHydrationInput{
 document:Document;hydratePlan():PromiseLike<unknown>;hydratePreferences(options:{force:boolean}):PromiseLike<unknown>;capture(scope:string,error:unknown,level:'error'):unknown;markStorageError(scope:string,message:string):unknown;
 projectPlan(options?:{fallback:true}):unknown;renderSavedPlans():unknown;quote():string;quoteChanged(options:{markChanged:false}):unknown;
}

export interface OwnershipViewsInput{
 document:Document;OWNERSHIP_STATES:OwnershipModule['OWNERSHIP_STATES'];AppOwnership:OwnershipController;NoticeCoordinator:Pick<import('../source/core/notice-coordinator.ts').NoticeCoordinator,'stopSound'>;
 appCanMutate():boolean;claimAppControl(force:boolean):unknown;setPlanStatus(message:string,ok:boolean):unknown;
 mutationStatus():{recoveryFault?:unknown;recoveryKind?:unknown}|null;ready():boolean;syncPlanAccess():unknown;projectOwnership():unknown;wakeBackground(reason:string):unknown;syncWake():unknown;
}
