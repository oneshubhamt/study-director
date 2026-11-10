import type {Task,TaskInput} from './domain.ts';
import type {TimerPayload,PracticeState,SessionTaskState} from './record-models.ts';
export type TimerMode='empty'|'ready'|'running'|'paused'|'done'|'suspended';
export type DeepReadonly<T>=T extends object?{readonly [K in keyof T]:DeepReadonly<T[K]>}:T;
export type TimerTask=Task;
export type Runtime={taskIdx:number|null;startMs:number|null;durationSec:number;totalPausedMs:number;pausedStartedMs:number|null;recordedSec:number;overtimeNotified:boolean;lastTickMs:number|null;sleepPausedMs:number};
export type RuntimeInput=Partial<Record<keyof Runtime,unknown>>;
export type TimerSession={studyDate:string|null;currentTaskId:string|null;contentRevision:number;savedRevision:number};
export type InactiveGap=NonNullable<TimerPayload['pendingInactiveGap']>&{id?:string;taskIdx?:number|null;secondaryGaps?:number};
export type InactiveGapPatch={[K in keyof InactiveGap]?:InactiveGap[K]|undefined};
export type ActiveBreak=NonNullable<TimerPayload['activeBreak']>&{taskIdx?:number};
export type ScheduleAdjustment={start?:number;end?:number;startMin?:number;endMin?:number;reason?:string;changedAt?:string|null};
export interface TimerStateInput{helpers:{makeTaskId(task:TaskInput,index:number):string};diagnostics:{capture(scope:string,error:unknown,severity:'warn'|'error'):void};effects:{modeChanged(previous:TimerMode,next:TimerMode,reason:string):void}}
export interface SnapshotInput{version?:number;date?:string;fingerprint?:string;taskState?:Record<string,SessionTaskState>;timerRuntime?:TimerPayload|null;latestCarryForward?:string;updatedAt?:string;review?:{reflection:string;studyQuality:number|null};practice?:PracticeState}
export interface EvidenceBase{date?:string;taskEvidence?:Readonly<Record<string,unknown>>;practiceRuns?:readonly unknown[]}
// Freezing an object preserves accessor setters; mark only its data/method
// properties readonly so the checked API reflects that platform behavior.
export type MutableControllerKey='mode'|'currentIndex'|'paused'|'runtime'|'inactiveGap'|'activeBreak'|'breakStartMs'|'currentBreakSec'|'pendingRestore'|'originalSchedule'|'adjustedSchedule'|'scheduleAnchorMin'|'studyDate'|'contentRevision'|'savedRevision';
export interface TimerAccessors{
 get mode():TimerMode;set mode(value:TimerMode);
 get currentIndex():number;set currentIndex(value:number);
 get paused():boolean;set paused(value:boolean);
 get runtime():Readonly<Runtime>;set runtime(value:RuntimeInput);
 get inactiveGap():Readonly<InactiveGapPatch>|null;set inactiveGap(value:InactiveGapPatch|null);
 get activeBreak():Readonly<Partial<ActiveBreak>>|null;set activeBreak(value:Partial<ActiveBreak>|null);
 get breakStartMs():number|null;set breakStartMs(value:number|null);
 get currentBreakSec():number;set currentBreakSec(value:number);
 get pendingRestore():DeepReadonly<TimerPayload>|null;set pendingRestore(value:TimerPayload|null);
 get originalSchedule():readonly DeepReadonly<TaskInput>[];set originalSchedule(value:readonly TaskInput[]);
 get adjustedSchedule():Readonly<Record<string,Readonly<ScheduleAdjustment>>>;set adjustedSchedule(value:Readonly<Record<string,Readonly<ScheduleAdjustment>>>);
 get scheduleAnchorMin():number;set scheduleAnchorMin(value:number);
 get studyDate():string|null;set studyDate(value:string|null);
 get contentRevision():number;set contentRevision(value:number);
 get savedRevision():number;set savedRevision(value:number);
}
export type FrozenController<T>=Readonly<Omit<T,MutableControllerKey>>&TimerAccessors;
