export type DomainLimits=Readonly<Record<'maxAreaNameChars'|'maxDurationMinutes'|'maxScheduleChars'|'maxScheduleRows'|'maxTaskNameChars'|'maxTasksPerDay'|'maxUnitChars',number>>;
export type TaskKind='work'|'support'|'fixed';
export type ScheduleRow={start:string;dur:number;name:string;kind:TaskKind;area:string;measure:string;target:number|null};
export type Task=ScheduleRow&{id:string};
// Partial input is accepted by the existing normalization helpers; it is not a stored record.
export type TaskInput={id?:unknown;start?:string;dur?:number;name?:unknown;kind?:unknown;area?:string;measure?:string;target?:number|null;completionSource?:unknown;completion?:unknown;skipped?:boolean;actualSeconds?:number;doneFlag?:boolean};
export type RowInput={start:string;dur:number;name:unknown;kind?:unknown;area?:unknown;measure?:unknown;target?:number|null};
export type TimelineRow={start?:number;end?:number;startMin?:number;endMin?:number;idx?:number};
export type CompletionSource='units'|'manual'|'time'|'finished-time'|'finished-unverified'|'skipped'|'none';
export type TaskOutcome='full'|'partial'|'skipped'|'untouched'|'finished-unverified'|'zero-output';
export type CompletionInput={skipped?:boolean;source?:unknown;storedPct?:number|null;unitPct?:number|null;focusPct?:number|null;doneFlag?:boolean;preferStoredAuto?:boolean};
export type CompletionResult={pct:number;source:CompletionSource};
export type TimelineEntry={index:number;row:ScheduleRow;lineNo:number;clockStart:number;start:number;end:number;crossesMidnight:boolean};
export type TimelineAnalysis={timeline:TimelineEntry[];errors:string[];warnings:string[]};
export type ScheduleParse={ok:true;kind:'ok';parsed:ScheduleRow[];warnings:string[];timeline:TimelineEntry[];rawOriginal:string;raw:string}|{ok:false;kind:'empty'|'too-large'|'too-many-rows'|'errors'|'no-tasks'|'timeline';message:string;parsed:[];errors?:string[];warnings?:string[];rawOriginal:string;raw:string};
export interface TimeModel{
 readonly rolloverHour:4;readonly dayMinutes:1440;
 clockToMinute(value:unknown):number;formatHHMM(value:unknown):string;clockMinuteToStudyMinute(value:unknown):number;
 studyMinuteToClockMinute(value:unknown):number;studyMinuteToHHMM(value:unknown):string;currentStudySecond(date?:Date):number;
 formatSeconds(value:number):string;formatOvertime(value:number):string;formatDuration(value:number):string;
 isValidHHMM(value:unknown):boolean;normalizeHHMM(value:unknown):string;isValidIsoDate(value:unknown):boolean;isoDateDay(value:unknown):number|null;minuteOfDay(date?:Date):number;positiveMinutes(value:unknown):number;
}
export interface ScheduleModel{
 token(value:unknown):string;normalizeKind(kind:unknown,area?:unknown,task?:unknown):TaskKind;
 isWork(task:TaskInput|null|undefined):boolean;isSupport(task:TaskInput|null|undefined):boolean;isFixed(task:TaskInput|null|undefined):boolean;isTrackable(task:TaskInput|null|undefined):boolean;isPomodoroEligible(task:TaskInput|null|undefined):boolean;hasNotes(task:TaskInput|null|undefined):boolean;
 normalizeTarget(value:unknown):number|null;makeRow(input:RowInput):ScheduleRow;parseText(value:unknown):ScheduleParse;isCanonicalText(value:unknown):boolean;analyzeTimeline(rows:ScheduleRow[],lineNos?:number[]):TimelineAnalysis;warningsMessage(warnings:unknown,limit?:number):string;
 buildTasks<T extends TaskInput>(rows:readonly T[]):(T&{id:string})[];textFromRows(rows:ScheduleRow[]):string;fingerprint(rows:ScheduleRow[]):string;chronologicalRows<T extends TimelineRow>(rows:readonly T[]):T[];startMinutes(rows:ScheduleRow[]):number[];
 normalizeArea(value:unknown):string;displayArea(value:unknown):string;areaValue(task:TaskInput|null|undefined):string;measureValue(task:TaskInput|null|undefined,fallback?:string):string;targetValue(task:TaskInput|null|undefined):number|null;areaLabel(task:TaskInput|null|undefined):string;areaKey(task:TaskInput|null|undefined):string;parentAreaKeys(key:unknown):string[];cleanIdentifierText(value:unknown):string;
}
export interface CompletionModel{
 normalizeSource(value:unknown):CompletionSource;clampPercent(value:unknown):number;fromUnits(done:unknown,total:unknown):number|null;parseProgressNumber(value:unknown):number|null;
 progressInput(done:unknown,total:unknown,defaultTotal?:unknown):{done:number|null;total:number|null;pct:number|null;hasDone:boolean;hasTotal:boolean};
 fromFocus(actual:unknown,planned:unknown,options?:{cap?:number}):number|null;storedSource(source:unknown):CompletionSource;needsFocus(input?:CompletionInput):boolean;resolve(input?:CompletionInput):CompletionResult;
}
export interface OutcomeModel{
 classify(task?:TaskInput):TaskOutcome;emptyCounts():Record<TaskOutcome,number>;count(tasks:TaskInput[]):Record<TaskOutcome,number>;sanitizeCounts(value:unknown):Record<TaskOutcome,number>;total(value:unknown):number;info(value:unknown):{status:string;label:string};summary(value:unknown,options?:{includeZero?:boolean}):string;
}
export interface DomainModule{
 readonly format:'study-director.domain';readonly contractVersion:1;
 readonly TimeModel:TimeModel;readonly ScheduleModel:ScheduleModel;readonly CompletionModel:CompletionModel;readonly OutcomeModel:OutcomeModel;
 readonly COMPLETION_SOURCES:Readonly<{UNITS:'units';MANUAL:'manual';TIME:'time';FINISHED_TIME:'finished-time';FINISHED_UNVERIFIED:'finished-unverified';SKIPPED:'skipped';NONE:'none'}>;
 readonly TASK_OUTCOMES:Readonly<{FULL:'full';PARTIAL:'partial';SKIPPED:'skipped';UNTOUCHED:'untouched';FINISHED_UNVERIFIED:'finished-unverified';ZERO_OUTPUT:'zero-output'}>;
 makeTaskId(task:TaskInput|null|undefined,index:number):string;
}
