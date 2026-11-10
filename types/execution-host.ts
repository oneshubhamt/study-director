import type {CompletionModel,CompletionResult,CompletionSource,OutcomeModel,Task,TaskOutcome} from './domain.ts';
import type {TimerStateInput} from './timer-state.ts';
import type {TaskSessionFields,TimerEngineInput} from './timer-engine.ts';
import type {PomodoroInput} from './pomodoro.ts';
import type {PracticeControllerPorts,PracticeModelInput} from './practice-pacer.ts';
import type {TimerStateModule} from '../source/core/timer-state.ts';
import type {PomodoroModule} from '../source/core/pomodoro.ts';
import type {PracticePacerModule} from '../source/core/practice-pacer.ts';
import type {TimerEngineModule} from '../source/core/timer-engine.ts';

export type RuntimeTaskSessionFields=TaskSessionFields&{
  completion:number;
  completionSource:CompletionSource;
};
export type TaskSessionField=keyof RuntimeTaskSessionFields;
export type TaskResolvedState='done'|'skipped'|null;

export interface TaskIdentityPort{
  idAt(index:number):string|null;
  indexMap():ReadonlyMap<string,number>;
  indexForId(taskId:unknown,indexMap?:ReadonlyMap<string,number>|null):number|null;
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
  schedule:Omit<TimerPorts['schedule'],'isTaskResolved'>;
  reviewEvidence:Pick<TimerPorts['reviewEvidence'],'applicableNotesForTask'|'buildRealTimeSnapshot'|'getReviewDate'|'updateRealTimeAwareness'|'updateTimerFocusMetrics'>;
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
