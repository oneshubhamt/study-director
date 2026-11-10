import type {CompletionSource} from './domain.ts';
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
export type ExecutionTimerPorts=Omit<TimerPorts,'state'|'practice'|'userPreferences'|'schedule'>&{
  schedule:Omit<TimerPorts['schedule'],'isTaskResolved'>;
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
  hooks:Readonly<{syncStudyQuiet():void}>;
}
