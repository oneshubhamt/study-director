/*
  Study Director Insights Model — portable foundations (M8.1–M8.4)
  Copyright © 2026 Shubham Tiwari and Dr Satyam Kumar. All rights reserved.

  Source-available for personal and noncommercial use only.
  See LICENSE.txt and NOTICE.txt for full terms.
*/
import type {CompletionSource,TaskKind,TaskOutcome} from '../../types/domain.ts';
import type {AreaSummary,DailyTaskView,PauseEvent,PracticeRun} from '../../types/record-models.ts';

type InsightPauseEvent=Partial<PauseEvent>&Readonly<{reason?:string;plannedSeconds?:number|null}>;
type InsightTask=Omit<Partial<DailyTaskView>,'kind'|'completionSource'|'pauseEvents'>&Readonly<{
  kind?:TaskKind|string;completionSource?:CompletionSource|string;pauseEvents?:readonly InsightPauseEvent[];__sdOutcome?:TaskOutcome;
}>;
type InsightRecord=Readonly<{
  date:string;dayName?:string;savedAt?:string;updatedAt?:string;createdAt?:string;studyQuality?:number|null;degraded?:boolean;
  originalPlannedStudyMinutes?:number|null;completedEquivalentMinutes?:number|null;actualFocusMinutes?:number|null;
  shiftedStudyBlocks?:number|null;totalScheduleShiftMinutes?:number|null;netScheduleShiftMinutes?:number|null;
  tasks?:readonly InsightTask[];originalSchedule?:readonly InsightTask[];practiceRuns?:readonly PracticeRun[];
}>;
type InsightSummary=Readonly<{date:string;completedMinutes?:number|null;actualTrackedMinutes?:number|null;outcomeCounts?:Partial<Record<TaskOutcome,number>>;areaSummary?:AreaSummary}>;
type OutcomeClassifier=(task:InsightTask)=>TaskOutcome;
type CompletionEvidenceGroup='explicit'|'time-derived'|'unverified'|'skipped'|'missing';
type OutcomeCounts=Record<TaskOutcome,number>;
type Labelled=Readonly<{label?:string|null}>;
type TimeBand=Readonly<{id:string;label:string;start:number;end:number}>;
type Matrix=number[][];
type Point=Readonly<{x:number;y:number}>;
type WeightedPoint=Readonly<{value:number;weight:number}>;
type LogisticExample=Readonly<{x:readonly number[];y:number;weight?:number}>;
type LogisticFit=Readonly<{ready:boolean;rows:number;reason?:string;positives?:number;negatives?:number;coefficients?:readonly number[];covariance?:Matrix|null;lambda?:number}>;
type Confidence=Readonly<{key:'weak'|'emerging'|'reliable'|'strong';label:string;tone:string}>;
type EvidenceMetadataInput=Readonly<{confidence?:Confidence|null;limitations?:readonly unknown[];observations?:unknown;days?:unknown;effectiveSample?:unknown;intervalWidth?:unknown;method?:unknown}>;
type NormalizedPauseEvent=Readonly<{type:'pomodoro'|'inactive-gap'|'manual';seconds:number;plannedSeconds:number|null}>;
type EvidenceRow=Readonly<{
  record:InsightRecord;task:InsightTask;date:string;kind:TaskKind;subject:string;planned:number;completed:number;actual:number;completion:number;
  source:string;evidenceGroup:CompletionEvidenceGroup;outcome:TaskOutcome;timerBacked:boolean;pauseEvents:readonly NormalizedPauseEvent[];
  frictionDurations:readonly number[];pauseCount:number;
}>;
type EvidenceGroups=Readonly<{all:readonly EvidenceRow[];work:readonly EvidenceRow[];support:readonly EvidenceRow[];fixed:readonly EvidenceRow[]}>;
type EvidenceIndex=Readonly<{records:readonly InsightRecord[];all:readonly EvidenceRow[];work:readonly EvidenceRow[];support:readonly EvidenceRow[];fixed:readonly EvidenceRow[];byRecord:Map<InsightRecord,EvidenceGroups>}>;
type DailySeriesRow=Readonly<{date:string;day:number|null;dayName:string;planned:number;completed:number;actual:number;workBlocks:number;timerBackedBlocks:number;timerBackedPlanned:number;timerCoverage:number|null;completion:number|null;quality:number|null}>;
type ProgressEvidence=Readonly<{total:number;explicitBlocks:number;timeDerivedBlocks:number;unverifiedBlocks:number;missingBlocks:number;skippedBlocks:number;explicitRate:number|null}>;

(function(global:typeof globalThis){
  'use strict';
  const isFiniteNumber=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
  // M8.1 CONFIGURATION COMPONENT
  const InsightsConfig=(()=>{
  const PLUGIN_VERSION='@@SD_RELEASE@@';
  const MIN_BLOCKS_FOR_SIGNAL=3;
  const MIN_RECORDS_FOR_TREND=4;
  const MIN_RECORDS_FOR_COACH_TREND=7;
  const MIN_MEANINGFUL_DIFFERENCE_POINTS=8;
  const MIN_TIMER_COVERAGE_FOR_PLAN_READ=65;
  const COVERAGE_WATCH_REFERENCE_DAYS=365;
  const MIN_PRACTICE_SUMMARY_UNITS=6;
  const MIN_PRACTICE_PATTERN_UNITS=12;
  const MIN_PRACTICE_PATTERN_DAYS=3;
  const MIN_PRACTICE_TREND_DAYS=4;
  const MIN_PRACTICE_AREA_UNITS=6;
  const MIN_PRACTICE_COMPARABLE_RUNS=3;
  const MIN_PRACTICE_COMPARABLE_UNITS=4;
  const PRACTICE_CONTROLLED_MIN=80;
  const PRACTICE_CONTROLLED_MAX=100;
  const PRACTICE_SEVERE_FAST_THRESHOLD=70;
  const MIN_PRACTICE_ESTABLISHED_RUNS=2;
  const MIN_PRACTICE_ESTABLISHED_DAYS=2;
  const MIN_PRACTICE_RELIABLE_RUNS=3;
  const MIN_PRACTICE_RELIABLE_DAYS=3;
  const MIN_PRACTICE_TREND_STABILITY=.75;
  const MIN_PRACTICE_TREND_POINTS_PER_WEEK=5;
  const DIRECTIONAL_TREND_HORIZON_DAYS=730;
  const MAX_PRACTICE_TREND_EXACT_DAYS=90;
  const PRACTICE_TREND_RECENT_OBSERVATIONS=12;
  const PRACTICE_TREND_JACKKNIFE_BLOCKS=10;
  const MIN_MEANINGFUL_PACE_DIFFERENCE_POINTS=10;
  const MIN_MEANINGFUL_PACE_SPREAD_POINTS=25;
  const PRACTICE_POSITION_BANDS=Object.freeze([
    Object.freeze({key:'opening',label:'Opening 20%',start:0,end:.2}),
    Object.freeze({key:'early-middle',label:'Early-middle 20%',start:.2,end:.4}),
    Object.freeze({key:'middle',label:'Middle 20%',start:.4,end:.6}),
    Object.freeze({key:'late-middle',label:'Late-middle 20%',start:.6,end:.8}),
    Object.freeze({key:'final',label:'Final 20%',start:.8,end:1})
  ]);
  const MIN_PRACTICE_POSITION_UNITS=5;
  const MIN_PRACTICE_POSITION_RUNS=3;
  const MIN_PRACTICE_POSITION_DAYS=3;
  const MIN_PRACTICE_SEGMENT_UNITS=6;
  const MIN_PRACTICE_SEGMENT_RUNS=2;
  const MIN_PRACTICE_SEGMENT_DAYS=2;
  const MIN_PRACTICE_SIZE_GROUP_UNITS=6;
  const MIN_PRACTICE_SIZE_GROUP_RUNS=2;
  const MIN_PRACTICE_SIZE_GROUP_DAYS=2;
  const MIN_PRACTICE_TARGET_SPAN_MS=60000;
  const MIN_PRACTICE_POSITION_SLIP_POINTS=10;
  const MIN_PRACTICE_SEGMENT_EFFECT_POINTS=10;
  const MIN_PRACTICE_SIZE_EFFECT_POINTS=10;
  const EVIDENCE_PRIOR_EFFECTIVE_BLOCKS=4;
  const MIN_EVIDENCE_EFFECT_POINTS=6;
  const MIN_HIERARCHICAL_GROUPS=2;
  const HIERARCHICAL_MU_STEPS=19;
  const HIERARCHICAL_RATE_STEPS=41;
  const HIERARCHICAL_KAPPA_GRID=Object.freeze([2,5,12,30,70]);
  const MIN_CHANGE_POINT_DAYS=12;
  const MIN_CHANGE_POINT_SEGMENT_DAYS=5;
  const MIN_CHANGE_POINT_DELTA_POINTS=8;
  const BOCPD_EXPECTED_REGIME_DAYS=35;
  const BOCPD_DETECTION_PROBABILITY=.4;
  const BOCPD_MAX_RUN_LENGTH=180;
  const MIN_ALLOCATION_EVIDENCE_PLANNED=240;
  const MIN_ALLOCATION_EVIDENCE_COMPLETED=60;
  const MIN_CASCADE_TRANSITIONS=8;
  const MIN_ADJUSTED_TRANSITIONS=30;
  const MIN_ADJUSTED_HAZARD_ROWS=40;
  const MIN_ADJUSTED_HAZARD_EVENTS=6;
  const MIN_WORKLOAD_FRONTIER_DAYS=24;
  const MIN_WORKLOAD_FRONTIER_SPAN=120;
  const MIN_FORECAST_BACKTESTS=18;
  const MAX_FORECAST_BACKTESTS=18;
  const FORECAST_CALIBRATION_FOLDS=3;
  const FORECAST_MAX_COMPLETION_MAE_POINTS=30;
  const FORECAST_MIN_NAIVE_MAE_GAIN_POINTS=1;
  const FORECAST_MAX_CALIBRATION_ERROR_POINTS=25;
  const FORECAST_BRIER_BASELINE_TOLERANCE=.03;
  const FORECAST_COMPLETION_RANGE_TARGET=.8;
  const FORECAST_COMPLETION_RANGE_MAX_COVERAGE_ERROR_POINTS=15;
  const WORKLOAD_CURVE_POINTS=25;
  const MIN_STATE_AWARE_FORECAST_TRAINING_DAYS=31;
  const MIN_STATE_AWARE_FORECAST_COMPLETE_DAYS=30;
  const MIN_STATE_AWARE_MAE_GAIN_POINTS=2;
  const STATE_AWARE_BRIER_TOLERANCE=.02;
  const MIN_INTERACTION_CELL_ROWS=5;
  const MIN_INTERACTION_CELL_DAYS=3;
  const MIN_INTERACTION_EFFECT_POINTS=8;
  const MIN_INTERACTION_STABILITY_EFFECT_POINTS=4;
  const MIN_DYNAMIC_ALIGNMENT_PERIODS=4;
  const MIN_DYNAMIC_ALIGNMENT_PERIOD_PLANNED=180;
  const MIN_DYNAMIC_ALIGNMENT_AREA_SHARE=5;
  const MIN_DYNAMIC_ALIGNMENT_GAP_POINTS=8;
  const FITNESS_MIN_MEASUREMENT_SD=10;
  const FITNESS_MAX_MEASUREMENT_SD=36;
  const FITNESS_TRAJECTORY_LOOKBACK_DAYS=14;
  const FITNESS_TRAJECTORY_DELTA_POINTS=5;
  const FITNESS_RECOVERY_DELTA_POINTS=8;
  const FITNESS_RECENT_LOAD_DAYS=7;
  const FITNESS_LOW_STATE_THRESHOLD=60;
  const FITNESS_LOW_STATE_UPPER_BOUND=70;
  const FITNESS_LOW_STATE_MAX_STALENESS_DAYS=7;
  const FITNESS_PARAMETER_WINDOW_OBSERVATIONS=180;
  const FITNESS_PARAMETER_UPDATE_CADENCE=7;
  const MIN_WORKLOAD_LOCAL_SUPPORT_DAYS=4;
  const WORKLOAD_LOCAL_SUPPORT_RADIUS_SD=.6;
  const FITNESS_SOURCE_WEIGHTS=Object.freeze({
    explicit:1,
    'time-derived':.55,
    unverified:.3,
    skipped:1,
    missing:0
  });
  const COACH_SIGNAL_LIMIT=3;
  const COACH_VISIBLE_SIGNAL_LIMIT=2;
  const COACH_SYNTHESIS_LIMIT=4;
  const COACH_SURFACES=Object.freeze([
    Object.freeze({key:'fitness',label:'Current Study State',targetId:'insights-fitness'}),
    Object.freeze({key:'performance',label:'Performance',targetId:'insights-performance'}),
    Object.freeze({key:'output',label:'Study Output',targetId:'insights-output'}),
    Object.freeze({key:'dynamics',label:'Study Dynamics',targetId:'insights-dynamics'}),
    Object.freeze({key:'execution',label:'Execution',targetId:'insights-execution'}),
    Object.freeze({key:'areas',label:'Areas',targetId:'insights-areas'})
  ]);
  const COACH_CONFIDENCE_RANK=Object.freeze({weak:0,emerging:1,reliable:2,strong:3});
  const CONFIDENCE=Object.freeze({
    weak:Object.freeze({key:'weak',label:'Weak signal',tone:'low'}),
    emerging:Object.freeze({key:'emerging',label:'Emerging signal',tone:'watch'}),
    reliable:Object.freeze({key:'reliable',label:'Reliable signal',tone:'good'}),
    strong:Object.freeze({key:'strong',label:'Strong pattern',tone:'strong'})
  });
  const EVIDENCE_BASIS=Object.freeze({history:'All saved history',window:'Selected window'});
  const COACH_MATERIAL_CONCERN_MARGIN=12;
  const DEFAULT_INSIGHT_WINDOW_KEY='30';
  const INSIGHT_WINDOW_OPTIONS=Object.freeze([
    Object.freeze({key:'7',label:'1 week',summary:'Last 7 days',days:7}),
    Object.freeze({key:'14',label:'14 days',summary:'Last 14 days',days:14}),
    Object.freeze({key:'30',label:'30 days',summary:'Last 30 days',days:30}),
    Object.freeze({key:'90',label:'90 days',summary:'Last 90 days',days:90}),
    Object.freeze({key:'all',label:'All',summary:'All records',days:null})
  ]);
  const TIME_BANDS=[
    {id:'morning',label:'Morning',start:5,end:12},
    {id:'afternoon',label:'Afternoon',start:12,end:17},
    {id:'evening',label:'Evening',start:17,end:21},
    {id:'night',label:'Night',start:21,end:5}
  ];
  const START_DELAY_BUCKETS=Object.freeze([
    Object.freeze({id:'on_time',label:'On time / early',min:-Infinity,max:5}),
    Object.freeze({id:'late_5_15',label:'5–15m late',min:5,max:15}),
    Object.freeze({id:'late_15_45',label:'15–45m late',min:15,max:45}),
    Object.freeze({id:'late_45_plus',label:'45m+ late',min:45,max:Infinity})
  ]);
  const MAX_EXPLICIT_BLOCK_ORDER=5;
  const STUDY_DAY_ROLLOVER_MINUTE=4*60;
  const SUPPORT_KINDS=new Set(['support']);
  const FIXED_KINDS=new Set(['fixed']);
  const OUTCOME_KEYS:readonly TaskOutcome[]=Object.freeze(['full','partial','skipped','untouched','finished-unverified','zero-output']);
    return Object.freeze({
      BOCPD_DETECTION_PROBABILITY,BOCPD_EXPECTED_REGIME_DAYS,BOCPD_MAX_RUN_LENGTH,COACH_CONFIDENCE_RANK,
      COACH_MATERIAL_CONCERN_MARGIN,COACH_SIGNAL_LIMIT,COACH_SURFACES,COACH_SYNTHESIS_LIMIT,
      COACH_VISIBLE_SIGNAL_LIMIT,CONFIDENCE,COVERAGE_WATCH_REFERENCE_DAYS,DEFAULT_INSIGHT_WINDOW_KEY,
      DIRECTIONAL_TREND_HORIZON_DAYS,
      EVIDENCE_BASIS,EVIDENCE_PRIOR_EFFECTIVE_BLOCKS,FITNESS_LOW_STATE_MAX_STALENESS_DAYS,
      FITNESS_LOW_STATE_THRESHOLD,FITNESS_LOW_STATE_UPPER_BOUND,FITNESS_MAX_MEASUREMENT_SD,
      FITNESS_MIN_MEASUREMENT_SD,FITNESS_PARAMETER_UPDATE_CADENCE,FITNESS_PARAMETER_WINDOW_OBSERVATIONS,
      FITNESS_RECENT_LOAD_DAYS,FITNESS_RECOVERY_DELTA_POINTS,FITNESS_SOURCE_WEIGHTS,
      FITNESS_TRAJECTORY_DELTA_POINTS,FITNESS_TRAJECTORY_LOOKBACK_DAYS,FIXED_KINDS,
      FORECAST_BRIER_BASELINE_TOLERANCE,FORECAST_CALIBRATION_FOLDS,
      FORECAST_COMPLETION_RANGE_MAX_COVERAGE_ERROR_POINTS,FORECAST_COMPLETION_RANGE_TARGET,
      FORECAST_MAX_CALIBRATION_ERROR_POINTS,FORECAST_MAX_COMPLETION_MAE_POINTS,
      FORECAST_MIN_NAIVE_MAE_GAIN_POINTS,HIERARCHICAL_KAPPA_GRID,HIERARCHICAL_MU_STEPS,HIERARCHICAL_RATE_STEPS,
      INSIGHT_WINDOW_OPTIONS,
      MAX_EXPLICIT_BLOCK_ORDER,
      MAX_FORECAST_BACKTESTS,
      MAX_PRACTICE_TREND_EXACT_DAYS,
      
      MIN_ADJUSTED_HAZARD_EVENTS,MIN_ADJUSTED_HAZARD_ROWS,
      MIN_ADJUSTED_TRANSITIONS,MIN_ALLOCATION_EVIDENCE_COMPLETED,MIN_ALLOCATION_EVIDENCE_PLANNED,
      MIN_BLOCKS_FOR_SIGNAL,MIN_CASCADE_TRANSITIONS,MIN_CHANGE_POINT_DAYS,MIN_CHANGE_POINT_DELTA_POINTS,
      MIN_CHANGE_POINT_SEGMENT_DAYS,MIN_DYNAMIC_ALIGNMENT_AREA_SHARE,MIN_DYNAMIC_ALIGNMENT_GAP_POINTS,
      MIN_DYNAMIC_ALIGNMENT_PERIODS,MIN_DYNAMIC_ALIGNMENT_PERIOD_PLANNED,MIN_EVIDENCE_EFFECT_POINTS,
      MIN_FORECAST_BACKTESTS,MIN_HIERARCHICAL_GROUPS,MIN_INTERACTION_CELL_DAYS,MIN_INTERACTION_CELL_ROWS,
      MIN_INTERACTION_EFFECT_POINTS,MIN_INTERACTION_STABILITY_EFFECT_POINTS,MIN_MEANINGFUL_DIFFERENCE_POINTS,
      MIN_MEANINGFUL_PACE_DIFFERENCE_POINTS,MIN_MEANINGFUL_PACE_SPREAD_POINTS,MIN_PRACTICE_AREA_UNITS,
      MIN_PRACTICE_COMPARABLE_RUNS,MIN_PRACTICE_COMPARABLE_UNITS,
      MIN_PRACTICE_ESTABLISHED_DAYS,MIN_PRACTICE_ESTABLISHED_RUNS,
      MIN_PRACTICE_PATTERN_DAYS,MIN_PRACTICE_PATTERN_UNITS,MIN_PRACTICE_POSITION_DAYS,MIN_PRACTICE_POSITION_RUNS,
      MIN_PRACTICE_POSITION_SLIP_POINTS,MIN_PRACTICE_POSITION_UNITS,MIN_PRACTICE_RELIABLE_DAYS,
      MIN_PRACTICE_RELIABLE_RUNS,MIN_PRACTICE_SEGMENT_DAYS,MIN_PRACTICE_SEGMENT_EFFECT_POINTS,
      MIN_PRACTICE_SEGMENT_RUNS,MIN_PRACTICE_SEGMENT_UNITS,MIN_PRACTICE_SIZE_EFFECT_POINTS,
      MIN_PRACTICE_SIZE_GROUP_DAYS,MIN_PRACTICE_SIZE_GROUP_RUNS,MIN_PRACTICE_SIZE_GROUP_UNITS,
      MIN_PRACTICE_SUMMARY_UNITS,MIN_PRACTICE_TARGET_SPAN_MS,MIN_PRACTICE_TREND_DAYS,
      MIN_PRACTICE_TREND_POINTS_PER_WEEK,MIN_PRACTICE_TREND_STABILITY,MIN_RECORDS_FOR_COACH_TREND,
      MIN_RECORDS_FOR_TREND,MIN_STATE_AWARE_FORECAST_COMPLETE_DAYS,MIN_STATE_AWARE_FORECAST_TRAINING_DAYS,
      MIN_STATE_AWARE_MAE_GAIN_POINTS,MIN_TIMER_COVERAGE_FOR_PLAN_READ,
      MIN_WORKLOAD_FRONTIER_DAYS,MIN_WORKLOAD_FRONTIER_SPAN,
      MIN_WORKLOAD_LOCAL_SUPPORT_DAYS,OUTCOME_KEYS,PLUGIN_VERSION,PRACTICE_CONTROLLED_MAX,
      PRACTICE_CONTROLLED_MIN,PRACTICE_POSITION_BANDS,PRACTICE_SEVERE_FAST_THRESHOLD,
      PRACTICE_TREND_JACKKNIFE_BLOCKS,PRACTICE_TREND_RECENT_OBSERVATIONS,
      START_DELAY_BUCKETS,STATE_AWARE_BRIER_TOLERANCE,STUDY_DAY_ROLLOVER_MINUTE,
      SUPPORT_KINDS,TIME_BANDS,WORKLOAD_CURVE_POINTS,WORKLOAD_LOCAL_SUPPORT_RADIUS_SD
    });
  })();

  // M8.2 PRIMITIVES COMPONENT
  const InsightsPrimitives=((Config:typeof InsightsConfig)=>{
    const {
      COACH_CONFIDENCE_RANK,CONFIDENCE,EVIDENCE_PRIOR_EFFECTIVE_BLOCKS,FIXED_KINDS,MIN_RECORDS_FOR_TREND,
      OUTCOME_KEYS,STUDY_DAY_ROLLOVER_MINUTE,SUPPORT_KINDS,TIME_BANDS
    }=Config;
  function num(value:unknown):number;
  function num(value:unknown,fallback:number):number;
  function num(value:unknown,fallback:null):number|null;
  function num(value:unknown,fallback:number|null=0){
    const n=Number(value);
    return isFiniteNumber(n)?n:fallback;
  }
  function finiteOrNull(value:unknown){
    if(value===null||value===undefined||value==='')return null;
    const n=Number(value);
    return isFiniteNumber(n)?n:null;
  }
  function pct(part:number,total:number){
    return total>0?(part/total)*100:null;
  }
  function pct0(part:number,total:number){
    const value=pct(part,total);
    return value===null?0:value;
  }
  function round(value:unknown,digits=1){
    const scale=Math.pow(10,digits);
    return Math.round(num(value)*scale)/scale;
  }
  function roundNullable(value:number|null|undefined,digits=1){
    return isFiniteNumber(value)?round(value,digits):null;
  }
  function apportionedPercents(values:readonly unknown[],digits=0){
    const clean=(Array.isArray(values)?values:[]).map(value=>Math.max(0,num(value)));
    const total=clean.reduce((sum,value)=>sum+value,0);
    if(!total)return clean.map(()=>0);
    const scale=Math.pow(10,Math.max(0,Math.round(digits))),target=100*scale;
    const exact=clean.map(value=>value/total*target),units=exact.map(Math.floor);
    let remainder=Math.max(0,Math.round(target-units.reduce((sum,value)=>sum+value,0)));
    exact.map((value,index)=>({index,fraction:value-units[index]!}))
      .sort((a,b)=>b.fraction-a.fraction||a.index-b.index)
      .forEach(row=>{if(remainder>0){units[row.index]=units[row.index]!+1;remainder-=1;}});
    return units.map(value=>value/scale);
  }
  function clampPct(value:unknown){
    return Math.max(0,Math.min(100,Math.round(num(value))));
  }
  function isIsoDate(value:unknown):value is string{
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
  }
  function dateDay(iso:unknown){
    if(!isIsoDate(iso))return null;
    const parts=iso.split('-').map(Number);
    return Math.floor(Date.UTC(parts[0]!,parts[1]!-1,parts[2]!)/86400000);
  }
  function dateFromDay(day:number){
    return new Date(day*86400000).toISOString().slice(0,10);
  }
  function localIsoDate(date=new Date()){
    const y=date.getFullYear();
    const m=String(date.getMonth()+1).padStart(2,'0');
    const d=String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  function dayName(iso:unknown){
    if(!isIsoDate(iso))return '';
    return weekdayFormatter.format(new Date(iso+'T00:00:00Z'));
  }
  // Calendar dates have no time zone. Reuse formatters rather than constructing
  // locale machinery for every chart label, and keep the date stable across zones.
  const weekdayFormatter=new Intl.DateTimeFormat('en-IN',{weekday:'short',timeZone:'UTC'});
  const shortDateFormatter=new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',timeZone:'UTC'});
  const shortDateYearFormatter=new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'2-digit',timeZone:'UTC'});
  function shortDate(iso:unknown){
    if(!isIsoDate(iso))return 'No date';
    const includeYear=iso.slice(0,4)!==localIsoDate().slice(0,4);
    return (includeYear?shortDateYearFormatter:shortDateFormatter).format(new Date(iso+'T00:00:00Z'));
  }
  function minutesLabel(minutes:unknown){
    const m=Math.round(Math.abs(num(minutes)));
    if(m<60)return `${m}m`;
    const h=Math.floor(m/60),r=m%60;
    return r?`${h}h ${r}m`:`${h}h`;
  }
  function evidenceMinutesLabel(minutes:unknown){
    const value=Math.abs(num(minutes));
    return value>0&&value<1?'<1m':minutesLabel(value);
  }
  function millisecondsLabel(value:unknown){
    const seconds=Math.round(Math.max(0,num(value))/1000);
    const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;
    if(h)return `${h}h${m?` ${m}m`:''}`;
    if(m)return `${m}m${s?` ${s}s`:''}`;
    return `${s}s`;
  }
  function signedMillisecondsLabel(value:unknown){
    if(!isFiniteNumber(Number(value)))return 'No data';
    const n=Math.round(Number(value));
    if(n===0)return 'on time';
    return `${n>0?'+':'−'}${millisecondsLabel(Math.abs(n))}`;
  }
  function signedMinutesLabel(minutes:unknown){
    const m=Math.round(num(minutes));
    if(m===0)return '0m';
    return `${m>0?'+':'-'}${minutesLabel(m)}`;
  }
  function delayLabel(minutes:unknown){
    if(!isFiniteNumber(Number(minutes)))return 'Need data';
    const m=Math.round(Number(minutes));
    if(m===0)return 'On time';
    return m>0?`${m}m late`:`${Math.abs(m)}m early`;
  }
  function scheduleShiftLabel(minutes:unknown){
    if(!isFiniteNumber(Number(minutes)))return 'No data';
    const m=Math.round(Number(minutes));
    if(m===0)return 'No net movement';
    return `${minutesLabel(Math.abs(m))} ${m>0?'later':'earlier'}`;
  }
  function percentLabel(value:unknown,digits=0){
    return value===null||value===undefined||Number.isNaN(Number(value))?'No data':`${round(num(value),digits)}%`;
  }
  function numberLabel(value:unknown,digits=1){
    return value===null||value===undefined||Number.isNaN(Number(value))?'No data':String(round(value,digits));
  }
  function topLevelAreaLabel(value:unknown){
    return String(value||'General Study').split('>')[0]!.trim().replace(/\s+/g,' ')||'General Study';
  }
  function subjectLabel(task:InsightTask|null|undefined){
    return topLevelAreaLabel((task&&task.areaLabel)||(task&&task.area)||(task&&task.areaKey)||'General Study');
  }
  function canonical(value:unknown){
    return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
  }
  function labelCompare(a:Labelled|null|undefined,b:Labelled|null|undefined){
    return String(a&&a.label||'').localeCompare(String(b&&b.label||''));
  }
  function taskKind(task:InsightTask|null|undefined){
    const kind=canonical(task&&task.kind);
    if(FIXED_KINDS.has(kind))return 'fixed';
    if(SUPPORT_KINDS.has(kind))return 'support';
    return 'work';
  }
  function taskPlanned(task:InsightTask|null|undefined){
    return Math.max(0,num(task&&task.dur));
  }
  function taskCompletion(task:InsightTask|null|undefined){
    return Math.max(0,Math.min(100,num(task&&task.completion)));
  }
  function taskHasCompletionEvidence(task:InsightTask|null|undefined){
    if(!task||typeof task!=='object')return false;
    if(task.completion!==null&&task.completion!==undefined&&isFiniteNumber(Number(task.completion)))return true;
    const source=canonical(task.completionSource);
    return !!task.skipped||!!task.doneFlag||['skipped','finished-unverified','manual','units','time','finished-time'].includes(source);
  }
  function taskHasActualEvidence(task:InsightTask|null|undefined){
    return !!task&&task.actualSeconds!==null&&task.actualSeconds!==undefined&&isFiniteNumber(Number(task.actualSeconds));
  }
  function taskCompleted(task:InsightTask|null|undefined){
    return taskPlanned(task)*taskCompletion(task)/100;
  }
  function taskActual(task:InsightTask|null|undefined){
    return task&&task.actualSeconds!==null&&task.actualSeconds!==undefined?Math.max(0,num(task.actualSeconds)/60):0;
  }
  function taskHasTimerEvidence(task:InsightTask|null|undefined){
    if(!task||typeof task!=='object')return false;
    if(num(task.sessionCount)>0||num(task.actualSeconds)>0||task.actualStart)return true;
    if(task.actualStartLocalMinute!==null&&task.actualStartLocalMinute!==undefined)return true;
    if(task.actualStartUtcOffsetMinutes!==null&&task.actualStartUtcOffsetMinutes!==undefined)return true;
    return Array.isArray(task.pauseEvents)&&task.pauseEvents.length>0;
  }
  function completionSourceKey(task:InsightTask|null|undefined){
    if(task&&task.skipped)return 'skipped';
    const source=canonical(task&&task.completionSource);
    if(['units','manual','time','finished-time','finished-unverified','skipped'].includes(source))return source;
    return 'none';
  }
  function taskOutcomeKey(task:InsightTask,classifyTaskOutcome:OutcomeClassifier){
    return task&&typeof task.__sdOutcome==='string'?task.__sdOutcome:classifyTaskOutcome(task);
  }
  function completionSourceLabel(source:unknown){
    const key=canonical(source);
    if(key==='units')return 'Done/Total';
    if(key==='manual')return 'Manual %';
    if(key==='time')return 'Focus-time fallback';
    if(key==='finished-time')return 'Finished from focus';
    if(key==='finished-unverified')return 'Finished status only';
    if(key==='skipped')return 'Skipped';
    return 'No source';
  }
  function completionEvidenceGroup(source:unknown){
    const key=canonical(source);
    if(key==='units'||key==='manual')return 'explicit';
    if(key==='time'||key==='finished-time')return 'time-derived';
    if(key==='finished-unverified')return 'unverified';
    if(key==='skipped')return 'skipped';
    return 'missing';
  }
  function emptyOutcomeCounts():OutcomeCounts{return {full:0,partial:0,skipped:0,untouched:0,'finished-unverified':0,'zero-output':0};}
  function addOutcome(counts:OutcomeCounts,outcome:TaskOutcome){
    if(counts&&OUTCOME_KEYS.includes(outcome))counts[outcome]+=1;
    return counts;
  }
  function outcomeShowsStudyActivity(outcome:unknown){
    return ['full','partial','finished-unverified','zero-output'].includes(String(outcome||''));
  }
  function evidenceRowShowsStudyActivity(row:Pick<EvidenceRow,'completed'|'actual'|'outcome'>|null|undefined){
    return !!row&&(num(row.completed)>0||num(row.actual)>0||outcomeShowsStudyActivity(row.outcome));
  }
  function parseClockMinute(value:unknown){
    if(!value)return null;
    const text=String(value).trim();
    if(/^\d{1,2}:\d{2}$/.test(text)){
      const [hh=NaN,mm=NaN]=text.split(':').map(Number);
      return hh>=0&&hh<=23&&mm>=0&&mm<=59?hh*60+mm:null;
    }
    const d=new Date(text);
    return Number.isNaN(d.getTime())?null:d.getHours()*60+d.getMinutes();
  }
  function wrappedMinuteDelta(actual:number,planned:number){
    if(!isFiniteNumber(actual)||!isFiniteNumber(planned))return null;
    const studyMinute=(minute:number)=>minute<STUDY_DAY_ROLLOVER_MINUTE?minute+1440:minute;
    return Math.round(studyMinute(actual)-studyMinute(planned));
  }
  function actualStartMinuteEvidence(task:InsightTask|null|undefined){
    const rawLocal=task&&task.actualStartLocalMinute;
    if(rawLocal!==null&&rawLocal!==undefined){
      const local=Number(rawLocal);
      if(Number.isInteger(local)&&local>=0&&local<1440)return {minute:local,source:'captured-local'};
    }
    const rawOffset=task&&task.actualStartUtcOffsetMinutes;
    if(rawOffset!==null&&rawOffset!==undefined&&task&&task.actualStart){
      const offset=Number(rawOffset);
      const stamp=Date.parse(task.actualStart);
      if(Number.isInteger(offset)&&offset>=-840&&offset<=840&&isFiniteNumber(stamp)){
        const utc=new Date(stamp);
        const minute=((utc.getUTCHours()*60+utc.getUTCMinutes()+offset)%1440+1440)%1440;
        return {minute,source:'captured-offset'};
      }
    }
    return {minute:null,source:'missing'};
  }
  function plannedStartMinute(task:InsightTask|null|undefined){
    const adjusted=parseClockMinute(task&&task.adjustedStart);
    if(isFiniteNumber(adjusted))return {minute:adjusted,source:'adjusted'};
    const original=parseClockMinute(task&&task.originalStart);
    if(isFiniteNumber(original))return {minute:original,source:'original'};
    return {minute:null,source:'missing'};
  }
  function startDelayMinutes(task:InsightTask|null|undefined){
    const planned=plannedStartMinute(task);
    if(!isFiniteNumber(planned.minute))return null;
    const actual=actualStartMinuteEvidence(task);
    if(!isFiniteNumber(actual.minute))return null;
    return wrappedMinuteDelta(actual.minute,planned.minute);
  }
  function firstHourSource(task:InsightTask|null|undefined){
    const actual=actualStartMinuteEvidence(task);
    return isFiniteNumber(actual.minute)
      ? {hour:Math.floor(actual.minute/60),source:actual.source}
      : {hour:null,source:'missing'};
  }
  function timeBandForHour(hour:number|null|undefined){
    if(!isFiniteNumber(hour))return null;
    return TIME_BANDS.find(b=>b.start<b.end?hour>=b.start&&hour<b.end:hour>=b.start||hour<b.end)||null;
  }
  function mean(values:readonly number[]){
    const clean=values.filter(v=>isFiniteNumber(v));
    return clean.length?clean.reduce((a,b)=>a+b,0)/clean.length:null;
  }
  function median(values:readonly number[]){
    const clean=values.filter(v=>isFiniteNumber(v)).sort((a,b)=>a-b);
    if(!clean.length)return null;
    const middle=Math.floor(clean.length/2);
    return clean.length%2?clean[middle]!:(clean[middle-1]!+clean[middle]!)/2;
  }
  function percentile(values:readonly number[],fraction:number){
    const clean=values.filter(v=>isFiniteNumber(v)).sort((a,b)=>a-b);
    if(!clean.length)return null;
    const position=(clean.length-1)*Math.max(0,Math.min(1,num(fraction)));
    const lower=Math.floor(position),upper=Math.ceil(position),weight=position-lower;
    return lower===upper?clean[lower]!:clean[lower]!*(1-weight)+clean[upper]!*weight;
  }
  function stdev(values:readonly number[]){
    const clean=values.filter(v=>isFiniteNumber(v));
    if(clean.length<2)return null;
    const m=mean(clean)!;
    return Math.sqrt(clean.reduce((sum,v)=>sum+Math.pow(v-m,2),0)/(clean.length-1));
  }
  function robustScale(values:readonly number[]){
    const clean=(Array.isArray(values)?values:[]).filter(isFiniteNumber);
    if(clean.length<2)return null;
    const centre=median(clean)!;
    return 1.4826*num(median(clean.map(value=>Math.abs(value-centre))));
  }
  function correlation(xs:readonly number[],ys:readonly number[]){
    const pairs:[number,number][]=[];
    xs.forEach((x,i)=>{
      const y=ys[i];
      if(isFiniteNumber(x)&&isFiniteNumber(y))pairs.push([x,y]);
    });
    if(pairs.length<3)return null;
    const mx=mean(pairs.map(p=>p[0]))!;
    const my=mean(pairs.map(p=>p[1]))!;
    let nume=0,dx=0,dy=0;
    pairs.forEach(([x,y])=>{
      nume+=(x-mx)*(y-my);
      dx+=Math.pow(x-mx,2);
      dy+=Math.pow(y-my,2);
    });
    return dx&&dy?nume/Math.sqrt(dx*dy):null;
  }
  function regressionSlope(points:readonly Point[]){
    const clean=points.filter(p=>isFiniteNumber(p.x)&&isFiniteNumber(p.y));
    if(clean.length<MIN_RECORDS_FOR_TREND)return null;
    const mx=mean(clean.map(p=>p.x))!;
    const my=mean(clean.map(p=>p.y))!;
    let nume=0,den=0;
    clean.forEach(p=>{
      nume+=(p.x-mx)*(p.y-my);
      den+=Math.pow(p.x-mx,2);
    });
    return den?nume/den:null;
  }
  function sum(values:readonly unknown[]){
    return (Array.isArray(values)?values:[]).reduce((total,value)=>total+num(value),0);
  }
  function clamp(value:unknown,low:number,high:number){return Math.max(low,Math.min(high,num(value)));}
  function sigmoid(value:unknown){
    const x=clamp(value,-35,35);
    return 1/(1+Math.exp(-x));
  }
  function logit(value:unknown){
    const p=clamp(value,1e-6,1-1e-6);
    return Math.log(p/(1-p));
  }
  function logGamma(value:unknown):number{
    const coefficients=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
    let z=num(value);
    if(z<.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
    z-=1;
    let x=.99999999999980993;
    coefficients.forEach((coefficient,index)=>{x+=coefficient/(z+index+1);});
    const t=z+coefficients.length-.5;
    return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x);
  }
  function logBeta(left:number,right:number){return logGamma(left)+logGamma(right)-logGamma(left+right);}
  function logSumExp(values:readonly number[]){
    const clean=(Array.isArray(values)?values:[]).filter(isFiniteNumber);
    if(!clean.length)return -Infinity;
    const maximum=Math.max(...clean);
    return maximum+Math.log(sum(clean.map(value=>Math.exp(value-maximum))));
  }
  function normalizedLogWeights(values:readonly number[]){
    const normalizer=logSumExp(values);
    return values.map(value=>isFiniteNumber(value)&&isFiniteNumber(normalizer)?Math.exp(value-normalizer):0);
  }
  function weightedQuantile(points:readonly WeightedPoint[],target:number){
    const sorted=(Array.isArray(points)?points:[]).filter(point=>isFiniteNumber(point.value)&&point.weight>0).sort((a,b)=>a.value-b.value);
    const total=sum(sorted.map(point=>point.weight));
    if(!total)return null;
    let running=0;
    for(const point of sorted){running+=point.weight;if(running/total>=target)return point.value;}
    return sorted[sorted.length-1]!.value;
  }
  function zeroMatrix(rows:number,columns=rows){return Array.from({length:rows},()=>Array(columns).fill(0));}
  function transposeMatrix(matrix:readonly (readonly number[])[]){return matrix[0]!.map((_,column)=>matrix.map(row=>row[column]!));}
  function multiplyMatrices(left:readonly (readonly number[])[],right:readonly (readonly number[])[]){
    const columns=right[0]!.length,shared=right.length;
    return left.map(row=>Array.from({length:columns},(_,column)=>{
      let total=0;
      for(let index=0;index<shared;index+=1)total+=num(row[index])*num(right[index]?.[column]);
      return total;
    }));
  }
  function addMatrices(left:readonly (readonly number[])[],right:readonly (readonly number[])[]){return left.map((row,index)=>row.map((value,column)=>num(value)+num(right[index]&&right[index][column])));}
  function multiplyMatrixVector(matrix:readonly (readonly number[])[],vector:readonly number[]){return matrix.map(row=>sum(row.map((value,index)=>num(value)*num(vector[index]))));}
  function solveLinearSystem(matrix:readonly (readonly number[])[],vector:readonly number[]){
    const size=matrix.length;
    if(!size||vector.length!==size)return null;
    const augmented=matrix.map((row,index)=>row.map(num).concat([num(vector[index])]));
    for(let column=0;column<size;column+=1){
      let pivot=column;
      for(let row=column+1;row<size;row+=1)if(Math.abs(augmented[row]![column]!)>Math.abs(augmented[pivot]![column]!))pivot=row;
      if(Math.abs(augmented[pivot]![column]!)<1e-10)return null;
      if(pivot!==column)[augmented[pivot],augmented[column]]=[augmented[column]!,augmented[pivot]!];
      const columnRow=augmented[column]!,divisor=columnRow[column]!;
      for(let index=column;index<=size;index+=1)columnRow[index]=columnRow[index]!/divisor;
      for(let row=0;row<size;row+=1){
        if(row===column)continue;
        const target=augmented[row]!,factor=target[column]!;
        for(let index=column;index<=size;index+=1)target[index]=target[index]!-factor*columnRow[index]!;
      }
    }
    return augmented.map(row=>row[size]!);
  }
  function invertMatrix(matrix:readonly (readonly number[])[]){
    const size=matrix.length;
    const columns:number[][]=[];
    for(let column=0;column<size;column+=1){
      const basis=Array(size).fill(0);basis[column]=1;
      const solved=solveLinearSystem(matrix,basis);
      if(!solved)return null;
      columns.push(solved);
    }
    return transposeMatrix(columns);
  }
  function quadraticForm(vector:readonly number[],matrix:readonly (readonly number[])[]){
    const projected=multiplyMatrixVector(matrix,vector);
    return sum(vector.map((value,index)=>num(value)*num(projected[index])));
  }
  function fitRegularizedLogistic(examples:readonly LogisticExample[],{lambda=2,minimumRows=8}:Readonly<{lambda?:number;minimumRows?:number}>={}){
    const rows=(Array.isArray(examples)?examples:[]).filter(row=>Array.isArray(row.x)&&isFiniteNumber(row.y)&&row.y>=0&&row.y<=1);
    if(rows.length<minimumRows)return {ready:false,rows:rows.length,reason:`Need ${Math.max(0,minimumRows-rows.length)} more eligible observations.`};
    const dimension=rows[0]!.x.length+1;
    // The design vector and observation weight are invariant across Newton
    // iterations. Materialize them once, then accumulate only one triangle of
    // the symmetric Hessian before mirroring it.
    const design=rows.map(row=>({x:[1,...row.x.map(num)],y:row.y,weight:Math.max(.05,num(row.weight,1))}));
    let coefficients=Array(dimension).fill(0);
    coefficients[0]=logit(clamp(mean(rows.map(row=>row.y)),.02,.98));
    let hessian=null;
    for(let iteration=0;iteration<10;iteration+=1){
      hessian=zeroMatrix(dimension);const gradient=Array(dimension).fill(0);
      for(const row of design){
        const {x,weight}=row;let eta=0;
        for(let index=0;index<dimension;index+=1)eta+=x[index]!*coefficients[index]!;
        const probability=sigmoid(eta),variance=Math.max(1e-5,probability*(1-probability))*weight,residual=(row.y-probability)*weight;
        for(let left=0;left<dimension;left+=1){
          gradient[left]=gradient[left]!+x[left]!*residual;
          const weightedLeft=x[left]!*variance;
          for(let right=left;right<dimension;right+=1)hessian[left]![right]=hessian[left]![right]!+weightedLeft*x[right]!;
        }
      }
      for(let left=1;left<dimension;left+=1)for(let right=0;right<left;right+=1)hessian[left]![right]=hessian[right]![left]!;
      for(let index=1;index<dimension;index+=1){hessian[index]![index]=hessian[index]![index]!+lambda;gradient[index]=gradient[index]!-lambda*coefficients[index]!;}
      hessian[0]![0]=hessian[0]![0]!+.05;
      const step=solveLinearSystem(hessian,gradient);
      if(!step)break;
      let maximumStep=0;
      for(let index=0;index<dimension;index+=1){const delta=step[index]!;maximumStep=Math.max(maximumStep,Math.abs(delta));coefficients[index]=clamp(coefficients[index]!+delta,-20,20);}
      if(maximumStep<1e-6)break;
    }
    const covariance=hessian&&invertMatrix(hessian);
    const positives=rows.filter(row=>row.y>=.5).length;
    return {ready:!!covariance,rows:rows.length,positives,negatives:rows.length-positives,coefficients,covariance,lambda};
  }
  function predictRegularizedLogistic(fit:LogisticFit|null|undefined,features:readonly number[],interval=.95){
    if(!fit||!fit.ready||!fit.coefficients||!fit.covariance)return {mean:null,low:null,high:null,width:null};
    const x=[1,...features.map(value=>num(value))];let eta=0;
    for(let index=0;index<x.length;index+=1)eta+=x[index]!*num(fit.coefficients[index]);
    const multiplier=interval>=.95?1.96:1.282;
    const standardError=Math.sqrt(Math.max(0,quadraticForm(x,fit.covariance)));
    const low=sigmoid(eta-multiplier*standardError),high=sigmoid(eta+multiplier*standardError);
    return {mean:sigmoid(eta),low,high,width:high-low,eta,standardError};
  }
  function effectiveSampleSize(weights:readonly number[]){
    const clean=(Array.isArray(weights)?weights:[]).map(value=>Math.max(0,num(value))).filter(value=>value>0);
    const total=sum(clean),squares=clean.reduce((acc,value)=>acc+value*value,0);
    return total&&squares?total*total/squares:0;
  }
  function evidenceConfidence(nEff:unknown,intervalWidth:unknown){
    const n=Math.max(0,num(nEff)),width=Math.max(0,num(intervalWidth,100));
    if(n<3||width>60)return CONFIDENCE.weak;
    if(n<7||width>45)return CONFIDENCE.emerging;
    if(n<20||width>30)return CONFIDENCE.reliable;
    return CONFIDENCE.strong;
  }
  function descriptiveEvidenceConfidence(days:unknown,volume=0){
    const n=Math.max(0,num(days)),v=Math.max(0,num(volume));
    if(n<5||v<120)return CONFIDENCE.weak;
    if(n<10||v<300)return CONFIDENCE.emerging;
    if(n<21||v<600)return CONFIDENCE.reliable;
    return CONFIDENCE.strong;
  }
  function confidenceAtLeast(confidence:Confidence|null|undefined,key:keyof typeof COACH_CONFIDENCE_RANK='emerging'){
    return num(confidence?(COACH_CONFIDENCE_RANK[confidence.key]??0):0,0)>=num(COACH_CONFIDENCE_RANK[key]??1,1);
  }
  function evidenceMetadata(meta:EvidenceMetadataInput={}){
    const confidence=meta&&meta.confidence&&typeof meta.confidence==='object'?meta.confidence:null;
    const limitationSource=meta.limitations;
    const limitations=(Array.isArray(limitationSource)?limitationSource:[])
      .map(value=>String(value||'').trim()).filter(Boolean);
    return Object.freeze({
      level:confidence&&confidence.key||null,
      label:confidence&&confidence.label||null,
      tone:confidence&&confidence.tone||null,
      observations:finiteOrNull(meta&&meta.observations),
      days:finiteOrNull(meta&&meta.days),
      effectiveSample:finiteOrNull(meta&&meta.effectiveSample),
      intervalWidth:finiteOrNull(meta&&meta.intervalWidth),
      method:String(meta&&meta.method||''),
      limitations:Object.freeze(limitations)
    });
  }
  function capabilityResult(ready:unknown,reason:unknown,evidence:EvidenceMetadataInput={}){
    return Object.freeze({
      ready:!!ready,
      reason:ready||reason===undefined||reason===null?null:String(reason),
      evidence:evidenceMetadata(evidence)
    });
  }
  function withEvidenceMetadata(result:Readonly<Record<string,unknown>>|null|undefined,evidence:EvidenceMetadataInput={}){
    return {...(result&&typeof result==='object'?result:{}),evidence:evidenceMetadata(evidence)};
  }
  function bayesianRateEstimate(rate:unknown,nEff:unknown,priorRate:unknown,priorStrength=EVIDENCE_PRIOR_EFFECTIVE_BLOCKS){
    const observed=Math.max(0,Math.min(1,num(rate)/100));
    const prior=Math.max(0,Math.min(1,num(priorRate,50)/100));
    const n=Math.max(0,num(nEff));
    const strength=Math.max(.1,num(priorStrength,EVIDENCE_PRIOR_EFFECTIVE_BLOCKS));
    const alpha=.5+prior*strength+observed*n;
    const beta=.5+(1-prior)*strength+(1-observed)*n;
    const posterior=alpha/(alpha+beta);
    const variance=alpha*beta/(Math.pow(alpha+beta,2)*(alpha+beta+1));
    const radius=1.96*Math.sqrt(Math.max(0,variance));
    const low=Math.max(0,posterior-radius)*100;
    const high=Math.min(1,posterior+radius)*100;
    const confidence=evidenceConfidence(n,high-low);
    return {
      mean:round(posterior*100,1),
      low:round(low,1),
      high:round(high,1),
      width:round(high-low,1),
      nEff:round(n,1),
      prior:round(prior*100,1),
      confidence
    };
  }
  function log2(value:number){return Math.log(value)/Math.LN2;}
  function jensenShannonDivergence(left:readonly number[],right:readonly number[]){
    const p=Array.isArray(left)?left:[],q=Array.isArray(right)?right:[];
    if(!p.length||p.length!==q.length)return null;
    const kl=(a:readonly number[],b:readonly number[])=>a.reduce((total,value,index)=>value>0&&b[index]!>0?total+value*log2(value/b[index]!):total,0);
    const midpoint=p.map((value,index)=>(value+q[index])/2);
    return Math.max(0,Math.min(1,(kl(p,midpoint)+kl(q,midpoint))/2));
  }
    return Object.freeze({
      actualStartMinuteEvidence,addMatrices,addOutcome,apportionedPercents,bayesianRateEstimate,canonical,
      capabilityResult,clamp,clampPct,completionEvidenceGroup,completionSourceKey,completionSourceLabel,
      confidenceAtLeast,correlation,dateDay,dateFromDay,dayName,delayLabel,descriptiveEvidenceConfidence,
      effectiveSampleSize,emptyOutcomeCounts,evidenceConfidence,evidenceMinutesLabel,
      evidenceRowShowsStudyActivity,finiteOrNull,firstHourSource,fitRegularizedLogistic,isIsoDate,
      jensenShannonDivergence,labelCompare,localIsoDate,logBeta,logGamma,logSumExp,logit,mean,median,
      millisecondsLabel,minutesLabel,multiplyMatrices,multiplyMatrixVector,normalizedLogWeights,num,numberLabel,
      pct,pct0,percentLabel,percentile,predictRegularizedLogistic,regressionSlope,robustScale,round,
      roundNullable,scheduleShiftLabel,shortDate,signedMillisecondsLabel,signedMinutesLabel,solveLinearSystem,
      startDelayMinutes,stdev,subjectLabel,sum,taskActual,taskCompleted,taskCompletion,taskHasActualEvidence,
      taskHasCompletionEvidence,taskHasTimerEvidence,taskKind,taskOutcomeKey,taskPlanned,timeBandForHour,
      topLevelAreaLabel,transposeMatrix,weightedQuantile,withEvidenceMetadata,zeroMatrix
    });
  })(InsightsConfig);

  // M8.3 RECORDS AND WINDOWS COMPONENT
  const InsightsRecords=((Config:typeof InsightsConfig,Primitives:typeof InsightsPrimitives)=>{
    const {
      DEFAULT_INSIGHT_WINDOW_KEY,INSIGHT_WINDOW_OPTIONS
    }=Config;
    const {
      dateDay,dateFromDay,isIsoDate,taskActual,taskCompleted,taskPlanned
    }=Primitives;
  function recordTimestamp(record:InsightRecord){
    const n=Date.parse(record&&((record.updatedAt)||(record.savedAt)||(record.createdAt))||'');
    return isFiniteNumber(n)?n:0;
  }
  function recordEvidenceScore(record:InsightRecord){
    const tasks=record.tasks??[];
    const planned=tasks.reduce((sum,t)=>sum+taskPlanned(t),0);
    const actual=tasks.reduce((sum,t)=>sum+taskActual(t),0);
    const completed=tasks.reduce((sum,t)=>sum+taskCompleted(t),0);
    const practiceUnits=(record.practiceRuns??[]).reduce((sum,run)=>sum+(Array.isArray(run&&run.unitMs)?run.unitMs.length:0),0);
    return tasks.length*1000000+Math.round(planned*1000)+Math.round(actual*100)+Math.round(completed*10)+practiceUnits;
  }
  function stableCacheValue(value:unknown,seen=new Set<object>()):unknown{
    if(value===null||value===undefined)return value===undefined?'[undefined]':null;
    const type=typeof value;
    if(type==='number')return isFiniteNumber(value)?value:String(value);
    if(type==='string'||type==='boolean')return value;
    if(type!=='object')return `[${type}]`;
    if(seen.has(value))return '[circular]';
    seen.add(value);
    let normalized;
    if(Array.isArray(value))normalized=value.map(item=>stableCacheValue(item,seen));
    else {const source=value as Record<string,unknown>;normalized=Object.fromEntries(Object.keys(source).sort().map(key=>[key,stableCacheValue(source[key],seen)]));}
    seen.delete(value);
    return normalized;
  }
  function stableRecordSignature(record:InsightRecord){
    try{
      return JSON.stringify(stableCacheValue({
        date:record.date,
        dayName:record.dayName,
        savedAt:record.savedAt,
        updatedAt:record.updatedAt,
        createdAt:record.createdAt,
        studyQuality:record.studyQuality,
        originalPlannedStudyMinutes:record.originalPlannedStudyMinutes,
        completedEquivalentMinutes:record.completedEquivalentMinutes,
        actualFocusMinutes:record.actualFocusMinutes,
        shiftedStudyBlocks:record.shiftedStudyBlocks,
        totalScheduleShiftMinutes:record.totalScheduleShiftMinutes,
        netScheduleShiftMinutes:record.netScheduleShiftMinutes,
        tasks:Array.isArray(record.tasks)?record.tasks:[],
        originalSchedule:Array.isArray(record.originalSchedule)?record.originalSchedule:[],
        practiceRuns:Array.isArray(record.practiceRuns)?record.practiceRuns:[]
      }));
    }catch(e){return String(record.date||'');}
  }
  function chooseCanonicalRecord(existing:InsightRecord|undefined,candidate:InsightRecord){
    if(!existing)return candidate;
    const tA=recordTimestamp(existing),tB=recordTimestamp(candidate);
    if(tA!==tB)return tB>tA?candidate:existing;
    const sA=recordEvidenceScore(existing),sB=recordEvidenceScore(candidate);
    if(sA!==sB)return sB>sA?candidate:existing;
    return stableRecordSignature(candidate)>stableRecordSignature(existing)?candidate:existing;
  }
  function normalizeRecords(records:readonly InsightRecord[]|null|undefined){
    const byDate=new Map<string,InsightRecord>();
    (records??[])
      .filter(r=>r&&typeof r==='object'&&isIsoDate(r.date))
      .map(r=>({...r,tasks:Array.isArray(r.tasks)?r.tasks.filter(t=>t&&typeof t==='object'&&taskPlanned(t)>0):[]}))
      .forEach(record=>byDate.set(record.date,chooseCanonicalRecord(byDate.get(record.date),record)));
    return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
  }
  async function normalizeRecordsAsync(records:readonly InsightRecord[]|null|undefined,yieldTask:(()=>unknown|PromiseLike<unknown>)|null=null,batchSize=64){
    const source=records??[],byDate=new Map<string,InsightRecord>(),size=Math.max(8,Math.min(256,Math.floor(Number(batchSize)||64)));
    for(let start=0;start<source.length;start+=size){
      const end=Math.min(source.length,start+size);
      for(let index=start;index<end;index+=1){
        const row=source[index];
        if(!row||typeof row!=='object'||!isIsoDate(row.date))continue;
        const record={...row,tasks:Array.isArray(row.tasks)?row.tasks.filter(task=>task&&typeof task==='object'&&taskPlanned(task)>0):[]};
        byDate.set(record.date,chooseCanonicalRecord(byDate.get(record.date),record));
      }
      if(end<source.length&&typeof yieldTask==='function')await yieldTask();
    }
    return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
  }
  function normalizeSummaries(summaries:readonly InsightSummary[]|null|undefined){
    return (summaries??[]).filter(s=>s&&typeof s==='object'&&isIsoDate(s.date)).sort((a,b)=>a.date.localeCompare(b.date));
  }
  function revisionHash(value:unknown){
    const text=String(value||'');let hash=2166136261;
    for(let index=0;index<text.length;index+=1){hash^=text.charCodeAt(index);hash=Math.imul(hash,16777619);}
    return (hash>>>0).toString(36);
  }
  function recordsRevisionKey(records:readonly InsightRecord[]){
    return `${records.length}:${revisionHash(records.map(stableRecordSignature).join('\u001e'))}`;
  }
  function summariesRevisionKey(summaries:readonly InsightSummary[]|null|undefined){
    const rows=normalizeSummaries(summaries);
    return `${rows.length}:${revisionHash(JSON.stringify(rows))}`;
  }
  function insightWindowByKey(key:unknown):typeof INSIGHT_WINDOW_OPTIONS[number]{
    const clean=String(key||'').toLowerCase();
    return INSIGHT_WINDOW_OPTIONS.find(option=>option.key===clean)||INSIGHT_WINDOW_OPTIONS.find(option=>option.key===DEFAULT_INSIGHT_WINDOW_KEY)||INSIGHT_WINDOW_OPTIONS[0]!;
  }
  function normalizeInsightWindowKey(value:unknown){
    return insightWindowByKey(value).key;
  }
  function filterCanonicalRecordsForInsightWindow(allRecords:readonly InsightRecord[],key:unknown,currentStudyDate:unknown=null){
    const option=insightWindowByKey(key);
    if(option.key==='all'||!option.days){
      const to=allRecords[allRecords.length-1]?.date||null;
      return {records:allRecords,key:option.key,label:option.summary,days:option.days,allRecordCount:allRecords.length,from:null,to};
    }
    const latestSavedDay=allRecords.length?dateDay(allRecords[allRecords.length-1]!.date):null;
    const currentDay=isIsoDate(currentStudyDate)?dateDay(currentStudyDate):null;
    const endDay=isFiniteNumber(currentDay)&&isFiniteNumber(latestSavedDay)
      ? Math.max(currentDay,latestSavedDay)
      : isFiniteNumber(currentDay)?currentDay:latestSavedDay;
    if(!isFiniteNumber(endDay)){
      return {records:[],key:option.key,label:option.summary,days:option.days,allRecordCount:0,from:null,to:null};
    }
    const startDay=endDay-option.days+1;
    const from=dateFromDay(startDay);
    const to=dateFromDay(endDay);
    const filtered=allRecords.filter(record=>{
      const day=dateDay(record.date);
      return day!==null&&day>=startDay&&day<=endDay;
    });
    return {
      records:filtered,
      key:option.key,
      label:option.summary,
      days:option.days,
      allRecordCount:allRecords.length,
      from,
      to
    };
  }
  function filterSummariesForInsightWindow(summaries:readonly InsightSummary[],windowInfo:Readonly<{key:string;days:number|null;from:string|null;to:string|null}>|null|undefined){
    if(!windowInfo||windowInfo.key==='all'||!windowInfo.days)return summaries;
    const fromDay=dateDay(windowInfo.from),toDay=dateDay(windowInfo.to);
    if(fromDay===null||toDay===null)return summaries;
    return summaries.filter(summary=>{
      const day=dateDay(summary.date);
      return day!==null&&day>=fromDay&&day<=toDay;
    });
  }
    return Object.freeze({
      filterCanonicalRecordsForInsightWindow,filterSummariesForInsightWindow,insightWindowByKey,normalizeRecords,normalizeRecordsAsync,
      normalizeInsightWindowKey,normalizeSummaries,recordsRevisionKey,summariesRevisionKey
    });
  })(InsightsConfig,InsightsPrimitives);

  // M8.4 CORE ANALYTICS COMPONENT
  const InsightsAnalytics=((Config:typeof InsightsConfig,Primitives:typeof InsightsPrimitives)=>{
    const {
      COVERAGE_WATCH_REFERENCE_DAYS,MAX_EXPLICIT_BLOCK_ORDER,MIN_RECORDS_FOR_COACH_TREND,MIN_RECORDS_FOR_TREND,
      OUTCOME_KEYS,START_DELAY_BUCKETS
    }=Config;
    const {
      actualStartMinuteEvidence,addOutcome,canonical,completionEvidenceGroup,completionSourceKey,
      completionSourceLabel,correlation,dateDay,dateFromDay,dayName,emptyOutcomeCounts,
      evidenceRowShowsStudyActivity,firstHourSource,isIsoDate,labelCompare,localIsoDate,mean,num,pct,pct0,
      regressionSlope,round,startDelayMinutes,stdev,subjectLabel,taskActual,taskCompleted,taskCompletion,
      taskHasActualEvidence,taskHasCompletionEvidence,taskHasTimerEvidence,taskKind,taskOutcomeKey,taskPlanned,
      timeBandForHour,topLevelAreaLabel
    }=Primitives;
  function createEvidenceRow(record:InsightRecord,task:InsightTask,kind:TaskKind,classifyTaskOutcome:OutcomeClassifier){
    const pauseEvents=taskPauseEvents(task);
    const frictionDurations=pauseEvents.map(pauseEventFrictionSeconds).filter(value=>value>0);
    const source=completionSourceKey(task);
    return Object.freeze({
      record,
      task,
      date:record.date||'',
      kind,
      subject:subjectLabel(task),
      planned:taskPlanned(task),
      completed:taskCompleted(task),
      actual:taskActual(task),
      completion:taskCompletion(task),
      source,
      evidenceGroup:completionEvidenceGroup(source),
      outcome:taskOutcomeKey(task,classifyTaskOutcome),
      timerBacked:taskHasTimerEvidence(task),
      pauseEvents:Object.freeze(pauseEvents),
      frictionDurations:Object.freeze(frictionDurations),
      pauseCount:frictionDurations.length
    });
  }
  function createEvidenceIndex(records:readonly InsightRecord[],classifyTaskOutcome:OutcomeClassifier){
    const all:EvidenceRow[]=[],work:EvidenceRow[]=[],support:EvidenceRow[]=[],fixed:EvidenceRow[]=[];
    const byRecord=new Map<InsightRecord,EvidenceGroups>();
    records.forEach(record=>{
      const groups:{all:EvidenceRow[];work:EvidenceRow[];support:EvidenceRow[];fixed:EvidenceRow[]}={all:[],work:[],support:[],fixed:[]};
      (record.tasks??[]).forEach(task=>{
        const kind=taskKind(task);
        if(record.degraded===true&&kind!=='fixed'&&(!taskHasCompletionEvidence(task)||!taskHasActualEvidence(task)))return;
        const row=createEvidenceRow(record,task,kind,classifyTaskOutcome);
        all.push(row);groups.all.push(row);
        if(row.kind==='work'){work.push(row);groups.work.push(row);}
        else if(row.kind==='support'){support.push(row);groups.support.push(row);}
        else {fixed.push(row);groups.fixed.push(row);}
      });
      if(!groups.fixed.length){
        (record.originalSchedule??[])
          .filter(row=>taskKind(row)==='fixed')
          .forEach(scheduleRow=>{
            const task:InsightTask={...scheduleRow,kind:'fixed',completion:null,actualSeconds:null};
            const row=createEvidenceRow(record,task,'fixed',classifyTaskOutcome);
            all.push(row);fixed.push(row);groups.all.push(row);groups.fixed.push(row);
          });
      }
      byRecord.set(record,Object.freeze({
        all:Object.freeze(groups.all),
        work:Object.freeze(groups.work),
        support:Object.freeze(groups.support),
        fixed:Object.freeze(groups.fixed)
      }));
    });
    return Object.freeze({
      records:Object.freeze([...(Array.isArray(records)?records:[])]),
      all:Object.freeze(all),
      work:Object.freeze(work),
      support:Object.freeze(support),
      fixed:Object.freeze(fixed),
      byRecord
    });
  }
  function rowsPlanned(rows:readonly EvidenceRow[]){return rows.reduce((sum,row)=>sum+row.planned,0);}
  function rowsCompleted(rows:readonly EvidenceRow[]){return rows.reduce((sum,row)=>sum+row.completed,0);}
  function rowsActual(rows:readonly EvidenceRow[]){return rows.reduce((sum,row)=>sum+row.actual,0);}
  function recordRows(evidence:EvidenceIndex,record:InsightRecord,kind:keyof EvidenceGroups){return evidence.byRecord.get(record)![kind];}
  function taskPauseEvents(task:InsightTask|null|undefined){
    return task?.pauseEvents?task.pauseEvents
      .map((ev):NormalizedPauseEvent=>{
        const row=(ev&&typeof ev==='object')?ev:{};
        const type=canonical(row.type||row.reason||'manual');
        const rawPlanned=Number(row.plannedSeconds);
        return {
          type:type==='pomodoro'?'pomodoro':type==='inactive-gap'?'inactive-gap':'manual',
          seconds:Math.max(0,num(row.seconds)),
          plannedSeconds:isFiniteNumber(rawPlanned)&&rawPlanned>0?rawPlanned:null
        };
      })
      .filter(ev=>ev.seconds>0):[];
  }
  function pauseEventFrictionSeconds(event:NormalizedPauseEvent|null|undefined){
    if(!event)return 0;
    if(event.type==='pomodoro')return Number(event.plannedSeconds)>0?Math.max(0,num(event.seconds)-num(event.plannedSeconds)):0;
    return Math.max(0,num(event.seconds));
  }
  function computeDailySeries(evidence:EvidenceIndex){
    return evidence.records.map(record=>{
      const work=recordRows(evidence,record,'work');
      const timerBacked=work.filter(row=>row.timerBacked);
      const planned=rowsPlanned(work);
      const completed=rowsCompleted(work);
      const actual=rowsActual(work);
      const timerBackedPlanned=rowsPlanned(timerBacked);
      return {
        date:record.date,
        day:dateDay(record.date)!,
        dayName:record.dayName||dayName(record.date),
        planned,
        completed,
        actual,
        workBlocks:work.length,
        timerBackedBlocks:timerBacked.length,
        timerBackedPlanned,
        timerCoverage:pct(timerBackedPlanned,planned),
        completion:pct(completed,planned),
        quality:Number.isInteger(Number(record.studyQuality))&&Number(record.studyQuality)>=1&&Number(record.studyQuality)<=5?Number(record.studyQuality):null
      };
    });
  }
  function rollingAverage(rows:readonly DailySeriesRow[],key:'completion',windowSize:number){
    const eligible:number[]=[];
    return rows.map(row=>{
      const value=row[key];
      if(isFiniteNumber(value))eligible.push(value);
      const slice=eligible.slice(-Math.max(1,windowSize));
      return {...row,value:slice.length?round(slice.reduce((a,b)=>a+b,0)/slice.length,1):null};
    });
  }
  function computeStreakFromDays(dayList:readonly (number|null)[],currentStudyDate:unknown){
    const days=[...new Set((Array.isArray(dayList)?dayList:[]).filter(isFiniteNumber))]
      .sort((a,b)=>a-b);
    let longest=0,latest=0,current=0;
    days.forEach((day,index)=>{
      current=(index===0||day===days[index-1]!+1)?current+1:1;
      longest=Math.max(longest,current);
      latest=current;
    });
    const lastDay=days.length?days[days.length-1]:null;
    const today=dateDay(isIsoDate(currentStudyDate)?currentStudyDate:localIsoDate());
    const daysSinceLast=isFiniteNumber(today)&&isFiniteNumber(lastDay)?today-lastDay:null;
    const isCurrent=isFiniteNumber(daysSinceLast)&&daysSinceLast>=0&&daysSinceLast<=1;
    return {
      current:isCurrent?latest:0,
      latest,
      longest,
      dayCount:days.length,
      first:days.length?dateFromDay(days[0]!):null,
      last:days.length?dateFromDay(days[days.length-1]!):null,
      daysSinceLast,
      isCurrent
    };
  }
  function computeStreak(evidence:EvidenceIndex,currentStudyDate:unknown){
    return computeStreakFromDays(evidence.records
      .filter(r=>recordRows(evidence,r,'work').some(evidenceRowShowsStudyActivity))
      .map(r=>dateDay(r.date))
      .filter(isFiniteNumber),currentStudyDate);
  }
  function computeSummaryStreak(summaries:readonly InsightSummary[],currentStudyDate:unknown){
    return computeStreakFromDays(summaries.filter(s=>num(s.completedMinutes)>0||num(s.actualTrackedMinutes)>0||(['full','partial','finished-unverified','zero-output'] as const).some(key=>num(s.outcomeCounts?.[key])>0))
      .map(s=>dateDay(s.date))
      .filter(isFiniteNumber),currentStudyDate);
  }
  function computeSubjectReference(summaries:readonly InsightSummary[],evidence:EvidenceIndex,referenceStartDay:number|null,referenceDay:number|null){
    const map=new Map();
    const savedDates=new Set();
    const inReferenceRange=(date:unknown)=>{
      const day=dateDay(date);
      return isFiniteNumber(day)&&(!isFiniteNumber(referenceStartDay)||day>=referenceStartDay)&&(!isFiniteNumber(referenceDay)||day<=referenceDay);
    };
    const add=(date:string,rawLabel:unknown,planned:number,completed:number,actual=0,activityBlocks=0)=>{
      if(!inReferenceRange(date)||!(planned>0||completed>0||actual>0||activityBlocks>0))return;
      savedDates.add(date);
      const label=topLevelAreaLabel(rawLabel);
      const key=canonical(label);
      if(!map.has(key))map.set(key,{label,days:new Set(),activityDays:new Set(),planned:0,completed:0,actual:0,activityBlocks:0,lastDate:null});
      const row=map.get(key)!;
      row.days.add(date);
      row.planned+=planned;
      row.completed+=completed;
      row.actual+=actual;
      row.activityBlocks+=activityBlocks;
      if(completed>0||actual>0||activityBlocks>0){
        row.activityDays.add(date);
        row.lastDate=(!row.lastDate||date>row.lastDate)?date:row.lastDate;
      }
    };
    summaries.filter(summary=>inReferenceRange(summary.date)).forEach(summary=>{
      savedDates.add(summary.date);
      Object.entries((summary&&summary.areaSummary&&typeof summary.areaSummary==='object')?summary.areaSummary:{}).forEach(([rawLabel,value])=>{
        const planned=Math.max(0,num(value&&value.planned));
        const completed=Math.max(0,num(value&&value.completed));
        const actual=Math.max(0,num(value&&value.actual));
        const activityBlocks=Math.max(0,num(value&&value.activityBlocks));
        add(summary.date,rawLabel,planned,completed,actual,activityBlocks);
      });
    });
    if(!savedDates.size&&evidence&&Array.isArray(evidence.work)){
      evidence.work.forEach(row=>add(row.date,row.subject,row.planned,row.completed,row.actual,evidenceRowShowsStudyActivity(row)?1:0));
    }
    const rows=[...map.entries()].map(([key,row])=>({key,...row,dayCount:row.days.size,activityDayCount:row.activityDays.size}));
    return {rows,totalDays:savedDates.size,totalPlanned:rows.reduce((sum,row)=>sum+row.planned,0)};
  }
  function computeSubjects(evidence:EvidenceIndex,currentStudyDate:unknown=null,subjectReferenceSummaries:readonly InsightSummary[]=[]){
    const map=new Map();
    const emptySubject=(label:string)=>({
      label,blocks:0,days:new Set(),planned:0,completed:0,actual:0,lastDate:null,
      pairedBlocks:0,pairedPlanned:0,pairedCompleted:0,pairedActual:0,pairedSources:{},
      watchBlocks:0,watchDays:new Set(),watchPlanned:0,watchCompleted:0,watchActual:0,watchSkipped:0,watchUntouched:0,watchLastDate:null
    });
    const records=evidence.records;
    const savedDays=Math.max(1,records.length);
    const firstDay=records.length?dateDay(records[0]!.date):null;
    const latestDay=records.length?dateDay(records[records.length-1]!.date):null;
    const requestedReferenceDay=isIsoDate(currentStudyDate)?dateDay(currentStudyDate):null;
    const referenceDay=isFiniteNumber(requestedReferenceDay)&&isFiniteNumber(latestDay)
      ? Math.max(requestedReferenceDay,latestDay)
      : isFiniteNumber(requestedReferenceDay)?requestedReferenceDay:latestDay;
    const referenceStartDay=isFiniteNumber(referenceDay)?referenceDay-COVERAGE_WATCH_REFERENCE_DAYS+1:null;
    evidence.work.forEach(evidenceRow=>{
      const {record}=evidenceRow;
      const label=evidenceRow.subject;
      const key=canonical(label);
      if(!map.has(key))map.set(key,emptySubject(label));
      const row=map.get(key)!;
      row.blocks+=1;
      row.days.add(record.date);
      row.planned+=evidenceRow.planned;
      row.completed+=evidenceRow.completed;
      row.actual+=evidenceRow.actual;
      if(evidenceRowShowsStudyActivity(evidenceRow))row.lastDate=(!row.lastDate||record.date>row.lastDate)?record.date:row.lastDate;
      if(evidenceRow.timerBacked&&evidenceRow.actual>0){
        row.pairedBlocks+=1;
        row.pairedPlanned+=evidenceRow.planned;
        row.pairedCompleted+=evidenceRow.completed;
        row.pairedActual+=evidenceRow.actual;
        row.pairedSources[evidenceRow.source]=(row.pairedSources[evidenceRow.source]||0)+1;
      }
      const recordDay=dateDay(record.date);
      if(isFiniteNumber(recordDay)&&(!isFiniteNumber(referenceStartDay)||recordDay>=referenceStartDay)&&(!isFiniteNumber(referenceDay)||recordDay<=referenceDay)){
        row.watchBlocks+=1;
        row.watchDays.add(record.date);
        row.watchPlanned+=evidenceRow.planned;
        row.watchCompleted+=evidenceRow.completed;
        row.watchActual+=evidenceRow.actual;
        row.watchSkipped+=evidenceRow.outcome==='skipped'?1:0;
        row.watchUntouched+=evidenceRow.outcome==='untouched'?1:0;
        if(evidenceRowShowsStudyActivity(evidenceRow))row.watchLastDate=(!row.watchLastDate||record.date>row.watchLastDate)?record.date:row.watchLastDate;
      }
    });
    const reference=computeSubjectReference(subjectReferenceSummaries,evidence,referenceStartDay,referenceDay);
    reference.rows.forEach(ref=>{
      if(!map.has(ref.key))map.set(ref.key,emptySubject(ref.label));
    });
    const referenceByKey=new Map(reference.rows.map(row=>[row.key,row]));
    const windowSpan=firstDay!==null&&referenceDay!==null?Math.max(1,referenceDay-firstDay+1):savedDays;
    const totalPlanned=[...map.values()].reduce((sum,row)=>sum+row.planned,0);
    const totalCompleted=[...map.values()].reduce((sum,row)=>sum+row.completed,0);
    const totalWatchCompleted=[...map.values()].reduce((sum,row)=>sum+row.watchCompleted,0);
    const totalWatchActual=[...map.values()].reduce((sum,row)=>sum+row.watchActual,0);
    const allocationLabel=(score:number)=>{
      if(score>=18)return 'major allocation';
      if(score>=8)return 'regular allocation';
      return 'light allocation';
    };
    return [...map.entries()].map(([key,row])=>{
      const ref=referenceByKey.get(key)||null;
      const days=row.days.size;
      const completion=pct(row.completed,row.planned);
      const share=pct(row.completed,totalCompleted);
      const plannedShare=pct0(row.planned,totalPlanned);
      const lastDate=[row.lastDate,ref&&ref.lastDate].filter((value):value is string=>typeof value==='string'&&value.length>0).sort().pop()||null;
      const lastDay=lastDate?dateDay(lastDate):null;
      const daysSinceLast=isFiniteNumber(referenceDay)&&isFiniteNumber(lastDay)?Math.max(0,referenceDay-lastDay):null;
      const neverStudied=!lastDate;
      const historicalPlanned=ref?ref.planned:0;
      const historicalDays=ref?ref.dayCount:0;
      const historicalPlannedShare=ref?pct0(ref.planned,reference.totalPlanned):0;
      const historicalDayShare=ref?pct0(ref.dayCount,Math.max(1,reference.totalDays)):0;
      const allocationScore=round(historicalPlannedShare*.75+historicalDayShare*.25,1);
      const allocationWeight=Math.min(1,allocationScore/20);
      const currentEvidence=Math.min(1,(Math.min(row.watchBlocks,4)/4)*.45+(Math.min(row.watchPlanned,120)/120)*.35+(Math.min(row.watchDays.size,3)/3)*.2);
      const historicalEvidence=Math.min(1,(Math.min(historicalPlanned,300)/300)*.55+(Math.min(historicalDays,5)/5)*.45);
      const evidenceStrength=Math.max(currentEvidence,historicalEvidence);
      const staleScale=Math.max(7,Math.min(21,windowSpan*.45));
      const recencyPressure=neverStudied?100:Math.min(100,(num(daysSinceLast)/staleScale)*100);
      const watchOutputShare=pct0(row.watchCompleted,totalWatchCompleted);
      const watchActualShare=pct0(row.watchActual,totalWatchActual);
      const watchCompletion=pct(row.watchCompleted,row.watchPlanned);
      const underAllocation=Math.min(100,Math.max(0,historicalPlannedShare-Math.max(watchActualShare,watchOutputShare))*3);
      const lowCompletion=row.watchBlocks>0&&isFiniteNumber(watchCompletion)?Math.max(0,75-watchCompletion)*0.65:0;
      const coverageWatchEligible=!!ref;
      const windowAbsent=row.blocks===0&&coverageWatchEligible;
      const absencePressure=windowAbsent?100:0;
      const missedRate=pct0(row.watchSkipped+row.watchUntouched,row.watchBlocks);
      const rawRisk=recencyPressure*.36+underAllocation*.25+lowCompletion*.18+missedRate*.10+absencePressure*.11;
      const allocationAdjusted=rawRisk*(.35+.65*allocationWeight)*(.65+.35*evidenceStrength);
      const coverageWatchScore=coverageWatchEligible?Math.round(Math.max(0,Math.min(100,allocationAdjusted))):0;
      const allocation=allocationLabel(allocationScore);
      return {
        label:row.label,blocks:row.blocks,days,planned:row.planned,completed:row.completed,actual:row.actual,
        completion,share,plannedShare,lastDate,daysSinceLast,neverStudied,
        pairedBlocks:row.pairedBlocks,pairedPlanned:row.pairedPlanned,pairedCompleted:row.pairedCompleted,pairedActual:row.pairedActual,
        pairedTimerCoverage:pct(row.pairedPlanned,row.planned),pairedSourceMix:{...row.pairedSources},
        coverageCompletion:watchCompletion,historicalPlanned,historicalDays,
        allocationScore,allocation,evidenceStrength:round(evidenceStrength,2),
        windowAbsent,coverageWatchEligible,coverageWatchScore
      };
    }).sort((a,b)=>Number(a.windowAbsent)-Number(b.windowAbsent)||b.completed-a.completed||b.historicalPlanned-a.historicalPlanned||a.label.localeCompare(b.label));
  }
  function computeCompletionSources(evidence:EvidenceIndex){
    const map=new Map();
    evidence.work.forEach(evidenceRow=>{
      const key=evidenceRow.source;
      if(!map.has(key))map.set(key,{key,label:completionSourceLabel(key),group:evidenceRow.evidenceGroup,blocks:0,planned:0,completed:0,actual:0});
      const row=map.get(key)!;
      row.blocks+=1;
      row.planned+=evidenceRow.planned;
      row.completed+=evidenceRow.completed;
      row.actual+=evidenceRow.actual;
    });
    return [...map.values()].map(row=>({
      ...row,
      completion:pct(row.completed,row.planned),
      share:pct(row.blocks,evidence.work.length)
    })).sort((a,b)=>b.blocks-a.blocks||b.planned-a.planned||labelCompare(a,b));
  }
  function computeProgressEvidence(evidence:EvidenceIndex){
    const rows={
      explicit:{key:'explicit',label:'Explicit progress',blocks:0,planned:0},
      'time-derived':{key:'time-derived',label:'Time-derived',blocks:0,planned:0},
      unverified:{key:'unverified',label:'Unverified finish',blocks:0,planned:0},
      missing:{key:'missing',label:'No progress source',blocks:0,planned:0},
      skipped:{key:'skipped',label:'Skipped',blocks:0,planned:0}
    };
    evidence.work.forEach(row=>{
      const item=rows[row.evidenceGroup];
      item.blocks+=1;
      item.planned+=row.planned;
    });
    const total=evidence.work.length;
    return {
      total,
      rows:Object.values(rows).map(row=>({...row,share:pct(row.blocks,total)})),
      explicitBlocks:rows.explicit.blocks,
      timeDerivedBlocks:rows['time-derived'].blocks,
      unverifiedBlocks:rows.unverified.blocks,
      missingBlocks:rows.missing.blocks,
      skippedBlocks:rows.skipped.blocks,
      explicitRate:pct(rows.explicit.blocks,total)
    };
  }
  function startDelayBucketFor(minutes:number|null){
    if(!isFiniteNumber(minutes))return null;
    return START_DELAY_BUCKETS.find(bucket=>minutes>bucket.min&&minutes<=bucket.max)||null;
  }
  function computeStartDelayBuckets(evidence:EvidenceIndex){
    const map=new Map(START_DELAY_BUCKETS.map(bucket=>[bucket.id,{...bucket,blocks:0,planned:0,completed:0,actual:0,skipped:0,outcomeCounts:emptyOutcomeCounts(),delays:Array<number>()}]));
    evidence.work.forEach(evidenceRow=>{
      const {task}=evidenceRow;
      const delay=startDelayMinutes(task);
      if(!isFiniteNumber(delay))return;
      const bucket=startDelayBucketFor(delay);
      if(!bucket)return;
      const row=map.get(bucket.id)!;
      row.blocks+=1;
      row.planned+=evidenceRow.planned;
      row.completed+=evidenceRow.completed;
      row.actual+=evidenceRow.actual;
      row.skipped+=evidenceRow.outcome==='skipped'?1:0;
      addOutcome(row.outcomeCounts,evidenceRow.outcome);
      row.delays.push(delay);
    });
    return [...map.values()].map(row=>({
      ...row,
      min:isFiniteNumber(row.min)?row.min:null,
      max:isFiniteNumber(row.max)?row.max:null,
      completion:pct(row.completed,row.planned),
      averageDelay:row.delays.length?Math.round(mean(row.delays)!):null
    }));
  }
  function ordinalLabel(n:unknown){
    const value=Math.max(1,Math.round(num(n,1)));
    if(value%100>=11&&value%100<=13)return `${value}th`;
    const last=value%10;
    return `${value}${last===1?'st':last===2?'nd':last===3?'rd':'th'}`;
  }
  function blockOrderKey(ordinal:unknown){
    const value=Math.max(1,Math.round(num(ordinal,1)));
    return value>MAX_EXPLICIT_BLOCK_ORDER?`${MAX_EXPLICIT_BLOCK_ORDER+1}+`:String(value);
  }
  function computeBlockOrder(evidence:EvidenceIndex){
    const map=new Map();
    evidence.records.forEach(record=>{
      recordRows(evidence,record,'work').forEach((evidenceRow,index)=>{
        const {task}=evidenceRow;
        const rawOrdinal=num(task.studyOrdinal,null);
        const ordinal=isFiniteNumber(rawOrdinal)&&rawOrdinal>0?Math.round(rawOrdinal):index+1;
        const key=blockOrderKey(ordinal);
        const label=key.endsWith('+')?`${ordinalLabel(MAX_EXPLICIT_BLOCK_ORDER+1)}+`:ordinalLabel(Number(key));
        if(!map.has(key))map.set(key,{key,label,sort:Math.min(ordinal,MAX_EXPLICIT_BLOCK_ORDER+1),blocks:0,planned:0,completed:0,actual:0,timerBackedBlocks:0,timerBackedActual:0,skipped:0,outcomeCounts:emptyOutcomeCounts()});
        const row=map.get(key)!;
        row.blocks+=1;
        row.planned+=evidenceRow.planned;
        row.completed+=evidenceRow.completed;
        row.actual+=evidenceRow.actual;
        if(evidenceRow.timerBacked){row.timerBackedBlocks+=1;row.timerBackedActual+=evidenceRow.actual;}
        row.skipped+=evidenceRow.outcome==='skipped'?1:0;
        addOutcome(row.outcomeCounts,evidenceRow.outcome);
      });
    });
    return [...map.values()].sort((a,b)=>a.sort-b.sort).map(row=>({
      ...row,
      completion:pct(row.completed,row.planned)
    }));
  }
  function computeOutcomes(evidence:EvidenceIndex){
    const counts=emptyOutcomeCounts();
    evidence.work.forEach(row=>addOutcome(counts,row.outcome));
    const total=evidence.work.length;
    return {
      total,
      counts,
      rows:OUTCOME_KEYS.map(key=>({key,blocks:counts[key],share:pct(counts[key],total)}))
    };
  }
  function computeInterruption(evidence:EvidenceIndex){
    const allTasks=evidence.work;
    const tasks=allTasks.filter(row=>row.timerBacked);
    let affectedBlocks=0,frictionSeconds=0,frictionCount=0;
    let pomodoroBreakCount=0,pomodoroRecoverySeconds=0,pomodoroOverrunSeconds=0,pomodoroOnTime=0;
    const bySubject=new Map();
    const byPair=new Map();
    tasks.forEach(evidenceRow=>{
      const {task}=evidenceRow;
      const events=evidenceRow.pauseEvents;
      const frictionDurations=evidenceRow.frictionDurations;
      const count=frictionDurations.length;
      const taskFrictionSeconds=frictionDurations.reduce((a,b)=>a+b,0);
      const taskAffected=count>0;
      if(taskAffected)affectedBlocks+=1;
      frictionSeconds+=taskFrictionSeconds;
      frictionCount+=count;
      events.forEach(event=>{
        if(event.type!=='pomodoro')return;
        const planned=Math.max(0,num(event.plannedSeconds));
        if(!planned)return;
        pomodoroBreakCount+=1;
        const seconds=Math.max(0,num(event.seconds));
        const recovery=Math.min(seconds,planned);
        const overrun=Math.max(0,seconds-planned);
        pomodoroRecoverySeconds+=recovery;
        pomodoroOverrunSeconds+=overrun;
        if(overrun<=0)pomodoroOnTime+=1;
      });
      const label=evidenceRow.subject;
      const key=canonical(label);
      const band=timeBandForHour(firstHourSource(task).hour);
      const bandLabel=band?band.label:'Unknown';
      const pairKey=`${key}|${canonical(bandLabel)}`;
      if(!bySubject.has(key))bySubject.set(key,{label,blocks:0,affected:0,frictionSeconds:0,frictionCount:0,actual:0});
      if(!byPair.has(pairKey))byPair.set(pairKey,{label,bandLabel,blocks:0,affected:0,frictionSeconds:0,frictionCount:0});
      const row=bySubject.get(key);
      const pair=byPair.get(pairKey);
      row.blocks+=1;pair.blocks+=1;
      row.actual+=evidenceRow.actual;
      if(taskAffected){row.affected+=1;pair.affected+=1;}
      row.frictionSeconds+=taskFrictionSeconds;pair.frictionSeconds+=taskFrictionSeconds;
      row.frictionCount+=count;pair.frictionCount+=count;
    });
    const frictionMinutes=frictionSeconds/60;
    const subjects=[...bySubject.values()].map(row=>({
      ...row,
      pauseMinutes:round(row.frictionSeconds/60,1),
      interruptionRate:pct(row.affected,row.blocks),
      pausesPerFocusHour:row.actual?round(row.frictionCount/(row.actual/60),1):null
    })).sort((a,b)=>num(b.frictionSeconds)-num(a.frictionSeconds)||num(b.interruptionRate)-num(a.interruptionRate)||labelCompare(a,b));
    const pairs=[...byPair.values()].sort((a,b)=>num(b.frictionSeconds)-num(a.frictionSeconds)||num(b.affected)-num(a.affected)||String(a.label).localeCompare(String(b.label))||String(a.bandLabel).localeCompare(String(b.bandLabel)));
    const worst=pairs.find(row=>row.frictionSeconds>0);
    return {
      pauseCount:frictionCount,
      averagePauseMinutes:frictionCount?round(frictionMinutes/frictionCount,1):null,
      averagePausesPerInterruptedBlock:affectedBlocks?round(frictionCount/affectedBlocks,1):null,
      interruptionRate:pct(affectedBlocks,tasks.length),
      cleanBlockRate:pct(tasks.length-affectedBlocks,tasks.length),
      blockCount:tasks.length,
      workBlockCount:allTasks.length,
      timerCoverage:pct(tasks.length,allTasks.length),
      hasWorkBlocks:allTasks.length>0,
      hasTimerEvidence:tasks.length>0,
      worstAffected:worst?`${worst.label} / ${worst.bandLabel}`:null,
      subjects,
      pomodoro:{
        breakCount:pomodoroBreakCount,
        recoveryMinutes:round(pomodoroRecoverySeconds/60,1),
        overrunMinutes:round(pomodoroOverrunSeconds/60,1),
        onTimeBreaks:pomodoroOnTime,
        onTimeRate:pct(pomodoroOnTime,pomodoroBreakCount),
        averageOverrunMinutes:pomodoroBreakCount?round((pomodoroOverrunSeconds/60)/pomodoroBreakCount,1):null
      }
    };
  }
  function computeFocusFrictionSources(evidence:EvidenceIndex){
    const rows=[
      {key:'manual',label:'Manual pauses',events:0,blocks:new Set(),seconds:0},
      {key:'inactive-gap',label:'Inactive-gap breaks',events:0,blocks:new Set(),seconds:0},
      {key:'pomodoro-overrun',label:'Pomodoro overrun',events:0,blocks:new Set(),seconds:0}
    ];
    const byKey=new Map(rows.map(row=>[row.key,row]));
    evidence.work.forEach((evidenceRow,index)=>{
      const {record,task}=evidenceRow;
      evidenceRow.pauseEvents.forEach(event=>{
        const friction=pauseEventFrictionSeconds(event);
        if(friction<=0)return;
        const key=event.type==='pomodoro'?'pomodoro-overrun':event.type==='inactive-gap'?'inactive-gap':'manual';
        const row=byKey.get(key);
        if(!row)return;
        row.events+=1;
        row.seconds+=friction;
        const taskIdentity=task&&task.id
          ? task.id
          : isFiniteNumber(Number(task&&task.idx))?`idx:${Number(task.idx)}`:`row:${index}:${task&&task.name||'block'}`;
        row.blocks.add(`${record.date||'unknown-date'}|${taskIdentity}`);
      });
    });
    const totalSeconds=rows.reduce((sum,row)=>sum+row.seconds,0);
    return rows.map(row=>({
      key:row.key,
      label:row.label,
      events:row.events,
      blocks:row.blocks.size,
      minutes:round(row.seconds/60,1),
      share:pct(row.seconds,totalSeconds)
    }));
  }
  function computeSampleAudit(evidence:EvidenceIndex){
    const {work,support,fixed}=evidence;
    const timerBacked=work.filter(row=>row.timerBacked);
    const pauseEligible=timerBacked.length;
    const eventBlocks=timerBacked.filter(row=>row.pauseEvents.length>0).length;
    const startEvidenceBlocks=work.filter(({task})=>isFiniteNumber(actualStartMinuteEvidence(task).minute)).length;
    const timerBackedPlanned=rowsPlanned(timerBacked);
    const plannedWork=rowsPlanned(work);
    return {
      workBlocks:work.length,
      supportBlocks:support.length,
      fixedBlocks:fixed.length,
      plannedWork,
      actualFocus:rowsActual(work),
      timerBackedBlocks:timerBacked.length,
      timerPlannedCoverage:pct(timerBackedPlanned,plannedWork),
      eventEvidenceBlocks:eventBlocks,
      pauseEligibleBlocks:pauseEligible,
      startEvidenceBlocks
    };
  }
  function computeKindSummary(rows:readonly EvidenceRow[]){
    const byResource=new Map();
    rows.forEach(evidenceRow=>{
      const label=evidenceRow.subject;
      const key=canonical(label);
      if(!byResource.has(key))byResource.set(key,{label,blocks:0,planned:0,completed:0,actual:0});
      const row=byResource.get(key);
      row.blocks+=1;
      row.planned+=evidenceRow.planned;
      row.completed+=evidenceRow.completed;
      row.actual+=evidenceRow.actual;
    });
    return {
      blocks:rows.length,
      planned:rowsPlanned(rows),
      completed:rowsCompleted(rows),
      actual:rowsActual(rows),
      resources:[...byResource.values()].map(row=>({...row,completion:pct(row.completed,row.planned)})).sort((a,b)=>b.planned-a.planned||labelCompare(a,b))
    };
  }
  function computeResourceMix(evidence:EvidenceIndex){
    const groups=[
      {key:'work',label:'Work',rows:evidence.work,tone:'work'},
      {key:'support',label:'Support',rows:evidence.support,tone:'support'},
      {key:'fixed',label:'Fixed',rows:evidence.fixed,tone:'fixed'}
    ];
    return groups.map(group=>({
      key:group.key,
      label:group.label,
      tone:group.tone,
      blocks:group.rows.length,
      planned:rowsPlanned(group.rows),
      completed:rowsCompleted(group.rows),
      actual:rowsActual(group.rows)
    }));
  }
  function sampleStrength(records:number,blocks:number){
    if(records>=21&&blocks>=60)return {key:'strong',label:'Strong signal',tone:'strong',note:'Enough saved data for confident descriptive patterns.'};
    if(records>=10&&blocks>=25)return {key:'reliable',label:'Useful signal',tone:'good',note:'Patterns are becoming useful, but still personal and descriptive.'};
    if(records>=5&&blocks>=12)return {key:'emerging',label:'Emerging signal',tone:'watch',note:'Readable direction, but avoid over-interpreting small differences.'};
    return {key:'weak',label:'Low sample',tone:'low',note:'Treat claims as early hints until more days are saved.'};
  }
  function trendStrength(value:number|null,records:number){
    if(value===null)return {key:'weak',label:'No trend yet',tone:'low'};
    const abs=Math.abs(value);
    if(records<MIN_RECORDS_FOR_TREND)return {key:'weak',label:'Low sample',tone:'low'};
    if(records<MIN_RECORDS_FOR_COACH_TREND)return {key:'weak',label:'Early trend',tone:'low'};
    if(abs>=10)return {key:'strong',label:'Strong trend',tone:value>0?'strong':'watch'};
    if(abs>=4)return {key:'reliable',label:'Emerging trend',tone:value>0?'good':'watch'};
    return {key:'emerging',label:'Mostly flat',tone:'quiet'};
  }
  function variabilityLabel(sd:number|null,sampleCount=0){
    if(sampleCount<5)return {label:'Early evidence',tone:'low',note:'Need at least 5 work-completion days for a stability label.'};
    if(sd===null)return {label:'No stability read',tone:'low'};
    if(sd>=25)return {label:'Volatile',tone:'watch'};
    if(sd>=14)return {label:'Mixed',tone:'quiet'};
    return {label:'Stable',tone:'quiet'};
  }
  function progressEvidenceStrength(progress:ProgressEvidence){
    const total=num(progress&&progress.total);
    if(!total)return {label:'No progress evidence',tone:'low',note:'Save work completion to establish evidence quality.'};
    const explicit=Math.round(num(progress.explicitRate));
    const weak=num(progress.unverifiedBlocks)+num(progress.missingBlocks);
    const tone=weak/total>=.25?'watch':explicit>=60?'good':'quiet';
    return {label:`${explicit}% explicit`,tone,note:`${progress.timeDerivedBlocks} time-derived · ${weak} unverified or missing.`};
  }
  function computeAdvanced(daily:readonly DailySeriesRow[],trendDaily:readonly DailySeriesRow[]=daily){
    const completionValues=daily.map(d=>d.completion).filter(isFiniteNumber);
    const qualityPairs=daily.filter(d=>isFiniteNumber(d.quality)&&isFiniteNumber(d.completion));
    const directionalRows=Array.isArray(trendDaily)?trendDaily:daily;
    const trendCompletionValues=directionalRows.map(d=>d.completion).filter(isFiniteNumber);
    const completionSlope=regressionSlope(directionalRows.filter(d=>isFiniteNumber(d.completion)).map(d=>({x:d.day,y:d.completion})));
    const actualSlope=regressionSlope(directionalRows.filter(d=>isFiniteNumber(d.actual)).map(d=>({x:d.day,y:d.actual})));
    const plannedSlope=regressionSlope(directionalRows.filter(d=>isFiniteNumber(d.planned)).map(d=>({x:d.day,y:d.planned})));
    const completionSd=stdev(completionValues);
    const completionSdRounded=completionSd===null?null:round(completionSd,1);
    const qualityCorrelation=correlation(qualityPairs.map(d=>d.quality!),qualityPairs.map(d=>d.completion!));
    return {
      completionSlopePerWeek:completionSlope===null?null:round(completionSlope*7,1),
      actualSlopePerWeek:actualSlope===null?null:Math.round(actualSlope*7),
      plannedSlopePerWeek:plannedSlope===null?null:Math.round(plannedSlope*7),
      completionMean:completionValues.length?round(mean(completionValues)!,1):null,
      completionSd:completionSdRounded,
      completionDayCount:completionValues.length,
      trendCompletionDayCount:trendCompletionValues.length,
      outputStability:variabilityLabel(completionSdRounded,completionValues.length),
      qualityCompletionCorrelation:qualityCorrelation===null?null:round(qualityCorrelation,2),
      qualityPairCount:qualityPairs.length,
      rolling7:rollingAverage(daily,'completion',7)
    };
  }
  function computeQualityEvidence(daily:readonly DailySeriesRow[]){
    const map=new Map<string,{rating:string;days:number;completionValues:number[];trackedActualValues:number[];planned:number;timerBackedPlanned:number}>();
    daily.forEach(row=>{
      const rating=Number(row&&row.quality);
      if(!isFiniteNumber(rating)||rating<1)return;
      const key=String(Math.round(rating));
      if(!map.has(key))map.set(key,{rating:key,days:0,completionValues:[],trackedActualValues:[],planned:0,timerBackedPlanned:0});
      const item=map.get(key)!;
      item.days+=1;
      if(isFiniteNumber(row.completion))item.completionValues.push(row.completion);
      item.planned+=Math.max(0,num(row.planned));
      item.timerBackedPlanned+=Math.max(0,num(row.timerBackedPlanned));
      if(num(row.timerBackedBlocks)>0&&isFiniteNumber(row.actual))item.trackedActualValues.push(row.actual);
    });
    return [...map.values()].sort((a,b)=>Number(a.rating)-Number(b.rating)).map(row=>({
      rating:row.rating,
      days:row.days,
      averageCompletion:row.completionValues.length?round(mean(row.completionValues)!,1):null,
      averageActual:row.trackedActualValues.length?Math.round(mean(row.trackedActualValues)!):null,
      trackedDays:row.trackedActualValues.length,
      timerCoverage:pct(row.timerBackedPlanned,row.planned)
    }));
  }
    return Object.freeze({
      blockOrderKey,computeAdvanced,computeBlockOrder,computeCompletionSources,computeDailySeries,
      computeFocusFrictionSources,computeInterruption,computeKindSummary,computeOutcomes,computeProgressEvidence,
      computeQualityEvidence,computeResourceMix,computeSampleAudit,computeStartDelayBuckets,computeStreak,
      computeSubjects,computeSummaryStreak,createEvidenceIndex,ordinalLabel,progressEvidenceStrength,recordRows,
      rowsActual,rowsCompleted,rowsPlanned,sampleStrength,trendStrength
    });
  })(InsightsConfig,InsightsPrimitives);


  const key=Symbol.for('studyDirector.insightsFoundations.v1');
  const foundations=Object.freeze({
    format:'study-director.insights-foundations' as const,contractVersion:1 as const,
    Config:InsightsConfig,Primitives:InsightsPrimitives,Records:InsightsRecords,Analytics:InsightsAnalytics
  });
  (global as typeof globalThis&{[key:symbol]:unknown})[key]=foundations;
})(globalThis);
