export type ActivationKind='ordinary-focus'|'visibility-return'|'background'|'ownership-takeover'|'date-rollover'|'exit';
export interface ActivationKinds{
  readonly ORDINARY_FOCUS:'ordinary-focus';readonly VISIBILITY_RETURN:'visibility-return';readonly BACKGROUND:'background';
  readonly OWNERSHIP_TAKEOVER:'ownership-takeover';readonly DATE_ROLLOVER:'date-rollover';readonly EXIT:'exit';
}
export interface ActivationEvent{
  readonly format:'study-director.activation-event';readonly contractVersion:1;readonly sequence:number;readonly kind:ActivationKind;
  readonly source:string;readonly destructive:boolean;readonly at:string;
}
export interface ActivationStatus{
  readonly format:'study-director.activation-status';readonly contractVersion:1;readonly sequence:number;
  readonly last:ActivationEvent|null;readonly kinds:Readonly<ActivationKinds>;
}
export interface ActivationContract{
  readonly format:'study-director.activation-contract';readonly contractVersion:1;readonly kinds:Readonly<ActivationKinds>;
  publish(kind:ActivationKind,source?:string,options?:Readonly<{destructive?:boolean}>):Readonly<ActivationEvent>;
  subscribe(listener:(event:Readonly<ActivationEvent>)=>unknown):()=>boolean;
  status():Readonly<ActivationStatus>;
}
export interface StartupFailure{
  readonly code:'STARTUP_INITIALIZATION_FAILED';readonly message:string;readonly at:string;readonly causeCode?:string;
}
export interface StartupStatus{
  readonly format:'study-director.startup-lifecycle-status';readonly contractVersion:1;
  readonly startRequested:boolean;readonly waitingForDom:boolean;readonly initializing:boolean;readonly fullyInitialized:boolean;
  readonly state:'idle'|'initializing'|'ready'|'failed';readonly failed:boolean;readonly failedStage:string;
  readonly lastFailure:Readonly<StartupFailure>|null;readonly domBindingsInstalled:boolean;readonly lifecycleInstalled:boolean;readonly exitHandled:boolean;
  readonly completedStages:readonly string[];
}
type Operation=()=>unknown|PromiseLike<unknown>;
export interface StartupLifecycleInput{
  readonly environment:Readonly<{
    document:Pick<Document,'readyState'|'hidden'|'addEventListener'>;
    window:Pick<Window,'addEventListener'>;
  }>;
  readonly diagnostics:Readonly<{guard(scope:string,operation:()=>unknown):unknown}>;
  readonly ownership:Readonly<{
    install:Operation;evaluate:()=>boolean|PromiseLike<boolean>;canMutate():boolean;hasControl():boolean;writeLease():unknown;
    flushAndRelease():unknown|PromiseLike<unknown>;transitionReleasing():unknown;release():unknown;setPrimary(value:boolean):unknown;
  }>;
  readonly timer:Readonly<{stopPresentation():unknown;syncAfterWake():unknown}>;
  readonly flushers:Readonly<{planDraft:Operation;preferences:Operation;activeSession:Operation;notes:Operation;deletionRecovery:Operation}>;
  readonly startup:Readonly<{
    prepareCanonicalData:Operation;restoreAppearance:Operation;bindDom:Operation;recoverInterruptedLibraryClear:Operation;recoverInterruptedRestore:Operation;
    loadNotes:Operation;hydrateDrafts:Operation;previewPlan:Operation;startClock:Operation;startHeaderClock:Operation;refreshCoreUi:Operation;
    renderRecovery:Operation;checkBackup:Operation;showEmptyIfNeeded:Operation;openInitialTab:Operation;restoreActiveSession:Operation;
    showNameSetup:Operation;inspectStorage:Operation;reconcileLifecycle:Operation;applyLaunchRoute:Operation;verifyReady:Operation;
    markReady(proof:unknown):unknown|PromiseLike<unknown>;reportFailure(failure:Readonly<StartupFailure&{stage:string}>):unknown;clearFailure:Operation;
  }>;
  readonly activation:Readonly<{publish(kind:ActivationKind,source?:string,options?:Readonly<{destructive?:boolean}>):unknown}>;
}
export interface StartupCoordinator{
  start():Readonly<StartupStatus>;
  installDomBindings():boolean;
  installLifecycle():boolean;
  flush():boolean;
  status():Readonly<StartupStatus>;
}
export interface StartupLifecycleModule{
  readonly format:'study-director.startup-lifecycle';readonly contractVersion:1;
  createCoordinator(input:Readonly<StartupLifecycleInput>):Readonly<StartupCoordinator>;
}
