import type {CompletionModel,CompletionResult,CompletionSource,OutcomeModel,ScheduleModel,Task,TaskOutcome,TimeModel} from './domain.ts';
import type {RealTimeSnapshot} from './record-models.ts';
import type {OriginalScheduleRow,ScheduleAdjustment,TimerStateInput} from './timer-state.ts';
import type {TaskSessionFields,TimerEngineInput} from './timer-engine.ts';
import type {PomodoroInput} from './pomodoro.ts';
import type {PracticeControllerPorts,PracticeModelInput} from './practice-pacer.ts';
import type {TimerStateModule} from '../source/core/timer-state.ts';
import type {PomodoroModule} from '../source/core/pomodoro.ts';
import type {PracticePacerModule} from '../source/core/practice-pacer.ts';
import type {TimerEngineModule} from '../source/core/timer-engine.ts';

export type RuntimeTaskSessionFields=TaskSessionFields;
export type TaskSessionField=keyof RuntimeTaskSessionFields;
export type TaskResolvedState='done'|'skipped'|null;

export interface TaskIdentityPort{
  idAt(index:number):string|null;
  indexMap():ReadonlyMap<string,number>;
  indexForId(taskId:unknown,indexMap?:ReadonlyMap<string,number>|null):number|null;
}
export type ExecutionScheduleRow={idx:number;t:Task;start:number;end:number;plannedStart:number;plannedEnd:number;adjusted:boolean};
export type ExecutionAnchorRow=Pick<ExecutionScheduleRow,'idx'|'t'|'start'|'end'>;
export type ExecutionTimelineRow={kind:'task';idx:number;t:Task;plannedStart:number;plannedEnd:number;startMin:number;endMin:number;completed:boolean;active:boolean;adjusted:boolean};
export type RealTimeScheduleState={
  nowEff:number;first:number|null;last:number|null;scheduledIdx:number|null;scheduledTask:Task|null;scheduledStart:number|null;scheduledEnd:number|null;
  scheduledPlannedStart:number|null;scheduledPlannedEnd:number|null;currentIdx:number|null;currentTask:Task|null;currentStart:number|null;currentEnd:number|null;
  currentPlannedStart:number|null;currentPlannedEnd:number|null;match:boolean;driftMin:number|null;driftKind:'none'|'ahead'|'behind'|'ontrack'|'mismatch';
  driftLabel:string;subline:string;
};
export interface ExecutionScheduleInput{
  tasks:readonly Task[];
  timerState:ReturnType<TimerStateModule['createStateController']>;
  taskSessionState:TaskSessionStore;
  model:Pick<ScheduleModel,'chronologicalRows'|'startMinutes'|'isFixed'|'isTrackable'|'areaValue'|'measureValue'|'targetValue'>;
  time:Pick<TimeModel,'dayMinutes'|'clockToMinute'|'clockMinuteToStudyMinute'|'studyMinuteToHHMM'|'currentStudySecond'|'formatDuration'|'minuteOfDay'>;
  compactAdjustedSchedule(value:unknown):Record<string,ScheduleAdjustment>;
  invalidateDerived(options:{adjustments?:boolean;render?:boolean}):unknown;
}
export interface ExecutionScheduleController{
  readonly format:'study-director.execution-schedule';
  readonly contractVersion:1;
  rebuildOriginalSchedule():readonly OriginalScheduleRow[];
  resetScheduleLayers():void;
  originalStartMin(index:number):number;
  originalEndMin(index:number):number;
  adjustedStartMin(index:number):number;
  adjustedEndMin(index:number):number;
  hasAdjustedTiming(index:number):boolean;
  scheduleWindowLabel(index:number,startMin?:number,endMin?:number):string;
  sanitizeRuntimeAdjustedSchedule(value:unknown):Record<string,ScheduleAdjustment>;
  effectiveNowMin(date?:Date):number;
  plannedRows():ExecutionScheduleRow[];
  isInsideAdjustedWindow(index:number|null|undefined,date?:Date):boolean;
  remainingWindowSeconds(index:number|null|undefined,date?:Date):number;
  fixedAnchorRowsFrom(startIndex:number):ExecutionAnchorRow[];
  avoidFixedAnchorOverlap(startMin:number,durationMin:number,anchors:readonly Pick<ExecutionScheduleRow,'start'|'end'>[]):number;
  nextIncompleteTrackableFrom(fromIndex:number):number|null;
  findNextIncompleteTrackableAfter(index:number):number;
  buildLiveTimeline():ExecutionTimelineRow[];
  getRealTimeState(date?:Date):RealTimeScheduleState;
  buildRealTimeSnapshot():Readonly<RealTimeSnapshot>;
  latestTrackableEndMin():number|null;
}
export interface CompletionEvidenceInput{
  tasks:readonly Task[];
  taskSessionState:TaskSessionStore;
  completionModel:CompletionModel;
  sources:Readonly<{UNITS:'units';MANUAL:'manual';TIME:'time';FINISHED_TIME:'finished-time';FINISHED_UNVERIFIED:'finished-unverified';SKIPPED:'skipped';NONE:'none'}>;
  classifyTaskOutcome:OutcomeModel['classify'];
  taskTargetValue(task:Task):number|null;
  actualTimeSnapshot():Record<string,number>;
  renderCompletionChange(index:number,pct:number,refreshStats?:boolean):unknown;
  saveLiveDraft():unknown;
}
export interface CompletionEvidenceController{
  readonly format:'study-director.completion-evidence';
  readonly contractVersion:1;
  setCompletionSource(index:number,source:unknown):void;
  explicitCompletionSource(index:number):CompletionSource;
  plannedSecondsForCompletion(index:number):number;
  unitCompletionForTask(index:number):number|null;
  progressInputState(index:number,doneValue:unknown,totalValue:unknown,defaultTotal?:unknown):ReturnType<CompletionModel['progressInput']>;
  syncProgressInputsToState(index:number,state:ReturnType<CompletionModel['progressInput']>|null|undefined,options?:{updateUI?:boolean;save?:boolean}):CompletionResult&{changed:boolean};
  clearManualCompletionOverride(index:number,options?:{updateUI?:boolean;save?:boolean}):CompletionResult;
  focusCompletionForTask(index:number,actualSnapshot?:Record<string,number>|null,options?:{cap?:number}):number|null;
  liveTaskOutcome(index:number,options?:{actualSnapshot?:Record<string,number>|null;resolved?:CompletionResult|null;exactPct?:number|null}):TaskOutcome;
  resolveTaskCompletion(index:number,options?:{actualSnapshot?:Record<string,number>|null;preferStoredAuto?:boolean}):CompletionResult;
  exactTaskCompletionPercent(index:number,options?:{actualSnapshot?:Record<string,number>|null;resolved?:CompletionResult|null}):number;
  storeResolvedCompletion(index:number,options?:{source?:CompletionSource|null;pct?:number|null;actualSnapshot?:Record<string,number>|null;preserveDone?:boolean}):CompletionResult;
  setCompletionState(index:number,pct:number,source?:CompletionSource):void;
  toggleDoneState(index:number):TaskResolvedState|'reopened-skip'|false;
  setTaskDoneState(index:number):void;
  setTaskSkippedState(index:number):void;
}
export interface TaskSessionStore{
  readonly format:'study-director.task-session-state';
  readonly contractVersion:1;
  getField<K extends TaskSessionField>(index:number,field:K):RuntimeTaskSessionFields[K]|undefined;
  setField<K extends TaskSessionField>(index:number,field:K,value:RuntimeTaskSessionFields[K]|undefined):boolean;
  deleteField<K extends TaskSessionField>(index:number,field:K):boolean;
  indexSnapshot<K extends TaskSessionField>(field:K):Record<string,RuntimeTaskSessionFields[K]>;
  resolvedState(index:number):TaskResolvedState;
  setResolved(index:number,state:TaskResolvedState):boolean;
  isDone(index:number):boolean;
  isSkipped(index:number):boolean;
  isResolved(index:number):boolean;
  toggleDone(index:number):TaskResolvedState|'reopened-skip';
  resolvedIndices(state:'done'|'skipped'):number[];
  indices():number[];
  clear():void;
}

type TimerPorts=TimerEngineInput['ports'];
export type ExecutionPomodoroPorts=Omit<PomodoroInput['ports'],'state'>;
export type ExecutionPracticePorts=Omit<PracticeControllerPorts,'state'|'schedule'>&{
  schedule:Pick<PracticeControllerPorts['schedule'],'isWorkBlock'>;
};
export type ExecutionTimerPorts=Omit<TimerPorts,'state'|'practice'|'userPreferences'|'schedule'|'reviewEvidence'>&{
  schedule:Pick<TimerPorts['schedule'],'getLatestCarryForward'|'getScheduleDerivedState'|'handleStudyDayRollover'|'isLiveTrackableTimer'|'isWorkBlock'|'scheduleFingerprint'|'studyDayRolledOver'>;
  reviewEvidence:Pick<TimerPorts['reviewEvidence'],'applicableNotesForTask'|'getReviewDate'|'updateRealTimeAwareness'|'updateTimerFocusMetrics'>;
  userPreferences:Pick<TimerPorts['userPreferences'],'notifications'>;
};
export interface ExecutionHostInput{
  modules:Readonly<{
    timerState:TimerStateModule;
    pomodoro:PomodoroModule;
    practicePacer:PracticePacerModule;
    timerEngine:TimerEngineModule;
  }>;
  timerState:TimerStateInput;
  pomodoro:ExecutionPomodoroPorts;
  practiceModel:PracticeModelInput['ports'];
  practice:ExecutionPracticePorts;
  timer:ExecutionTimerPorts;
  schedule:Readonly<{
    model:ExecutionScheduleInput['model'];
    time:ExecutionScheduleInput['time'];
    compactAdjustedSchedule(value:unknown):Record<string,ScheduleAdjustment>;
    invalidateDerived(options:{adjustments?:boolean;render?:boolean}):unknown;
  }>;
  evidence:Readonly<{
    completionModel:CompletionModel;
    sources:CompletionEvidenceInput['sources'];
    classifyTaskOutcome:OutcomeModel['classify'];
    taskTargetValue(task:Task):number|null;
    renderCompletionChange(index:number,pct:number,refreshStats?:boolean):unknown;
    saveLiveDraft():unknown;
  }>;
  hooks:Readonly<{syncStudyQuiet():void}>;
}

export type ExecutionRuntime=ReturnType<import('../source/core/execution-host.ts').ExecutionHostModule['createRuntime']>;
export type TimerRestoreCandidate={runtime:import('./record-models.ts').TimerPayload;idx:number;task:Task;rawState:import('./record-models.ts').TimerPayload['timerState'];durationSec:number};
export interface TimerRestorationInput{
  runtime:ExecutionRuntime;
  DecisionClock:{nowMs():number};
  isTrackableBlock(task:Task|undefined):boolean;
  clampText(value:unknown,limit:number):string;
  invalidateIdleDisplay():void;
  setExecuteShellVisible(visible:boolean):void;
  setExecuteControlsEnabled(enabled:boolean):void;
  clearExecuteStateOverlay():void;
  refreshPnote():void;
  requestRender(...surfaces:string[]):void;
  updateBadges():void;
  flushLiveDraft(options:{markChanged:boolean}):unknown;
}

export type ScheduleProgressMatch={primaryKey:string;areaKey:string};
export type ScheduleProgressFields={[K in keyof RuntimeTaskSessionFields]?:RuntimeTaskSessionFields[K]|undefined}&{target?:number|null;done?:boolean;skipped?:boolean};
export type ScheduleProgressEntry=ScheduleProgressMatch&{idx:number;progress:ScheduleProgressFields};
export type ScheduleProgressSnapshot={date:string;entries:ScheduleProgressEntry[];practiceLinks:(ScheduleProgressMatch&{oldTaskId:string})[];latestCarryForward:string;preview:{total:number;matched:number;practiceTotal:number;practiceMatched:number}};
export type ScheduleGatewayOptions={studyDate?:string;source?:string;progressMigration?:ScheduleProgressSnapshot|null;sessionSnapshot?:import('./record-models.ts').SessionSnapshot|null;reviewOnly?:boolean;lifecycleManaged?:boolean};
export type ScheduleStartupDecision={kind:'done'|'forward-complete'}|{kind:'start';idx:number;seconds:number}|{kind:'wait';idx:number};
export interface ScheduleGatewayInput{
  runtime:ExecutionRuntime;document:Document;ScheduleDerivedState:{renderDirty:boolean};APP_LIMITS:{maxCarryForwardChars:number};
  completionSources:CompletionEvidenceInput['sources'];
  getCarryForward():string;setCarryForward(value:string):void;
  taskAreaKey:ScheduleModel['areaKey'];taskMeasureValue:ScheduleModel['measureValue'];taskTargetValue:ScheduleModel['targetValue'];
  isTrackableBlock:ScheduleModel['isTrackable'];normalizeCompletionSource:CompletionModel['normalizeSource'];
  makeTaskId:import('./domain.ts').DomainModule['makeTaskId'];buildTasks:ScheduleModel['buildTasks'];
  clampText(value:unknown,limit:number):string;isLiveTrackableTimer():boolean;
  saveNote():unknown;captureReviewInputs():unknown;syncUnfinishedNoteDraft():unknown;getReviewDate():string;
  showEmpty(message:string,title?:string):void;refreshCoreUi(options:{header:boolean}):void;showDone():void;
  isValidIsoDate(value:unknown):boolean;todayISO():string;isValidHHMM(value:unknown):boolean;clockMinuteToStudyMinute(value:number):number;t2m(value:string):number;
  invalidateScheduleDerived(options:{identity?:boolean;render?:boolean}):void;
  applySessionSnapshot(snapshot:import('./record-models.ts').SessionSnapshot):boolean;restoreLiveDraftIfAny():boolean;restoreTimerRuntimeIfAny():boolean;
  clearFutureUntouchedProgress():unknown;flushLiveDraft():unknown;scheduleFingerprint():string;writeLiveDraftNow():unknown;
  advanceTaskNoteScheduleRevision():unknown;markDayContentChanged():unknown;clearSessionSafetyMessage(reason:string):unknown;
  SessionLifecycle:Pick<import('./session-lifecycle.ts').SessionCoordinator,'run'|'reconcile'>;
}
