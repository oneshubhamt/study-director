import type {PomodoroModule} from '../source/core/pomodoro.ts';
import type {Task,TaskInput,CompletionResult,CompletionSource,TaskOutcome} from './domain.ts';
import type {TimerStateModule} from '../source/core/timer-state.ts';
import type {PracticePacerModule} from '../source/core/practice-pacer.ts';
import type {Limits,RecordHelpers,KeyedRecord,ClockRecord,PauseEvent,RealTimeSnapshot} from './record-models.ts';
import type {TimerMode,ActiveBreak} from './timer-state.ts';
export type TimerController=ReturnType<TimerStateModule['createStateController']>;
export type LivePauseMeta={startedAt:string;endedAt:string;type:string;plannedSeconds?:number|undefined;cueIssuedAt?:string|null};
export type LiveActualSession={startedAt?:string|null;endedAt?:string|null;durationSec?:number;activeSeconds?:number;pausedSeconds?:number;pauseCount?:number;pauseEvents?:PauseEvent[]};
export type LiveActualRecord={idx?:number;taskId?:string;firstStartedAt?:string|null;lastStartedAt?:string|null;lastEndedAt?:string|null;activeSeconds?:number;pausedSeconds?:number;pauseCount?:number;status?:string;sessionCount?:number;sessions?:LiveActualSession[];pauseEvents?:PauseEvent[]};
export type ActualRecordSnapshot={idx:number;taskId:string;firstStartedAt:string|null;lastStartedAt:string|null;lastEndedAt:string|null;activeSeconds:number;pausedSeconds:number;pauseCount:number;status:string;sessionCount?:number;sessions:{startedAt:string|null;durationSec:number;endedAt:string|null;activeSeconds:number;pausedSeconds:number;pauseCount:number}[];pauseEvents:PauseEvent[]};
export interface TaskSessionFields{completion:number;completionSource:CompletionSource;actualTime:number;actualClock:ClockRecord;actualRecords:LiveActualRecord;notes:{done?:number;total?:number}}
export interface TaskSessionPort{
 indexSnapshot<K extends keyof TaskSessionFields>(field:K):Record<string,TaskSessionFields[K]>;
 getField<K extends keyof TaskSessionFields>(index:number,field:K):TaskSessionFields[K]|undefined;
 setField<K extends keyof TaskSessionFields>(index:number,field:K,value:TaskSessionFields[K]|undefined):boolean;
 resolvedState(index:number):'done'|'skipped'|null;
}
export type TaskEvidence={idx:number;task:Task;resolved:CompletionResult;pct:number|null;outcome:TaskOutcome;actualSeconds:number;clock:ClockRecord;record:Partial<ActualRecordSnapshot>};
export type RuntimeEvidence={actualTime:Record<string,number>;actualRecords:Record<string,ActualRecordSnapshot>;taskEvidence:Record<string,TaskEvidence>};
export type PlannedRow={idx:number;t:Task;start:number;end:number};
export type TimerBoundary={idx:number;task:Task;start:number;end:number};
export type SoundMetadata={system?:boolean;title?:string;message?:string};
export interface SoundOperation{resolve():unknown;update(event:SoundMetadata&{cue:string;occurrence:string}):unknown}
export interface TimerEngineInput{ports:{
 configuration:{APP_LIMITS:Limits;SLEEP_GAP_THRESHOLD_MS:number};
 state:{TASKS:readonly Task[];TIMER_MODES:TimerStateModule['TIMER_MODES'];TaskIdentity:TimerController['taskIdentity'];TaskSessionState:TaskSessionPort;TimerState:TimerController;resetBreakState(clear?:boolean):void;setCurrentTask(index:number):unknown;setTimerMode(mode:TimerMode,reason:string):unknown};
 domain:Pick<RecordHelpers,'boundedInt'|'clampText'>&{KeyedRecord:KeyedRecord;cleanDayRevision(value:unknown):number;fmtOver(seconds:number):string;fmtS(seconds:number):string;makeTaskId(task:TaskInput,index:number):string;positiveMinutes(value:unknown):number;shortTaskLabel(task:Task):string;studyMinuteToHHMM(minutes:number):string;taskAreaValue(task:Task):string;taskMeasureValue(task:Task,fallback?:string):string;taskTargetValue(task:Task):number|null};
 schedule:{adjustedEndMin(index:number):number;adjustedStartMin(index:number):number;effectiveNowMin(date?:Date):number;findNextIncompleteTrackableAfter(index:number):number;getLatestCarryForward():string;getScheduleDerivedState():{adjustmentsRevision:number};handleStudyDayRollover():void;hasAdjustedTiming(index:number):boolean;isFixedBlock(task:Task|undefined):boolean;isLiveTrackableTimer():boolean;isTaskResolved(index:number):boolean;isTrackableBlock(task:Task|undefined):boolean;isWorkBlock(task:Task|undefined):boolean;originalEndMin(index:number):number;originalStartMin(index:number):number;plannedRows():PlannedRow[];scheduleFingerprint():string;studyDayRolledOver():boolean};
 persistence:{compactPauseEvents(value:unknown,extra?:PauseEvent):PauseEvent[];compactRealTimeSnapshot(value:unknown):RealTimeSnapshot|null;flushLiveDraft():void;maybeSnapshotRunningTimer():void;recoverySetStatus(message:string,warn:boolean):void;saveLiveDraft():void;saveNote():void;writeLiveDraftNow():void};
 view:{cachedElements<K extends string>(owner:object,ids:Record<K,string>):Record<K,HTMLElement|null>;clearExecuteStateOverlay():void;invalidateExecuteIdleDisplay():void;refreshPnote(options?:{force?:boolean}):void;refreshExecuteIdleDisplay():void;requestRender(...parts:string[]):void;setElementStyle(element:HTMLElement|null,name:string,value:string):boolean;setElementText(element:Element|null,value:string):boolean;setTextSafe(id:string,value:string):void;setExecuteControlsEnabled(value:boolean):void;setExecuteShellVisible(value:boolean):void;showDone():void;showEmpty(message?:string):void;textEl(tag:string,className:string):HTMLElement};
 reviewEvidence:{applicableNotesForTask(task:Task):{exactKey:string;exactLabel:string;exactText:string;inherited:{key:string;label:string;value:string;text:string}[]};buildRealTimeSnapshot():unknown;exactTaskCompletionPercent(index:number,options:{actualSnapshot:Record<string,number>;resolved:CompletionResult}):number|null;focusCompletionForTask(index:number,actualSnapshot?:Record<string,number>|null,options?:{cap?:number}):number|null;getReviewDate():string;liveTaskOutcome(index:number,options:{actualSnapshot:Record<string,number>;resolved:CompletionResult;exactPct:number|null}):TaskOutcome;resolveTaskCompletion(index:number,options:{actualSnapshot:Record<string,number>}):CompletionResult;storeResolvedCompletion(index:number,options?:{source?:CompletionSource|null;pct?:number|null;actualSnapshot?:Record<string,number>|null;preserveDone?:boolean}):CompletionResult;toggleDoneState(index:number):'done'|'skipped'|'reopened-skip'|null|false;setTaskDoneState(index:number):void;setTaskSkippedState(index:number):void;updateRealTimeAwareness():void;updateTimerFocusMetrics():void};
 clock:{nowMs():number};clockEnvironment:{cancelAnimationFrame(handle:number):void;clearInterval(handle:number):void;document:Document;getComputedStyle(element:Element):CSSStyleDeclaration;requestAnimationFrame(callback:FrameRequestCallback):number;setInterval(callback:()=>void,ms:number):number;setTimeout(callback:()=>void,ms:number):number;window:Pick<Window,'matchMedia'>};
 userPreferences:{Pomodoro:ReturnType<PomodoroModule['createController']>;notifications:{begin(event:{source:'timer';id:'execution';surface:'quiet';foreground:false}):SoundOperation}};
 ownership:{appCanMutate():boolean};practice:{controller:ReturnType<PracticePacerModule['createController']>;model:ReturnType<PracticePacerModule['createModel']>};
}}
export type RestoredBreak={startedAtMs:number;now:number;activeBreak:Partial<ActiveBreak>|null;overrunCapped:boolean};
