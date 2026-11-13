import type {DomainModule,TaskKind,CompletionSource} from './domain.ts';
import type {PRODUCTION_LIMITS} from '../contracts/production-limits.mjs';
export type Limits=typeof PRODUCTION_LIMITS;
export interface BoundedOptions<F extends number|null>{min:number;max:number;fallback:F;integer?:boolean}
export interface RecordHelpers{
 boundedInt<F extends number|null>(value:unknown,options:BoundedOptions<F>):number|F;
 boundedNumber<F extends number|null>(value:unknown,options:BoundedOptions<F>):number|F;
 clampText(value:unknown,max:number):string;clampEditorContent(value:unknown,max:number):string;editorContentWithinLimits(value:unknown):boolean;
 optionalBoundedNumber(value:unknown,options:{min:number;max:number;integer?:boolean}):number|null;optionalText(value:unknown,max:number):string|null;
 safeBoolean(value:unknown):boolean;sameDataValue(a:unknown,b:unknown):boolean;normalizeStudyQuality(value:unknown):number|null;
 todayISO():string;dateInsightsMeta(date:string):{dayOfWeek:number;dayName:string};
 sanitizePracticeRun(value:unknown,options:{unitLimit:number;allowedTaskIds:Set<string>}):PracticeRun|null;
}
export interface Timestamps{
 normalizeTimestamp(value:unknown,fallback:null):string|null;normalizeTimestamp(value:unknown,fallback:string):string;
 normalizeImportedTimestamp(value:unknown,fallback:null):string|null;normalizeImportedTimestamp(value:unknown,fallback:string):string;
 normalizeImportedEpochMillis(value:unknown,fallback:null):number|null;normalizeImportedEpochMillis(value:unknown,fallback:number):number;
}
export interface DataContract{schemas:{LocalRecoveryEnvelope:{version:1};DailyRecord:{version:16};DailySummary:{version:5};ActiveSession:{version:10};SessionSnapshot:{version:6};PendingReview:{version:2};Backup:{version:24};Note:{version:3;trashKeyPrefix:string}}}
export interface KeyedRecord{create<T>():Record<string,T>}
export type PracticePlan={mode:'time'|'marks';groups:[number,number][];segments?:([number]|[number,string])[]};
export type PracticeRun={targetMs:number;unitMs:number[];partial?:true;taskId?:string;unitPlan?:PracticePlan;sessionTargetMs?:number;totalUnits?:number};
export type PracticeActive=PracticeRun&{taskId:string;currentMs:number;anchorMs:number|null;pauseCause:string|null;cueStage:number};
export type PracticeState={active:PracticeActive|null;runs:PracticeRun[]};
export type PauseEvent={startedAt:string|null;endedAt:string|null;seconds:number;type:string;plannedSeconds?:number;cueIssuedAt?:string|null};
export type Adjustment={startMin:number;endMin:number;reason:string;changedAt:string|null};
export type DailyResult={adjustedStart?:string;completion?:number;completionSource?:CompletionSource;done?:number;total?:number;actualSeconds?:number;actualStart?:string;actualEnd?:string;actualStartLocalMinute?:number|null;actualStartUtcOffsetMinutes?:number|null;actualStartTimeZone?:string;pauseEvents?:PauseEvent[];sessionCount?:number;skipped?:true;doneFlag?:true};
export type StoredSchedule={id:string;start:string;duration:number;name:string;kind:TaskKind;area:string;measure:string;target:number|null};
export type RealTimeSnapshot={capturedAt:string|null;scheduledIdx:number|null;scheduledName:string|null;scheduledKind:TaskKind|null;currentIdx:number|null;currentName:string|null;match:boolean;driftKind:string;driftMinutes:number|null;driftLabel:string};
export type TimerPayload={version:2;taskId:string;mode:'paused'|'running';paused:boolean;timerState:{startMs:number;durationSec:number;totalPausedMs:number;pausedStartedMs:number|null;recordedSec:number;overtimeNotified:boolean;lastTickMs:number|null;sleepPausedMs:number};updatedAt:string;nudgeCycle?:{startSec:number};pendingInactiveGap?:{gapMs:number;promptMs:number;detectedAtMs:number;lastMs:number;source:string};activeBreak?:{type:'pomodoro'|'manual';startedAtMs:number;plannedSeconds:number;cueIssuedAt:string|null;doneNotified:boolean}};
export type DailyBase={version:number;date:string;savedAt:string;updatedAt:string;sourceRevision:number;reflection:string};
export type DiaryRecord=DailyBase&{recordKind:'diary'};
export type StudyRecord=DailyBase&{recordKind:'study';quote:string;studyQuality:number|null;realTimeSnapshot:RealTimeSnapshot|null;schedule:StoredSchedule[];results:Record<string,DailyResult>;practiceRuns:PracticeRun[];carryForwardDraft:string};
export type DailyRecord=DiaryRecord|StudyRecord;
export type NoteFields={label?:string;text?:string};
export type NoteRecord={version:number;key:string;label:string;text:string;updatedAt:string;links?:string[]};
export type AreaSummary=Record<string,{planned:number;completed:number;actual:number;activityBlocks:number}>;
export type ClockRecord={startedAt?:string;endedAt?:string;startedAtLocalMinute?:number;startedAtUtcOffsetMinutes?:number;startedAtTimeZone?:string};
export type ActualRecord={firstStartedAt?:string;lastStartedAt?:string;lastEndedAt?:string;activeSeconds?:number;pausedSeconds?:number;pauseCount?:number;sessionCount?:number;status?:string;sessions?:{startedAt:string|null;durationSec:number;endedAt:string|null;activeSeconds:number;pausedSeconds:number;pauseCount:number}[];pauseEvents?:PauseEvent[]};
export type SessionTaskState={resolvedState?:'done'|'skipped';completion?:number;completionSource?:CompletionSource;progress?:{done?:number;total?:number};actual?:{seconds?:number;clock?:ClockRecord;record?:ActualRecord}};
export type SessionSnapshot={version:number;date:string;fingerprint:string;contentRevision:number;savedRevision:number;currentTaskId:string|null;taskState:Record<string,SessionTaskState>;scheduleAdjustments:Record<string,Adjustment>;timerRuntime:TimerPayload|null;latestCarryForward:string;updatedAt:string;review:{reflection:string;studyQuality:number|null};practice?:PracticeState};
export type ActiveSession={id:string;type:'activeSession';version:number;revision:number;date:string;status:'suspended'|'active';runningOn:string;scheduleText:string;snapshot:SessionSnapshot;suspendedAt:string|null;updatedAt:string};
export type SessionEvidence=Pick<ActiveSession,'date'|'scheduleText'|'snapshot'>;
export interface DailyInput{limits:Limits;dataContract:DataContract;domain:DomainModule;keyedRecord:KeyedRecord;helpers:RecordHelpers;timestamps:Timestamps;timer:{modes:{PAUSED:'paused';RUNNING:'running'};defaultBreakSeconds:()=>number}}
export interface ActiveInput{limits:Limits;dataContract:DataContract;activeSessionId:string;domain:Pick<DomainModule,'CompletionModel'|'COMPLETION_SOURCES'>;keyedRecord:KeyedRecord;timestamps:Timestamps;dailyRecordCodec:{compactPauseEvents(value:unknown,extra?:unknown):PauseEvent[];sanitizeTimerRuntimePayload(value:unknown):TimerPayload|null};helpers:Pick<RecordHelpers,'boundedInt'|'boundedNumber'|'clampText'|'clampEditorContent'|'editorContentWithinLimits'|'sameDataValue'|'normalizeStudyQuality'>&{cleanDayRevision(value:unknown):number;activeSessionScheduleFingerprint(value:{date:string;scheduleText:string}):string;isCanonicalScheduleText(value:unknown):boolean;isValidIsoDate(value:unknown):boolean;parseProgressNumber(value:unknown):number|null;sanitizePracticeState(value:unknown):PracticeState}}
export type PersonalPreferences={studentName:string|null;theme:string|null;presentation:string|null;quote:string|null;practiceCueMode:string|null;fontScale:number|null;practiceTargetMs:number|null;nudge:{enabled:boolean;sound?:boolean;nudgeAfter:number;breakMinutes:number}|null;soundMode?:'full'|'minimal'|'off'};
export type SavedPlans={draft:string|null;savedPlans:readonly {id:string;label:string;scheduleText:string;createdAt:string;updatedAt:string}[];defaultId:string|null};
export type PersonalData={version:2;plans:SavedPlans;preferences:PersonalPreferences};
export type ReviewSubject='note'|'savedDay'|'personal'|'session';
export type ReviewValues={note:NoteFields|null;savedDay:DailyRecord|null;personal:PersonalData|null;session:ActiveSession|null};
export type PendingReview={[K in ReviewSubject]:{version:number;id:string;subject:K;ref:string;keptAt:string;keptFrom:string;keptChangedAt:string;kept:ReviewValues[K];base:NoteFields|null;resolvedAt:string}}[ReviewSubject];
export type OpenReview=Exclude<PendingReview,{subject:'personal'}>|(Extract<PendingReview,{subject:'personal'}>&{kept:PersonalData});
export interface PendingReviewInput{dataContract:DataContract;dailyRecordCodec:{noteKeys:{isId(value:unknown):boolean};sanitizeNoteFields(value:unknown):NoteFields|null;sanitizeCurrentDailyRecord(value:unknown):DailyRecord|null};activeSessionCodec:{sanitizeCurrent(value:unknown):ActiveSession|null;contentValue(value:unknown):unknown};personalDataCodec:{normalize(value:unknown):PersonalData};helpers:{sameDataValue(a:unknown,b:unknown):boolean;randomBytes(count:number):Uint8Array}}
export type DailyTaskView={idx:number;id:string;name:string;kind:TaskKind;area:string;areaKey:string;areaLabel:string;dur:number;measure:string;target:number|null;studyOrdinal:number;studyBlockCount:number;isFirstStudyBlock:boolean;isLastStudyBlock:boolean;originalStart:string;originalEnd:string;adjustedStart:string;adjustedEnd:string;hasAdjustment:boolean;completion:number|null;completionSource:CompletionSource;done:number|null;enteredTotal:number|null;actualSeconds:number|null;actualDeltaSeconds:number|null;actualStart:string|null;actualEnd:string|null;actualStartLocalMinute:number|null;actualStartUtcOffsetMinutes:number|null;actualStartTimeZone:string|null;pauseEvents:PauseEvent[];sessionCount:number;skipped:boolean;doneFlag:boolean};
