/*
  Study Director Insights Model
  Copyright © 2026 Shubham Tiwari and Dr Satyam Kumar. All rights reserved.

  Source-available for personal and noncommercial use only.
  See LICENSE.txt and NOTICE.txt for full terms.
*/
(function(global){
  'use strict';
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
  const OUTCOME_KEYS=Object.freeze(['full','partial','skipped','untouched','finished-unverified','zero-output']);
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
  const InsightsPrimitives=((Config)=>{
    const {
      COACH_CONFIDENCE_RANK,CONFIDENCE,EVIDENCE_PRIOR_EFFECTIVE_BLOCKS,FIXED_KINDS,MIN_RECORDS_FOR_TREND,
      OUTCOME_KEYS,STUDY_DAY_ROLLOVER_MINUTE,SUPPORT_KINDS,TIME_BANDS
    }=Config;
  function num(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }
  function finiteOrNull(value){
    if(value===null||value===undefined||value==='')return null;
    const n=Number(value);
    return Number.isFinite(n)?n:null;
  }
  function pct(part,total){
    return total>0?(part/total)*100:null;
  }
  function pct0(part,total){
    const value=pct(part,total);
    return value===null?0:value;
  }
  function round(value,digits=1){
    const scale=Math.pow(10,digits);
    return Math.round(num(value)*scale)/scale;
  }
  function roundNullable(value,digits=1){
    return Number.isFinite(value)?round(value,digits):null;
  }
  function apportionedPercents(values,digits=0){
    const clean=(Array.isArray(values)?values:[]).map(value=>Math.max(0,num(value)));
    const total=clean.reduce((sum,value)=>sum+value,0);
    if(!total)return clean.map(()=>0);
    const scale=Math.pow(10,Math.max(0,Math.round(digits))),target=100*scale;
    const exact=clean.map(value=>value/total*target),units=exact.map(Math.floor);
    let remainder=Math.max(0,Math.round(target-units.reduce((sum,value)=>sum+value,0)));
    exact.map((value,index)=>({index,fraction:value-units[index]}))
      .sort((a,b)=>b.fraction-a.fraction||a.index-b.index)
      .forEach(row=>{if(remainder>0){units[row.index]+=1;remainder-=1;}});
    return units.map(value=>value/scale);
  }
  function clampPct(value){
    return Math.max(0,Math.min(100,Math.round(num(value))));
  }
  function isIsoDate(value){
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
  }
  function dateDay(iso){
    if(!isIsoDate(iso))return null;
    const parts=iso.split('-').map(Number);
    return Math.floor(Date.UTC(parts[0],parts[1]-1,parts[2])/86400000);
  }
  function dateFromDay(day){
    return new Date(day*86400000).toISOString().slice(0,10);
  }
  function localIsoDate(date=new Date()){
    const y=date.getFullYear();
    const m=String(date.getMonth()+1).padStart(2,'0');
    const d=String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  function dayName(iso){
    if(!isIsoDate(iso))return '';
    return weekdayFormatter.format(new Date(iso+'T00:00:00Z'));
  }
  // Calendar dates have no time zone. Reuse formatters rather than constructing
  // locale machinery for every chart label, and keep the date stable across zones.
  const weekdayFormatter=new Intl.DateTimeFormat('en-IN',{weekday:'short',timeZone:'UTC'});
  const shortDateFormatter=new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',timeZone:'UTC'});
  const shortDateYearFormatter=new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'2-digit',timeZone:'UTC'});
  function shortDate(iso){
    if(!isIsoDate(iso))return 'No date';
    const includeYear=iso.slice(0,4)!==localIsoDate().slice(0,4);
    return (includeYear?shortDateYearFormatter:shortDateFormatter).format(new Date(iso+'T00:00:00Z'));
  }
  function minutesLabel(minutes){
    const m=Math.round(Math.abs(num(minutes)));
    if(m<60)return `${m}m`;
    const h=Math.floor(m/60),r=m%60;
    return r?`${h}h ${r}m`:`${h}h`;
  }
  function evidenceMinutesLabel(minutes){
    const value=Math.abs(num(minutes));
    return value>0&&value<1?'<1m':minutesLabel(value);
  }
  function millisecondsLabel(value){
    const seconds=Math.round(Math.max(0,num(value))/1000);
    const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;
    if(h)return `${h}h${m?` ${m}m`:''}`;
    if(m)return `${m}m${s?` ${s}s`:''}`;
    return `${s}s`;
  }
  function signedMillisecondsLabel(value){
    if(!Number.isFinite(Number(value)))return 'No data';
    const n=Math.round(Number(value));
    if(n===0)return 'on time';
    return `${n>0?'+':'−'}${millisecondsLabel(Math.abs(n))}`;
  }
  function signedMinutesLabel(minutes){
    const m=Math.round(num(minutes));
    if(m===0)return '0m';
    return `${m>0?'+':'-'}${minutesLabel(m)}`;
  }
  function delayLabel(minutes){
    if(!Number.isFinite(Number(minutes)))return 'Need data';
    const m=Math.round(Number(minutes));
    if(m===0)return 'On time';
    return m>0?`${m}m late`:`${Math.abs(m)}m early`;
  }
  function scheduleShiftLabel(minutes){
    if(!Number.isFinite(Number(minutes)))return 'No data';
    const m=Math.round(Number(minutes));
    if(m===0)return 'No net movement';
    return `${minutesLabel(Math.abs(m))} ${m>0?'later':'earlier'}`;
  }
  function percentLabel(value,digits=0){
    return value===null||value===undefined||Number.isNaN(Number(value))?'No data':`${round(num(value),digits)}%`;
  }
  function numberLabel(value,digits=1){
    return value===null||value===undefined||Number.isNaN(Number(value))?'No data':String(round(value,digits));
  }
  function topLevelAreaLabel(value){
    return String(value||'General Study').split('>')[0].trim().replace(/\s+/g,' ')||'General Study';
  }
  function subjectLabel(task){
    return topLevelAreaLabel((task&&task.areaLabel)||(task&&task.area)||(task&&task.areaKey)||'General Study');
  }
  function canonical(value){
    return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
  }
  function labelCompare(a,b){
    return String(a&&a.label||'').localeCompare(String(b&&b.label||''));
  }
  function taskKind(task){
    const kind=canonical(task&&task.kind);
    if(FIXED_KINDS.has(kind))return 'fixed';
    if(SUPPORT_KINDS.has(kind))return 'support';
    return 'work';
  }
  function taskPlanned(task){
    return Math.max(0,num(task&&task.dur));
  }
  function taskCompletion(task){
    return Math.max(0,Math.min(100,num(task&&task.completion)));
  }
  function taskHasCompletionEvidence(task){
    if(!task||typeof task!=='object')return false;
    if(task.completion!==null&&task.completion!==undefined&&Number.isFinite(Number(task.completion)))return true;
    const source=canonical(task.completionSource);
    return !!task.skipped||!!task.doneFlag||['skipped','finished-unverified','manual','units','time','finished-time'].includes(source);
  }
  function taskHasActualEvidence(task){
    return !!task&&task.actualSeconds!==null&&task.actualSeconds!==undefined&&Number.isFinite(Number(task.actualSeconds));
  }
  function taskCompleted(task){
    return taskPlanned(task)*taskCompletion(task)/100;
  }
  function taskActual(task){
    return task&&task.actualSeconds!==null&&task.actualSeconds!==undefined?Math.max(0,num(task.actualSeconds)/60):0;
  }
  function taskHasTimerEvidence(task){
    if(!task||typeof task!=='object')return false;
    if(num(task.sessionCount)>0||num(task.actualSeconds)>0||task.actualStart)return true;
    if(task.actualStartLocalMinute!==null&&task.actualStartLocalMinute!==undefined)return true;
    if(task.actualStartUtcOffsetMinutes!==null&&task.actualStartUtcOffsetMinutes!==undefined)return true;
    return Array.isArray(task.pauseEvents)&&task.pauseEvents.length>0;
  }
  function completionSourceKey(task){
    if(task&&task.skipped)return 'skipped';
    const source=canonical(task&&task.completionSource);
    if(['units','manual','time','finished-time','finished-unverified','skipped'].includes(source))return source;
    return 'none';
  }
  function taskOutcomeKey(task,classifyTaskOutcome){
    return task&&typeof task.__sdOutcome==='string'?task.__sdOutcome:classifyTaskOutcome(task);
  }
  function completionSourceLabel(source){
    const key=canonical(source);
    if(key==='units')return 'Done/Total';
    if(key==='manual')return 'Manual %';
    if(key==='time')return 'Focus-time fallback';
    if(key==='finished-time')return 'Finished from focus';
    if(key==='finished-unverified')return 'Finished status only';
    if(key==='skipped')return 'Skipped';
    return 'No source';
  }
  function completionEvidenceGroup(source){
    const key=canonical(source);
    if(key==='units'||key==='manual')return 'explicit';
    if(key==='time'||key==='finished-time')return 'time-derived';
    if(key==='finished-unverified')return 'unverified';
    if(key==='skipped')return 'skipped';
    return 'missing';
  }
  function emptyOutcomeCounts(){
    return Object.fromEntries(OUTCOME_KEYS.map(key=>[key,0]));
  }
  function addOutcome(counts,outcome){
    if(counts&&OUTCOME_KEYS.includes(outcome))counts[outcome]+=1;
    return counts;
  }
  function outcomeShowsStudyActivity(outcome){
    return ['full','partial','finished-unverified','zero-output'].includes(String(outcome||''));
  }
  function evidenceRowShowsStudyActivity(row){
    return !!row&&(num(row.completed)>0||num(row.actual)>0||outcomeShowsStudyActivity(row.outcome));
  }
  function parseClockMinute(value){
    if(!value)return null;
    const text=String(value).trim();
    if(/^\d{1,2}:\d{2}$/.test(text)){
      const [hh,mm]=text.split(':').map(Number);
      return hh>=0&&hh<=23&&mm>=0&&mm<=59?hh*60+mm:null;
    }
    const d=new Date(text);
    return Number.isNaN(d.getTime())?null:d.getHours()*60+d.getMinutes();
  }
  function wrappedMinuteDelta(actual,planned){
    if(!Number.isFinite(actual)||!Number.isFinite(planned))return null;
    const studyMinute=minute=>minute<STUDY_DAY_ROLLOVER_MINUTE?minute+1440:minute;
    return Math.round(studyMinute(actual)-studyMinute(planned));
  }
  function actualStartMinuteEvidence(task){
    const rawLocal=task&&task.actualStartLocalMinute;
    if(rawLocal!==null&&rawLocal!==undefined){
      const local=Number(rawLocal);
      if(Number.isInteger(local)&&local>=0&&local<1440)return {minute:local,source:'captured-local'};
    }
    const rawOffset=task&&task.actualStartUtcOffsetMinutes;
    if(rawOffset!==null&&rawOffset!==undefined&&task&&task.actualStart){
      const offset=Number(rawOffset);
      const stamp=Date.parse(task.actualStart);
      if(Number.isInteger(offset)&&offset>=-840&&offset<=840&&Number.isFinite(stamp)){
        const utc=new Date(stamp);
        const minute=((utc.getUTCHours()*60+utc.getUTCMinutes()+offset)%1440+1440)%1440;
        return {minute,source:'captured-offset'};
      }
    }
    return {minute:null,source:'missing'};
  }
  function plannedStartMinute(task){
    const adjusted=parseClockMinute(task&&task.adjustedStart);
    if(Number.isFinite(adjusted))return {minute:adjusted,source:'adjusted'};
    const original=parseClockMinute(task&&task.originalStart);
    if(Number.isFinite(original))return {minute:original,source:'original'};
    return {minute:null,source:'missing'};
  }
  function startDelayMinutes(task){
    const planned=plannedStartMinute(task);
    if(!Number.isFinite(planned.minute))return null;
    const actual=actualStartMinuteEvidence(task);
    if(!Number.isFinite(actual.minute))return null;
    return wrappedMinuteDelta(actual.minute,planned.minute);
  }
  function firstHourSource(task){
    const actual=actualStartMinuteEvidence(task);
    return Number.isFinite(actual.minute)
      ? {hour:Math.floor(actual.minute/60),source:actual.source}
      : {hour:null,source:'missing'};
  }
  function timeBandForHour(hour){
    if(!Number.isFinite(hour))return null;
    return TIME_BANDS.find(b=>b.start<b.end?hour>=b.start&&hour<b.end:hour>=b.start||hour<b.end)||null;
  }
  function mean(values){
    const clean=values.filter(v=>Number.isFinite(v));
    return clean.length?clean.reduce((a,b)=>a+b,0)/clean.length:null;
  }
  function median(values){
    const clean=values.filter(v=>Number.isFinite(v)).sort((a,b)=>a-b);
    if(!clean.length)return null;
    const middle=Math.floor(clean.length/2);
    return clean.length%2?clean[middle]:(clean[middle-1]+clean[middle])/2;
  }
  function percentile(values,fraction){
    const clean=values.filter(v=>Number.isFinite(v)).sort((a,b)=>a-b);
    if(!clean.length)return null;
    const position=(clean.length-1)*Math.max(0,Math.min(1,num(fraction)));
    const lower=Math.floor(position),upper=Math.ceil(position),weight=position-lower;
    return lower===upper?clean[lower]:clean[lower]*(1-weight)+clean[upper]*weight;
  }
  function stdev(values){
    const clean=values.filter(v=>Number.isFinite(v));
    if(clean.length<2)return null;
    const m=mean(clean);
    return Math.sqrt(clean.reduce((sum,v)=>sum+Math.pow(v-m,2),0)/(clean.length-1));
  }
  function robustScale(values){
    const clean=(Array.isArray(values)?values:[]).filter(Number.isFinite);
    if(clean.length<2)return null;
    const centre=median(clean);
    return 1.4826*num(median(clean.map(value=>Math.abs(value-centre))));
  }
  function correlation(xs,ys){
    const pairs=[];
    xs.forEach((x,i)=>{
      const y=ys[i];
      if(Number.isFinite(x)&&Number.isFinite(y))pairs.push([x,y]);
    });
    if(pairs.length<3)return null;
    const mx=mean(pairs.map(p=>p[0]));
    const my=mean(pairs.map(p=>p[1]));
    let nume=0,dx=0,dy=0;
    pairs.forEach(([x,y])=>{
      nume+=(x-mx)*(y-my);
      dx+=Math.pow(x-mx,2);
      dy+=Math.pow(y-my,2);
    });
    return dx&&dy?nume/Math.sqrt(dx*dy):null;
  }
  function regressionSlope(points){
    const clean=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
    if(clean.length<MIN_RECORDS_FOR_TREND)return null;
    const mx=mean(clean.map(p=>p.x));
    const my=mean(clean.map(p=>p.y));
    let nume=0,den=0;
    clean.forEach(p=>{
      nume+=(p.x-mx)*(p.y-my);
      den+=Math.pow(p.x-mx,2);
    });
    return den?nume/den:null;
  }
  function sum(values){
    return (Array.isArray(values)?values:[]).reduce((total,value)=>total+num(value),0);
  }
  function clamp(value,low,high){return Math.max(low,Math.min(high,num(value)));}
  function sigmoid(value){
    const x=clamp(value,-35,35);
    return 1/(1+Math.exp(-x));
  }
  function logit(value){
    const p=clamp(value,1e-6,1-1e-6);
    return Math.log(p/(1-p));
  }
  function logGamma(value){
    const coefficients=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
    let z=num(value);
    if(z<.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
    z-=1;
    let x=.99999999999980993;
    coefficients.forEach((coefficient,index)=>{x+=coefficient/(z+index+1);});
    const t=z+coefficients.length-.5;
    return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x);
  }
  function logBeta(left,right){return logGamma(left)+logGamma(right)-logGamma(left+right);}
  function logSumExp(values){
    const clean=(Array.isArray(values)?values:[]).filter(Number.isFinite);
    if(!clean.length)return -Infinity;
    const maximum=Math.max(...clean);
    return maximum+Math.log(sum(clean.map(value=>Math.exp(value-maximum))));
  }
  function normalizedLogWeights(values){
    const normalizer=logSumExp(values);
    return values.map(value=>Number.isFinite(value)&&Number.isFinite(normalizer)?Math.exp(value-normalizer):0);
  }
  function weightedQuantile(points,target){
    const sorted=(Array.isArray(points)?points:[]).filter(point=>Number.isFinite(point.value)&&point.weight>0).sort((a,b)=>a.value-b.value);
    const total=sum(sorted.map(point=>point.weight));
    if(!total)return null;
    let running=0;
    for(const point of sorted){running+=point.weight;if(running/total>=target)return point.value;}
    return sorted[sorted.length-1].value;
  }
  function zeroMatrix(rows,columns=rows){return Array.from({length:rows},()=>Array(columns).fill(0));}
  function transposeMatrix(matrix){return matrix[0].map((_,column)=>matrix.map(row=>row[column]));}
  function multiplyMatrices(left,right){
    const columns=right[0].length,shared=right.length;
    return left.map(row=>Array.from({length:columns},(_,column)=>{
      let total=0;
      for(let index=0;index<shared;index+=1)total+=num(row[index])*num(right[index][column]);
      return total;
    }));
  }
  function addMatrices(left,right){return left.map((row,index)=>row.map((value,column)=>num(value)+num(right[index]&&right[index][column])));}
  function multiplyMatrixVector(matrix,vector){return matrix.map(row=>sum(row.map((value,index)=>num(value)*num(vector[index]))));}
  function solveLinearSystem(matrix,vector){
    const size=matrix.length;
    if(!size||vector.length!==size)return null;
    const augmented=matrix.map((row,index)=>row.map(num).concat([num(vector[index])]));
    for(let column=0;column<size;column+=1){
      let pivot=column;
      for(let row=column+1;row<size;row+=1)if(Math.abs(augmented[row][column])>Math.abs(augmented[pivot][column]))pivot=row;
      if(Math.abs(augmented[pivot][column])<1e-10)return null;
      if(pivot!==column)[augmented[pivot],augmented[column]]=[augmented[column],augmented[pivot]];
      const divisor=augmented[column][column];
      for(let index=column;index<=size;index+=1)augmented[column][index]/=divisor;
      for(let row=0;row<size;row+=1){
        if(row===column)continue;
        const factor=augmented[row][column];
        for(let index=column;index<=size;index+=1)augmented[row][index]-=factor*augmented[column][index];
      }
    }
    return augmented.map(row=>row[size]);
  }
  function invertMatrix(matrix){
    const size=matrix.length;
    const columns=[];
    for(let column=0;column<size;column+=1){
      const basis=Array(size).fill(0);basis[column]=1;
      const solved=solveLinearSystem(matrix,basis);
      if(!solved)return null;
      columns.push(solved);
    }
    return transposeMatrix(columns);
  }
  function quadraticForm(vector,matrix){
    const projected=multiplyMatrixVector(matrix,vector);
    return sum(vector.map((value,index)=>num(value)*num(projected[index])));
  }
  function fitRegularizedLogistic(examples,{lambda=2,minimumRows=8}={}){
    const rows=(Array.isArray(examples)?examples:[]).filter(row=>Array.isArray(row.x)&&Number.isFinite(row.y)&&row.y>=0&&row.y<=1);
    if(rows.length<minimumRows)return {ready:false,rows:rows.length,reason:`Need ${Math.max(0,minimumRows-rows.length)} more eligible observations.`};
    const dimension=rows[0].x.length+1;
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
        for(let index=0;index<dimension;index+=1)eta+=x[index]*coefficients[index];
        const probability=sigmoid(eta),variance=Math.max(1e-5,probability*(1-probability))*weight,residual=(row.y-probability)*weight;
        for(let left=0;left<dimension;left+=1){
          gradient[left]+=x[left]*residual;
          const weightedLeft=x[left]*variance;
          for(let right=left;right<dimension;right+=1)hessian[left][right]+=weightedLeft*x[right];
        }
      }
      for(let left=1;left<dimension;left+=1)for(let right=0;right<left;right+=1)hessian[left][right]=hessian[right][left];
      for(let index=1;index<dimension;index+=1){hessian[index][index]+=lambda;gradient[index]-=lambda*coefficients[index];}
      hessian[0][0]+=.05;
      const step=solveLinearSystem(hessian,gradient);
      if(!step)break;
      let maximumStep=0;
      for(let index=0;index<dimension;index+=1){const delta=step[index];maximumStep=Math.max(maximumStep,Math.abs(delta));coefficients[index]=clamp(coefficients[index]+delta,-20,20);}
      if(maximumStep<1e-6)break;
    }
    const covariance=hessian&&invertMatrix(hessian);
    const positives=rows.filter(row=>row.y>=.5).length;
    return {ready:!!covariance,rows:rows.length,positives,negatives:rows.length-positives,coefficients,covariance,lambda};
  }
  function predictRegularizedLogistic(fit,features,interval=.95){
    if(!fit||!fit.ready)return {mean:null,low:null,high:null,width:null};
    const x=[1,...features.map(num)];let eta=0;
    for(let index=0;index<x.length;index+=1)eta+=x[index]*num(fit.coefficients[index]);
    const multiplier=interval>=.95?1.96:1.282;
    const standardError=Math.sqrt(Math.max(0,quadraticForm(x,fit.covariance)));
    const low=sigmoid(eta-multiplier*standardError),high=sigmoid(eta+multiplier*standardError);
    return {mean:sigmoid(eta),low,high,width:high-low,eta,standardError};
  }
  function effectiveSampleSize(weights){
    const clean=(Array.isArray(weights)?weights:[]).map(value=>Math.max(0,num(value))).filter(value=>value>0);
    const total=sum(clean),squares=clean.reduce((acc,value)=>acc+value*value,0);
    return total&&squares?total*total/squares:0;
  }
  function evidenceConfidence(nEff,intervalWidth){
    const n=Math.max(0,num(nEff)),width=Math.max(0,num(intervalWidth,100));
    if(n<3||width>60)return CONFIDENCE.weak;
    if(n<7||width>45)return CONFIDENCE.emerging;
    if(n<20||width>30)return CONFIDENCE.reliable;
    return CONFIDENCE.strong;
  }
  function descriptiveEvidenceConfidence(days,volume=0){
    const n=Math.max(0,num(days)),v=Math.max(0,num(volume));
    if(n<5||v<120)return CONFIDENCE.weak;
    if(n<10||v<300)return CONFIDENCE.emerging;
    if(n<21||v<600)return CONFIDENCE.reliable;
    return CONFIDENCE.strong;
  }
  function confidenceAtLeast(confidence,key='emerging'){
    return num(COACH_CONFIDENCE_RANK[confidence&&confidence.key],0)>=num(COACH_CONFIDENCE_RANK[key],1);
  }
  function evidenceMetadata(meta={}){
    const confidence=meta&&meta.confidence&&typeof meta.confidence==='object'?meta.confidence:null;
    const limitations=(Array.isArray(meta&&meta.limitations)?meta.limitations:[])
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
  function capabilityResult(ready,reason,evidence={}){
    return Object.freeze({
      ready:!!ready,
      reason:ready||reason===undefined||reason===null?null:String(reason),
      evidence:evidenceMetadata(evidence)
    });
  }
  function withEvidenceMetadata(result,evidence={}){
    return {...(result&&typeof result==='object'?result:{}),evidence:evidenceMetadata(evidence)};
  }
  function bayesianRateEstimate(rate,nEff,priorRate,priorStrength=EVIDENCE_PRIOR_EFFECTIVE_BLOCKS){
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
  function log2(value){return Math.log(value)/Math.LN2;}
  function jensenShannonDivergence(left,right){
    const p=Array.isArray(left)?left:[],q=Array.isArray(right)?right:[];
    if(!p.length||p.length!==q.length)return null;
    const kl=(a,b)=>a.reduce((total,value,index)=>value>0&&b[index]>0?total+value*log2(value/b[index]):total,0);
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
  const InsightsRecords=((Config,Primitives)=>{
    const {
      DEFAULT_INSIGHT_WINDOW_KEY,INSIGHT_WINDOW_OPTIONS
    }=Config;
    const {
      dateDay,dateFromDay,isIsoDate,taskActual,taskCompleted,taskPlanned
    }=Primitives;
  function recordTimestamp(record){
    const n=Date.parse(record&&((record.updatedAt)||(record.savedAt)||(record.createdAt))||'');
    return Number.isFinite(n)?n:0;
  }
  function recordEvidenceScore(record){
    const tasks=Array.isArray(record&&record.tasks)?record.tasks:[];
    const planned=tasks.reduce((sum,t)=>sum+taskPlanned(t),0);
    const actual=tasks.reduce((sum,t)=>sum+taskActual(t),0);
    const completed=tasks.reduce((sum,t)=>sum+taskCompleted(t),0);
    const practiceUnits=(Array.isArray(record&&record.practiceRuns)?record.practiceRuns:[]).reduce((sum,run)=>sum+(Array.isArray(run&&run.unitMs)?run.unitMs.length:0),0);
    return tasks.length*1000000+Math.round(planned*1000)+Math.round(actual*100)+Math.round(completed*10)+practiceUnits;
  }
  function stableCacheValue(value,seen=new Set()){
    if(value===null||value===undefined)return value===undefined?'[undefined]':null;
    const type=typeof value;
    if(type==='number')return Number.isFinite(value)?value:String(value);
    if(type==='string'||type==='boolean')return value;
    if(type!=='object')return `[${type}]`;
    if(seen.has(value))return '[circular]';
    seen.add(value);
    let normalized;
    if(Array.isArray(value))normalized=value.map(item=>stableCacheValue(item,seen));
    else normalized=Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableCacheValue(value[key],seen)]));
    seen.delete(value);
    return normalized;
  }
  function stableRecordSignature(record){
    try{
      return JSON.stringify(stableCacheValue({
        date:record&&record.date,
        dayName:record&&record.dayName,
        savedAt:record&&record.savedAt,
        updatedAt:record&&record.updatedAt,
        createdAt:record&&record.createdAt,
        studyQuality:record&&record.studyQuality,
        originalPlannedStudyMinutes:record&&record.originalPlannedStudyMinutes,
        completedEquivalentMinutes:record&&record.completedEquivalentMinutes,
        actualFocusMinutes:record&&record.actualFocusMinutes,
        shiftedStudyBlocks:record&&record.shiftedStudyBlocks,
        totalScheduleShiftMinutes:record&&record.totalScheduleShiftMinutes,
        netScheduleShiftMinutes:record&&record.netScheduleShiftMinutes,
        tasks:Array.isArray(record&&record.tasks)?record.tasks:[],
        originalSchedule:Array.isArray(record&&record.originalSchedule)?record.originalSchedule:[],
        practiceRuns:Array.isArray(record&&record.practiceRuns)?record.practiceRuns:[]
      }));
    }catch(e){return String(record&&record.date||'');}
  }
  function chooseCanonicalRecord(existing,candidate){
    if(!existing)return candidate;
    const tA=recordTimestamp(existing),tB=recordTimestamp(candidate);
    if(tA!==tB)return tB>tA?candidate:existing;
    const sA=recordEvidenceScore(existing),sB=recordEvidenceScore(candidate);
    if(sA!==sB)return sB>sA?candidate:existing;
    return stableRecordSignature(candidate)>stableRecordSignature(existing)?candidate:existing;
  }
  function normalizeRecords(records){
    const byDate=new Map();
    (Array.isArray(records)?records:[])
      .filter(r=>r&&typeof r==='object'&&isIsoDate(r.date))
      .map(r=>({...r,tasks:Array.isArray(r.tasks)?r.tasks.filter(t=>t&&typeof t==='object'&&taskPlanned(t)>0):[]}))
      .forEach(record=>byDate.set(record.date,chooseCanonicalRecord(byDate.get(record.date),record)));
    return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
  }
  async function normalizeRecordsAsync(records,yieldTask=null,batchSize=64){
    const source=Array.isArray(records)?records:[],byDate=new Map(),size=Math.max(8,Math.min(256,Math.floor(Number(batchSize)||64)));
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
  function normalizeSummaries(summaries){
    return (Array.isArray(summaries)?summaries:[]).filter(s=>s&&typeof s==='object'&&isIsoDate(s.date)).sort((a,b)=>a.date.localeCompare(b.date));
  }
  function revisionHash(value){
    const text=String(value||'');let hash=2166136261;
    for(let index=0;index<text.length;index+=1){hash^=text.charCodeAt(index);hash=Math.imul(hash,16777619);}
    return (hash>>>0).toString(36);
  }
  function recordsRevisionKey(records){
    return `${records.length}:${revisionHash(records.map(stableRecordSignature).join('\u001e'))}`;
  }
  function summariesRevisionKey(summaries){
    const rows=normalizeSummaries(summaries);
    return `${rows.length}:${revisionHash(JSON.stringify(rows))}`;
  }
  function insightWindowByKey(key){
    const clean=String(key||'').toLowerCase();
    return INSIGHT_WINDOW_OPTIONS.find(option=>option.key===clean)||INSIGHT_WINDOW_OPTIONS.find(option=>option.key===DEFAULT_INSIGHT_WINDOW_KEY)||INSIGHT_WINDOW_OPTIONS[0];
  }
  function normalizeInsightWindowKey(value){
    return insightWindowByKey(value).key;
  }
  function filterCanonicalRecordsForInsightWindow(allRecords,key,currentStudyDate=null){
    const option=insightWindowByKey(key);
    if(option.key==='all'||!option.days){
      const to=allRecords[allRecords.length-1]?.date||null;
      return {records:allRecords,key:option.key,label:option.summary,days:option.days,allRecordCount:allRecords.length,from:null,to};
    }
    const latestSavedDay=allRecords.length?dateDay(allRecords[allRecords.length-1].date):null;
    const currentDay=isIsoDate(currentStudyDate)?dateDay(currentStudyDate):null;
    const endDay=Number.isFinite(currentDay)&&Number.isFinite(latestSavedDay)
      ? Math.max(currentDay,latestSavedDay)
      : Number.isFinite(currentDay)?currentDay:latestSavedDay;
    if(!Number.isFinite(endDay)){
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
  function filterSummariesForInsightWindow(summaries,windowInfo){
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
  const InsightsAnalytics=((Config,Primitives)=>{
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
  function createEvidenceRow(record,task,kind=taskKind(task),classifyTaskOutcome=null){
    const pauseEvents=taskPauseEvents(task);
    const frictionDurations=pauseEvents.map(pauseEventFrictionSeconds).filter(value=>value>0);
    const source=completionSourceKey(task);
    return Object.freeze({
      record,
      task,
      date:record&&record.date||'',
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
  function createEvidenceIndex(records,classifyTaskOutcome){
    const all=[],work=[],support=[],fixed=[];
    const byRecord=new Map();
    (Array.isArray(records)?records:[]).forEach(record=>{
      const groups={all:[],work:[],support:[],fixed:[]};
      (Array.isArray(record&&record.tasks)?record.tasks:[]).forEach(task=>{
        const kind=taskKind(task);
        if(record.degraded===true&&kind!=='fixed'&&(!taskHasCompletionEvidence(task)||!taskHasActualEvidence(task)))return;
        const row=createEvidenceRow(record,task,kind,classifyTaskOutcome);
        all.push(row);groups.all.push(row);
        if(row.kind==='work'){work.push(row);groups.work.push(row);}
        else if(row.kind==='support'){support.push(row);groups.support.push(row);}
        else {fixed.push(row);groups.fixed.push(row);}
      });
      if(!groups.fixed.length){
        (Array.isArray(record&&record.originalSchedule)?record.originalSchedule:[])
          .filter(row=>taskKind(row)==='fixed')
          .forEach(scheduleRow=>{
            const task={...scheduleRow,kind:'fixed',completion:null,actualSeconds:null};
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
  function rowsPlanned(rows){return rows.reduce((sum,row)=>sum+row.planned,0);}
  function rowsCompleted(rows){return rows.reduce((sum,row)=>sum+row.completed,0);}
  function rowsActual(rows){return rows.reduce((sum,row)=>sum+row.actual,0);}
  function recordRows(evidence,record,kind){return evidence.byRecord.get(record)[kind];}
  function taskPauseEvents(task){
    return Array.isArray(task&&task.pauseEvents)?task.pauseEvents
      .map(ev=>{
        const row=(ev&&typeof ev==='object')?ev:{};
        const type=canonical(row.type||row.reason||'manual');
        const rawPlanned=Number(row.plannedSeconds);
        return {
          type:type==='pomodoro'?'pomodoro':type==='inactive-gap'?'inactive-gap':'manual',
          seconds:Math.max(0,num(row.seconds)),
          plannedSeconds:Number.isFinite(rawPlanned)&&rawPlanned>0?rawPlanned:null
        };
      })
      .filter(ev=>ev.seconds>0):[];
  }
  function pauseEventFrictionSeconds(event){
    if(!event)return 0;
    if(event.type==='pomodoro')return Number(event.plannedSeconds)>0?Math.max(0,num(event.seconds)-num(event.plannedSeconds)):0;
    return Math.max(0,num(event.seconds));
  }
  function computeDailySeries(evidence){
    return evidence.records.map(record=>{
      const work=recordRows(evidence,record,'work');
      const timerBacked=work.filter(row=>row.timerBacked);
      const planned=rowsPlanned(work);
      const completed=rowsCompleted(work);
      const actual=rowsActual(work);
      const timerBackedPlanned=rowsPlanned(timerBacked);
      return {
        date:record.date,
        day:dateDay(record.date),
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
  function rollingAverage(rows,key,windowSize){
    const eligible=[];
    return rows.map(row=>{
      if(Number.isFinite(row&&row[key]))eligible.push(row[key]);
      const slice=eligible.slice(-Math.max(1,windowSize));
      return {...row,value:slice.length?round(slice.reduce((a,b)=>a+b,0)/slice.length,1):null};
    });
  }
  function computeStreakFromDays(dayList,currentStudyDate){
    const days=[...new Set((Array.isArray(dayList)?dayList:[]).filter(Number.isFinite))]
      .sort((a,b)=>a-b);
    let longest=0,latest=0,current=0;
    days.forEach((day,index)=>{
      current=(index===0||day===days[index-1]+1)?current+1:1;
      longest=Math.max(longest,current);
      latest=current;
    });
    const lastDay=days.length?days[days.length-1]:null;
    const today=dateDay(isIsoDate(currentStudyDate)?currentStudyDate:localIsoDate());
    const daysSinceLast=Number.isFinite(today)&&Number.isFinite(lastDay)?today-lastDay:null;
    const isCurrent=Number.isFinite(daysSinceLast)&&daysSinceLast>=0&&daysSinceLast<=1;
    return {
      current:isCurrent?latest:0,
      latest,
      longest,
      dayCount:days.length,
      first:days.length?dateFromDay(days[0]):null,
      last:days.length?dateFromDay(days[days.length-1]):null,
      daysSinceLast,
      isCurrent
    };
  }
  function computeStreak(evidence,currentStudyDate){
    return computeStreakFromDays(evidence.records
      .filter(r=>recordRows(evidence,r,'work').some(evidenceRowShowsStudyActivity))
      .map(r=>dateDay(r.date))
      .filter(Number.isFinite),currentStudyDate);
  }
  function computeSummaryStreak(summaries,currentStudyDate){
    return computeStreakFromDays(summaries.filter(s=>num(s.completedMinutes)>0||num(s.actualTrackedMinutes)>0||['full','partial','finished-unverified','zero-output'].some(key=>num(s.outcomeCounts&&s.outcomeCounts[key])>0))
      .map(s=>dateDay(s.date))
      .filter(Number.isFinite),currentStudyDate);
  }
  function computeSubjectReference(summaries,evidence,referenceStartDay,referenceDay){
    const map=new Map();
    const savedDates=new Set();
    const inReferenceRange=date=>{
      const day=dateDay(date);
      return Number.isFinite(day)&&(!Number.isFinite(referenceStartDay)||day>=referenceStartDay)&&(!Number.isFinite(referenceDay)||day<=referenceDay);
    };
    const add=(date,rawLabel,planned,completed,actual=0,activityBlocks=0)=>{
      if(!inReferenceRange(date)||!(planned>0||completed>0||actual>0||activityBlocks>0))return;
      savedDates.add(date);
      const label=topLevelAreaLabel(rawLabel);
      const key=canonical(label);
      if(!map.has(key))map.set(key,{label,days:new Set(),activityDays:new Set(),planned:0,completed:0,actual:0,activityBlocks:0,lastDate:null});
      const row=map.get(key);
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
  function computeSubjects(evidence,currentStudyDate=null,subjectReferenceSummaries=[]){
    const map=new Map();
    const emptySubject=label=>({
      label,blocks:0,days:new Set(),planned:0,completed:0,actual:0,lastDate:null,
      pairedBlocks:0,pairedPlanned:0,pairedCompleted:0,pairedActual:0,pairedSources:{},
      watchBlocks:0,watchDays:new Set(),watchPlanned:0,watchCompleted:0,watchActual:0,watchSkipped:0,watchUntouched:0,watchLastDate:null
    });
    const records=evidence.records;
    const savedDays=Math.max(1,records.length);
    const firstDay=records.length?dateDay(records[0].date):null;
    const latestDay=records.length?dateDay(records[records.length-1].date):null;
    const requestedReferenceDay=isIsoDate(currentStudyDate)?dateDay(currentStudyDate):null;
    const referenceDay=Number.isFinite(requestedReferenceDay)&&Number.isFinite(latestDay)
      ? Math.max(requestedReferenceDay,latestDay)
      : Number.isFinite(requestedReferenceDay)?requestedReferenceDay:latestDay;
    const referenceStartDay=Number.isFinite(referenceDay)?referenceDay-COVERAGE_WATCH_REFERENCE_DAYS+1:null;
    evidence.work.forEach(evidenceRow=>{
      const {record}=evidenceRow;
      const label=evidenceRow.subject;
      const key=canonical(label);
      if(!map.has(key))map.set(key,emptySubject(label));
      const row=map.get(key);
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
      if(Number.isFinite(recordDay)&&(!Number.isFinite(referenceStartDay)||recordDay>=referenceStartDay)&&(!Number.isFinite(referenceDay)||recordDay<=referenceDay)){
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
    const allocationLabel=score=>{
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
      const lastDate=[row.lastDate,ref&&ref.lastDate].filter(Boolean).sort().pop()||null;
      const daysSinceLast=referenceDay!==null&&lastDate?Math.max(0,referenceDay-dateDay(lastDate)):null;
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
      const recencyPressure=neverStudied?100:Math.min(100,(daysSinceLast/staleScale)*100);
      const watchOutputShare=pct0(row.watchCompleted,totalWatchCompleted);
      const watchActualShare=pct0(row.watchActual,totalWatchActual);
      const watchCompletion=pct(row.watchCompleted,row.watchPlanned);
      const underAllocation=Math.min(100,Math.max(0,historicalPlannedShare-Math.max(watchActualShare,watchOutputShare))*3);
      const lowCompletion=row.watchBlocks>0&&Number.isFinite(watchCompletion)?Math.max(0,75-watchCompletion)*0.65:0;
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
  function computeCompletionSources(evidence){
    const map=new Map();
    evidence.work.forEach(evidenceRow=>{
      const key=evidenceRow.source;
      if(!map.has(key))map.set(key,{key,label:completionSourceLabel(key),group:evidenceRow.evidenceGroup,blocks:0,planned:0,completed:0,actual:0});
      const row=map.get(key);
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
  function computeProgressEvidence(evidence){
    const rows={
      explicit:{key:'explicit',label:'Explicit progress',blocks:0,planned:0},
      'time-derived':{key:'time-derived',label:'Time-derived',blocks:0,planned:0},
      unverified:{key:'unverified',label:'Unverified finish',blocks:0,planned:0},
      missing:{key:'missing',label:'No progress source',blocks:0,planned:0},
      skipped:{key:'skipped',label:'Skipped',blocks:0,planned:0}
    };
    evidence.work.forEach(row=>{
      const item=rows[row.evidenceGroup]||rows.missing;
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
  function startDelayBucketFor(minutes){
    if(!Number.isFinite(minutes))return null;
    return START_DELAY_BUCKETS.find(bucket=>minutes>bucket.min&&minutes<=bucket.max)||null;
  }
  function computeStartDelayBuckets(evidence){
    const map=new Map(START_DELAY_BUCKETS.map(bucket=>[bucket.id,{...bucket,blocks:0,planned:0,completed:0,actual:0,skipped:0,outcomeCounts:emptyOutcomeCounts(),delays:[]} ]));
    evidence.work.forEach(evidenceRow=>{
      const {task}=evidenceRow;
      const delay=startDelayMinutes(task);
      if(!Number.isFinite(delay))return;
      const bucket=startDelayBucketFor(delay);
      if(!bucket)return;
      const row=map.get(bucket.id);
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
      min:Number.isFinite(row.min)?row.min:null,
      max:Number.isFinite(row.max)?row.max:null,
      completion:pct(row.completed,row.planned),
      averageDelay:row.delays.length?Math.round(mean(row.delays)):null
    }));
  }
  function ordinalLabel(n){
    const value=Math.max(1,Math.round(num(n,1)));
    if(value%100>=11&&value%100<=13)return `${value}th`;
    const last=value%10;
    return `${value}${last===1?'st':last===2?'nd':last===3?'rd':'th'}`;
  }
  function blockOrderKey(ordinal){
    const value=Math.max(1,Math.round(num(ordinal,1)));
    return value>MAX_EXPLICIT_BLOCK_ORDER?`${MAX_EXPLICIT_BLOCK_ORDER+1}+`:String(value);
  }
  function computeBlockOrder(evidence){
    const map=new Map();
    evidence.records.forEach(record=>{
      recordRows(evidence,record,'work').forEach((evidenceRow,index)=>{
        const {task}=evidenceRow;
        const rawOrdinal=num(task.studyOrdinal,null);
        const ordinal=Number.isFinite(rawOrdinal)&&rawOrdinal>0?Math.round(rawOrdinal):index+1;
        const key=blockOrderKey(ordinal);
        const label=key.endsWith('+')?`${ordinalLabel(MAX_EXPLICIT_BLOCK_ORDER+1)}+`:ordinalLabel(Number(key));
        if(!map.has(key))map.set(key,{key,label,sort:Math.min(ordinal,MAX_EXPLICIT_BLOCK_ORDER+1),blocks:0,planned:0,completed:0,actual:0,timerBackedBlocks:0,timerBackedActual:0,skipped:0,outcomeCounts:emptyOutcomeCounts()});
        const row=map.get(key);
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
  function computeOutcomes(evidence){
    const counts=emptyOutcomeCounts();
    evidence.work.forEach(row=>addOutcome(counts,row.outcome));
    const total=evidence.work.length;
    return {
      total,
      counts,
      rows:OUTCOME_KEYS.map(key=>({key,blocks:counts[key],share:pct(counts[key],total)}))
    };
  }
  function computeInterruption(evidence){
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
  function computeFocusFrictionSources(evidence){
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
          : Number.isFinite(Number(task&&task.idx))?`idx:${Number(task.idx)}`:`row:${index}:${task&&task.name||'block'}`;
        row.blocks.add(`${record&&record.date||'unknown-date'}|${taskIdentity}`);
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
  function computeSampleAudit(evidence){
    const {work,support,fixed}=evidence;
    const timerBacked=work.filter(row=>row.timerBacked);
    const pauseEligible=timerBacked.length;
    const eventBlocks=timerBacked.filter(row=>row.pauseEvents.length>0).length;
    const startEvidenceBlocks=work.filter(({task})=>Number.isFinite(actualStartMinuteEvidence(task).minute)).length;
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
  function computeKindSummary(rows){
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
  function computeResourceMix(evidence){
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
  function sampleStrength(records,blocks){
    if(records>=21&&blocks>=60)return {key:'strong',label:'Strong signal',tone:'strong',note:'Enough saved data for confident descriptive patterns.'};
    if(records>=10&&blocks>=25)return {key:'reliable',label:'Useful signal',tone:'good',note:'Patterns are becoming useful, but still personal and descriptive.'};
    if(records>=5&&blocks>=12)return {key:'emerging',label:'Emerging signal',tone:'watch',note:'Readable direction, but avoid over-interpreting small differences.'};
    return {key:'weak',label:'Low sample',tone:'low',note:'Treat claims as early hints until more days are saved.'};
  }
  function trendStrength(value,records){
    if(value===null)return {key:'weak',label:'No trend yet',tone:'low'};
    const abs=Math.abs(value);
    if(records<MIN_RECORDS_FOR_TREND)return {key:'weak',label:'Low sample',tone:'low'};
    if(records<MIN_RECORDS_FOR_COACH_TREND)return {key:'weak',label:'Early trend',tone:'low'};
    if(abs>=10)return {key:'strong',label:'Strong trend',tone:value>0?'strong':'watch'};
    if(abs>=4)return {key:'reliable',label:'Emerging trend',tone:value>0?'good':'watch'};
    return {key:'emerging',label:'Mostly flat',tone:'quiet'};
  }
  function variabilityLabel(sd,sampleCount=0){
    if(sampleCount<5)return {label:'Early evidence',tone:'low',note:'Need at least 5 work-completion days for a stability label.'};
    if(sd===null)return {label:'No stability read',tone:'low'};
    if(sd>=25)return {label:'Volatile',tone:'watch'};
    if(sd>=14)return {label:'Mixed',tone:'quiet'};
    return {label:'Stable',tone:'quiet'};
  }
  function progressEvidenceStrength(progress){
    const total=num(progress&&progress.total);
    if(!total)return {label:'No progress evidence',tone:'low',note:'Save work completion to establish evidence quality.'};
    const explicit=Math.round(num(progress.explicitRate));
    const weak=num(progress.unverifiedBlocks)+num(progress.missingBlocks);
    const tone=weak/total>=.25?'watch':explicit>=60?'good':'quiet';
    return {label:`${explicit}% explicit`,tone,note:`${progress.timeDerivedBlocks} time-derived · ${weak} unverified or missing.`};
  }
  function computeAdvanced(daily,trendDaily=daily){
    const completionValues=daily.map(d=>d.completion).filter(Number.isFinite);
    const qualityPairs=daily.filter(d=>Number.isFinite(d.quality)&&Number.isFinite(d.completion));
    const directionalRows=Array.isArray(trendDaily)?trendDaily:daily;
    const trendCompletionValues=directionalRows.map(d=>d.completion).filter(Number.isFinite);
    const completionSlope=regressionSlope(directionalRows.filter(d=>Number.isFinite(d.completion)).map(d=>({x:d.day,y:d.completion})));
    const actualSlope=regressionSlope(directionalRows.filter(d=>Number.isFinite(d.actual)).map(d=>({x:d.day,y:d.actual})));
    const plannedSlope=regressionSlope(directionalRows.filter(d=>Number.isFinite(d.planned)).map(d=>({x:d.day,y:d.planned})));
    const completionSd=stdev(completionValues);
    const completionSdRounded=completionSd===null?null:round(completionSd,1);
    const qualityCorrelation=correlation(qualityPairs.map(d=>d.quality),qualityPairs.map(d=>d.completion));
    return {
      completionSlopePerWeek:completionSlope===null?null:round(completionSlope*7,1),
      actualSlopePerWeek:actualSlope===null?null:Math.round(actualSlope*7),
      plannedSlopePerWeek:plannedSlope===null?null:Math.round(plannedSlope*7),
      completionMean:mean(completionValues)===null?null:round(mean(completionValues),1),
      completionSd:completionSdRounded,
      completionDayCount:completionValues.length,
      trendCompletionDayCount:trendCompletionValues.length,
      outputStability:variabilityLabel(completionSdRounded,completionValues.length),
      qualityCompletionCorrelation:qualityCorrelation===null?null:round(qualityCorrelation,2),
      qualityPairCount:qualityPairs.length,
      rolling7:rollingAverage(daily,'completion',7)
    };
  }
  function computeQualityEvidence(daily){
    const map=new Map();
    (Array.isArray(daily)?daily:[]).forEach(row=>{
      const rating=Number(row&&row.quality);
      if(!Number.isFinite(rating)||rating<1)return;
      const key=String(Math.round(rating));
      if(!map.has(key))map.set(key,{rating:key,days:0,completionValues:[],trackedActualValues:[],planned:0,timerBackedPlanned:0});
      const item=map.get(key);
      item.days+=1;
      if(Number.isFinite(row.completion))item.completionValues.push(row.completion);
      item.planned+=Math.max(0,num(row.planned));
      item.timerBackedPlanned+=Math.max(0,num(row.timerBackedPlanned));
      if(num(row.timerBackedBlocks)>0&&Number.isFinite(row.actual))item.trackedActualValues.push(row.actual);
    });
    return [...map.values()].sort((a,b)=>Number(a.rating)-Number(b.rating)).map(row=>({
      rating:row.rating,
      days:row.days,
      averageCompletion:row.completionValues.length?round(mean(row.completionValues),1):null,
      averageActual:row.trackedActualValues.length?Math.round(mean(row.trackedActualValues)):null,
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

  // M8.5 PRACTICE PACER EVIDENCE COMPONENT
  const InsightsPacerEvidence=((Config,Primitives)=>{
    const {
      COACH_CONFIDENCE_RANK,MIN_MEANINGFUL_PACE_DIFFERENCE_POINTS,MIN_MEANINGFUL_PACE_SPREAD_POINTS,
      MIN_PRACTICE_AREA_UNITS,MIN_PRACTICE_COMPARABLE_RUNS,MIN_PRACTICE_COMPARABLE_UNITS,
      MIN_PRACTICE_ESTABLISHED_DAYS,MIN_PRACTICE_ESTABLISHED_RUNS,MIN_PRACTICE_PATTERN_DAYS,
      MIN_PRACTICE_PATTERN_UNITS,MIN_PRACTICE_POSITION_DAYS,MIN_PRACTICE_POSITION_RUNS,
      MIN_PRACTICE_POSITION_SLIP_POINTS,MIN_PRACTICE_POSITION_UNITS,MIN_PRACTICE_RELIABLE_DAYS,
      MIN_PRACTICE_RELIABLE_RUNS,MIN_PRACTICE_SEGMENT_DAYS,MIN_PRACTICE_SEGMENT_EFFECT_POINTS,
      MIN_PRACTICE_SEGMENT_RUNS,MIN_PRACTICE_SEGMENT_UNITS,MIN_PRACTICE_SIZE_EFFECT_POINTS,
      MIN_PRACTICE_SIZE_GROUP_DAYS,MIN_PRACTICE_SIZE_GROUP_RUNS,MIN_PRACTICE_SIZE_GROUP_UNITS,
      MAX_PRACTICE_TREND_EXACT_DAYS,MIN_PRACTICE_SUMMARY_UNITS,MIN_PRACTICE_TARGET_SPAN_MS,MIN_PRACTICE_TREND_DAYS,
      MIN_PRACTICE_TREND_POINTS_PER_WEEK,MIN_PRACTICE_TREND_STABILITY,PRACTICE_CONTROLLED_MAX,
      PRACTICE_CONTROLLED_MIN,PRACTICE_POSITION_BANDS,PRACTICE_SEVERE_FAST_THRESHOLD,
      PRACTICE_TREND_JACKKNIFE_BLOCKS,PRACTICE_TREND_RECENT_OBSERVATIONS
    }=Config;
    const {
      canonical,dateDay,finiteOrNull,isIsoDate,median,millisecondsLabel,num,numberLabel,pct,pct0,percentLabel,
      percentile,round,roundNullable,signedMillisecondsLabel,subjectLabel
    }=Primitives;
  function practiceMode(run){
    const mode=canonical(run&&run.unitPlan&&run.unitPlan.mode);
    if(mode==='marks')return {key:'paper-marks',label:'Paper · marks'};
    if(mode==='time')return {key:'paper-time',label:'Paper · time'};
    if(num(run&&run.totalUnits)>0)return {key:'simple-planned',label:'Simple · planned'};
    return {key:'simple-open',label:'Simple · open'};
  }
  function practiceEvidenceMaturity(units,runs,days){
    const u=Math.max(0,num(units)),r=Math.max(0,num(runs)),d=Math.max(0,num(days));
    if(u>=MIN_PRACTICE_PATTERN_UNITS&&r>=MIN_PRACTICE_RELIABLE_RUNS&&d>=MIN_PRACTICE_RELIABLE_DAYS){
      return {key:'reliable',label:'Reliable',tone:'good',rank:2,confidence:{key:'reliable',label:'Reliable pace evidence',tone:'good'}};
    }
    if(u>=MIN_PRACTICE_AREA_UNITS&&r>=MIN_PRACTICE_ESTABLISHED_RUNS&&d>=MIN_PRACTICE_ESTABLISHED_DAYS){
      return {key:'established',label:'Established',tone:'watch',rank:1,confidence:{key:'emerging',label:'Established pace evidence',tone:'watch'}};
    }
    return {key:'early',label:'Early',tone:'low',rank:0,confidence:{key:'weak',label:'Early pace evidence',tone:'low'}};
  }
  function practiceSortedQuantile(sorted,fraction){
    if(!sorted.length)return null;
    const position=(sorted.length-1)*Math.max(0,Math.min(1,num(fraction)));
    const lower=Math.floor(position),upper=Math.ceil(position),weight=position-lower;
    return lower===upper?sorted[lower]:sorted[lower]*(1-weight)+sorted[upper]*weight;
  }
  function practicePairwiseSlope(points){
    const rows=(Array.isArray(points)?points:[]).filter(point=>Number.isFinite(point&&point.x)&&Number.isFinite(point&&point.y));
    const slopes=[];
    for(let i=0;i<rows.length;i+=1){
      for(let j=i+1;j<rows.length;j+=1){
        const dx=rows[j].x-rows[i].x;
        if(dx)slopes.push((rows[j].y-rows[i].y)/dx);
      }
    }
    if(!slopes.length)return {slope:null,low:null,high:null,count:0};
    slopes.sort((a,b)=>a-b);
    return {
      slope:practiceSortedQuantile(slopes,.5),
      low:practiceSortedQuantile(slopes,.25),
      high:practiceSortedQuantile(slopes,.75),
      count:slopes.length
    };
  }
  function practiceEvenSample(points,count){
    const rows=Array.isArray(points)?points:[];
    const limit=Math.max(0,Math.floor(num(count)));
    if(!limit||!rows.length)return [];
    if(rows.length<=limit)return rows.slice();
    if(limit===1)return [rows[0]];
    const sampled=[];
    for(let index=0;index<limit;index+=1){
      sampled.push(rows[Math.round(index*(rows.length-1)/(limit-1))]);
    }
    return sampled;
  }
  function practiceTrendSample(points){
    const rows=Array.isArray(points)?points:[];
    if(rows.length<=MAX_PRACTICE_TREND_EXACT_DAYS)return {points:rows.slice(),exact:true};
    const recentCount=Math.min(PRACTICE_TREND_RECENT_OBSERVATIONS,MAX_PRACTICE_TREND_EXACT_DAYS-2);
    const recent=rows.slice(-recentCount),older=rows.slice(0,-recentCount);
    const sampled=[...practiceEvenSample(older,MAX_PRACTICE_TREND_EXACT_DAYS-recentCount),...recent];
    return {points:sampled,exact:false};
  }
  function practiceTrendBlocks(points){
    const rows=Array.isArray(points)?points:[];
    const blockCount=Math.min(PRACTICE_TREND_JACKKNIFE_BLOCKS,rows.length);
    if(rows.length<4||blockCount<2)return [];
    return Array.from({length:blockCount},(_,index)=>{
      const start=Math.floor(index*rows.length/blockCount),end=Math.floor((index+1)*rows.length/blockCount);
      const slope=practicePairwiseSlope(rows.filter((_,rowIndex)=>rowIndex<start||rowIndex>=end)).slope;
      return {index,start,end,slope};
    }).filter(block=>Number.isFinite(block.slope));
  }
  function practiceTrendSummary(daily){
    const rows=(Array.isArray(daily)?daily:[]).filter(row=>isIsoDate(row&&row.date)&&Number.isFinite(row&&row.medianPace));
    const empty={slopePerWeek:null,lowPerWeek:null,highPerWeek:null,stability:0,stable:false,endpointStable:false,method:'bounded-theil-sen-block-jackknife',eligibleDays:rows.length,sampledDays:rows.length,pairCount:0,blockCount:0,exact:rows.length<=MAX_PRACTICE_TREND_EXACT_DAYS};
    if(rows.length<2)return empty;
    const origin=dateDay(rows[0].date);
    const points=rows.map((row,index)=>({x:(dateDay(row.date)??origin+index)-origin,y:row.medianPace}));
    const sample=practiceTrendSample(points),full=practicePairwiseSlope(sample.points);
    if(!Number.isFinite(full.slope))return {...empty,sampledDays:sample.points.length,exact:sample.exact};
    const sign=Math.sign(full.slope);
    const blocks=practiceTrendBlocks(sample.points);
    const stableDirections=sign&&blocks.length?blocks.filter(block=>Math.sign(block.slope)===sign).length:0;
    const stability=blocks.length?stableDirections/blocks.length:0;
    const endpointSlopes=blocks.length?[blocks[0].slope,blocks[blocks.length-1].slope].filter(Number.isFinite):[];
    const endpointStable=endpointSlopes.length===2&&endpointSlopes.every(value=>Math.sign(value)===sign&&Math.abs(value)>=Math.abs(full.slope)*.35&&Math.abs(value)<=Math.abs(full.slope)*3);
    const low=Number.isFinite(full.low)?full.low*7:null,high=Number.isFinite(full.high)?full.high*7:null,slope=full.slope*7;
    const intervalDirection=sign>0?num(low)>0:sign<0?num(high)<0:false;
    return {
      slopePerWeek:round(slope,1),
      lowPerWeek:roundNullable(low,1),
      highPerWeek:roundNullable(high,1),
      stability:round(stability*100,1),
      endpointStable,
      stable:rows.length>=MIN_PRACTICE_TREND_DAYS&&Math.abs(slope)>=MIN_PRACTICE_TREND_POINTS_PER_WEEK&&stability>=MIN_PRACTICE_TREND_STABILITY&&intervalDirection&&endpointStable,
      method:'bounded-theil-sen-block-jackknife',eligibleDays:rows.length,sampledDays:sample.points.length,
      pairCount:full.count,blockCount:blocks.length,exact:sample.exact
    };
  }
  function practiceFinding(tag,tone,text,meta={}){
    return {
      tag:String(tag||'Pace reading'),
      tone:String(tone||'quiet'),
      text:String(text||''),
      kind:['concern','positive','context'].includes(meta.kind)?meta.kind:'context',
      topic:String(meta.topic||tag||'pacer'),
      score:Math.max(0,num(meta.score)),
      confidence:meta.confidence&&typeof meta.confidence==='object'?meta.confidence:{key:'weak',label:'Early pace evidence',tone:'low'}
    };
  }
  function rankPracticeFindings(findings){
    const kindRank={concern:3,positive:2,context:1};
    return (Array.isArray(findings)?findings:[]).slice().sort((a,b)=>
      num(kindRank[b.kind])-num(kindRank[a.kind])||
      num(b.score)-num(a.score)||
      num(COACH_CONFIDENCE_RANK[b.confidence&&b.confidence.key])-num(COACH_CONFIDENCE_RANK[a.confidence&&a.confidence.key])||
      String(a.tag).localeCompare(String(b.tag))
    );
  }
  function practiceRawRunAuditReason(value){
    if(!value||typeof value!=='object')return 'Malformed saved run';
    const rawUnits=Array.isArray(value.unitMs)?value.unitMs.filter(item=>Number.isFinite(Number(item))&&Number(item)>0):[];
    if(!rawUnits.length)return 'No completed units';
    if(!Number.isFinite(Number(value.targetMs))||Number(value.targetMs)<=0)return 'Invalid or missing target';
    const plan=value.unitPlan&&typeof value.unitPlan==='object'?value.unitPlan:null;
    if(plan&&canonical(plan.mode)==='marks'&&(!Number.isFinite(Number(value.sessionTargetMs))||Number(value.sessionTargetMs)<=0))return 'Marks plan missing total time';
    return null;
  }
  function practicePositionBandIndex(index,total){
    if(total<=0)return 0;
    return Math.max(0,Math.min(PRACTICE_POSITION_BANDS.length-1,Math.floor(((index+.5)/total)*PRACTICE_POSITION_BANDS.length)));
  }
  function computePracticePositionProfile(runRows){
    const eligible=(Array.isArray(runRows)?runRows:[]).filter(run=>Array.isArray(run.unitRows)&&run.unitRows.length>=MIN_PRACTICE_POSITION_UNITS);
    const rows=PRACTICE_POSITION_BANDS.map((band,index)=>({
      key:band.key,label:band.label,index,runPaces:[],relativeDeltas:[],runIds:new Set(),days:new Set()
    }));
    eligible.forEach(run=>{
      const byBand=PRACTICE_POSITION_BANDS.map(()=>[]);
      run.unitRows.forEach((unit,index)=>byBand[practicePositionBandIndex(index,run.unitRows.length)].push(unit.paceRatio));
      const bandPaces=byBand.map(values=>values.length?median(values):null);
      const openingValues=bandPaces.slice(0,2).filter(Number.isFinite);
      const baseline=openingValues.length?median(openingValues):null;
      bandPaces.forEach((pace,index)=>{
        if(!Number.isFinite(pace))return;
        const row=rows[index];row.runPaces.push(pace);row.runIds.add(run.id);row.days.add(run.date);
        if(Number.isFinite(baseline))row.relativeDeltas.push(pace-baseline);
      });
    });
    const profile=rows.map(row=>({
      key:row.key,label:row.label,index:row.index,runs:row.runIds.size,days:row.days.size,
      medianPace:roundNullable(median(row.runPaces),1),
      medianDeltaFromOpening:roundNullable(median(row.relativeDeltas),1),
      ready:row.runIds.size>=MIN_PRACTICE_POSITION_RUNS&&row.days.size>=MIN_PRACTICE_POSITION_DAYS
    }));
    let onset=null;
    for(let index=1;index<profile.length;index+=1){
      const row=profile[index];
      if(!row.ready||!Number.isFinite(row.medianPace)||!Number.isFinite(row.medianDeltaFromOpening))continue;
      const subsequent=profile.slice(index).filter(item=>item.ready&&Number.isFinite(item.medianDeltaFromOpening));
      const sustained=subsequent.length===1||subsequent.slice(1).some(item=>num(item.medianDeltaFromOpening)>=MIN_PRACTICE_POSITION_SLIP_POINTS*.5||num(item.medianPace)>PRACTICE_CONTROLLED_MAX);
      if(num(row.medianPace)>PRACTICE_CONTROLLED_MAX&&num(row.medianDeltaFromOpening)>=MIN_PRACTICE_POSITION_SLIP_POINTS&&sustained){onset=row;break;}
    }
    return {eligibleRuns:eligible.length,profile,onset};
  }
  function canonicalPracticeSegmentLabel(value){
    return canonical(String(value||'').replace(/[–—]/g,'-').replace(/\s*[-:]\s*/g,' ').replace(/[^a-z0-9 ]+/gi,' '));
  }
  function practiceSegmentPlanSignature(run){
    const plan=run&&run.unitPlan&&typeof run.unitPlan==='object'?run.unitPlan:null;
    if(!plan||!Array.isArray(plan.segments)||!plan.segments.length)return '';
    let start=0;
    const segmentLengths=plan.segments.map(row=>{const end=Math.max(start,Math.floor(num(row&&row[0])));const length=end-start;start=end;return length;});
    const groupCounts=(Array.isArray(plan.groups)?plan.groups:[]).map(row=>Math.max(0,Math.floor(num(row&&row[0]))));
    return [canonical(plan.mode),`u${start}`,`s${segmentLengths.join('.')}`,`g${groupCounts.join('.')}`].join('|');
  }
  function computeRepeatedPracticeSegments(segmentRows){
    const map=new Map();
    (Array.isArray(segmentRows)?segmentRows:[]).forEach(segment=>{
      const labelKey=canonicalPracticeSegmentLabel(segment.label);
      if(!labelKey)return;
      const key=[canonical(segment.area),canonical(segment.modeKey),canonical(segment.planSignature),labelKey].join('|');
      if(!map.has(key))map.set(key,{key,label:segment.label,area:segment.area,modeLabel:segment.modeLabel,planSignature:segment.planSignature,rows:[],runIds:new Set(),days:new Set()});
      const row=map.get(key);row.rows.push(segment);row.runIds.add(segment.runId);row.days.add(segment.date);
    });
    return [...map.values()].map(group=>{
      const units=group.rows.reduce((sum,row)=>sum+num(row.units),0),plannedUnits=group.rows.reduce((sum,row)=>sum+num(row.plannedUnits),0),runs=group.runIds.size,days=group.days.size;
      const evidenceUnits=Math.max(units,plannedUnits),maturity=practiceEvidenceMaturity(evidenceUnits,runs,days);
      const completionRates=group.rows.filter(row=>num(row.plannedUnits)>0).map(row=>Math.min(100,num(row.units)/num(row.plannedUnits)*100));
      const completedRows=group.rows.filter(row=>num(row.plannedUnits)>0&&num(row.units)>=num(row.plannedUnits));
      const paceRows=group.rows.filter(row=>Number.isFinite(row.paceRatio));
      return {
        key:group.key,label:group.label,area:group.area,modeLabel:group.modeLabel,planSignature:group.planSignature,units,plannedUnits,evidenceUnits,runs,days,maturity,
        medianPace:roundNullable(median(paceRows.map(row=>row.paceRatio)),1),
        medianRelativeDelta:roundNullable(median(paceRows.map(row=>row.relativeDelta).filter(Number.isFinite)),1),
        medianCompletion:roundNullable(median(completionRates),1),completedSegments:completedRows.length,completedSegmentRate:completionRates.length?round(pct0(completedRows.length,completionRates.length),1):null,
        withinBudgetRuns:paceRows.filter(row=>num(row.paceRatio)<=PRACTICE_CONTROLLED_MAX).length
      };
    }).filter(row=>row.evidenceUnits>=MIN_PRACTICE_SEGMENT_UNITS&&row.runs>=MIN_PRACTICE_SEGMENT_RUNS&&row.days>=MIN_PRACTICE_SEGMENT_DAYS)
      .sort((a,b)=>Math.max(0,100-num(b.medianCompletion),100-num(b.completedSegmentRate),Math.abs(num(b.medianRelativeDelta)))-Math.max(0,100-num(a.medianCompletion),100-num(a.completedSegmentRate),Math.abs(num(a.medianRelativeDelta)))||b.runs-a.runs||b.days-a.days||a.label.localeCompare(b.label));
  }
  function summarizePracticeUnitGroups(unitRows,groupFor){
    const map=new Map();
    (Array.isArray(unitRows)?unitRows:[]).forEach(unit=>{
      const group=groupFor(unit);if(!group)return;
      if(!map.has(group.key))map.set(group.key,{key:group.key,label:group.label,family:group.family,units:[],runIds:new Set(),days:new Set(),byRun:new Map()});
      const row=map.get(group.key);row.units.push(unit);row.runIds.add(unit.runId);row.days.add(unit.date);
      if(!row.byRun.has(unit.runId))row.byRun.set(unit.runId,[]);row.byRun.get(unit.runId).push(unit.paceRatio);
    });
    return [...map.values()].map(row=>{
      const runPaces=[...row.byRun.values()].map(values=>median(values));
      const units=row.units.length,runs=row.runIds.size,days=row.days.size,maturity=practiceEvidenceMaturity(units,runs,days);
      const controlledRuns=runPaces.filter(value=>value>=PRACTICE_CONTROLLED_MIN&&value<=PRACTICE_CONTROLLED_MAX).length;
      const overBudgetRuns=runPaces.filter(value=>value>PRACTICE_CONTROLLED_MAX).length,belowBandRuns=runPaces.filter(value=>value<PRACTICE_CONTROLLED_MIN).length;
      return {
        key:row.key,label:row.label,family:row.family,units,runs,days,maturity,
        medianPace:roundNullable(median(runPaces),1),controlledRuns,controlledRunRate:round(pct0(controlledRuns,runs),1),
        overBudgetRuns,overBudgetRunRate:round(pct0(overBudgetRuns,runs),1),belowBandRuns,belowBandRunRate:round(pct0(belowBandRuns,runs),1)
      };
    }).filter(row=>row.units>=MIN_PRACTICE_SIZE_GROUP_UNITS&&row.runs>=MIN_PRACTICE_SIZE_GROUP_RUNS&&row.days>=MIN_PRACTICE_SIZE_GROUP_DAYS)
      .sort((a,b)=>String(a.family).localeCompare(String(b.family))||num(a.medianPace)-num(b.medianPace)||a.label.localeCompare(b.label));
  }
  function computePracticeUnitSizeGroups(unitRows){
    const rows=Array.isArray(unitRows)?unitRows:[];
    const marksRows=rows.filter(row=>Number.isFinite(row.marks)&&row.marks>0);
    let marks=[];
    if(marksRows.length){
      const values=[...new Set(marksRows.map(row=>round(row.marks,3)))].sort((a,b)=>a-b);
      if(values.length<=6){
        marks=summarizePracticeUnitGroups(marksRows,unit=>({family:'marks',key:`marks:${round(unit.marks,3)}`,label:`${numberLabel(unit.marks,3)} marks`}));
      }else{
        const q1=percentile(marksRows.map(row=>row.marks),1/3),q2=percentile(marksRows.map(row=>row.marks),2/3);
        marks=summarizePracticeUnitGroups(marksRows,unit=>unit.marks<=q1
          ?{family:'marks',key:'marks:low',label:`Lower marks (≤${numberLabel(q1,1)})`}
          :unit.marks<=q2?{family:'marks',key:'marks:mid',label:`Middle marks (${numberLabel(q1,1)}–${numberLabel(q2,1)})`}
          :{family:'marks',key:'marks:high',label:`Higher marks (>${numberLabel(q2,1)})`});
      }
    }
    const durationRows=rows.filter(row=>!Number.isFinite(row.marks)&&Number.isFinite(row.targetMs)&&row.targetMs>0);
    let durations=[];
    if(durationRows.length){
      const targets=durationRows.map(row=>row.targetMs),min=Math.min(...targets),max=Math.max(...targets);
      if(max-min>=MIN_PRACTICE_TARGET_SPAN_MS||max>=min*1.25){
        const q1=percentile(targets,1/3),q2=percentile(targets,2/3);
        if(q2>q1){
          durations=summarizePracticeUnitGroups(durationRows,unit=>unit.targetMs<=q1
            ?{family:'duration',key:'duration:short',label:`Short target (≤${millisecondsLabel(q1)})`}
            :unit.targetMs<=q2?{family:'duration',key:'duration:medium',label:`Medium target (${millisecondsLabel(q1)}–${millisecondsLabel(q2)})`}
            :{family:'duration',key:'duration:long',label:`Long target (>${millisecondsLabel(q2)})`});
        }
      }
    }
    return {marks,durations,all:[...marks,...durations]};
  }
  function strongestPracticeGroupDifference(groups){
    const byFamily=new Map();
    (Array.isArray(groups)?groups:[]).filter(row=>row.maturity&&row.maturity.rank>=1&&Number.isFinite(row.medianPace)).forEach(row=>{
      if(!byFamily.has(row.family))byFamily.set(row.family,[]);byFamily.get(row.family).push(row);
    });
    let best=null;
    byFamily.forEach(rows=>{
      if(rows.length<2)return;
      const sorted=rows.slice().sort((a,b)=>num(a.medianPace)-num(b.medianPace));
      const low=sorted[0],high=sorted[sorted.length-1],gap=num(high.medianPace)-num(low.medianPace);
      if(gap<MIN_PRACTICE_SIZE_EFFECT_POINTS)return;
      const candidate={family:high.family,low,high,gap};
      if(!best||candidate.gap>best.gap)best=candidate;
    });
    return best;
  }
  function practicePacerReadings(practice){
    if(!practice||!practice.units){
      const primary=practiceFinding('No evidence','quiet','No completed Practice Pacer runs are saved in this window.');
      return {primary,supporting:null,coach:primary,candidates:[primary]};
    }
    const maturity=practice.maturity||practiceEvidenceMaturity(practice.units,practice.runs,practice.practiceDays);
    const overallConfidence=practice.overallConfidence||maturity.confidence;
    if(practice.units<MIN_PRACTICE_SUMMARY_UNITS){
      const primary=practiceFinding('Early evidence','quiet',`${practice.units} completed unit${practice.units===1?' is':'s are'} enough for a factual pace summary, but not for a pattern read.`,{confidence:overallConfidence});
      return {primary,supporting:null,coach:primary,candidates:[primary]};
    }
    if(!practice.patternReady){
      const primary=practiceFinding('Building evidence','quiet',`Pace evidence spans ${practice.units} units across ${practice.runs} runs and ${practice.practiceDays} practice day${practice.practiceDays===1?'':'s'}. Pattern reads begin at ${MIN_PRACTICE_PATTERN_UNITS} units across ${MIN_PRACTICE_PATTERN_DAYS} days.`,{confidence:overallConfidence});
      return {primary,supporting:null,coach:primary,candidates:[primary]};
    }
    const findings=[];
    const add=(tag,tone,text,meta)=>findings.push(practiceFinding(tag,tone,text,{confidence:overallConfidence,...meta}));
    const finishingRuns=num(practice.completedPlannedRuns);
    if(finishingRuns){
      const timeUsed=num(practice.medianCompletedRunTimeUsed),withinRate=num(practice.completedWithinTimeRate),margin=num(practice.medianFinishingMarginMs);
      if(timeUsed>PRACTICE_CONTROLLED_MAX||withinRate<80){
        const over=Math.max(0,timeUsed-PRACTICE_CONTROLLED_MAX),shortfall=Math.max(0,80-withinRate);
        add('Finishing margin','watch',`Completed planned runs used a median ${percentLabel(timeUsed,1)} of their full budgets, with ${practice.completedWithinTimeRuns}/${finishingRuns} finishing within time. The median finishing margin was ${signedMillisecondsLabel(margin)}.`,{kind:'concern',topic:'finishing-margin',score:108+Math.min(28,Math.max(over,shortfall))});
      }else if(timeUsed<PRACTICE_CONTROLLED_MIN){
        add('Finishing margin','watch',`Completed planned runs used a median ${percentLabel(timeUsed,1)} of their full budgets, leaving a median ${millisecondsLabel(Math.max(0,margin))} in hand. Pacing alone cannot establish whether this reflects efficiency or underdeveloped work.`,{kind:'concern',topic:'finishing-margin',score:78+Math.min(18,PRACTICE_CONTROLLED_MIN-timeUsed)});
      }else{
        add('Finishing margin','strong',`Completed planned runs used a median ${percentLabel(timeUsed,1)} of their full budgets; ${practice.completedWithinTimeRuns}/${finishingRuns} finished within time, with a median margin of ${signedMillisecondsLabel(margin)}.`,{kind:'positive',topic:'finishing-margin',score:66});
      }
    }else{
      const runPace=num(practice.medianRunPace);
      if(runPace>PRACTICE_CONTROLLED_MAX){
        const over=runPace-PRACTICE_CONTROLLED_MAX;
        add('Run time used','watch',`The median completed run used ${percentLabel(runPace,1)} of its combined unit targets—about ${numberLabel(over,1)}% over its time budget.`,{kind:'concern',topic:'run-budget',score:105+Math.min(30,over)});
      }else if(runPace<PRACTICE_CONTROLLED_MIN){
        const gap=PRACTICE_CONTROLLED_MIN-runPace,severeFast=runPace<PRACTICE_SEVERE_FAST_THRESHOLD;
        add('Run time used','watch',`The median completed run used ${percentLabel(runPace,1)} of its combined targets. Time remained in hand; pacing alone cannot establish whether this reflects efficiency or underdeveloped work.`,{kind:'concern',topic:'run-budget',score:76+Math.min(20,gap)+(severeFast?8:0)});
      }else add('Run time used','strong',`The median completed run used ${percentLabel(runPace,1)} of its combined targets, within the controlled 80–100% pacing band.`,{kind:'positive',topic:'run-budget',score:62});
    }
    const plannedRunMedian=num(practice.plannedRunCompletionMedian),plannedRunFinishRate=num(practice.completedPlannedRunRate);
    if(practice.plannedUnits>=MIN_PRACTICE_PATTERN_UNITS&&(plannedRunMedian<80||plannedRunFinishRate<80)){
      const gap=Math.max(80-plannedRunMedian,80-plannedRunFinishRate);
      add('Plan follow-through','watch',`The median planned run recorded ${percentLabel(practice.plannedRunCompletionMedian,1)} of its planned units, and ${practice.completedPlannedRuns}/${practice.plannedRuns} planned runs were fully completed. Check whether planned runs are too large or being ended early.`,{kind:'concern',topic:'plan-follow-through',score:104+Math.min(30,gap)});
    }
    const onset=practice.position&&practice.position.onset;
    if(onset){
      add('Pace slippage','watch',`Pace generally begins slipping around the ${onset.label.toLowerCase()}: median pace there was ${percentLabel(onset.medianPace,1)}, about ${numberLabel(onset.medianDeltaFromOpening,1)} points above the opening baseline across ${onset.runs} runs and ${onset.days} days.`,{kind:'concern',topic:'position-slip',score:94+Math.min(22,num(onset.medianDeltaFromOpening))});
    }
    if(practice.spreadComparableRuns>=MIN_PRACTICE_COMPARABLE_RUNS&&num(practice.medianWithinRunSpread)>=MIN_MEANINGFUL_PACE_SPREAD_POINTS){
      add('Pace spread','watch',`Within runs, the middle 50% of unit pace spanned a median ${numberLabel(practice.medianWithinRunSpread,1)} percentage points across ${practice.spreadComparableRuns} comparable runs. Typical pace is masking uneven timing.`,{kind:'concern',topic:'pace-spread',score:82+Math.min(18,num(practice.medianWithinRunSpread)/2)});
    }
    const trend=practice.trend||{};
    if(practice.trendReady&&trend.stable&&Math.abs(num(trend.slopePerWeek))>=MIN_PRACTICE_TREND_POINTS_PER_WEEK){
      const worsening=num(trend.slopePerWeek)>0,runPace=num(practice.medianRunPace);
      if(worsening)add('Pace direction','watch',`Run-balanced daily pace rose by about ${Math.abs(round(trend.slopePerWeek,1))} target-percentage points per week. The direction remained stable when contiguous evidence blocks were removed.`,{kind:'concern',topic:'pace-trend',score:86+Math.min(20,Math.abs(num(trend.slopePerWeek)))});
      else if(runPace>=PRACTICE_CONTROLLED_MIN)add('Pace direction','strong',`Run-balanced daily pace fell by about ${Math.abs(round(trend.slopePerWeek,1))} target-percentage points per week, with a consistent direction across the saved history.`,{kind:'positive',topic:'pace-trend',score:66+Math.min(12,Math.abs(num(trend.slopePerWeek)))});
      else add('Pace direction','quiet',`Run-balanced daily pace is moving downward, but the current median is already below 80% of target. More time in hand cannot be interpreted as better work without quality evidence.`,{kind:'context',topic:'pace-trend',score:42});
    }
    const segmentCandidates=(practice.repeatedSegments||[]).filter(row=>row.maturity&&row.maturity.rank>=1).map(row=>{
      const followGap=Math.max(0,80-num(row.medianCompletion),80-num(row.completedSegmentRate));
      const paceEffect=Number.isFinite(row.medianRelativeDelta)&&Math.abs(num(row.medianRelativeDelta))>=MIN_PRACTICE_SEGMENT_EFFECT_POINTS;
      const paceConcern=paceEffect&&Number.isFinite(row.medianPace)&&num(row.medianPace)>PRACTICE_CONTROLLED_MAX&&num(row.medianRelativeDelta)>0;
      return {row,followGap,paceEffect,paceConcern,score:Math.max(followGap,paceEffect?Math.abs(num(row.medianRelativeDelta)):0)};
    }).filter(item=>item.followGap>0||item.paceEffect).sort((a,b)=>b.score-a.score||b.row.runs-a.row.runs||b.row.days-a.row.days);
    const segmentCandidate=segmentCandidates[0];
    if(segmentCandidate){
      const segment=segmentCandidate.row,followConcern=segmentCandidate.followGap>0,concern=followConcern||segmentCandidate.paceConcern;
      const evidence=`across ${segment.runs} runs and ${segment.days} days`;
      const followText=followConcern?`The median run completed ${percentLabel(segment.medianCompletion,1)} of ${segment.label}, and ${segment.completedSegments}/${segment.runs} repeated segments were fully completed ${evidence}.`:'';
      const paceText=segmentCandidate.paceEffect?`${segment.label} used a median ${percentLabel(segment.medianPace,1)} of its completed-unit targets—${numberLabel(Math.abs(segment.medianRelativeDelta),1)} points ${segment.medianRelativeDelta>0?'slower':'faster'} than the rest of the same runs.`:'';
      findings.push(practiceFinding('Repeated segment',concern?'watch':'quiet',[followText,paceText].filter(Boolean).join(' '),{kind:concern?'concern':'context',topic:'segment',score:concern?92+Math.min(24,segmentCandidate.score):44,confidence:segment.maturity.confidence}));
    }
    const sizeDifference=practice.unitSizeDifference;
    if(sizeDifference){
      const high=sizeDifference.high,low=sizeDifference.low,concern=num(high.medianPace)>PRACTICE_CONTROLLED_MAX;
      findings.push(practiceFinding(sizeDifference.family==='marks'?'Marks pattern':'Target-size pattern',concern?'watch':'quiet',`${high.label} used a median ${percentLabel(high.medianPace,1)} of target versus ${percentLabel(low.medianPace,1)} for ${low.label}, a ${numberLabel(sizeDifference.gap,1)}-point difference across repeated evidence.`,{kind:concern?'concern':'context',topic:'unit-size',score:concern?89+Math.min(18,sizeDifference.gap):43,confidence:high.maturity.confidence}));
    }
    const matureModes=(practice.modes||[]).filter(row=>row.maturity&&row.maturity.rank>=1&&Number.isFinite(row.medianRunPace));
    const setupConcern=matureModes.map(row=>({row,gap:Math.abs(num(row.medianRunPace)-num(practice.medianRunPace))}))
      .filter(item=>item.gap>=MIN_MEANINGFUL_PACE_DIFFERENCE_POINTS&&(num(item.row.medianRunPace)>PRACTICE_CONTROLLED_MAX||num(item.row.medianRunPace)<PRACTICE_CONTROLLED_MIN))
      .sort((a,b)=>b.gap-a.gap||num(b.row.medianRunPace)-num(a.row.medianRunPace))[0];
    if(setupConcern){
      const row=setupConcern.row,over=num(row.medianRunPace)>PRACTICE_CONTROLLED_MAX;
      findings.push(practiceFinding('Setup difference','watch',`${row.label} runs used a median ${percentLabel(row.medianRunPace,1)} of their combined targets across ${row.runs} runs and ${row.days} days—${over?'above':'below'} the controlled band.`,{kind:'concern',topic:'setup',score:90+Math.min(20,setupConcern.gap),confidence:row.maturity.confidence}));
    }
    const ordered=rankPracticeFindings(findings);
    const primary=ordered[0]||practiceFinding('Pace reading','quiet','No stable pacing pattern stands out yet.',{confidence:maturity.confidence});
    const supporting=ordered.find(item=>item!==primary&&item.topic!==primary.topic)||null;
    const coach=ordered.find(item=>item.kind==='concern')||primary;
    return {primary,supporting,coach,candidates:ordered};
  }
  function practicePacerReading(practice){
    return practicePacerReadings(practice).primary;
  }
  function groupPracticeRuns(runRows,keyFor,labelFor){
    const map=new Map();
    (Array.isArray(runRows)?runRows:[]).forEach(run=>{
      const key=keyFor(run);
      if(!map.has(key))map.set(key,{key,label:labelFor(run),runRows:[],days:new Set()});
      const row=map.get(key);row.runRows.push(run);row.days.add(run.date);
    });
    return [...map.values()].map(row=>{
      const runs=row.runRows.length,units=row.runRows.reduce((sum,run)=>sum+num(run.units),0),days=row.days.size;
      const maturity=practiceEvidenceMaturity(units,runs,days);
      const controlledRuns=row.runRows.filter(run=>run.controlled).length;
      const withinBudgetRuns=row.runRows.filter(run=>run.withinBudget).length;
      return {
        key:row.key,label:row.label,units,runs,days,maturity,
        medianRunPace:roundNullable(median(row.runRows.map(run=>run.runPace)),1),
        typicalUnitPace:roundNullable(median(row.runRows.map(run=>run.medianUnitPace)),1),
        controlledRuns,controlledRunRate:round(pct0(controlledRuns,runs),1),
        withinBudgetRuns,withinBudgetRate:round(pct0(withinBudgetRuns,runs),1)
      };
    }).sort((a,b)=>b.runs-a.runs||b.days-a.days||b.units-a.units||num(b.medianRunPace)-num(a.medianRunPace)||a.label.localeCompare(b.label));
  }
  function computePracticePacer(records,summarizePracticeRuns,trendBasis={}){
    const runRows=[],unitRows=[],segmentRows=[];
    const audit={savedRuns:0,acceptedRuns:0,excludedRuns:0,encounteredUnits:0,acceptedUnits:0,excludedUnits:0,reasons:new Map()};
    const addAuditReason=(reason,count=1)=>audit.reasons.set(reason,num(audit.reasons.get(reason))+count);
    (Array.isArray(records)?records:[]).forEach(record=>{
      const rawRuns=Array.isArray(record&&record.practiceRuns)?record.practiceRuns:[];
      audit.savedRuns+=rawRuns.length;
      rawRuns.forEach(run=>{audit.encounteredUnits+=Array.isArray(run&&run.unitMs)?run.unitMs.length:0;});
      let summary=null;
      try{summary=record&&record.__sdPracticeSummary||summarizePracticeRuns(rawRuns);}catch(e){summary=null;}
      if(!summary||!Array.isArray(summary.runSummaries)){if(rawRuns.length)addAuditReason('Summary unavailable',rawRuns.length);return;}
      audit.acceptedRuns+=summary.runSummaries.length;
      const rejectedIndexes=summary.audit&&Array.isArray(summary.audit.rejectedRawIndexes)?summary.audit.rejectedRawIndexes:null;
      if(rejectedIndexes)rejectedIndexes.forEach(index=>addAuditReason(practiceRawRunAuditReason(rawRuns[index])||'Malformed or unsupported saved run'));
      else{
        const rejectedCount=Math.max(0,rawRuns.length-summary.runSummaries.length);
        if(rejectedCount)addAuditReason('Malformed or unsupported saved run',rejectedCount);
      }
      const tasks=new Map((Array.isArray(record.tasks)?record.tasks:[]).map(task=>[String(task.id||''),task]));
      summary.runSummaries.forEach((source,runIndex)=>{
        const run=source&&source.run||{},task=tasks.get(String(run.taskId||''))||null;
        const area=task?subjectLabel(task):'Unlinked',block=task&&task.name?String(task.name):'Unlinked practice',mode=practiceMode(run),runId=`${record.date}:${runIndex}`;
        const normalizedUnits=(Array.isArray(source.unitRows)?source.unitRows:[]).map((unit,unitIndex)=>{
          const actualMs=Math.max(0,num(unit&&unit.actualMs)),targetMs=Math.max(0,num(unit&&unit.targetMs));
          if(!actualMs||!targetMs)return null;
          return {
            date:record.date,runId,runIndex,unitIndex,area,block,modeKey:mode.key,modeLabel:mode.label,
            actualMs,targetMs,paceRatio:round(actualMs/targetMs*100,4),withinTarget:actualMs<=targetMs,
            controlled:actualMs/targetMs*100>=PRACTICE_CONTROLLED_MIN&&actualMs/targetMs*100<=PRACTICE_CONTROLLED_MAX,
            segmentLabel:String(unit&&unit.segmentLabel||''),marks:finiteOrNull(unit&&unit.marks)
          };
        }).filter(Boolean);
        if(!normalizedUnits.length)return;
        audit.acceptedUnits+=normalizedUnits.length;
        const paceQ1=percentile(normalizedUnits.map(unit=>unit.paceRatio),.25),paceQ3=percentile(normalizedUnits.map(unit=>unit.paceRatio),.75);
        const plannedUnits=Math.max(0,num(source.plannedUnits)),actualMs=normalizedUnits.reduce((sum,unit)=>sum+unit.actualMs,0),targetMs=normalizedUnits.reduce((sum,unit)=>sum+unit.targetMs,0),runPace=targetMs?round(actualMs/targetMs*100,1):null;
        const completePlanned=plannedUnits>0&&normalizedUnits.length>=plannedUnits;
        const row={
          id:runId,date:record.date,index:runIndex,area,block,modeKey:mode.key,modeLabel:mode.label,
          units:normalizedUnits.length,plannedUnits,plannedCompletion:plannedUnits?pct(Math.min(normalizedUnits.length,plannedUnits),plannedUnits):null,
          actualMs,targetMs,runPace,medianUnitPace:round(median(normalizedUnits.map(unit=>unit.paceRatio)),1),unitRows:normalizedUnits,
          controlled:Number.isFinite(runPace)&&runPace>=PRACTICE_CONTROLLED_MIN&&runPace<=PRACTICE_CONTROLLED_MAX,
          withinBudget:Number.isFinite(runPace)&&runPace<=PRACTICE_CONTROLLED_MAX,
          completePlanned,finishingMarginMs:completePlanned?targetMs-actualMs:null,
          paceQ1:round(paceQ1,1),paceQ3:round(paceQ3,1),paceSpread:round(paceQ3-paceQ1,1),
          atOrBelowTarget:normalizedUnits.filter(unit=>unit.withinTarget).length,controlledUnits:normalizedUnits.filter(unit=>unit.controlled).length
        };
        runRows.push(row);unitRows.push(...normalizedUnits);
        const planSignature=practiceSegmentPlanSignature(run);
        (Array.isArray(source.segmentRows)?source.segmentRows:[]).forEach(segment=>{
          const segmentActualMs=Math.max(0,num(segment&&segment.actualMs)),segmentTargetMs=Math.max(0,num(segment&&segment.targetMs));
          const segmentUnits=Math.max(0,num(segment&&segment.units)),segmentPlannedUnits=Math.max(0,num(segment&&segment.plannedUnits));
          if(!segmentPlannedUnits&&!segmentUnits)return;
          const restActualMs=Math.max(0,actualMs-segmentActualMs),restTargetMs=Math.max(0,targetMs-segmentTargetMs),restPace=restTargetMs?restActualMs/restTargetMs*100:null,paceRatio=segmentActualMs&&segmentTargetMs?segmentActualMs/segmentTargetMs*100:null;
          segmentRows.push({
            runId,date:record.date,area,block,modeKey:mode.key,modeLabel:mode.label,planSignature,label:String(segment&&segment.label||`Segment ${num(segment&&segment.index)+1}`),
            units:segmentUnits,plannedUnits:segmentPlannedUnits,completion:segmentPlannedUnits?round(Math.min(100,segmentUnits/segmentPlannedUnits*100),1):null,complete:segmentPlannedUnits>0&&segmentUnits>=segmentPlannedUnits,
            actualMs:segmentActualMs,targetMs:segmentTargetMs,plannedTargetMs:Math.max(segmentTargetMs,num(segment&&segment.plannedTargetMs)),paceRatio:roundNullable(paceRatio,1),restPace:roundNullable(restPace,1),relativeDelta:Number.isFinite(paceRatio)&&Number.isFinite(restPace)?round(paceRatio-restPace,1):null
          });
        });
      });
    });
    audit.excludedRuns=Math.max(0,audit.savedRuns-audit.acceptedRuns);
    audit.excludedUnits=Math.max(0,audit.encounteredUnits-audit.acceptedUnits);
    const classified=[...audit.reasons.values()].reduce((sum,value)=>sum+num(value),0);
    if(audit.excludedRuns>classified)addAuditReason('Malformed or unsupported saved run',audit.excludedRuns-classified);
    else if(classified>audit.excludedRuns&&audit.excludedRuns>=0){
      audit.reasons.clear();
      if(audit.excludedRuns)addAuditReason('Malformed or unsupported saved run',audit.excludedRuns);
    }
    audit.reasonRows=[...audit.reasons.entries()].map(([reason,count])=>({reason,count})).filter(row=>row.count>0).sort((a,b)=>b.count-a.count||a.reason.localeCompare(b.reason));
    delete audit.reasons;
    const dailyMap=new Map();
    runRows.forEach(run=>{if(!dailyMap.has(run.date))dailyMap.set(run.date,{date:run.date,runs:[]});dailyMap.get(run.date).runs.push(run);});
    const daily=[...dailyMap.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(row=>{
      const runPaces=row.runs.map(run=>run.runPace).filter(Number.isFinite),paceQ1=percentile(runPaces,.25),paceQ3=percentile(runPaces,.75),units=row.runs.reduce((sum,run)=>sum+run.units,0),controlledRuns=row.runs.filter(run=>run.controlled).length;
      return {date:row.date,units,runs:row.runs.length,medianPace:roundNullable(median(runPaces),1),medianRunPace:roundNullable(median(runPaces),1),typicalUnitPace:roundNullable(median(row.runs.map(run=>run.medianUnitPace)),1),paceQ1:roundNullable(paceQ1,1),paceQ3:roundNullable(paceQ3,1),paceSpread:roundNullable(paceQ3-paceQ1,1),spreadReady:row.runs.length>=MIN_PRACTICE_ESTABLISHED_RUNS,controlledRate:round(pct0(controlledRuns,row.runs.length),1),atOrBelowRate:round(pct0(row.runs.filter(run=>run.withinBudget).length,row.runs.length),1)};
    });
    const plannedRuns=runRows.filter(run=>run.plannedUnits>0),plannedUnits=plannedRuns.reduce((sum,run)=>sum+run.plannedUnits,0),completedPlannedUnits=plannedRuns.reduce((sum,run)=>sum+Math.min(run.units,run.plannedUnits),0),plannedRunCompletionMedian=plannedRuns.length?round(median(plannedRuns.map(run=>run.plannedCompletion)),1):null,completedPlannedRows=plannedRuns.filter(run=>run.completePlanned),completedPlannedRuns=completedPlannedRows.length,completedPlannedRunRate=plannedRuns.length?round(pct0(completedPlannedRuns,plannedRuns.length),1):null,plannedUnitCompletionRate=plannedUnits?round(pct0(completedPlannedUnits,plannedUnits),1):null;
    const completedWithinTimeRows=completedPlannedRows.filter(run=>num(run.runPace)<=PRACTICE_CONTROLLED_MAX),medianCompletedRunTimeUsed=completedPlannedRows.length?roundNullable(median(completedPlannedRows.map(run=>run.runPace)),1):null,medianFinishingMarginMs=completedPlannedRows.length?roundNullable(median(completedPlannedRows.map(run=>run.finishingMarginMs)),0):null,completedWithinTimeRuns=completedWithinTimeRows.length,completedWithinTimeRate=completedPlannedRows.length?round(pct0(completedWithinTimeRuns,completedPlannedRows.length),1):null;
    const spreadComparableRows=runRows.filter(run=>run.units>=MIN_PRACTICE_COMPARABLE_UNITS&&Number.isFinite(run.paceSpread));
    const medianRunPace=roundNullable(median(runRows.map(run=>run.runPace)),1),typicalUnitPace=roundNullable(median(runRows.map(run=>run.medianUnitPace)),1),atOrBelowTarget=unitRows.filter(unit=>unit.withinTarget).length,controlledRuns=runRows.filter(run=>run.controlled).length,withinBudgetRuns=runRows.filter(run=>run.withinBudget).length;
    const distribution=[
      {key:'under',label:'Below 80% of target',count:runRows.filter(run=>num(run.runPace)<PRACTICE_CONTROLLED_MIN).length},
      {key:'near-under',label:'80–100% target',count:controlledRuns},
      {key:'near-over',label:'Up to 10% over',count:runRows.filter(run=>num(run.runPace)>PRACTICE_CONTROLLED_MAX&&num(run.runPace)<=110).length},
      {key:'over',label:'More than 10% over',count:runRows.filter(run=>num(run.runPace)>110).length}
    ].map(row=>({...row,share:pct0(row.count,runRows.length)}));
    const trendFromDay=Number.isFinite(trendBasis&&trendBasis.fromDay)?trendBasis.fromDay:-Infinity;
    const trendToDay=Number.isFinite(trendBasis&&trendBasis.toDay)?trendBasis.toDay:Infinity;
    const inTrendRange=row=>{const day=dateDay(row&&row.date);return Number.isFinite(day)&&day>=trendFromDay&&day<=trendToDay;};
    const trendDaily=daily.filter(inTrendRange),trendUnitRows=unitRows.filter(inTrendRange);
    const trend=practiceTrendSummary(trendDaily),maturity=practiceEvidenceMaturity(unitRows.length,runRows.length,daily.length),patternReady=unitRows.length>=MIN_PRACTICE_PATTERN_UNITS&&daily.length>=MIN_PRACTICE_PATTERN_DAYS,trendReady=trendUnitRows.length>=MIN_PRACTICE_PATTERN_UNITS&&trendDaily.length>=MIN_PRACTICE_TREND_DAYS,overallConfidence=patternReady?trendReady?{key:'reliable',label:'Reliable pace sample',tone:'good'}:{key:'emerging',label:'Emerging pace pattern',tone:'watch'}:{key:'weak',label:'Early pace evidence',tone:'low'};
    const resolvedTrendBasis={
      key:String(trendBasis&&trendBasis.key||'selected-window'),label:String(trendBasis&&trendBasis.label||'Selected window'),
      from:trendBasis&&trendBasis.from||trendDaily[0]?.date||null,to:trendBasis&&trendBasis.to||trendDaily[trendDaily.length-1]?.date||null,
      horizonDays:Number.isFinite(trendBasis&&trendBasis.horizonDays)?trendBasis.horizonDays:null,capped:!!(trendBasis&&trendBasis.capped),
      practiceDays:trendDaily.length,selectedPracticeDays:daily.length,units:trendUnitRows.length
    };
    const position=computePracticePositionProfile(runRows),repeatedSegments=computeRepeatedPracticeSegments(segmentRows),unitSizeGroups=computePracticeUnitSizeGroups(unitRows),unitSizeDifference=strongestPracticeGroupDifference(unitSizeGroups.all);
    const practice={
      practiceDays:daily.length,runs:runRows.length,units:unitRows.length,totalActualMs:unitRows.reduce((sum,unit)=>sum+unit.actualMs,0),medianPace:medianRunPace,medianRunPace,typicalUnitPace,
      atOrBelowTarget,atOrBelowRate:unitRows.length?round(pct0(atOrBelowTarget,unitRows.length),1):null,controlledRuns,controlledRunRate:runRows.length?round(pct0(controlledRuns,runRows.length),1):null,withinBudgetRuns,withinBudgetRate:runRows.length?round(pct0(withinBudgetRuns,runRows.length),1):null,
      plannedRuns:plannedRuns.length,plannedUnits,completedPlannedUnits,plannedRunCompletionMedian,completedPlannedRuns,completedPlannedRunRate,plannedUnitCompletionRate,
      medianCompletedRunTimeUsed,medianFinishingMarginMs,completedWithinTimeRuns,completedWithinTimeRate,
      medianWithinRunSpread:roundNullable(median(spreadComparableRows.map(run=>run.paceSpread)),1),spreadComparableRuns:spreadComparableRows.length,
      paceSlopePerWeek:trend.slopePerWeek,trend,trendBasis:resolvedTrendBasis,maturity,overallConfidence,summaryReady:unitRows.length>=MIN_PRACTICE_SUMMARY_UNITS,patternReady,trendReady,
      daily,runRows,unitRows,segmentRows,position,repeatedSegments,unitSizeGroups,unitSizeDifference,audit,distribution,
      areas:groupPracticeRuns(runRows,run=>canonical(run.area),run=>run.area),modes:groupPracticeRuns(runRows,run=>run.modeKey,run=>run.modeLabel)
    };
    practice.readings=practicePacerReadings(practice);practice.reading=practice.readings.primary;practice.supportingReading=practice.readings.supporting;practice.coachReading=practice.readings.coach;
    return practice;
  }
    return Object.freeze({
      computePracticePacer,practicePacerReading
    });
  })(InsightsConfig,InsightsPrimitives);

  // M8.6 CURRENT STUDY STATE COMPONENT
  const InsightsStudyFitness=((Config,Primitives,Analytics)=>{
    const {
      CONFIDENCE,FITNESS_MAX_MEASUREMENT_SD,FITNESS_MIN_MEASUREMENT_SD,FITNESS_PARAMETER_UPDATE_CADENCE,
      FITNESS_PARAMETER_WINDOW_OBSERVATIONS,FITNESS_RECENT_LOAD_DAYS,FITNESS_RECOVERY_DELTA_POINTS,
      FITNESS_SOURCE_WEIGHTS,FITNESS_TRAJECTORY_DELTA_POINTS,FITNESS_TRAJECTORY_LOOKBACK_DAYS
    }=Config;
    const {
      addMatrices,clamp,dateDay,dateFromDay,effectiveSampleSize,evidenceConfidence,isIsoDate,mean,median,
      multiplyMatrices,multiplyMatrixVector,num,pct,percentLabel,robustScale,round,roundNullable,
      solveLinearSystem,startDelayMinutes,sum,transposeMatrix,zeroMatrix
    }=Primitives;
    const {
      recordRows,rowsActual
    }=Analytics;
  function computeScheduleSummary(recordsInput){
    const records=Array.isArray(recordsInput)?recordsInput:[];
    const dailyPeakShiftTotal=records.reduce((total,record)=>total+Math.max(0,num(record&&record.totalScheduleShiftMinutes)),0);
    const maxDailyShift=records.reduce((maximum,record)=>Math.max(maximum,Math.max(0,num(record&&record.totalScheduleShiftMinutes))),0);
    const shiftedRecords=records.filter(record=>num(record&&record.shiftedStudyBlocks)>0);
    const shiftedDays=shiftedRecords.length;
    const shiftedBlocks=shiftedRecords.reduce((total,record)=>total+Math.max(0,num(record&&record.shiftedStudyBlocks)),0);
    const weightedNetShift=shiftedBlocks
      ? shiftedRecords.reduce((total,record)=>total+num(record&&record.netScheduleShiftMinutes)*Math.max(0,num(record&&record.shiftedStudyBlocks)),0)/shiftedBlocks
      : null;
    return {
      maxDailyShiftMinutes:Math.round(maxDailyShift),
      shiftedDays,
      shiftedBlocks,
      averageDailyPeakShiftOnShiftedDays:shiftedDays?Math.round(dailyPeakShiftTotal/shiftedDays):0,
      typicalNetShiftMinutes:weightedNetShift===null?null:Math.round(weightedNetShift)
    };
  }
  function fitnessObservationForDay(dailyRow,evidence,recordByDate){
    const record=recordByDate.get(dailyRow.date);
    const work=recordRows(evidence,record,'work').filter(row=>row.planned>0);
    const planned=Math.max(0,num(dailyRow&&dailyRow.planned));
    const plannedByGroup={explicit:0,'time-derived':0,unverified:0,skipped:0,missing:0};
    work.forEach(row=>{
      const group=Object.prototype.hasOwnProperty.call(plannedByGroup,row.evidenceGroup)?row.evidenceGroup:'missing';
      plannedByGroup[group]+=row.planned;
    });
    const weightedPlanned=Object.entries(plannedByGroup).reduce((total,[group,value])=>total+value*num(FITNESS_SOURCE_WEIGHTS[group]),0);
    const evidenceWeight=planned>0?Math.max(0,Math.min(1,weightedPlanned/planned)):0;
    const informativeWeights=work
      .map(row=>row.planned*num(FITNESS_SOURCE_WEIGHTS[row.evidenceGroup]))
      .filter(value=>value>0);
    const effectiveBlocks=effectiveSampleSize(informativeWeights);
    const information=evidenceWeight*Math.max(1,effectiveBlocks);
    const measurementSd=evidenceWeight>0
      ? Math.max(FITNESS_MIN_MEASUREMENT_SD,Math.min(FITNESS_MAX_MEASUREMENT_SD,24/Math.sqrt(Math.max(.25,information))))
      : null;
    const delayValues=work.map(row=>startDelayMinutes(row.task)).filter(Number.isFinite);
    const startScore=delayValues.length?clamp(100-1.2*mean(delayValues.map(value=>Math.max(0,value))),0,100):null;
    const hasMovementEvidence=work.length>0&&!!record&&['shiftedStudyBlocks','totalScheduleShiftMinutes','netScheduleShiftMinutes'].some(key=>Object.prototype.hasOwnProperty.call(record,key));
    const movementScore=hasMovementEvidence?clamp(100-Math.max(0,num(record.totalScheduleShiftMinutes))*.8,0,100):null;
    const executionValues=[startScore,movementScore].filter(Number.isFinite);
    const execution=executionValues.length?mean(executionValues):null;
    const timerRows=work.filter(row=>row.timerBacked);
    const actualSeconds=rowsActual(timerRows)*60;
    const frictionSeconds=sum(timerRows.flatMap(row=>row.frictionDurations||[]));
    const focusControl=actualSeconds>0?clamp(100-300*frictionSeconds/actualSeconds,0,100):null;
    const pomodoroEvents=timerRows.flatMap(row=>row.pauseEvents||[]).filter(event=>event.type==='pomodoro'&&num(event.plannedSeconds)>0);
    const returnScore=pomodoroEvents.length?pct(pomodoroEvents.filter(event=>num(event.seconds)<=num(event.plannedSeconds)).length,pomodoroEvents.length):null;
    const recoveryValues=[focusControl,returnScore].filter(Number.isFinite);
    const recovery=recoveryValues.length?mean(recoveryValues):null;
    const components={
      capacity:{value:Number.isFinite(dailyRow.completion)&&evidenceWeight>0?round(dailyRow.completion,1):null,measurementSd:measurementSd===null?null:round(measurementSd,2),evidenceCount:effectiveBlocks},
      execution:{value:roundNullable(execution,1),measurementSd:executionValues.length?round(clamp(22/Math.sqrt(executionValues.length+delayValues.length/3),9,30),2):null,evidenceCount:executionValues.length+delayValues.length},
      recovery:{value:roundNullable(recovery,1),measurementSd:recoveryValues.length?round(clamp(25/Math.sqrt(recoveryValues.length+pomodoroEvents.length/4),10,32),2):null,evidenceCount:recoveryValues.length+pomodoroEvents.length}
    };
    return {
      date:dailyRow.date,
      day:dailyRow.day,
      completion:Number.isFinite(dailyRow.completion)?round(dailyRow.completion,1):null,
      planned,
      completed:Math.max(0,num(dailyRow.completed)),
      blocks:work.length,
      evidenceWeight:round(evidenceWeight,3),
      effectiveBlocks:round(effectiveBlocks,2),
      measurementSd:measurementSd===null?null:round(measurementSd,2),
      hasObservation:Number.isFinite(dailyRow.completion)&&evidenceWeight>0,
      components,
      plannedByGroup:Object.fromEntries(Object.entries(plannedByGroup).map(([key,value])=>[key,round(value,1)]))
    };
  }
  function fitnessTrajectory(history,current,confidence,lastEvidenceDay,endDay){
    const rows=(Array.isArray(history)?history:[]).filter(row=>Number.isFinite(row.estimate));
    const recentEvidence=rows.filter(row=>row.day>endDay-FITNESS_TRAJECTORY_LOOKBACK_DAYS&&Number.isFinite(row.observed)).length;
    const uncertain=!current||confidence.key==='weak'||recentEvidence<3||!Number.isFinite(lastEvidenceDay);
    if(uncertain)return {key:'uncertain',label:'Uncertain',tone:'low',delta:null,lookbackDays:FITNESS_TRAJECTORY_LOOKBACK_DAYS,recentEvidence};
    const target=endDay-FITNESS_TRAJECTORY_LOOKBACK_DAYS;
    const baseline=[...rows].reverse().find(row=>row.day<=target)||rows[0];
    if(!baseline||endDay-baseline.day<7)return {key:'uncertain',label:'Uncertain',tone:'low',delta:null,lookbackDays:endDay-(baseline&&baseline.day||endDay),recentEvidence};
    const delta=round(current.estimate-baseline.estimate,1);
    const recoveryWindow=rows.filter(row=>row.day>=endDay-42);
    const troughCandidates=recoveryWindow.filter(row=>row.day<=endDay-7);
    const trough=troughCandidates.sort((a,b)=>a.estimate-b.estimate||b.day-a.day)[0]||null;
    const earlierPeak=trough
      ? recoveryWindow.filter(row=>row.day<trough.day).sort((a,b)=>b.estimate-a.estimate||b.day-a.day)[0]||null
      : null;
    const recovering=!!trough&&!!earlierPeak&&current.estimate-trough.estimate>=FITNESS_RECOVERY_DELTA_POINTS&&earlierPeak.estimate-current.estimate>=3&&delta>=Math.max(3,FITNESS_TRAJECTORY_DELTA_POINTS*.6);
    if(recovering)return {key:'recovering',label:'Recovering',tone:'good',delta,lookbackDays:endDay-baseline.day,recentEvidence,troughDate:trough.date};
    if(delta>=FITNESS_TRAJECTORY_DELTA_POINTS)return {key:'rising',label:'Rising',tone:'good',delta,lookbackDays:endDay-baseline.day,recentEvidence};
    if(delta<=-FITNESS_TRAJECTORY_DELTA_POINTS)return {key:'falling',label:'Falling',tone:'watch',delta,lookbackDays:endDay-baseline.day,recentEvidence};
    return {key:'stable',label:'Stable',tone:'quiet',delta,lookbackDays:endDay-baseline.day,recentEvidence};
  }
  function learnFitnessStateParameters(observations,keys){
    const centers=keys.map(key=>mean(observations.map(row=>row.components[key].value).filter(Number.isFinite))??50);
    const persistence=keys.map((key,index)=>{
      const pairs=[];
      for(let rowIndex=1;rowIndex<observations.length;rowIndex+=1){
        const before=observations[rowIndex-1],after=observations[rowIndex];
        if(after.day-before.day>3)continue;
        const x=before.components[key].value,y=after.components[key].value;
        if(Number.isFinite(x)&&Number.isFinite(y))pairs.push({x:x-centers[index],y:y-centers[index]});
      }
      const denominator=sum(pairs.map(pair=>pair.x*pair.x));
      const raw=denominator?sum(pairs.map(pair=>pair.x*pair.y))/denominator:.85;
      return clamp((pairs.length*raw+8*.85)/(pairs.length+8),.35,.98);
    });
    const transition=zeroMatrix(keys.length);
    persistence.forEach((value,index)=>{transition[index][index]=value;});
    const completePairs=[];
    for(let index=1;index<observations.length;index+=1){
      const before=observations[index-1],after=observations[index];
      if(after.day-before.day!==1)continue;
      const beforeValues=keys.map(key=>before.components[key].value),afterValues=keys.map(key=>after.components[key].value);
      if(beforeValues.every(Number.isFinite)&&afterValues.every(Number.isFinite))completePairs.push({
        x:beforeValues.map((value,keyIndex)=>value-centers[keyIndex]),
        y:afterValues.map((value,keyIndex)=>value-centers[keyIndex])
      });
    }
    if(completePairs.length>=10){
      const xtx=zeroMatrix(keys.length),shrink=completePairs.length/(completePairs.length+18);
      completePairs.forEach(pair=>pair.x.forEach((left,leftIndex)=>pair.x.forEach((right,rightIndex)=>{xtx[leftIndex][rightIndex]+=left*right;})));
      for(let index=0;index<keys.length;index+=1)xtx[index][index]+=120;
      keys.forEach((key,target)=>{
        const xty=Array(keys.length).fill(0);
        completePairs.forEach(pair=>pair.x.forEach((value,index)=>{xty[index]+=value*pair.y[target];}));
        const fitted=solveLinearSystem(xtx,xty);
        if(!fitted)return;
        transition[target]=transition[target].map((fallback,index)=>index===target?fallback:shrink*clamp(fitted[index],-.08,.08));
      });
    }
    const processSd=keys.map((key,keyIndex)=>{
      const residuals=[];
      for(let index=1;index<observations.length;index+=1){
        const before=observations[index-1],after=observations[index];
        if(after.day-before.day>3)continue;
        const beforeValue=before.components[key].value,afterValue=after.components[key].value;
        if(Number.isFinite(beforeValue)&&Number.isFinite(afterValue))residuals.push(afterValue-(centers[keyIndex]+persistence[keyIndex]*(beforeValue-centers[keyIndex])));
      }
      const learned=robustScale(residuals);
      return clamp(Number.isFinite(learned)?(residuals.length*learned+6*6)/(residuals.length+6):6,3,12);
    });
    const measurementSd=keys.map(key=>{
      const reported=observations.map(row=>row.components[key].measurementSd).filter(Number.isFinite);
      const differences=[];
      for(let index=1;index<observations.length;index+=1){
        const before=observations[index-1],after=observations[index],gap=after.day-before.day;
        const left=before.components[key].value,right=after.components[key].value;
        if(gap<=3&&Number.isFinite(left)&&Number.isFinite(right))differences.push((right-left)/Math.sqrt(Math.max(1,gap)));
      }
      const designBased=median(reported)??20,empirical=robustScale(differences);
      const blended=Number.isFinite(empirical)?(differences.length*(empirical/Math.sqrt(2))+8*designBased)/(differences.length+8):designBased;
      return clamp(blended,8,28);
    });
    return {keys,centers,transition,empiricalPersistence:persistence,processSd,measurementSd,completePairs:completePairs.length,learnedDays:observations.length};
  }
  function componentInterval(estimate,variance){
    const radius=1.96*Math.sqrt(Math.max(0,num(variance)));
    return {estimate:round(clamp(estimate,0,100),1),low:round(clamp(estimate-radius,0,100),1),high:round(clamp(estimate+radius,0,100),1)};
  }
  function computeFitnessPerformanceState(model,evidence){
    const recordByDate=new Map((evidence&&Array.isArray(evidence.records)?evidence.records:[]).map(record=>[record.date,record]));
    const allObservations=(Array.isArray(model&&model.daily)?model.daily:[])
      .filter(row=>Number.isFinite(row&&row.day))
      .sort((a,b)=>a.day-b.day)
      .map(row=>fitnessObservationForDay(row,evidence,recordByDate));
    const lastSavedDay=allObservations.length?allObservations[allObservations.length-1].day:null;
    const currentDay=isIsoDate(model&&model.currentStudyDate)?dateDay(model.currentStudyDate):null;
    const calendarEndDay=isIsoDate(model&&model.calendarRange&&model.calendarRange.end)?dateDay(model.calendarRange.end):null;
    const endDay=[lastSavedDay,currentDay,calendarEndDay].filter(Number.isFinite).sort((a,b)=>b-a)[0];
    if(!Number.isFinite(endDay))return {
      ready:false,history:[],observations:allObservations,current:null,confidence:CONFIDENCE.weak,
      trajectory:{key:'uncertain',label:'Uncertain',tone:'low'},effectiveDays:0,observedDays:0,lastEvidenceDate:null,daysSinceLastEvidence:null
    };
    const firstHistoryDay=allObservations.length?allObservations[0].day:endDay;
    const observations=allObservations.filter(row=>row.day>=firstHistoryDay&&row.day<=endDay);
    const byDay=new Map(observations.map(row=>[row.day,row]));
    const keys=['capacity','execution','recovery'];
    const firstObserved=observations.find(row=>keys.some(key=>Number.isFinite(row.components[key].value)));
    if(!firstObserved)return {
      ready:false,history:[],observations,current:null,confidence:CONFIDENCE.weak,
      trajectory:{key:'uncertain',label:'Uncertain',tone:'low'},effectiveDays:0,observedDays:0,lastEvidenceDate:null,daysSinceLastEvidence:null,
      basis:{start:observations[0]&&observations[0].date||null,end:dateFromDay(endDay),mode:'bounded-two-year-model'}
    };
    let parameters=learnFitnessStateParameters(observations.filter(row=>row.day<=firstObserved.day).slice(-FITNESS_PARAMETER_WINDOW_OBSERVATIONS),keys);
    let state=keys.map((key,index)=>Number.isFinite(firstObserved.components[key].value)?firstObserved.components[key].value:parameters.centers[index]),covariance=zeroMatrix(keys.length);
    keys.forEach((key,index)=>{covariance[index][index]=Math.pow(parameters.measurementSd[index],2);});
    const lastEvidenceDays=Object.fromEntries(keys.map(key=>[key,null]));
    const parameterObservations=[];
    const history=[];
    for(let day=firstObserved.day;day<=endDay;day+=1){
      const observation=byDay.get(day)||null;
      const observedComponents=keys.map(key=>!!observation&&Number.isFinite(observation.components[key].value));
      const hasStateObservation=observedComponents.some(Boolean);
      if(hasStateObservation)parameterObservations.push(observation);
      if(day===firstObserved.day||(hasStateObservation&&parameterObservations.length%FITNESS_PARAMETER_UPDATE_CADENCE===0)){
        parameters=learnFitnessStateParameters(parameterObservations.slice(-FITNESS_PARAMETER_WINDOW_OBSERVATIONS),keys);
      }
      const previousState=state.slice();
      const previousCovariance=covariance.map(row=>row.slice());
      const centered=state.map((value,index)=>value-parameters.centers[index]);
      state=multiplyMatrixVector(parameters.transition,centered).map((value,index)=>clamp(value+parameters.centers[index],0,100));
      const process=zeroMatrix(keys.length);parameters.processSd.forEach((value,index)=>{process[index][index]=value*value;});
      covariance=addMatrices(multiplyMatrices(multiplyMatrices(parameters.transition,covariance),transposeMatrix(parameters.transition)),process);
      state=state.map((value,index)=>observedComponents[index]?value:previousState[index]);
      const gains={};
      if(observation){
        keys.forEach((key,index)=>{
          const component=observation.components[key];
          if(!Number.isFinite(component.value))return;
          const learnedSd=parameters.measurementSd[index],designSd=num(component.measurementSd,learnedSd);
          const measurementSd=Math.max(learnedSd*.65,Math.sqrt(Math.max(1,designSd*learnedSd)));
          const denominator=covariance[index][index]+measurementSd*measurementSd;
          if(!(denominator>0))return;
          const gain=covariance.map(row=>row[index]/denominator),innovation=component.value-state[index];
          state=state.map((value,stateIndex)=>clamp(value+gain[stateIndex]*innovation,0,100));
          const pivotRow=covariance[index].slice();
          covariance=covariance.map((row,rowIndex)=>row.map((value,column)=>value-gain[rowIndex]*pivotRow[column]));
          for(let row=0;row<keys.length;row+=1)for(let column=row+1;column<keys.length;column+=1){const symmetric=(covariance[row][column]+covariance[column][row])/2;covariance[row][column]=symmetric;covariance[column][row]=symmetric;}
          gains[key]=round(gain[index],3);lastEvidenceDays[key]=day;
        });
      }
      state=state.map((value,index)=>observedComponents[index]?value:previousState[index]);
      observedComponents.forEach((observed,index)=>{
        if(!observed)covariance[index][index]=Math.max(previousCovariance[index][index],covariance[index][index]);
      });
      const states=Object.fromEntries(keys.map((key,index)=>[key,{
        ...componentInterval(state[index],covariance[index][index]),
        observed:observation&&Number.isFinite(observation.components[key].value)?observation.components[key].value:null,
        observationUsed:!!(observation&&Number.isFinite(observation.components[key].value)),gain:gains[key]??null
      }]));
      const interval=Number.isFinite(lastEvidenceDays.capacity)?states.capacity:{estimate:null,low:null,high:null};
      history.push({
        date:dateFromDay(day),day,
        observed:observation&&Number.isFinite(observation.completion)?observation.completion:null,
        observationUsed:!!(observation&&observation.hasObservation),
        evidenceWeight:observation?observation.evidenceWeight:null,
        measurementSd:observation?observation.measurementSd:null,
        gain:gains.capacity??null,variance:round(covariance[0][0],2),states,
        ...interval
      });
    }
    const latest=history[history.length-1]||null;
    const reportedParameters=learnFitnessStateParameters(parameterObservations.slice(-FITNESS_PARAMETER_WINDOW_OBSERVATIONS),keys);
    const current=Number.isFinite(lastEvidenceDays.capacity)?latest:null;
    const effectiveDays=round(sum(observations.filter(row=>row.hasObservation).map(row=>row.evidenceWeight)),1);
    const observedDays=observations.filter(row=>row.hasObservation).length;
    const intervalWidth=current?round(current.high-current.low,1):100;
    const confidence=evidenceConfidence(effectiveDays,intervalWidth);
    const trajectory=fitnessTrajectory(history,current,confidence,lastEvidenceDays.capacity,endDay);
    const dimensions=Object.fromEntries(keys.map((key,index)=>{
      const currentState=Number.isFinite(lastEvidenceDays[key])&&latest&&latest.states?latest.states[key]:null;
      const observed=observations.filter(row=>Number.isFinite(row.components[key].value)).length;
      return [key,{key,label:key==='capacity'?'Output state':key==='execution'?'Schedule control':'Focus control',current:currentState,observedDays:observed,confidence:evidenceConfidence(observed,currentState?currentState.high-currentState.low:100),center:round(reportedParameters.centers[index],1),persistence:round(reportedParameters.empiricalPersistence[index],3),lastEvidenceDate:Number.isFinite(lastEvidenceDays[key])?dateFromDay(lastEvidenceDays[key]):null,daysSinceLastEvidence:Number.isFinite(lastEvidenceDays[key])?Math.max(0,endDay-lastEvidenceDays[key]):null}];
    }));
    return {
      ready:Object.values(dimensions).some(dimension=>!!dimension.current),
      history,observations,current,confidence,trajectory,effectiveDays,observedDays,dimensions,parameters:reportedParameters,
      multivariateReady:Object.values(dimensions).filter(dimension=>dimension.observedDays>=6).length>=2,
      forecastCausal:true,
      parameterUpdateCadence:FITNESS_PARAMETER_UPDATE_CADENCE,
      parameterWindowObservations:FITNESS_PARAMETER_WINDOW_OBSERVATIONS,
      lastEvidenceDate:Number.isFinite(lastEvidenceDays.capacity)?dateFromDay(lastEvidenceDays.capacity):null,
      daysSinceLastEvidence:Number.isFinite(lastEvidenceDays.capacity)?Math.max(0,endDay-lastEvidenceDays.capacity):null,
      basis:{start:history[0]&&history[0].date||null,end:dateFromDay(endDay),mode:'bounded-two-year-model',historicalMode:'origin-causal'},
      intervalWidth
    };
  }
  function computeFitnessLoadMatch(model){
    const eligible=(Array.isArray(model&&model.daily)?model.daily:[])
      .filter(row=>row&&row.planned>0&&Number.isFinite(row.completion))
      .slice(-FITNESS_RECENT_LOAD_DAYS);
    const recentPlanned=mean(eligible.map(row=>row.planned));
    const recentCompletion=mean(eligible.map(row=>row.completion));
    const workload=model&&model.dynamics&&model.dynamics.workload||{};
    const recommendation=workload&&workload.recommendation;
    if(!workload.ready||!recommendation||!Number.isFinite(recentPlanned))return {
      ready:false,key:'unknown',label:'Response not established',tone:'low',recentPlanned:roundNullable(recentPlanned,1),recentCompletion:roundNullable(recentCompletion,1),
      recentDays:eligible.length,range:null,reason:workload.reason||'Need more varied planned-work days.'
    };
    const range={min:recommendation.minPlanned,max:recommendation.maxPlanned,typical:recommendation.typicalPlanned};
    const margin=Math.max(20,Math.round(num(range.typical)*.05));
    let key='within',label='Within estimated region',tone='good';
    if(recentPlanned<range.min-margin){key='below';label='Below estimated region';tone='quiet';}
    else if(recentPlanned>range.max+margin){key='above';label='Above estimated region';tone='watch';}
    return {
      ready:true,key,label,tone,recentPlanned:round(recentPlanned,1),recentCompletion:roundNullable(recentCompletion,1),recentDays:eligible.length,range
    };
  }
  function computeStudyFitness(model,evidence,options={}){
    const performanceState=options&&options.performanceState||computeFitnessPerformanceState(model,evidence);
    const loadMatch=computeFitnessLoadMatch(model);
    const ratedDays=num(model&&model.advanced&&model.advanced.qualityPairCount);
    const quality={ratedDays,average:model&&model.overview?model.overview.averageQuality:null,totalSavedDays:num(model&&model.recordCount),ready:ratedDays>=3};
    const current=performanceState.current;
    const stateText=current?`${percentLabel(current.estimate,1)} (${percentLabel(current.low,0)}–${percentLabel(current.high,0)} model range)`:'No state estimate';
    const trajectoryText=performanceState.trajectory&&performanceState.trajectory.label||'Uncertain';
    const dimensionCopy=performanceState.dimensions?['execution','recovery'].map(key=>performanceState.dimensions[key]).filter(dimension=>dimension&&dimension.current).map(dimension=>`${dimension.label} ${percentLabel(dimension.current.estimate,0)}`).join(' · '):'';
    const stalenessDays=performanceState.daysSinceLastEvidence;
    const stalenessText=Number.isFinite(stalenessDays)&&stalenessDays>0
      ? ` Last usable completion evidence was ${stalenessDays===1?'1 day':`${stalenessDays} days`} ago; the point estimate is held while uncertainty widens.`
      : '';
    const summary=current
      ? `${trajectoryText} Output state at ${stateText}${dimensionCopy?`; ${dimensionCopy}`:''}.${stalenessText}`
      : dimensionCopy?`Output state is unknown because usable progress evidence is absent; ${dimensionCopy}.`:'No uncertainty-aware current-state estimate can be estimated from the available evidence.';
    return {
      version:3,performanceState,loadMatch,quality,
      readiness:performanceState.confidence,
      summary:{text:summary,stateText,trajectory:trajectoryText},
      parameters:{learned:performanceState.parameters||null,sourceWeights:{...FITNESS_SOURCE_WEIGHTS}}
    };
  }

  function compactFitnessResult(fitness){
    const state=fitness.performanceState,history=state.history.map(({date,day,observed,observationUsed,evidenceWeight,estimate,low,high})=>({date,day,observed,observationUsed,evidenceWeight,estimate,low,high}));
    return {...fitness,performanceState:{...state,history,observations:undefined,parameters:undefined},parameters:{sourceWeights:{...FITNESS_SOURCE_WEIGHTS}}};
  }
    return Object.freeze({
      compactFitnessResult,computeFitnessPerformanceState,computeScheduleSummary,computeStudyFitness
    });
  })(InsightsConfig,InsightsPrimitives,InsightsAnalytics);

  // M8.7 STUDY DYNAMICS COMPONENT
  const InsightsDynamics=((Config,Primitives,Analytics)=>{
    const {
      BOCPD_DETECTION_PROBABILITY,BOCPD_EXPECTED_REGIME_DAYS,BOCPD_MAX_RUN_LENGTH,CONFIDENCE,
      DIRECTIONAL_TREND_HORIZON_DAYS,EVIDENCE_PRIOR_EFFECTIVE_BLOCKS,FITNESS_RECENT_LOAD_DAYS,FORECAST_BRIER_BASELINE_TOLERANCE,
      FORECAST_CALIBRATION_FOLDS,FORECAST_COMPLETION_RANGE_MAX_COVERAGE_ERROR_POINTS,
      FORECAST_COMPLETION_RANGE_TARGET,FORECAST_MAX_CALIBRATION_ERROR_POINTS,FORECAST_MAX_COMPLETION_MAE_POINTS,
      FORECAST_MIN_NAIVE_MAE_GAIN_POINTS,HIERARCHICAL_KAPPA_GRID,HIERARCHICAL_MU_STEPS,HIERARCHICAL_RATE_STEPS,
      MAX_EXPLICIT_BLOCK_ORDER,MAX_FORECAST_BACKTESTS,MIN_ADJUSTED_HAZARD_EVENTS,MIN_ADJUSTED_HAZARD_ROWS,
      MIN_ADJUSTED_TRANSITIONS,MIN_ALLOCATION_EVIDENCE_COMPLETED,MIN_ALLOCATION_EVIDENCE_PLANNED,
      MIN_CASCADE_TRANSITIONS,MIN_CHANGE_POINT_DAYS,MIN_CHANGE_POINT_DELTA_POINTS,MIN_CHANGE_POINT_SEGMENT_DAYS,
      MIN_DYNAMIC_ALIGNMENT_AREA_SHARE,MIN_DYNAMIC_ALIGNMENT_GAP_POINTS,MIN_DYNAMIC_ALIGNMENT_PERIODS,
      MIN_DYNAMIC_ALIGNMENT_PERIOD_PLANNED,MIN_EVIDENCE_EFFECT_POINTS,MIN_FORECAST_BACKTESTS,
      MIN_HIERARCHICAL_GROUPS,MIN_INTERACTION_CELL_DAYS,MIN_INTERACTION_CELL_ROWS,MIN_INTERACTION_EFFECT_POINTS,
      MIN_INTERACTION_STABILITY_EFFECT_POINTS,MIN_STATE_AWARE_FORECAST_COMPLETE_DAYS,
      MIN_STATE_AWARE_FORECAST_TRAINING_DAYS,MIN_STATE_AWARE_MAE_GAIN_POINTS,MIN_WORKLOAD_FRONTIER_DAYS,
      MIN_WORKLOAD_FRONTIER_SPAN,MIN_WORKLOAD_LOCAL_SUPPORT_DAYS,STATE_AWARE_BRIER_TOLERANCE,TIME_BANDS,
      WORKLOAD_CURVE_POINTS,WORKLOAD_LOCAL_SUPPORT_RADIUS_SD
    }=Config;
    const {
      actualStartMinuteEvidence,bayesianRateEstimate,canonical,capabilityResult,clamp,confidenceAtLeast,dateDay,
      dateFromDay,descriptiveEvidenceConfidence,effectiveSampleSize,evidenceConfidence,
      evidenceRowShowsStudyActivity,firstHourSource,fitRegularizedLogistic,isIsoDate,jensenShannonDivergence,
      labelCompare,localIsoDate,logBeta,logGamma,logSumExp,logit,mean,median,minutesLabel,normalizedLogWeights,
      num,numberLabel,pct,pct0,percentLabel,predictRegularizedLogistic,regressionSlope,round,roundNullable,stdev,
      sum,timeBandForHour,weightedQuantile,withEvidenceMetadata
    }=Primitives;
    const {
      blockOrderKey,ordinalLabel,recordRows,rowsCompleted,rowsPlanned
    }=Analytics;
  function hierarchicalRatePosterior(groups,baseline){
    const usable=(Array.isArray(groups)?groups:[]).filter(group=>num(group.nEff)>0&&Number.isFinite(group.rawCompletion));
    const totalEffective=sum(usable.map(group=>group.nEff));
    const hierarchyReady=usable.length>=MIN_HIERARCHICAL_GROUPS&&totalEffective>=4;
    const muValues=Array.from({length:HIERARCHICAL_MU_STEPS},(_,index)=>.05+index*(.9/(HIERARCHICAL_MU_STEPS-1)));
    const hyper=[];
    const baselineRate=clamp(num(baseline,50)/100,.02,.98);
    (hierarchyReady?muValues:[baselineRate]).forEach(mu=>{
      (hierarchyReady?HIERARCHICAL_KAPPA_GRID:[EVIDENCE_PRIOR_EFFECTIVE_BLOCKS]).forEach(kappa=>{
        let logWeight=hierarchyReady?Math.log(mu)+Math.log(1-mu)-Math.log(kappa):0;
        usable.forEach(group=>{
          const n=Math.max(.01,num(group.nEff)),successes=clamp(num(group.rawCompletion)/100,0,1)*n;
          logWeight+=logBeta(mu*kappa+successes,(1-mu)*kappa+n-successes)-logBeta(mu*kappa,(1-mu)*kappa);
        });
        hyper.push({mu,kappa,logWeight});
      });
    });
    const weights=normalizedLogWeights(hyper.map(row=>row.logWeight));
    hyper.forEach((row,index)=>{row.weight=weights[index];});
    const learnedMean=sum(hyper.map(row=>row.mu*row.weight));
    const learnedConcentration=sum(hyper.map(row=>row.kappa*row.weight));
    let cumulative=0;
    const activeHyper=hyper.slice().sort((a,b)=>b.weight-a.weight).filter(row=>{
      if(cumulative>=.999||row.weight<=1e-8)return false;
      cumulative+=row.weight;
      return true;
    }).slice(0,12);
    const rows=usable.map(group=>{
      const n=Math.max(.01,num(group.nEff)),successes=clamp(num(group.rawCompletion)/100,0,1)*n;
      const posteriorComponents=activeHyper.map(row=>{
        const alpha=row.mu*row.kappa+successes,beta=(1-row.mu)*row.kappa+n-successes;
        return {logWeight:Math.log(row.weight),alpha,beta,normalizer:logBeta(alpha,beta)};
      });
      const density=[];
      for(let index=0;index<HIERARCHICAL_RATE_STEPS;index+=1){
        const rate=.0025+index*(.995/(HIERARCHICAL_RATE_STEPS-1));
        const components=posteriorComponents.map(row=>row.logWeight+(row.alpha-1)*Math.log(rate)+(row.beta-1)*Math.log(1-rate)-row.normalizer);
        density.push({value:rate,logWeight:logSumExp(components)});
      }
      const densityWeights=normalizedLogWeights(density.map(point=>point.logWeight));
      const posteriorPoints=density.map((point,index)=>({value:point.value,weight:densityWeights[index]}));
      const posteriorMean=sum(posteriorPoints.map(point=>point.value*point.weight));
      const low=weightedQuantile(posteriorPoints,.025),high=weightedQuantile(posteriorPoints,.975);
      const estimate={
        mean:round(posteriorMean*100,1),low:round(num(low)*100,1),high:round(num(high)*100,1),
        width:round((num(high)-num(low))*100,1),nEff:round(n,1),prior:round(learnedMean*100,1),
        confidence:evidenceConfidence(n,(num(high)-num(low))*100),method:hierarchyReady?'hierarchical-grid':'weak-prior-grid'
      };
      return {...group,estimate,effect:round(estimate.mean-learnedMean*100,1),meaningful:Math.abs(estimate.mean-learnedMean*100)>=MIN_EVIDENCE_EFFECT_POINTS};
    });
    return {
      ready:hierarchyReady,groups:usable.length,totalEffective:round(totalEffective,1),
      populationMean:round(learnedMean*100,1),populationConcentration:round(learnedConcentration,1),
      populationLow:round(num(weightedQuantile(hyper.map(row=>({value:row.mu,weight:row.weight})),.025))*100,1),
      populationHigh:round(num(weightedQuantile(hyper.map(row=>({value:row.mu,weight:row.weight})),.975))*100,1),
      hyperGridSize:hyper.length,rows
    };
  }
  function completionPatternDimension(evidence,baseline,{key,label,labelName,sort}={}){
    const map=new Map();
    (evidence&&Array.isArray(evidence.work)?evidence.work:[]).forEach((row,index)=>{
      if(!(row.planned>0))return;
      const rawKey=typeof key==='function'?key(row,index):null;
      if(rawKey===null||rawKey===undefined||rawKey==='')return;
      const groupKey=String(rawKey);
      const groupLabel=typeof label==='function'?label(row,index,groupKey):groupKey;
      if(!map.has(groupKey))map.set(groupKey,{key:groupKey,label:groupLabel,blocks:0,planned:0,completed:0,weights:[]});
      const item=map.get(groupKey);
      item.blocks+=1;
      item.planned+=row.planned;
      item.completed+=row.completed;
      item.weights.push(row.planned);
    });
    const rawRows=[...map.values()].map(row=>{
      const rawCompletion=pct(row.completed,row.planned);
      const nEff=effectiveSampleSize(row.weights);
      return {
        key:row.key,label:row.label,blocks:row.blocks,planned:row.planned,completed:row.completed,
        rawCompletion:roundNullable(rawCompletion,1),nEff:round(nEff,1),
        dimension:labelName||'Pattern'
      };
    });
    const hierarchy=hierarchicalRatePosterior(rawRows,baseline);
    const rows=hierarchy.rows;
    hierarchy.rows=typeof sort==='function'?rows.sort(sort):rows.sort((a,b)=>Math.abs(b.effect)-Math.abs(a.effect)||b.planned-a.planned||labelCompare(a,b));
    return hierarchy;
  }
  function computeBayesianPatterns(evidence,model,detail=true){
    const baseline=Number.isFinite(model&&model.overview&&model.overview.completion)?model.overview.completion:50;
    const area=completionPatternDimension(evidence,baseline,{
      key:row=>canonical(row.subject),label:row=>row.subject,labelName:'Top-level area'
    });
    const time=completionPatternDimension(evidence,baseline,{
      key:row=>{const band=timeBandForHour(firstHourSource(row.task).hour);return band&&band.id;},
      label:row=>{const band=timeBandForHour(firstHourSource(row.task).hour);return band&&band.label;},
      labelName:'Actual-start band',
      sort:(a,b)=>TIME_BANDS.findIndex(row=>row.id===a.key)-TIME_BANDS.findIndex(row=>row.id===b.key)
    });
    const position=completionPatternDimension(evidence,baseline,{
      key:(row,index)=>{
        const recordRowsList=recordRows(evidence,row.record,'work');
        const recordIndex=Math.max(0,recordRowsList.indexOf(row));
        const rawOrdinal=num(row.task&&row.task.studyOrdinal,null);
        const ordinal=Number.isFinite(rawOrdinal)&&rawOrdinal>0?Math.round(rawOrdinal):recordIndex+1;
        return blockOrderKey(ordinal);
      },
      label:(row,index,keyValue)=>keyValue.endsWith('+')?`${ordinalLabel(MAX_EXPLICIT_BLOCK_ORDER+1)}+`:ordinalLabel(Number(keyValue)),
      labelName:'Planned position',
      sort:(a,b)=>num(a.key.replace('+',''),99)-num(b.key.replace('+',''),99)
    });
    const dimensions=[
      {key:'area',label:'Top-level area',...area},
      {key:'time',label:'Actual-start band',...time},
      {key:'position',label:'Planned position',...position}
    ];
    const clearest=dimensions.flatMap(dimension=>dimension.rows.map(row=>({...row,dimensionKey:dimension.key,dimension:dimension.label})))
      .filter(row=>row.blocks>0)
      .sort((a,b)=>Math.abs(b.effect)-Math.abs(a.effect)||b.estimate.nEff-a.estimate.nEff||labelCompare(a,b))[0]||null;
    const actualStartBlocks=time.rows.reduce((total,row)=>total+row.blocks,0);
    const result={
      baseline:round(baseline,1),method:'hierarchical-posterior-grid',dimensions,clearest,
      actualStartBlocks,totalWorkBlocks:evidence.work.length,
      meaningfulCount:dimensions.flatMap(dimension=>dimension.rows).filter(row=>row.meaningful).length,
      readyDimensions:dimensions.filter(dimension=>dimension.ready).length
    };
    if(detail)return result;
    return {...result,dimensions:dimensions.map(dimension=>{
      const strongest=(dimension.rows||[]).filter(row=>row.meaningful&&row.estimate&&confidenceAtLeast(row.estimate.confidence,'emerging')).sort((a,b)=>Math.abs(b.effect)-Math.abs(a.effect)||b.estimate.nEff-a.estimate.nEff)[0];
      return {...dimension,rows:strongest?[strongest]:[]};
    })};
  }
  function studentTLogDensity(value,location,scale,degrees){
    const safeScale=Math.max(1e-6,num(scale,1)),df=Math.max(1,num(degrees,1));
    const z=(num(value)-num(location))/safeScale;
    return logGamma((df+1)/2)-logGamma(df/2)-.5*Math.log(df*Math.PI)-Math.log(safeScale)-((df+1)/2)*Math.log(1+z*z/df);
  }
  function nigPredictiveLogDensity(state,value){
    const scale=Math.sqrt(Math.max(1e-6,state.beta*(state.kappa+1)/(state.alpha*state.kappa)));
    return studentTLogDensity(value,state.mean,scale,2*state.alpha);
  }
  function updateNig(state,value){
    const kappa=state.kappa+1;
    return {
      mean:(state.kappa*state.mean+value)/kappa,
      kappa,
      alpha:state.alpha+.5,
      beta:state.beta+state.kappa*Math.pow(value-state.mean,2)/(2*kappa)
    };
  }
  function changeProbabilityStrength(probability,days){
    const value=num(probability);
    if(days<MIN_CHANGE_POINT_DAYS||value<.18)return CONFIDENCE.weak;
    if(value<.4)return CONFIDENCE.emerging;
    if(value<.7)return CONFIDENCE.reliable;
    return CONFIDENCE.strong;
  }
  function computeCompletionChangePoint(daily,detail=true){
    const rows=(Array.isArray(daily)?daily:[]).filter(row=>Number.isFinite(row&&row.completion)&&Number.isFinite(row&&row.day)).sort((a,b)=>a.day-b.day);
    const n=rows.length;
    if(!n)return {ready:false,detected:false,days:0,minimumDays:MIN_CHANGE_POINT_DAYS,history:[],confidence:CONFIDENCE.weak,reason:`Need ${MIN_CHANGE_POINT_DAYS} completion-eligible days.`};
    const prior={mean:50,kappa:.35,alpha:2.5,beta:950};
    let states=[{runLength:0,logProbability:0,parameters:{...prior}}];
    const history=[];
    rows.forEach((row,index)=>{
      const gap=index?Math.max(1,row.day-rows[index-1].day):1;
      const hazard=1-Math.pow(1-1/BOCPD_EXPECTED_REGIME_DAYS,gap);
      const priorPredictive=nigPredictiveLogDensity(prior,row.completion);
      const changeLog=logSumExp(states.map(state=>state.logProbability+Math.log(hazard)))+priorPredictive;
      const candidates=[{runLength:0,logProbability:changeLog,parameters:updateNig(prior,row.completion)}];
      states.forEach(state=>{
        if(state.runLength>=BOCPD_MAX_RUN_LENGTH)return;
        candidates.push({
          runLength:state.runLength+1,
          logProbability:state.logProbability+Math.log(1-hazard)+nigPredictiveLogDensity(state.parameters,row.completion),
          parameters:updateNig(state.parameters,row.completion)
        });
      });
      const normalizer=logSumExp(candidates.map(state=>state.logProbability));
      states=candidates.map(state=>({...state,logProbability:state.logProbability-normalizer,probability:Math.exp(state.logProbability-normalizer)}))
        .filter(state=>state.probability>1e-10)
        .sort((a,b)=>a.runLength-b.runLength);
      const changeProbability=states.find(state=>state.runLength===0)?.probability||0;
      const recentChangeProbability=sum(states.filter(state=>state.runLength<=3).map(state=>state.probability));
      const mode=states.slice().sort((a,b)=>b.probability-a.probability)[0];
      history.push(detail?{
        date:row.date,day:row.day,completion:round(row.completion,1),changeProbability:round(changeProbability,4),
        recentChangeProbability:round(recentChangeProbability,4),modalRunLength:mode.runLength,
        regimeMean:round(mode.parameters.mean,1),regimeProbability:round(mode.probability,4)
      }:{date:row.date,day:row.day,recentChangeProbability:round(recentChangeProbability,4),modalRunLength:mode.runLength,regimeMean:round(mode.parameters.mean,1)});
    });
    const eligiblePeaks=history.map((row,index)=>({...row,index,inferredIndex:Math.max(0,index-Math.max(0,num(row.modalRunLength))) }))
      .filter(row=>row.inferredIndex>=MIN_CHANGE_POINT_SEGMENT_DAYS&&n-row.inferredIndex>=MIN_CHANGE_POINT_SEGMENT_DAYS);
    const best=eligiblePeaks.sort((a,b)=>b.recentChangeProbability-a.recentChangeProbability||b.index-a.index)[0]||null;
    const split=best&&best.inferredIndex;
    const beforeRows=Number.isFinite(split)?rows.slice(Math.max(0,split-Math.max(MIN_CHANGE_POINT_SEGMENT_DAYS,Math.min(21,split))),split):[];
    const afterRows=Number.isFinite(split)?rows.slice(split,Math.min(n,split+Math.max(MIN_CHANGE_POINT_SEGMENT_DAYS,21))):[];
    const beforeMean=mean(beforeRows.map(row=>row.completion)),afterMean=mean(afterRows.map(row=>row.completion));
    const delta=Number.isFinite(beforeMean)&&Number.isFinite(afterMean)?afterMean-beforeMean:null;
    const peakProbability=best?best.recentChangeProbability:0;
    const confidence=changeProbabilityStrength(peakProbability,n);
    const detected=n>=MIN_CHANGE_POINT_DAYS&&best&&peakProbability>=BOCPD_DETECTION_PROBABILITY&&Math.abs(num(delta))>=MIN_CHANGE_POINT_DELTA_POINTS;
    const latest=history[history.length-1]||null;
    return {
      ready:n>=MIN_CHANGE_POINT_DAYS,detected:!!detected,days:n,minimumDays:MIN_CHANGE_POINT_DAYS,confidence,history,
      date:Number.isFinite(split)&&rows[split]?rows[split].date:null,beforeMean:roundNullable(beforeMean,1),afterMean:roundNullable(afterMean,1),
      beforeDays:beforeRows.length,afterDays:afterRows.length,delta:roundNullable(delta,1),
      probability:round(peakProbability*100,1),latestProbability:latest?round(latest.recentChangeProbability*100,1):null,
      currentRunLength:latest&&latest.modalRunLength,currentRegimeMean:latest&&latest.regimeMean,
      expectedRegimeDays:BOCPD_EXPECTED_REGIME_DAYS,
      threshold:{delta:MIN_CHANGE_POINT_DELTA_POINTS,probability:round(BOCPD_DETECTION_PROBABILITY*100)},
      reason:detected?'The likelihood of a shift and the size of the completion change both cleared their evidence gates.':n<MIN_CHANGE_POINT_DAYS?`Need ${MIN_CHANGE_POINT_DAYS-n} more completion-eligible day${MIN_CHANGE_POINT_DAYS-n===1?'':'s'}.`:'No date has enough evidence for both a likely shift and a meaningful completion change.'
    };
  }
  function computeAllocationConcentration(model,detail=true){
    const rows=(model&&Array.isArray(model.subjects)?model.subjects:[]).filter(row=>num(row.planned)>0||num(row.completed)>0);
    const totalPlanned=sum(rows.map(row=>row.planned)),totalCompleted=sum(rows.map(row=>row.completed));
    const ready=rows.length>=2&&totalPlanned>=MIN_ALLOCATION_EVIDENCE_PLANNED&&totalCompleted>=MIN_ALLOCATION_EVIDENCE_COMPLETED;
    if(!ready)return {
      ready:false,areas:rows.length,totalPlanned,totalCompleted,rows:[],...(detail?{}:{displayRows:[]}),divergence:null,
      confidence:descriptiveEvidenceConfidence(model&&model.advanced&&model.advanced.completionDayCount,totalCompleted),
      reason:`Needs 2+ areas, ${minutesLabel(MIN_ALLOCATION_EVIDENCE_PLANNED)} planned, and ${minutesLabel(MIN_ALLOCATION_EVIDENCE_COMPLETED)} completed-equivalent work.`
    };
    const plannedShares=rows.map(row=>num(row.planned)/totalPlanned);
    const completedShares=rows.map(row=>num(row.completed)/totalCompleted);
    const divergence=jensenShannonDivergence(plannedShares,completedShares);
    const evidenceRows=rows.map((row,index)=>({
      label:row.label,
      plannedShare:round(plannedShares[index]*100,1),
      completedShare:round(completedShares[index]*100,1),
      gap:round((completedShares[index]-plannedShares[index])*100,1),
      planned:row.planned,completed:row.completed
    })).sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap)||labelCompare(a,b));
    const effectivePlannedAreas=1/plannedShares.reduce((total,value)=>total+value*value,0);
    const effectiveCompletedAreas=1/completedShares.reduce((total,value)=>total+value*value,0);
    const label=divergence<=.02?'Aligned with plan':divergence<=.08?'Mild allocation shift':'Concentrated away from plan';
    return {
      ready:true,areas:rows.length,totalPlanned,totalCompleted,rows:detail?evidenceRows:[],...(detail?{}:{displayRows:evidenceRows.slice(0,3)}),
      divergence:round(divergence,3),divergencePercent:round(divergence*100,1),label,
      effectivePlannedAreas:round(effectivePlannedAreas,1),effectiveCompletedAreas:round(effectiveCompletedAreas,1),
      topOver:evidenceRows.filter(row=>row.gap>0).sort((a,b)=>b.gap-a.gap)[0]||null,
      topUnder:evidenceRows.filter(row=>row.gap<0).sort((a,b)=>a.gap-b.gap)[0]||null,
      confidence:descriptiveEvidenceConfidence(model&&model.advanced&&model.advanced.completionDayCount,totalCompleted)
    };
  }
  function cascadeState(row){
    if(!row)return 'missed';
    if(row.completion>=80&&row.outcome!=='finished-unverified')return 'strong';
    if(['skipped','untouched'].includes(row.outcome)&&!evidenceRowShowsStudyActivity(row))return 'missed';
    return 'attempted';
  }
  function orderedWorkEvidence(evidence,record){
    const all=recordRows(evidence,record,'all');
    return recordRows(evidence,record,'work').map((row,index)=>{
      const rawOrdinal=num(row.task&&row.task.studyOrdinal,null);
      return {row,allIndex:all.indexOf(row),ordinal:Number.isFinite(rawOrdinal)&&rawOrdinal>0?Math.round(rawOrdinal):index+1,index};
    }).sort((a,b)=>a.ordinal-b.ordinal||a.index-b.index);
  }
  function fittedSequenceEffects(fit,names){
    if(!fit||!fit.ready)return [];
    return names.map((label,index)=>{
      const coefficient=num(fit.coefficients[index+1]);
      const standardError=Math.sqrt(Math.max(0,num(fit.covariance[index+1]&&fit.covariance[index+1][index+1])));
      const low=coefficient-1.96*standardError,high=coefficient+1.96*standardError;
      return {
        key:canonical(label),label,coefficient:round(coefficient,3),low:round(low,3),high:round(high,3),
        oddsRatio:round(Math.exp(clamp(coefficient,-8,8)),2),oddsLow:round(Math.exp(clamp(low,-8,8)),2),oddsHigh:round(Math.exp(clamp(high,-8,8)),2),
        clear:low>0||high<0
      };
    }).sort((a,b)=>Number(b.clear)-Number(a.clear)||Math.abs(b.coefficient)-Math.abs(a.coefficient)||String(a.label).localeCompare(String(b.label)));
  }
  function adjustedSequenceConfidence(fit,effects,minimumRows){
    if(!fit||!fit.ready||fit.rows<minimumRows)return CONFIDENCE.weak;
    const clear=(effects||[]).filter(row=>row.clear).length;
    if(fit.rows<60||!clear)return CONFIDENCE.emerging;
    if(fit.rows<120||clear<2)return CONFIDENCE.reliable;
    return CONFIDENCE.strong;
  }
  function computeAdjustedSequenceModels(evidence,detail=true){
    const transitions=[],hazards=[];
    evidence.records.forEach(record=>{
      const ordered=orderedWorkEvidence(evidence,record);
      if(!ordered.length)return;
      const states=ordered.map(entry=>cascadeState(entry.row));
      const all=recordRows(evidence,record,'all');
      const planned=rowsPlanned(recordRows(evidence,record,'work'));
      let terminalStart=-1;
      if(states[states.length-1]==='missed'){
        terminalStart=states.length-1;
        while(terminalStart>0&&states[terminalStart-1]==='missed')terminalStart-=1;
      }
      ordered.forEach((entry,index)=>{
        const previous=index>0?ordered[index-1]:null;
        const previousState=index>0?states[index-1]:'attempted';
        const currentStart=actualStartMinuteEvidence(entry.row.task).minute;
        const low=previous?Math.min(previous.allIndex,entry.allIndex):-1,high=previous?Math.max(previous.allIndex,entry.allIndex):-1;
        const supportBefore=previous&&low>=0&&high>=0&&all.slice(low+1,high).some(row=>row.kind==='support');
        const frictionKnown=!!previous&&!!previous.row.timerBacked;
        const frictionBefore=frictionKnown&&previous.row.frictionDurations.length>0;
        const startKnown=Number.isFinite(currentStart);
        const base=[
          previousState==='strong'?1:0,
          previousState==='missed'?1:0,
          frictionBefore?1:0,
          previous&&!frictionKnown?1:0,
          supportBefore?1:0,
          startKnown&&currentStart>=12*60?1:0,
          startKnown?0:1
        ];
        if(terminalStart<0||index<=terminalStart)hazards.push({
          y:index===terminalStart?1:0,position:index+1,planned,
          base
        });
        if(!previous)return;
        transitions.push({
          y:states[index]==='strong'?1:0,position:index+1,planned,
          base
        });
      });
    });
    const transform=rows=>{
      const positionMean=mean(rows.map(row=>row.position))||1,positionSd=Math.max(.75,num(stdev(rows.map(row=>row.position)),1));
      const loadMean=mean(rows.map(row=>row.planned))||0,loadSd=Math.max(45,num(stdev(rows.map(row=>row.planned)),60));
      return {
        positionMean,positionSd,loadMean,loadSd,
        examples:rows.map(row=>({y:row.y,x:[...row.base,(row.position-positionMean)/positionSd,(row.planned-loadMean)/loadSd]}))
      };
    };
    const names=['Previous block strong','Previous block missed','Recorded friction before','Friction evidence missing','Support block before','Block starts after noon','Start-time evidence missing','Later planned position','Higher planned day load'];
    const transitionData=transform(transitions),hazardData=transform(hazards);
    const transitionFit=(transitions.filter(row=>row.y).length>=5&&transitions.filter(row=>!row.y).length>=5)
      ? fitRegularizedLogistic(transitionData.examples,{lambda:2.5,minimumRows:MIN_ADJUSTED_TRANSITIONS})
      : {ready:false,rows:transitions.length,reason:'Need at least five strong and five non-strong next-block outcomes.'};
    const hazardEvents=hazards.filter(row=>row.y).length;
    const hazardFit=(hazardEvents>=MIN_ADJUSTED_HAZARD_EVENTS&&hazards.length-hazardEvents>=20)
      ? fitRegularizedLogistic(hazardData.examples,{lambda:3,minimumRows:MIN_ADJUSTED_HAZARD_ROWS})
      : {ready:false,rows:hazards.length,reason:`Need ${MIN_ADJUSTED_HAZARD_EVENTS}+ terminal-collapse events and 20+ non-events.`};
    const transitionEffects=fittedSequenceEffects(transitionFit,names),hazardEffects=fittedSequenceEffects(hazardFit,names);
    const transitionConfidence=adjustedSequenceConfidence(transitionFit,transitionEffects,MIN_ADJUSTED_TRANSITIONS);
    const hazardConfidence=adjustedSequenceConfidence(hazardFit,hazardEffects,MIN_ADJUSTED_HAZARD_ROWS);
    const maxPosition=Math.max(1,...hazards.map(row=>row.position));
    const hazardCurve=Array.from({length:maxPosition},(_,index)=>{
      const position=index+1;
      const features=[0,0,0,0,0,0,0,(position-hazardData.positionMean)/hazardData.positionSd,0];
      const estimate=predictRegularizedLogistic(hazardFit,features);
      return {position,label:ordinalLabel(position),estimate:{mean:roundNullable(estimate.mean===null?null:estimate.mean*100,1),low:roundNullable(estimate.low===null?null:estimate.low*100,1),high:roundNullable(estimate.high===null?null:estimate.high*100,1)}};
    });
    const primary=[
      ...transitionEffects.filter(row=>row.clear).map(row=>({...row,model:'Next-block strength',confidence:transitionConfidence})),
      ...hazardEffects.filter(row=>row.clear).map(row=>({...row,model:'Terminal-collapse hazard',confidence:hazardConfidence}))
    ].sort((a,b)=>Math.abs(b.coefficient)-Math.abs(a.coefficient))[0]||null;
    return {
      ready:transitionFit.ready||hazardFit.ready,names:detail?names:undefined,
      transition:{ready:!!transitionFit.ready,reason:transitionFit.ready?null:transitionFit.reason,effects:detail?transitionEffects:[],fit:detail?transitionFit:undefined,confidence:transitionConfidence,rows:transitions.length,strong:transitions.filter(row=>row.y).length},
      hazard:{ready:!!hazardFit.ready,reason:hazardFit.ready?null:hazardFit.reason,effects:detail?hazardEffects:[],fit:detail?hazardFit:undefined,confidence:hazardConfidence,rows:hazards.length,events:hazardEvents,curve:hazardCurve},
      primary,
      reason:transitionFit.ready||hazardFit.ready?null:`Transition: ${transitionFit.reason||'not ready'} Hazard: ${hazardFit.reason||'not ready'}`
    };
  }
  function computeExecutionCascade(evidence,detail=true){
    const states=[
      {key:'strong',label:'Strong (80%+)'},
      {key:'attempted',label:'Attempted / partial'},
      {key:'missed',label:'Missed'}
    ];
    const matrix=new Map(states.map(state=>[state.key,Object.fromEntries(states.map(next=>[next.key,0]))]));
    const contexts={
      friction:{yes:{trials:0,strong:0},no:{trials:0,strong:0}},
      support:{yes:{trials:0,strong:0},no:{trials:0,strong:0}},
      afterNoon:{yes:{trials:0,strong:0},no:{trials:0,strong:0}}
    };
    const hazards=new Map();
    let transitions=0,nextStrong=0,daysWithWork=0,terminalCollapseDays=0;
    evidence.records.forEach(record=>{
      const ordered=orderedWorkEvidence(evidence,record);
      if(!ordered.length)return;
      daysWithWork+=1;
      const statesForDay=ordered.map(entry=>cascadeState(entry.row));
      const riskKeys=new Set();
      ordered.forEach((entry,index)=>riskKeys.add(blockOrderKey(index+1)));
      riskKeys.forEach(key=>{
        if(!hazards.has(key))hazards.set(key,{key,label:key.endsWith('+')?`${ordinalLabel(MAX_EXPLICIT_BLOCK_ORDER+1)}+`:ordinalLabel(Number(key)),sort:num(key.replace('+',''),99),daysAtRisk:0,collapses:0});
        hazards.get(key).daysAtRisk+=1;
      });
      if(statesForDay[statesForDay.length-1]==='missed'){
        terminalCollapseDays+=1;
        let start=statesForDay.length-1;
        while(start>0&&statesForDay[start-1]==='missed')start-=1;
        const key=blockOrderKey(start+1);
        if(!hazards.has(key))hazards.set(key,{key,label:key.endsWith('+')?`${ordinalLabel(MAX_EXPLICIT_BLOCK_ORDER+1)}+`:ordinalLabel(Number(key)),sort:num(key.replace('+',''),99),daysAtRisk:0,collapses:0});
        hazards.get(key).collapses+=1;
      }
      const all=recordRows(evidence,record,'all');
      for(let index=0;index<ordered.length-1;index+=1){
        const from=ordered[index],to=ordered[index+1];
        const fromState=statesForDay[index],toState=statesForDay[index+1];
        matrix.get(fromState)[toState]+=1;
        transitions+=1;
        if(toState==='strong')nextStrong+=1;
        if(from.row.timerBacked){
          const frictionKey=from.row.frictionDurations.length?'yes':'no';
          contexts.friction[frictionKey].trials+=1;
          if(toState==='strong')contexts.friction[frictionKey].strong+=1;
        }
        const low=Math.min(from.allIndex,to.allIndex),high=Math.max(from.allIndex,to.allIndex);
        const supportBetween=low>=0&&high>=0&&all.slice(low+1,high).some(row=>row.kind==='support');
        const supportKey=supportBetween?'yes':'no';
        contexts.support[supportKey].trials+=1;
        if(toState==='strong')contexts.support[supportKey].strong+=1;
        const nextStart=actualStartMinuteEvidence(to.row.task).minute;
        if(Number.isFinite(nextStart)){
          const timeKey=nextStart>=12*60?'yes':'no';
          contexts.afterNoon[timeKey].trials+=1;
          if(toState==='strong')contexts.afterNoon[timeKey].strong+=1;
        }
      }
    });
    const overallRate=pct(nextStrong,transitions);
    const transitionRows=states.map(state=>{
      const counts=matrix.get(state.key),total=sum(Object.values(counts));
      const estimate=bayesianRateEstimate(pct(counts.strong,total),total,overallRate===null?50:overallRate);
      return {key:state.key,label:state.label,total,counts:{...counts},nextStrong:counts.strong,rawStrongRate:pct(counts.strong,total),estimate,effect:round(estimate.mean-num(overallRate,50),1)};
    });
    const contextRows=Object.entries(contexts).map(([key,value])=>{
      const yesRate=pct(value.yes.strong,value.yes.trials),noRate=pct(value.no.strong,value.no.trials);
      const yesEstimate=bayesianRateEstimate(yesRate,value.yes.trials,overallRate===null?50:overallRate);
      const noEstimate=bayesianRateEstimate(noRate,value.no.trials,overallRate===null?50:overallRate);
      return {
        key,label:key==='friction'?'After recorded focus friction':key==='support'?'With a support block between':'Next block starts after noon',
        yes:{...value.yes,rate:yesRate,estimate:yesEstimate},no:{...value.no,rate:noRate,estimate:noEstimate},
        difference:round(yesEstimate.mean-noEstimate.mean,1),
        confidence:(value.yes.trials&&value.no.trials)?evidenceConfidence(Math.min(value.yes.trials,value.no.trials),Math.max(yesEstimate.width,noEstimate.width)):CONFIDENCE.weak
      };
    });
    const collapsePrior=pct(terminalCollapseDays,daysWithWork);
    const hazardRows=[...hazards.values()].sort((a,b)=>a.sort-b.sort).map(row=>{
      const rate=pct(row.collapses,row.daysAtRisk);
      return {...row,rate,estimate:bayesianRateEstimate(rate,row.daysAtRisk,collapsePrior===null?0:collapsePrior)};
    });
    const candidates=[];
    transitionRows.filter(row=>row.total>=3).forEach(row=>candidates.push({
      effect:row.effect,confidence:row.estimate.confidence,
      text:`After a ${row.label.toLowerCase()} block, the estimated chance that the next planned block was strong was ${percentLabel(row.estimate.mean,1)} (${percentLabel(row.estimate.low,0)}–${percentLabel(row.estimate.high,0)}).`
    }));
    contextRows.filter(row=>row.yes.trials>=3&&row.no.trials>=3).forEach(row=>candidates.push({
      effect:row.difference,confidence:row.confidence,
      text:`${row.label}, next-block strong completion was ${Math.abs(row.difference)} points ${row.difference>=0?'higher':'lower'} after shrinkage than in the comparison sample.`
    }));
    let primary=candidates.sort((a,b)=>Math.abs(b.effect)-Math.abs(a.effect))[0]||null;
    const peakHazard=hazardRows.filter(row=>row.daysAtRisk>=3&&row.collapses>0).sort((a,b)=>num(b.estimate.mean)-num(a.estimate.mean)||b.collapses-a.collapses)[0]||null;
    if((!primary||Math.abs(primary.effect)<MIN_EVIDENCE_EFFECT_POINTS)&&peakHazard)primary={
      effect:peakHazard.estimate.mean,confidence:peakHazard.estimate.confidence,
      text:`The clearest terminal-collapse position was the ${peakHazard.label} planned block: ${peakHazard.collapses}/${peakHazard.daysAtRisk} at-risk days ended in a missed tail beginning there.`
    };
    const adjusted=computeAdjustedSequenceModels(evidence,detail);
    if(adjusted.primary){
      const effect=adjusted.primary;
      const direction=effect.oddsRatio>=1?'higher':'lower';
      const outcome=effect.model==='Terminal-collapse hazard'?'risk that the day ended in a missed tail':'chance that the next block was strong';
      primary={
        effect:round((effect.oddsRatio-1)*100,1),confidence:effect.confidence,
        text:`Considering the other recorded factors together, ${effect.label.toLowerCase()} was associated with a meaningfully ${direction} ${outcome}.`
      };
    }
    return {
      ready:transitions>=MIN_CASCADE_TRANSITIONS,transitions,nextStrong,overallStrongRate:overallRate,daysWithWork,terminalCollapseDays,
      transitionRows,contextRows,hazardRows,primary,peakHazard,adjusted,
      confidence:primary&&primary.confidence||evidenceConfidence(transitions,100),
      minimumTransitions:MIN_CASCADE_TRANSITIONS
    };
  }
  function priorFitnessStatesByDay(performanceState){
    return (Array.isArray(performanceState&&performanceState.history)?performanceState.history:[])
      .filter(row=>Number.isFinite(row&&row.day)&&row.states)
      .sort((a,b)=>a.day-b.day);
  }
  function currentFitnessPredictors(performanceState){
    const dimensions=performanceState&&performanceState.dimensions||{};
    const capacity=dimensions.capacity&&dimensions.capacity.current&&dimensions.capacity.current.estimate;
    const execution=dimensions.execution&&dimensions.execution.current&&dimensions.execution.current.estimate;
    const recovery=dimensions.recovery&&dimensions.recovery.current&&dimensions.recovery.current.estimate;
    return [capacity,execution,recovery].every(Number.isFinite)?{capacity,execution,recovery}:null;
  }
  function workloadModelRows(daily,performanceState=null){
    const source=(Array.isArray(daily)?daily:[]).filter(row=>row&&row.planned>0&&Number.isFinite(row.completion)&&Number.isFinite(row.day)).sort((a,b)=>a.day-b.day);
    const causalStateHistory=!!(performanceState&&performanceState.forecastCausal===true&&performanceState.basis&&performanceState.basis.historicalMode==='origin-causal');
    const stateHistory=causalStateHistory?priorFitnessStatesByDay(performanceState):[];
    let stateCursor=0,priorFitness=null,state=50;
    return source.map(row=>{
      while(stateCursor<stateHistory.length&&stateHistory[stateCursor].day<row.day){
        const candidate=stateHistory[stateCursor],states=candidate.states||{};
        const capacity=states.capacity&&states.capacity.estimate,execution=states.execution&&states.execution.estimate,recovery=states.recovery&&states.recovery.estimate;
        if([capacity,execution,recovery].every(Number.isFinite))priorFitness={capacity,execution,recovery,date:candidate.date,day:candidate.day};
        stateCursor+=1;
      }
      const result={...row,strong:Math.round(row.completion)>=80,priorState:state,fitness:priorFitness?{...priorFitness,basis:'origin-causal-prior-day'}:null};
      state=.78*state+.22*row.completion;
      return result;
    });
  }
  function balancedWorkloadBins(rows,count){
    const sorted=(Array.isArray(rows)?rows:[]).slice().sort((a,b)=>a.planned-b.planned||a.day-b.day);
    const bins=[];
    let cursor=0;
    for(let index=0;index<count;index+=1){
      const remaining=sorted.length-cursor,groups=count-index;
      if(remaining<=0)break;
      const size=Math.ceil(remaining/groups);
      bins.push(sorted.slice(cursor,cursor+size));
      cursor+=size;
    }
    return bins.filter(bin=>bin.length);
  }
  function empiricalWorkloadBands(rows){
    if(!Array.isArray(rows)||!rows.length)return [];
    const bandCount=rows.length>=24?4:Math.min(3,rows.length);
    return balancedWorkloadBins(rows,bandCount).map((bin,index)=>{
      const meanPlanned=mean(bin.map(row=>row.planned)),meanCompletion=mean(bin.map(row=>row.completion));
      const strongDays=bin.filter(row=>row.strong).length;
      return {
        index,label:`Band ${index+1}`,days:bin.length,
        minPlanned:Math.round(Math.min(...bin.map(row=>row.planned))),
        maxPlanned:Math.round(Math.max(...bin.map(row=>row.planned))),
        meanPlanned:Math.round(meanPlanned),
        meanCompletion:round(meanCompletion,1),
        strongDays,strongRate:roundNullable(pct(strongDays,bin.length),1),
        expectedCompleted:round(meanPlanned*meanCompletion/100,1)
      };
    });
  }
  function fitWorkloadSurface(rows,{minimumDays=MIN_WORKLOAD_FRONTIER_DAYS}={}){
    const plannedValues=rows.map(row=>row.planned),span=rows.length?Math.max(...plannedValues)-Math.min(...plannedValues):0;
    const baseReason=rows.length<minimumDays
      ? `Need ${minimumDays-rows.length} more completion-eligible workload day${minimumDays-rows.length===1?'':'s'}.`
      : span<MIN_WORKLOAD_FRONTIER_SPAN
        ? `Planned workload spans only ${minutesLabel(span)}; about ${minutesLabel(MIN_WORKLOAD_FRONTIER_SPAN)} is needed to compare load levels.`
        : null;
    if(baseReason)return {
      ready:false,completionReady:false,strongReady:false,rows:rows.length,span,reason:baseReason,
      completionFit:{ready:false,rows:rows.length,reason:baseReason},
      strongFit:{ready:false,rows:rows.length,reason:'Completion response is not yet estimable.'}
    };
    const loadMean=mean(plannedValues),loadSd=Math.max(45,num(stdev(plannedValues),60));
    const stateMean=mean(rows.map(row=>row.priorState)),stateSd=Math.max(8,num(stdev(rows.map(row=>row.priorState)),12));
    const features=row=>{
      const load=(row.planned-loadMean)/loadSd,state=(row.priorState-stateMean)/stateSd;
      return [load,load*load-1,state];
    };
    const preparedRows=rows.map(row=>({row,x:features(row)}));
    const completionFit=fitRegularizedLogistic(preparedRows.map(({row,x})=>({x,y:clamp(row.completion/100,.001,.999)})),{lambda:3,minimumRows:minimumDays});
    const strongDays=rows.filter(row=>row.strong).length,nonStrongDays=rows.length-strongDays;
    const strongFit=strongDays>=5&&nonStrongDays>=5
      ? fitRegularizedLogistic(preparedRows.map(({row,x})=>({x,y:row.strong?1:0})),{lambda:3.5,minimumRows:minimumDays})
      : {ready:false,rows:rows.length,strongDays,nonStrongDays,reason:'Need five strong and five non-strong days.'};
    const residuals=completionFit.ready?preparedRows.map(({row,x})=>row.completion/100-predictRegularizedLogistic(completionFit,x,.8).mean):[];
    return {
      ready:!!completionFit.ready,completionReady:!!completionFit.ready,strongReady:!!strongFit.ready,
      rows:rows.length,span,loadMean,loadSd,stateMean,stateSd,features,completionFit,strongFit,strongDays,nonStrongDays,
      residualSd:residuals.length?Math.sqrt(mean(residuals.map(value=>value*value))):null,
      reason:completionFit.ready?null:completionFit.reason||'Completion response could not be estimated.',
      strongReason:strongFit.ready?null:strongFit.reason||'Strong-day probability could not be estimated.'
    };
  }
  function calibratedStrongPrediction(surface,features,calibrator=null){
    if(!surface||!surface.strongReady)return {raw:null,calibrated:null};
    const raw=predictRegularizedLogistic(surface.strongFit,features,.8);
    const calibrated=calibrator&&calibrator.ready
      ? predictRegularizedLogistic(calibrator,[logit(raw.mean)],.8)
      : raw;
    return {raw,calibrated};
  }
  function completionPredictionEnvelope(surface,features,completionHalfWidth=null){
    const completion=predictRegularizedLogistic(surface.completionFit,features,.8);
    const residual=Math.max(.04,num(surface.residualSd,.12));
    const modelUncertainty=1.282*Math.sqrt(residual*residual+Math.pow(completion.width/2.56,2));
    const calibrated=Number.isFinite(completionHalfWidth)&&completionHalfWidth>0;
    const uncertainty=calibrated?completionHalfWidth:modelUncertainty;
    return {
      mean:clamp(completion.mean,0,1),
      low:clamp(completion.mean-uncertainty,0,1),
      high:clamp(completion.mean+uncertainty,0,1),
      rangeMethod:calibrated?'backtest-calibrated':'model-estimated'
    };
  }
  function predictionSummary(surface,features,planned,calibrator=null,completionHalfWidth=null){
    const completion=completionPredictionEnvelope(surface,features,completionHalfWidth);
    const strong=calibratedStrongPrediction(surface,features,calibrator);
    return {
      completionMean:completion.mean,completionLow:completion.low,completionHigh:completion.high,completionRangeMethod:completion.rangeMethod,
      strongProbability:strong.calibrated?clamp(strong.calibrated.mean,0,1):null,
      strongLow:strong.calibrated?clamp(strong.calibrated.low,0,1):null,
      strongHigh:strong.calibrated?clamp(strong.calibrated.high,0,1):null,
      rawStrongProbability:strong.raw?strong.raw.mean:null,
      expectedCompleted:planned*completion.mean
    };
  }
  function predictWorkloadSurface(surface,planned,priorState,calibrator=null,completionHalfWidth=null){
    if(!surface||!surface.completionReady)return null;
    const load=(planned-surface.loadMean)/surface.loadSd,state=(priorState-surface.stateMean)/surface.stateSd;
    const features=[load,load*load-1,state];
    return {planned,priorState,...predictionSummary(surface,features,planned,calibrator,completionHalfWidth)};
  }
  function fitStateAwareForecastSurface(rows,{minimumDays=MIN_STATE_AWARE_FORECAST_COMPLETE_DAYS}={}){
    const complete=(Array.isArray(rows)?rows:[]).filter(row=>row&&row.fitness&&[row.fitness.capacity,row.fitness.execution,row.fitness.recovery].every(Number.isFinite));
    const plannedValues=complete.map(row=>row.planned),span=complete.length?Math.max(...plannedValues)-Math.min(...plannedValues):0;
    const reason=complete.length<minimumDays
      ? `Need ${Math.max(0,minimumDays-complete.length)} more days with origin-causal prior-day output, schedule, and focus states.`
      : span<MIN_WORKLOAD_FRONTIER_SPAN
        ? `State-aware workload history spans only ${minutesLabel(span)}; about ${minutesLabel(MIN_WORKLOAD_FRONTIER_SPAN)} is needed.`
        : null;
    if(reason)return {ready:false,completionReady:false,strongReady:false,rows:complete.length,span,reason,strongReason:reason};
    const loadMean=mean(plannedValues),loadSd=Math.max(45,num(stdev(plannedValues),60));
    const stateKeys=['capacity','execution','recovery'];
    const stateMeans=Object.fromEntries(stateKeys.map(key=>[key,mean(complete.map(row=>row.fitness[key]))]));
    const stateSds=Object.fromEntries(stateKeys.map(key=>[key,Math.max(8,num(stdev(complete.map(row=>row.fitness[key])),12))]));
    const features=row=>{
      const load=(row.planned-loadMean)/loadSd;
      return [load,load*load-1,...stateKeys.map(key=>(row.fitness[key]-stateMeans[key])/stateSds[key])];
    };
    const preparedRows=complete.map(row=>({row,x:features(row)}));
    const completionFit=fitRegularizedLogistic(preparedRows.map(({row,x})=>({x,y:clamp(row.completion/100,.001,.999)})),{lambda:6,minimumRows:minimumDays});
    const strongDays=complete.filter(row=>row.strong).length,nonStrongDays=complete.length-strongDays;
    const strongFit=strongDays>=5&&nonStrongDays>=5
      ? fitRegularizedLogistic(preparedRows.map(({row,x})=>({x,y:row.strong?1:0})),{lambda:6.5,minimumRows:minimumDays})
      : {ready:false,rows:complete.length,strongDays,nonStrongDays,reason:'Need five strong and five non-strong state-complete days.'};
    const residuals=completionFit.ready?preparedRows.map(({row,x})=>row.completion/100-predictRegularizedLogistic(completionFit,x,.8).mean):[];
    return {
      ready:!!completionFit.ready,completionReady:!!completionFit.ready,strongReady:!!strongFit.ready,rows:complete.length,span,
      loadMean,loadSd,stateKeys,stateMeans,stateSds,features,completionFit,strongFit,strongDays,nonStrongDays,
      residualSd:residuals.length?Math.sqrt(mean(residuals.map(value=>value*value))):null,
      forecastCausal:complete.every(row=>row.fitness&&row.fitness.basis==='origin-causal-prior-day'),
      reason:completionFit.ready?null:completionFit.reason||'State-aware completion forecast could not be estimated.',
      strongReason:strongFit.ready?null:strongFit.reason||'State-aware strong-day probability could not be estimated.'
    };
  }
  function predictStateAwareForecastSurface(surface,planned,fitness,calibrator=null,completionHalfWidth=null){
    if(!surface||!surface.completionReady||!fitness||![fitness.capacity,fitness.execution,fitness.recovery].every(Number.isFinite))return null;
    const features=surface.features({planned,fitness});
    return {planned,fitness:{...fitness},...predictionSummary(surface,features,planned,calibrator,completionHalfWidth)};
  }
  function rollingForecastPredictions(rows,variant){
    const stateAware=variant==='state-aware',minimumTraining=stateAware?MIN_STATE_AWARE_FORECAST_TRAINING_DAYS:18;
    const available=Math.max(0,rows.length-minimumTraining),originCount=Math.min(MAX_FORECAST_BACKTESTS,available);
    const origins=[...new Set(Array.from({length:originCount},(_,index)=>originCount===1?rows.length-1:Math.round(minimumTraining+index*(rows.length-minimumTraining-1)/(originCount-1))))]
      .filter(index=>index>=minimumTraining&&index<rows.length);
    const predictions=[];
    for(const index of origins){
      const training=rows.slice(0,index),test=rows[index];
      const surface=stateAware
        ? fitStateAwareForecastSurface(training,{minimumDays:MIN_STATE_AWARE_FORECAST_COMPLETE_DAYS})
        : fitWorkloadSurface(training,{minimumDays:18});
      if(!surface.completionReady)continue;
      const prediction=stateAware
        ? predictStateAwareForecastSurface(surface,test.planned,test.fitness)
        : predictWorkloadSurface(surface,test.planned,test.priorState);
      const recentCompletion=median(training.slice(-7).map(row=>row.completion).filter(Number.isFinite));
      if(prediction)predictions.push({
        date:test.date,actualStrong:test.strong?1:0,actualCompletion:test.completion/100,
        naiveCompletion:Number.isFinite(recentCompletion)?recentCompletion/100:null,
        ...prediction
      });
    }
    return predictions;
  }
  function finiteSampleQuantile(values,target=FORECAST_COMPLETION_RANGE_TARGET){
    const clean=(Array.isArray(values)?values:[]).filter(Number.isFinite).sort((a,b)=>a-b);
    if(!clean.length)return null;
    const rank=Math.min(clean.length,Math.max(1,Math.ceil((clean.length+1)*clamp(target,0,1))));
    return clean[rank-1];
  }
  function completionRangeCalibration(predictions){
    const rows=(Array.isArray(predictions)?predictions:[]).filter(row=>Number.isFinite(row.actualCompletion)&&Number.isFinite(row.completionMean));
    const errors=rows.map(row=>Math.abs(row.actualCompletion-row.completionMean));
    if(rows.length<MIN_FORECAST_BACKTESTS)return {
      ready:false,target:FORECAST_COMPLETION_RANGE_TARGET,backtests:rows.length,halfWidth:null,coverage:null,coverageError:null,
      reason:`Need ${MIN_FORECAST_BACKTESTS}+ held-out completion forecasts to check the prediction range.`
    };
    const halfWidth=finiteSampleQuantile(errors,FORECAST_COMPLETION_RANGE_TARGET);
    const leaveOneOut=rows.map((row,index)=>{
      const calibrationErrors=errors.filter((value,errorIndex)=>errorIndex!==index),width=finiteSampleQuantile(calibrationErrors,FORECAST_COMPLETION_RANGE_TARGET);
      return Number.isFinite(width)?Math.abs(row.actualCompletion-row.completionMean)<=width:null;
    }).filter(value=>value!==null);
    const coverage=leaveOneOut.length?mean(leaveOneOut.map(value=>value?1:0)):null;
    const coverageError=Number.isFinite(coverage)?Math.abs(coverage-FORECAST_COMPLETION_RANGE_TARGET)*100:null;
    const ready=Number.isFinite(halfWidth)&&Number.isFinite(coverage)&&coverageError<=FORECAST_COMPLETION_RANGE_MAX_COVERAGE_ERROR_POINTS;
    return {
      ready,target:FORECAST_COMPLETION_RANGE_TARGET,backtests:rows.length,coverageTests:leaveOneOut.length,
      halfWidth:roundNullable(halfWidth,4),halfWidthPoints:roundNullable(halfWidth*100,1),coverage:roundNullable(coverage*100,1),coverageError:roundNullable(coverageError,1),
      reason:ready?null:`The estimated range covered ${percentLabel(Number.isFinite(coverage)?coverage*100:null,1)} of held-out outcomes; approximately ${percentLabel(FORECAST_COMPLETION_RANGE_TARGET*100,0)} is required.`
    };
  }
  function evaluateForecastPredictions(predictions,modelKey,modelLabel){
    const completionMae=predictions.length?mean(predictions.map(row=>Math.abs(row.completionMean-row.actualCompletion))):null;
    const naiveRows=predictions.filter(row=>Number.isFinite(row.naiveCompletion));
    const naiveMae=naiveRows.length?mean(naiveRows.map(row=>Math.abs(row.naiveCompletion-row.actualCompletion))):null;
    const naiveGain=Number.isFinite(completionMae)&&Number.isFinite(naiveMae)?naiveMae-completionMae:null;
    const completionRange=completionRangeCalibration(predictions);
    const errorReady=Number.isFinite(completionMae)&&completionMae*100<=FORECAST_MAX_COMPLETION_MAE_POINTS;
    const benchmarkReady=naiveRows.length>=MIN_FORECAST_BACKTESTS&&Number.isFinite(naiveGain)&&naiveGain*100>=FORECAST_MIN_NAIVE_MAE_GAIN_POINTS;
    const completionReady=predictions.length>=MIN_FORECAST_BACKTESTS&&errorReady&&benchmarkReady;
    const completionReason=predictions.length<MIN_FORECAST_BACKTESTS
      ? `Need ${MIN_FORECAST_BACKTESTS}+ qualifying rolling ${modelLabel.toLowerCase()} completion forecasts.`
      : !errorReady?`Rolling ${modelLabel.toLowerCase()} completion error remains guarded: MAE ${percentLabel(roundNullable(completionMae===null?null:completionMae*100,1),1)}.`
      : !benchmarkReady?`Rolling ${modelLabel.toLowerCase()} did not beat the recent-seven-day median benchmark by the required ${FORECAST_MIN_NAIVE_MAE_GAIN_POINTS} point${FORECAST_MIN_NAIVE_MAE_GAIN_POINTS===1?'':'s'}.`
      : null;
    const strongPredictions=predictions.filter(row=>Number.isFinite(row.rawStrongProbability));
    const strongYes=strongPredictions.filter(row=>row.actualStrong).length,strongNo=strongPredictions.length-strongYes;
    const calibrator=strongPredictions.length>=MIN_FORECAST_BACKTESTS&&strongYes>=4&&strongNo>=4
      ? fitRegularizedLogistic(strongPredictions.map(row=>({x:[logit(row.rawStrongProbability)],y:row.actualStrong})),{lambda:4,minimumRows:MIN_FORECAST_BACKTESTS})
      : {ready:false,rows:strongPredictions.length,reason:`Need ${MIN_FORECAST_BACKTESTS}+ rolling strong-day forecasts with both outcomes.`};
    const foldCounters={0:0,1:0};
    const foldAssignments=strongPredictions.map(row=>{const key=row.actualStrong?1:0;return foldCounters[key]++%FORECAST_CALIBRATION_FOLDS;});
    const crossCalibrated=calibrator.ready?strongPredictions.map((row,index)=>{
      const training=strongPredictions.filter((candidate,candidateIndex)=>foldAssignments[candidateIndex]!==foldAssignments[index]);
      if(training.filter(candidate=>candidate.actualStrong).length<2||training.filter(candidate=>!candidate.actualStrong).length<2)return null;
      const foldFit=fitRegularizedLogistic(training.map(candidate=>({x:[logit(candidate.rawStrongProbability)],y:candidate.actualStrong})),{lambda:4,minimumRows:Math.max(10,Math.floor(MIN_FORECAST_BACKTESTS*2/3))});
      return foldFit.ready?predictRegularizedLogistic(foldFit,[logit(row.rawStrongProbability)],.8).mean:null;
    }):[];
    const crossFitReady=strongPredictions.length>=MIN_FORECAST_BACKTESTS&&crossCalibrated.length===strongPredictions.length&&crossCalibrated.every(Number.isFinite);
    const evaluated=strongPredictions.map((row,index)=>({...row,calibrated:crossFitReady?crossCalibrated[index]:row.rawStrongProbability}));
    const brier=evaluated.length?mean(evaluated.map(row=>Math.pow(row.calibrated-row.actualStrong,2))):null;
    const baseRate=evaluated.length?mean(evaluated.map(row=>row.actualStrong)):null;
    const baselineBrier=evaluated.length?mean(evaluated.map(row=>Math.pow(baseRate-row.actualStrong,2))):null;
    const edges=[0,.34,.67,1.001];
    const bins=edges.slice(0,-1).map((low,index)=>{
      const high=edges[index+1],items=evaluated.filter(row=>row.calibrated>=low&&row.calibrated<high);
      return {low,high,count:items.length,predicted:items.length?mean(items.map(row=>row.calibrated)):null,observed:items.length?mean(items.map(row=>row.actualStrong)):null};
    });
    const calibrationError=evaluated.length?sum(bins.map(bin=>bin.count?bin.count/evaluated.length*Math.abs(bin.predicted-bin.observed):0)):null;
    const strongReady=!!calibrator.ready&&crossFitReady&&Number.isFinite(brier)&&Number.isFinite(baselineBrier)&&brier<=baselineBrier+FORECAST_BRIER_BASELINE_TOLERANCE&&Number.isFinite(calibrationError)&&calibrationError*100<=FORECAST_MAX_CALIBRATION_ERROR_POINTS;
    const brierRounded=roundNullable(brier,3),baselineRounded=roundNullable(baselineBrier,3),completionRounded=roundNullable(completionMae===null?null:completionMae*100,1),naiveRounded=roundNullable(naiveMae===null?null:naiveMae*100,1),naiveGainRounded=roundNullable(naiveGain===null?null:naiveGain*100,1),calibrationRounded=roundNullable(calibrationError===null?null:calibrationError*100,1);
    const strongReason=!calibrator.ready?calibrator.reason
      : !crossFitReady?'Cross-fitted strong-day calibration could not be estimated across all folds.'
      : !strongReady?`Strong-day checks remain guarded: Brier ${numberLabel(brierRounded,3)} versus ${numberLabel(baselineRounded,3)} baseline, calibration gap ${percentLabel(calibrationRounded,1)}.`:null;
    const ready=completionReady||strongReady;
    const label=completionReady&&completionRange.ready&&strongReady?'Completion range + strong-day checked':completionReady&&completionRange.ready?'Completion range checked':completionReady&&strongReady?'Completion + strong-day checks passed':completionReady?'Completion backtests passed':strongReady?'Strong-day calibration passed':'Checks pending';
    return {
      modelKey,modelLabel,ready,completionReady,strongReady,calibratorReady:!!calibrator.ready,crossFitReady,predictions,strongPredictions,calibrator,
      backtests:predictions.length,strongBacktests:strongPredictions.length,brier:brierRounded,baselineBrier:baselineRounded,completionMae:completionRounded,naiveCompletionMae:naiveRounded,naiveMaeGain:naiveGainRounded,naiveBenchmarkReady:benchmarkReady,
      calibrationError:calibrationRounded,bins,completionRange,intervalReady:completionRange.ready,intervalReason:completionRange.reason,reason:ready?null:completionReason||strongReason,completionReason,strongReason,
      gates:{maximumCompletionMae:FORECAST_MAX_COMPLETION_MAE_POINTS,minimumNaiveMaeGain:FORECAST_MIN_NAIVE_MAE_GAIN_POINTS,maximumCalibrationError:FORECAST_MAX_CALIBRATION_ERROR_POINTS,brierBaselineTolerance:FORECAST_BRIER_BASELINE_TOLERANCE,completionRangeTarget:FORECAST_COMPLETION_RANGE_TARGET,maximumRangeCoverageError:FORECAST_COMPLETION_RANGE_MAX_COVERAGE_ERROR_POINTS},label
    };
  }
  function compactForecastCalibration(calibration){
    const strip=value=>{const {predictions,strongPredictions,calibrator,bins,...summary}=value||{};return summary;};
    const {candidates,...summary}=strip(calibration);
    return {...summary,candidates:candidates?Object.fromEntries(Object.entries(candidates).map(([key,value])=>[key,strip(value)])):candidates};
  }
  function forecastCalibration(rows){
    const baseline=evaluateForecastPredictions(rollingForecastPredictions(rows,'baseline'),'baseline','Baseline workload model');
    const stateAware=evaluateForecastPredictions(rollingForecastPredictions(rows,'state-aware'),'state-aware','State-aware model');
    const maeGain=Number.isFinite(baseline.completionMae)&&Number.isFinite(stateAware.completionMae)?round(baseline.completionMae-stateAware.completionMae,1):null;
    const strongGuard=!baseline.strongReady||!stateAware.strongReady||(
      num(stateAware.brier,Infinity)<=num(baseline.brier,Infinity)+STATE_AWARE_BRIER_TOLERANCE&&
      num(stateAware.calibrationError,Infinity)<=num(baseline.calibrationError,Infinity)+5
    );
    const causalGuard=stateAware.predictions.length>0&&stateAware.predictions.every(row=>row.fitness&&row.fitness.basis==='origin-causal-prior-day');
    const stateWins=causalGuard&&stateAware.completionReady&&strongGuard&&(!baseline.completionReady||(Number.isFinite(maeGain)&&maeGain>=MIN_STATE_AWARE_MAE_GAIN_POINTS));
    const selected=stateWins?stateAware:baseline;
    const selectionReason=stateWins
      ? `State-aware forecasting reduced rolling completion MAE by ${numberLabel(maeGain,1)} points without failing the strong-day guard.`
      : !causalGuard?'State-aware forecasting remains disabled because origin-causal historical state predictors were not established.'
      : !stateAware.completionReady?stateAware.completionReason||'State-aware backtests are not yet sufficient.'
      : !strongGuard?'State-aware strong-day calibration was materially less reliable than the baseline.'
      : `The state-aware model did not improve rolling completion MAE by the required ${MIN_STATE_AWARE_MAE_GAIN_POINTS} points.`;
    return {
      ...selected,selectedModel:selected.modelKey,selectedModelLabel:selected.modelLabel,selectionReason,
      candidates:{baseline,stateAware},comparison:{maeGain,strongGuard,causalGuard,stateWins,requiredMaeGain:MIN_STATE_AWARE_MAE_GAIN_POINTS}
    };
  }
  function computeWorkloadFrontier(daily,performanceState=null,detail=true){
    const rows=workloadModelRows(daily,performanceState);
    const plannedValues=rows.map(row=>row.planned);
    const span=rows.length?Math.max(...plannedValues)-Math.min(...plannedValues):0;
    const observations=rows.map(row=>Object.freeze({date:row.date,day:row.day,planned:round(row.planned,1),completion:round(row.completion,1),completed:round(row.completed,1),strong:!!row.strong,stateReady:!!row.fitness,stateBasis:row.fitness&&row.fitness.basis||null}));
    const empiricalBands=empiricalWorkloadBands(rows);
    const surface=fitWorkloadSurface(rows),stateAwareSurface=fitStateAwareForecastSurface(rows),calibration=surface.completionReady?forecastCalibration(rows):{ready:false,completionReady:false,strongReady:false,backtests:0,strongBacktests:0,label:'Calibration pending',completionReason:surface.reason,strongReason:surface.strongReason,selectedModel:'baseline',selectedModelLabel:'Baseline workload model',selectionReason:surface.reason,candidates:{}};
    if(!surface.completionReady)return {
      ready:false,completionReady:false,strongReady:false,days:rows.length,span,minimumDays:MIN_WORKLOAD_FRONTIER_DAYS,minimumSpan:MIN_WORKLOAD_FRONTIER_SPAN,observations,empiricalBands,curve:[],forecastCurve:[],recommendation:null,tradeoff:null,
      capabilities:{
        completion:capabilityResult(false,surface.reason,{observations:rows.length,days:rows.length,method:'regularised-completion-response'}),
        strong:capabilityResult(false,surface.strongReason||'Completion response is not yet estimable.',{observations:rows.length,days:rows.length,method:'regularised-strong-day-response'}),
        forecastCompletion:capabilityResult(false,calibration.completionReason,{observations:calibration.backtests,days:calibration.backtests,method:'rolling-origin-causal-model-competition'}),
        forecastStrong:capabilityResult(false,calibration.strongReason,{observations:calibration.strongBacktests,days:calibration.strongBacktests,method:'cross-fitted-probability-calibration'})
      },
      confidence:descriptiveEvidenceConfidence(rows.length,sum(rows.map(row=>row.completed))),reason:surface.reason
    };
    const minimum=Math.min(...plannedValues),maximum=Math.max(...plannedValues),latestState=rows.length?(.78*rows[rows.length-1].priorState+.22*rows[rows.length-1].completion):50;
    const baselineCalibrator=calibration.selectedModel==='baseline'&&calibration.strongReady?calibration.calibrator:null;
    const supportRadius=Math.max(45,surface.loadSd*WORKLOAD_LOCAL_SUPPORT_RADIUS_SD);
    const curve=Array.from({length:WORKLOAD_CURVE_POINTS},(_,index)=>{
      const planned=minimum+(maximum-minimum)*(index/(WORKLOAD_CURVE_POINTS-1));
      const prediction=predictWorkloadSurface(surface,planned,latestState,baselineCalibrator);
      const localSupport=rows.filter(row=>Math.abs(row.planned-planned)<=supportRadius).length;
      return {index,planned:Math.round(planned),completionMean:round(prediction.completionMean*100,1),completionLow:round(prediction.completionLow*100,1),completionHigh:round(prediction.completionHigh*100,1),strongProbability:Number.isFinite(prediction.strongProbability)?round(prediction.strongProbability*100,1):null,strongLow:Number.isFinite(prediction.strongLow)?round(prediction.strongLow*100,1):null,strongHigh:Number.isFinite(prediction.strongHigh)?round(prediction.strongHigh*100,1):null,expectedCompleted:round(prediction.expectedCompleted,1),localSupport,frontier:false};
    });
    if(surface.strongReady)curve.forEach(point=>{point.frontier=!curve.some(other=>other!==point&&other.expectedCompleted>=point.expectedCompleted&&other.strongProbability>=point.strongProbability&&(other.expectedCompleted>point.expectedCompleted||other.strongProbability>point.strongProbability));});
    else curve.forEach(point=>{point.frontier=!curve.some(other=>other!==point&&other.expectedCompleted>=point.expectedCompleted&&other.completionMean>=point.completionMean&&(other.expectedCompleted>point.expectedCompleted||other.completionMean>point.completionMean));});
    const supportedCurve=curve.filter(point=>point.localSupport>=MIN_WORKLOAD_LOCAL_SUPPORT_DAYS);
    if(!supportedCurve.length){
      const publicCalibration=detail?calibration:compactForecastCalibration(calibration);
      const supportReason=`No workload region has ${MIN_WORKLOAD_LOCAL_SUPPORT_DAYS}+ nearby observed days within ${minutesLabel(supportRadius)}.`;
      return {
        ready:true,completionReady:true,strongReady:surface.strongReady,days:rows.length,span,minimumDays:MIN_WORKLOAD_FRONTIER_DAYS,minimumSpan:MIN_WORKLOAD_FRONTIER_SPAN,method:'regularised-probabilistic-response-surface',curve,forecastCurve:[],
        surface:{loadMean:round(surface.loadMean,1),loadSd:round(surface.loadSd,1),stateMean:round(surface.stateMean,1),stateSd:round(surface.stateSd,1),residualSd:round(surface.residualSd,3),strongDays:surface.strongDays,nonStrongDays:surface.nonStrongDays,stateAwareRows:stateAwareSurface.rows||0,stateAwareReady:!!stateAwareSurface.completionReady,stateAwareCausal:!!stateAwareSurface.forecastCausal},
        capabilities:{
          completion:capabilityResult(true,null,{confidence:descriptiveEvidenceConfidence(rows.length,sum(rows.map(row=>row.completed))),observations:rows.length,days:rows.length,method:'regularised-completion-response'}),
          strong:capabilityResult(surface.strongReady,surface.strongReason,{confidence:surface.strongReady?descriptiveEvidenceConfidence(rows.length,sum(rows.map(row=>row.completed))):null,observations:rows.length,days:rows.length,method:'regularised-strong-day-response'}),
          forecastCompletion:capabilityResult(false,supportReason,{observations:calibration.backtests,days:calibration.backtests,method:'rolling-origin-causal-model-competition'}),
          forecastStrong:capabilityResult(false,supportReason,{observations:calibration.strongBacktests,days:calibration.strongBacktests,method:'cross-fitted-probability-calibration'})
        },
        recommendation:null,recommendationReason:supportReason,tradeoff:null,
        forecast:{ready:false,completionReady:false,strongReady:false,completionReason:supportReason,strongReason:supportReason,calibration:publicCalibration},
        calibration:publicCalibration,confidence:descriptiveEvidenceConfidence(rows.length,sum(rows.map(row=>row.completed))),observations,empiricalBands,anchorBand:null,reason:null,strongReason:surface.strongReason,localSupport:{minimumDays:MIN_WORKLOAD_LOCAL_SUPPORT_DAYS,radius:round(supportRadius,1)}
      };
    }
    const bestExpected=Math.max(...supportedCurve.map(point=>point.expectedCompleted));
    let efficient,selected,rangePoints;
    if(surface.strongReady){
      const bestReliability=Math.max(...supportedCurve.map(point=>point.strongProbability)),reliabilityFloor=bestReliability>=55?Math.max(55,bestReliability-10):Math.max(0,bestReliability-10);
      efficient=supportedCurve.filter(point=>point.frontier&&point.strongProbability>=reliabilityFloor&&point.expectedCompleted>=bestExpected*.35);
      selected=(efficient.length?efficient:supportedCurve).slice().sort((a,b)=>(b.expectedCompleted*(.5+b.strongProbability/200))-(a.expectedCompleted*(.5+a.strongProbability/200)))[0];
      rangePoints=supportedCurve.filter(point=>point.strongProbability>=selected.strongProbability-5&&point.expectedCompleted>=selected.expectedCompleted*.9);
    }else{
      const bestCompletion=Math.max(...supportedCurve.map(point=>point.completionMean)),completionFloor=bestCompletion>=65?Math.max(60,bestCompletion-10):Math.max(0,bestCompletion-10);
      efficient=supportedCurve.filter(point=>point.frontier&&point.completionMean>=completionFloor&&point.expectedCompleted>=bestExpected*.35);
      selected=(efficient.length?efficient:supportedCurve).slice().sort((a,b)=>(b.expectedCompleted*(.5+b.completionMean/200))-(a.expectedCompleted*(.5+a.completionMean/200)))[0];
      rangePoints=supportedCurve.filter(point=>point.completionMean>=selected.completionMean-5&&point.expectedCompleted>=selected.expectedCompleted*.9);
    }
    const anchorBand=empiricalBands.find(band=>selected.planned>=band.minPlanned&&selected.planned<=band.maxPlanned)||empiricalBands.slice().sort((a,b)=>Math.abs(a.meanPlanned-selected.planned)-Math.abs(b.meanPlanned-selected.planned))[0]||null;
    const recommendation={minPlanned:Math.min(...rangePoints.map(point=>point.planned)),maxPlanned:Math.max(...rangePoints.map(point=>point.planned)),typicalPlanned:selected.planned,expectedCompleted:selected.expectedCompleted,strongProbability:selected.strongProbability,probabilityLow:selected.strongLow,probabilityHigh:selected.strongHigh,completionMean:selected.completionMean,confidence:descriptiveEvidenceConfidence(rows.length,sum(rows.map(row=>row.completed))),days:rows.length,localSupport:selected.localSupport,belowStrongThreshold:surface.strongReady?Math.max(...supportedCurve.map(point=>point.strongProbability))<55:null,pointIndex:selected.index,mode:surface.strongReady?'completion-and-strong':'completion-only',empiricalBandIndex:anchorBand&&anchorBand.index};
    const lowPoint=supportedCurve.slice(0,Math.ceil(supportedCurve.length/2)).sort((a,b)=>b.completionMean-a.completionMean)[0],highPoint=supportedCurve[supportedCurve.length-1];
    const completionDrop=round(lowPoint.completionMean-highPoint.completionMean,1),reliabilityDrop=surface.strongReady?round(lowPoint.strongProbability-highPoint.strongProbability,1):null;
    const tradeoff=(completionDrop>=MIN_CHANGE_POINT_DELTA_POINTS||(Number.isFinite(reliabilityDrop)&&reliabilityDrop>=10))?{low:lowPoint,high:highPoint,completionDrop,reliabilityDrop,effect:Math.max(completionDrop,Number.isFinite(reliabilityDrop)?reliabilityDrop:0)}:null;
    const recentPlans=rows.slice(-FITNESS_RECENT_LOAD_DAYS).map(row=>row.planned).sort((a,b)=>a-b),scenarioPlanned=Math.round(median(recentPlans)||selected.planned);
    const currentFitness=currentFitnessPredictors(performanceState),useStateAware=calibration.selectedModel==='state-aware'&&stateAwareSurface.completionReady&&stateAwareSurface.forecastCausal&&currentFitness;
    const forecastCalibrator=calibration.strongReady?calibration.calibrator:null;
    const forecastHalfWidth=calibration.intervalReady&&calibration.completionRange?calibration.completionRange.halfWidth:null;
    const forecastPrediction=planned=>useStateAware
      ? predictStateAwareForecastSurface(stateAwareSurface,planned,currentFitness,forecastCalibrator,forecastHalfWidth)
      : predictWorkloadSurface(surface,planned,latestState,forecastCalibrator,forecastHalfWidth);
    const scenarioPrediction=forecastPrediction(scenarioPlanned);
    const forecastCurve=Array.from({length:WORKLOAD_CURVE_POINTS},(_,index)=>{
      const planned=minimum+(maximum-minimum)*(index/(WORKLOAD_CURVE_POINTS-1)),prediction=forecastPrediction(planned);
      return {index,planned:Math.round(planned),completionMean:round(prediction.completionMean*100,1),completionLow:round(prediction.completionLow*100,1),completionHigh:round(prediction.completionHigh*100,1),strongProbability:Number.isFinite(prediction.strongProbability)?round(prediction.strongProbability*100,1):null,strongLow:Number.isFinite(prediction.strongLow)?round(prediction.strongLow*100,1):null,strongHigh:Number.isFinite(prediction.strongHigh)?round(prediction.strongHigh*100,1):null,expectedCompleted:round(prediction.expectedCompleted,1)};
    });
    const publicCalibration=detail?calibration:compactForecastCalibration(calibration);
    const scenarioSupport=rows.filter(row=>Math.abs(row.planned-scenarioPlanned)<=supportRadius).length;
    const scenarioSupported=scenarioSupport>=MIN_WORKLOAD_LOCAL_SUPPORT_DAYS;
    const supportReason=scenarioSupported?null:`The next-plan scenario has only ${scenarioSupport} nearby observed day${scenarioSupport===1?'':'s'}; ${MIN_WORKLOAD_LOCAL_SUPPORT_DAYS}+ are required.`;
    const forecastCompletionReady=calibration.completionReady&&scenarioSupported,forecastStrongReady=calibration.strongReady&&scenarioSupported;
    const forecast={
      ready:(calibration.ready&&scenarioSupported),completionReady:forecastCompletionReady,strongReady:forecastStrongReady,completionReason:supportReason||calibration.completionReason,strongReason:supportReason||calibration.strongReason,scenarioPlanned,scenarioSource:'recent eligible-plan median',scenarioSupport,state:round(latestState,1),
      modelKey:useStateAware?'state-aware':'baseline',modelLabel:useStateAware?'State-aware forecast':'Baseline workload forecast',selectionReason:calibration.selectionReason,statePredictors:useStateAware?{...currentFitness}:null,statePredictorsCausal:useStateAware?true:null,
      completionMean:round(scenarioPrediction.completionMean*100,1),completionLow:round(scenarioPrediction.completionLow*100,1),completionHigh:round(scenarioPrediction.completionHigh*100,1),completionRangeMethod:scenarioPrediction.completionRangeMethod,rangeReady:!!calibration.intervalReady,rangeLabel:calibration.intervalReady?'Backtest-checked 80% range':'Estimated model range',rangeCoverage:calibration.completionRange&&calibration.completionRange.coverage,rangeBacktests:calibration.completionRange&&calibration.completionRange.coverageTests,rangeReason:calibration.intervalReason,strongProbability:Number.isFinite(scenarioPrediction.strongProbability)?round(scenarioPrediction.strongProbability*100,1):null,strongLow:Number.isFinite(scenarioPrediction.strongLow)?round(scenarioPrediction.strongLow*100,1):null,strongHigh:Number.isFinite(scenarioPrediction.strongHigh)?round(scenarioPrediction.strongHigh*100,1):null,expectedCompleted:round(scenarioPrediction.expectedCompleted,1),calibration:publicCalibration
    };
    return {
      ready:true,completionReady:true,strongReady:surface.strongReady,days:rows.length,span,minimumDays:MIN_WORKLOAD_FRONTIER_DAYS,minimumSpan:MIN_WORKLOAD_FRONTIER_SPAN,method:'regularised-probabilistic-response-surface',curve,forecastCurve,
      surface:{loadMean:round(surface.loadMean,1),loadSd:round(surface.loadSd,1),stateMean:round(surface.stateMean,1),stateSd:round(surface.stateSd,1),residualSd:round(surface.residualSd,3),strongDays:surface.strongDays,nonStrongDays:surface.nonStrongDays,stateAwareRows:stateAwareSurface.rows||0,stateAwareReady:!!stateAwareSurface.completionReady,stateAwareCausal:!!stateAwareSurface.forecastCausal},
      capabilities:{
        completion:capabilityResult(true,null,{confidence:recommendation.confidence,observations:rows.length,days:rows.length,method:'regularised-completion-response'}),
        strong:capabilityResult(surface.strongReady,surface.strongReason,{confidence:surface.strongReady?recommendation.confidence:null,observations:rows.length,days:rows.length,method:'regularised-strong-day-response'}),
        forecastCompletion:capabilityResult(forecastCompletionReady,forecast.completionReason,{observations:calibration.backtests,days:calibration.backtests,method:'rolling-origin-causal-model-competition'}),
        forecastStrong:capabilityResult(forecastStrongReady,forecast.strongReason,{observations:calibration.strongBacktests,days:calibration.strongBacktests,method:'cross-fitted-probability-calibration'})
      },
      recommendation,tradeoff,forecast,calibration:publicCalibration,confidence:recommendation.confidence,observations,empiricalBands,anchorBand,reason:null,strongReason:surface.strongReason,localSupport:{minimumDays:MIN_WORKLOAD_LOCAL_SUPPORT_DAYS,radius:round(supportRadius,1)}
    };
  }
  function periodStartDay(day,size=7){
    if(size===7){const weekday=new Date(day*86400000).getUTCDay();return day-((weekday+6)%7);}
    return Math.floor(day/size)*size;
  }
  function computeDynamicAllocation(evidence,currentStudyDate=null,detail=true,modelTrendBasis=null){
    const rows=(evidence&&Array.isArray(evidence.work)?evidence.work:[]).filter(row=>row.planned>0&&isIsoDate(row.date));
    const currentDay=isIsoDate(currentStudyDate)?dateDay(currentStudyDate):dateDay(localIsoDate()),currentPeriodStart=Number.isFinite(currentDay)?periodStartDay(currentDay,7):null;
    const groups=new Map();
    rows.forEach(row=>{
      const day=dateDay(row.date),start=periodStartDay(day,7),key=String(start);
      if(!groups.has(key))groups.set(key,{startDay:start,endDay:start+6,planned:0,completed:0,areas:new Map()});
      const period=groups.get(key);period.planned+=row.planned;period.completed+=row.completed;
      if(!period.areas.has(row.subject))period.areas.set(row.subject,{label:row.subject,planned:0,completed:0});
      const area=period.areas.get(row.subject);area.planned+=row.planned;area.completed+=row.completed;
    });
    const allPeriods=[...groups.values()].sort((a,b)=>a.startDay-b.startDay).filter(period=>period.planned>=MIN_DYNAMIC_ALIGNMENT_PERIOD_PLANNED).map(period=>{
      const areas=[...period.areas.values()].filter(area=>area.planned>0||area.completed>0),plannedTotal=sum(areas.map(area=>area.planned)),completedTotal=sum(areas.map(area=>area.completed));
      const areaRows=areas.map(area=>({label:area.label,plannedShare:plannedTotal?area.planned/plannedTotal*100:0,completedShare:completedTotal?area.completed/completedTotal*100:0})).map(area=>({...area,gap:area.completedShare-area.plannedShare}));
      const divergence=completedTotal>0&&areaRows.length>=2?jensenShannonDivergence(areaRows.map(area=>area.plannedShare/100),areaRows.map(area=>area.completedShare/100)):null;
      const provisional=Number.isFinite(currentPeriodStart)&&period.startDay===currentPeriodStart&&currentDay<=period.endDay;
      return {start:dateFromDay(period.startDay),end:dateFromDay(period.endDay),planned:round(plannedTotal,1),completed:round(completedTotal,1),divergence:roundNullable(divergence,4),provisional,rows:areaRows.map(area=>({...area,plannedShare:round(area.plannedShare,1),completedShare:round(area.completedShare,1),gap:round(area.gap,1)}))};
    }).filter(period=>Number.isFinite(period.divergence));
    const provisionalPeriod=allPeriods.find(period=>period.provisional)||null,periods=allPeriods.filter(period=>!period.provisional);
    const latestPeriodDay=periods.length?dateDay(periods[periods.length-1].end):null;
    const trendToDay=Number.isFinite(currentDay)&&Number.isFinite(latestPeriodDay)?Math.max(currentDay,latestPeriodDay):Number.isFinite(currentDay)?currentDay:latestPeriodDay;
    const trendFromDay=Number.isFinite(trendToDay)?trendToDay-DIRECTIONAL_TREND_HORIZON_DAYS+1:null;
    const trendPeriods=Number.isFinite(trendFromDay)?periods.filter(period=>{const day=dateDay(period.end);return Number.isFinite(day)&&day>=trendFromDay&&day<=trendToDay;}):periods;
    const localTrendBasis={label:trendPeriods.length<periods.length?'Latest 2 years':'All available weeks',horizonDays:DIRECTIONAL_TREND_HORIZON_DAYS,from:Number.isFinite(trendFromDay)?dateFromDay(trendFromDay):null,to:Number.isFinite(trendToDay)?dateFromDay(trendToDay):null,periods:trendPeriods.length,selectedPeriods:periods.length,capped:trendPeriods.length<periods.length};
    const trendBasis=modelTrendBasis&&modelTrendBasis.capped?{
      ...localTrendBasis,label:'Latest 2 years',capped:true,
      selectedPeriods:Math.max(localTrendBasis.periods+1,Math.ceil(num(modelTrendBasis.selectedRecordCount,localTrendBasis.periods)/7))
    }:localTrendBasis;
    if(periods.length<MIN_DYNAMIC_ALIGNMENT_PERIODS)return {ready:false,periods:detail?periods:[],allPeriods:detail?allPeriods:[],provisionalPeriod,trendBasis,minimumPeriods:MIN_DYNAMIC_ALIGNMENT_PERIODS,reason:`Need ${Math.max(0,MIN_DYNAMIC_ALIGNMENT_PERIODS-periods.length)} more completed eligible weekly allocation periods.${provisionalPeriod?' The current week is provisional and excluded from this count.':''}`};
    const areaMap=new Map();
    periods.forEach(period=>period.rows.forEach(row=>{
      if(row.plannedShare<MIN_DYNAMIC_ALIGNMENT_AREA_SHARE)return;
      if(!areaMap.has(row.label))areaMap.set(row.label,{label:row.label,periods:0,under:0,over:0,gaps:[]});
      const item=areaMap.get(row.label);item.periods+=1;item.gaps.push(row.gap);if(row.gap<=-MIN_DYNAMIC_ALIGNMENT_GAP_POINTS)item.under+=1;if(row.gap>=MIN_DYNAMIC_ALIGNMENT_GAP_POINTS)item.over+=1;
    }));
    const areaRows=[...areaMap.values()].map(row=>({...row,underRate:pct0(row.under,row.periods),overRate:pct0(row.over,row.periods),meanGap:round(mean(row.gaps),1)}));
    const persistentUnder=areaRows.filter(row=>row.periods>=MIN_DYNAMIC_ALIGNMENT_PERIODS&&row.under>=3&&row.underRate>=60).sort((a,b)=>b.underRate-a.underRate||a.meanGap-b.meanGap)[0]||null;
    const persistentOver=areaRows.filter(row=>row.periods>=MIN_DYNAMIC_ALIGNMENT_PERIODS&&row.over>=3&&row.overRate>=60).sort((a,b)=>b.overRate-a.overRate||b.meanGap-a.meanGap)[0]||null;
    const slope=regressionSlope(trendPeriods.map((period,index)=>({x:index,y:period.divergence*100})));
    const trend=trendPeriods.length<MIN_DYNAMIC_ALIGNMENT_PERIODS
      ?{key:'insufficient',label:'Alignment direction not established',slope:null,ready:false}
      :Number.isFinite(slope)&&slope<=-1.5?{key:'improving',label:'Alignment improving',slope:round(slope,1),ready:true}
        :Number.isFinite(slope)&&slope>=1.5?{key:'worsening',label:'Alignment worsening',slope:round(slope,1),ready:true}
          :{key:'stable',label:'Alignment broadly stable',slope:roundNullable(slope,1),ready:true};
    const recent=trendPeriods.slice(-6),recentMean=recent.length?round(mean(recent.map(period=>period.divergence))*100,1):null;
    return {ready:true,periods:detail?periods:[],allPeriods:detail?allPeriods:[],provisionalPeriod,areaRows:detail?areaRows:[],persistentUnder,persistentOver,trend,trendBasis,recentPeriods:recent.length,recentMeanDivergence:recentMean,minimumPeriodPlanned:MIN_DYNAMIC_ALIGNMENT_PERIOD_PLANNED};
  }
  function interactionCell(rows,valueFor,weightFor,baseline){
    const clean=(Array.isArray(rows)?rows:[]).filter(row=>Number.isFinite(valueFor(row))&&num(weightFor(row))>0),weights=clean.map(weightFor),totalWeight=sum(weights),raw=totalWeight?sum(clean.map((row,index)=>valueFor(row)*weights[index]))/totalWeight:null;
    const typicalWeight=median(weights)||1,priorWeight=typicalWeight*EVIDENCE_PRIOR_EFFECTIVE_BLOCKS,estimate=Number.isFinite(raw)?(raw*totalWeight+baseline*priorWeight)/(totalWeight+priorWeight):null;
    return {rows:clean.length,days:new Set(clean.map(row=>row.date)).size,weight:round(totalWeight,1),raw:roundNullable(raw,1),estimate:roundNullable(estimate,1),ready:clean.length>=MIN_INTERACTION_CELL_ROWS&&new Set(clean.map(row=>row.date)).size>=MIN_INTERACTION_CELL_DAYS};
  }
  function interactionStability(groups,valueFor,weightFor,baseline){
    const dates=[...new Set((Array.isArray(groups)?groups:[]).flatMap(group=>(Array.isArray(group)?group:[]).map(row=>row&&row.date).filter(isIsoDate)))].sort();
    if(dates.length<MIN_INTERACTION_CELL_DAYS*2)return {ready:false,earlyEffect:null,lateEffect:null,reason:`Need ${MIN_INTERACTION_CELL_DAYS*2}+ distinct dates for an early/late stability check.`};
    const split=dates[Math.floor(dates.length/2)],effectFor=side=>{
      const cells=(Array.isArray(groups)?groups:[]).map(group=>interactionCell((group||[]).filter(row=>side==='early'?row.date<split:row.date>=split),valueFor,weightFor,baseline));
      const ready=cells.length===4&&cells.every(cell=>cell.ready&&Number.isFinite(cell.estimate));
      return ready?(cells[0].estimate-cells[1].estimate)-(cells[2].estimate-cells[3].estimate):null;
    };
    const earlyEffect=effectFor('early'),lateEffect=effectFor('late');
    const sameDirection=Number.isFinite(earlyEffect)&&Number.isFinite(lateEffect)&&Math.sign(earlyEffect)===Math.sign(lateEffect);
    const ready=sameDirection&&Math.abs(earlyEffect)>=MIN_INTERACTION_STABILITY_EFFECT_POINTS&&Math.abs(lateEffect)>=MIN_INTERACTION_STABILITY_EFFECT_POINTS;
    return {
      ready,split,earlyEffect:roundNullable(earlyEffect,1),lateEffect:roundNullable(lateEffect,1),
      reason:ready?null:'The interaction did not repeat with the same material direction in the early and late evidence halves.'
    };
  }
  function interactionDifference(label,key,cells,textFor,meta={}){
    const ready=Object.values(cells).every(cell=>cell.ready&&Number.isFinite(cell.estimate));
    const effect=ready?(cells.a.estimate-cells.b.estimate)-(cells.c.estimate-cells.d.estimate):null;
    const minimumRows=Math.min(...Object.values(cells).map(cell=>cell.rows)),minimumDays=Math.min(...Object.values(cells).map(cell=>cell.days));
    const stability=meta.stability||{ready:false,reason:'No repeated-period stability check is available.'};
    return {key,label,cells,ready,effect:roundNullable(effect,1),meaningful:ready&&Math.abs(effect)>=MIN_INTERACTION_EFFECT_POINTS&&stability.ready,confidence:ready&&stability.ready?descriptiveEvidenceConfidence(minimumRows,minimumDays*120):CONFIDENCE.weak,text:ready?textFor(effect):'The four comparison cells are not yet sufficiently represented.',...meta,stability};
  }
  function canonicalInteractionPartition(groups){
    const clean=(Array.isArray(groups)?groups:[]).map(group=>(Array.isArray(group)?group:[]).slice().sort((a,b)=>a-b));
    if(clean.length!==4)return '';
    const variants=[clean,[clean[2],clean[3],clean[0],clean[1]],[clean[1],clean[0],clean[3],clean[2]],[clean[3],clean[2],clean[1],clean[0]]];
    return variants.map(variant=>variant.map(group=>group.join(',')).join('|')).sort()[0];
  }
  function deduplicateInteractionCandidates(candidates){
    const seen=new Set(),unique=[];
    (Array.isArray(candidates)?candidates:[]).forEach(candidate=>{
      const key=String(candidate&&candidate.dedupeKey||`${candidate&&candidate.key||'interaction'}:${candidate&&candidate.label||''}`);
      if(seen.has(key))return;
      seen.add(key);unique.push(candidate);
    });
    return unique;
  }
  function selectDiverseInteractions(candidates,limit=2){
    const source=Array.isArray(candidates)?candidates:[],shown=[],usedTypes=new Set();
    source.forEach(candidate=>{if(shown.length<limit&&!usedTypes.has(candidate.key)){shown.push(candidate);usedTypes.add(candidate.key);}});
    source.forEach(candidate=>{if(shown.length<limit&&!shown.includes(candidate))shown.push(candidate);});
    return shown;
  }
  function interactionCells(groups,value,weight,baseline){
    return {a:interactionCell(groups[0],value,weight,baseline),b:interactionCell(groups[1],value,weight,baseline),c:interactionCell(groups[2],value,weight,baseline),d:interactionCell(groups[3],value,weight,baseline)};
  }
  function computeAreaTimeInteractions(evidence){
    const rows=(evidence&&Array.isArray(evidence.work)?evidence.work:[]).filter(row=>row.planned>0&&Number.isFinite(firstHourSource(row.task).hour)),baseline=pct(rowsCompleted(rows),rowsPlanned(rows))??50,rowIndex=new Map(rows.map((row,index)=>[row,index]));
    const areaTotals=new Map();rows.forEach(row=>areaTotals.set(row.subject,num(areaTotals.get(row.subject))+row.planned));
    const areas=[...areaTotals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([label])=>label),bands=TIME_BANDS;
    const candidates=[];
    areas.forEach(area=>bands.forEach(band=>{
      const inBand=row=>{const current=timeBandForHour(firstHourSource(row.task).hour);return current&&current.id===band.id;};
      const groups=[rows.filter(row=>row.subject===area&&inBand(row)),rows.filter(row=>row.subject===area&&!inBand(row)),rows.filter(row=>row.subject!==area&&inBand(row)),rows.filter(row=>row.subject!==area&&!inBand(row))];
      const cells=interactionCells(groups,row=>row.completion,row=>row.planned,baseline);
      const partition=canonicalInteractionPartition(groups.map(group=>group.map(row=>rowIndex.get(row))));
      candidates.push(interactionDifference(`${area} × ${band.label}`,'area-time',cells,effect=>`${area}'s ${band.label.toLowerCase()} completion difference was ${Math.abs(round(effect,1))} points ${effect>=0?'more favourable':'less favourable'} than expected from its separate area and time patterns.`,{dedupeKey:`area-time:${partition}`,stability:interactionStability(groups,row=>row.completion,row=>row.planned,baseline)}));
    }));
    return candidates;
  }
  function computePositionWorkloadInteraction(evidence,daily){
    const dailyLoad=new Map((Array.isArray(daily)?daily:[]).map(row=>[row.date,row.planned])),loads=[...dailyLoad.values()].filter(Number.isFinite),cut=median(loads);
    const rows=(evidence&&Array.isArray(evidence.work)?evidence.work:[]).filter(row=>row.planned>0&&Number.isFinite(dailyLoad.get(row.date))),baseline=pct(rowsCompleted(rows),rowsPlanned(rows))??50;
    const late=row=>{const recordWork=recordRows(evidence,row.record,'work'),index=Math.max(0,recordWork.indexOf(row)),raw=num(row.task&&row.task.studyOrdinal,null),ordinal=Number.isFinite(raw)&&raw>0?Math.round(raw):index+1;return ordinal>=4;};
    const high=row=>dailyLoad.get(row.date)>=cut;
    const groups=[rows.filter(row=>late(row)&&high(row)),rows.filter(row=>late(row)&&!high(row)),rows.filter(row=>!late(row)&&high(row)),rows.filter(row=>!late(row)&&!high(row))];
    const cells=interactionCells(groups,row=>row.completion,row=>row.planned,baseline);
    return interactionDifference('Late position × workload','position-workload',cells,effect=>`Fourth-and-later blocks changed by ${Math.abs(round(effect,1))} completion points ${effect<0?'more negatively':'more positively'} on higher-load days than early blocks did.`,{stability:interactionStability(groups,row=>row.completion,row=>row.planned,baseline)});
  }
  function computePreviousSupportInteraction(evidence){
    const transitions=[];
    (evidence&&Array.isArray(evidence.records)?evidence.records:[]).forEach(record=>{
      const all=recordRows(evidence,record,'all'),work=all.filter(row=>row.kind==='work'&&row.planned>0);
      for(let index=1;index<work.length;index+=1){
        const previous=work[index-1],next=work[index],left=all.indexOf(previous),right=all.indexOf(next),support=left>=0&&right>=0&&all.slice(left+1,right).some(row=>row.kind==='support');
        transitions.push({date:record.date,previousStrong:cascadeState(previous)==='strong',support,nextStrong:cascadeState(next)==='strong'});
      }
    });
    const baseline=pct(transitions.filter(row=>row.nextStrong).length,transitions.length)??50,value=row=>row.nextStrong?100:0,weight=()=>1;
    const groups=[transitions.filter(row=>!row.previousStrong&&row.support),transitions.filter(row=>!row.previousStrong&&!row.support),transitions.filter(row=>row.previousStrong&&row.support),transitions.filter(row=>row.previousStrong&&!row.support)];
    const cells=interactionCells(groups,value,weight,baseline);
    return interactionDifference('Previous result × support break','previous-support',cells,effect=>`A support break changed next-block recovery after a non-strong block by ${Math.abs(round(effect,1))} points ${effect>=0?'more favourably':'less favourably'} than it changed continuation after a strong block.`,{stability:interactionStability(groups,value,weight,baseline)});
  }
  function computeRestrainedInteractions(evidence,daily,detail=true){
    const tests=[...computeAreaTimeInteractions(evidence),computePositionWorkloadInteraction(evidence,daily),computePreviousSupportInteraction(evidence)];
    const ranked=tests.filter(test=>test.meaningful).sort((a,b)=>Math.abs(b.effect)-Math.abs(a.effect)),candidates=deduplicateInteractionCandidates(ranked),shown=selectDiverseInteractions(candidates,2);
    const observations=sum(tests.map(test=>sum(Object.values(test.cells||{}).map(cell=>num(cell&&cell.rows)))));
    return {ready:candidates.length>0,tests:detail?tests:[],candidates:detail?candidates:[],shown,...(detail?{}:{observations}),minimumCellRows:MIN_INTERACTION_CELL_ROWS,minimumCellDays:MIN_INTERACTION_CELL_DAYS,minimumEffect:MIN_INTERACTION_EFFECT_POINTS,minimumStabilityEffect:MIN_INTERACTION_STABILITY_EFFECT_POINTS,reason:candidates.length?'Only distinct interactions clearing four-cell evidence, effect-size, and repeated-period stability gates are retained; mirrored descriptions are collapsed before ranking.':'No tested combination was both sufficiently large and stable across the early and late evidence halves.'};
  }
  function computeStudyDynamics(model,evidence,historyMeta={},detail=true){
    const bayesian=computeBayesianPatterns(evidence,model,detail);
    const changePoint=computeCompletionChangePoint(model.daily,detail);
    const allocation=computeAllocationConcentration(model,detail);
    allocation.dynamic=computeDynamicAllocation(evidence,model&&model.currentStudyDate,detail,model&&model.trendBasis);
    const cascade=computeExecutionCascade(evidence,detail);
    const interactions=computeRestrainedInteractions(evidence,model.daily,detail);
    const interactionObservations=detail?sum((interactions.tests||[]).map(test=>sum(Object.values(test.cells||{}).map(cell=>num(cell&&cell.rows))))):num(interactions.observations);
    const performanceState=historyMeta.fitness&&historyMeta.fitness.performanceState||null;
    const workload=computeWorkloadFrontier(model.daily,performanceState,detail);
    const completionDays=Math.max(0,num(model&&model.advanced&&model.advanced.completionDayCount));
    return {
      history:Object.freeze({
        mode:historyMeta.capped?'bounded-two-year-model':'all-admitted-data',records:Math.max(0,num(historyMeta.records)),workBlocks:Math.max(0,num(historyMeta.workBlocks)),
        start:isIsoDate(historyMeta.start)?historyMeta.start:null,end:isIsoDate(historyMeta.end)?historyMeta.end:null,
        modelRecords:Math.max(0,num(historyMeta.modelRecords)),modelStart:isIsoDate(historyMeta.modelStart)?historyMeta.modelStart:null,
        modelEnd:isIsoDate(historyMeta.modelEnd)?historyMeta.modelEnd:null,horizonDays:Math.max(0,num(historyMeta.horizonDays)),capped:!!historyMeta.capped
      }),
      bayesian:withEvidenceMetadata(bayesian,{observations:evidence&&evidence.work&&evidence.work.length,days:completionDays,method:'hierarchical-completion-patterns',limitations:bayesian.readyDimensions?[]:['No dimension has cleared the hierarchy evidence gate.']}),
      changePoint:withEvidenceMetadata(changePoint,{confidence:changePoint.confidence,observations:changePoint.days,days:changePoint.days,method:'bayesian-online-change-point',limitations:changePoint.reason?[changePoint.reason]:[]}),
      allocation:withEvidenceMetadata(allocation,{confidence:allocation.confidence,observations:allocation.areas,days:completionDays,method:'jensen-shannon-plus-weekly-drift',limitations:allocation.reason?[allocation.reason]:[]}),
      cascade:withEvidenceMetadata(cascade,{confidence:cascade.confidence,observations:cascade.transitions,days:cascade.daysWithWork,method:'regularised-sequence-and-hazard',limitations:cascade.reason?[cascade.reason]:[]}),
      interactions:withEvidenceMetadata(interactions,{observations:interactionObservations,days:completionDays,method:'gated-four-cell-interactions',limitations:interactions.ready?[]:[interactions.reason]}),
      workload:withEvidenceMetadata(workload,{confidence:workload.confidence,observations:workload.days,days:workload.days,method:workload.method||'regularised-workload-response',limitations:[workload.reason,workload.strongReason].filter(Boolean)})
    };
  }
    return Object.freeze({
      computeStudyDynamics
    });
  })(InsightsConfig,InsightsPrimitives,InsightsAnalytics);

  // M8.8 COACH COMPONENT
  const InsightsCoach=((Config,Primitives,PacerEvidence)=>{
    const {
      COACH_CONFIDENCE_RANK,COACH_MATERIAL_CONCERN_MARGIN,COACH_SIGNAL_LIMIT,COACH_SURFACES,
      COACH_SYNTHESIS_LIMIT,COACH_VISIBLE_SIGNAL_LIMIT,FITNESS_LOW_STATE_MAX_STALENESS_DAYS,
      FITNESS_LOW_STATE_THRESHOLD,FITNESS_LOW_STATE_UPPER_BOUND,MIN_ALLOCATION_EVIDENCE_COMPLETED,
      MIN_ALLOCATION_EVIDENCE_PLANNED,MIN_BLOCKS_FOR_SIGNAL,MIN_DYNAMIC_ALIGNMENT_GAP_POINTS,
      MIN_EVIDENCE_EFFECT_POINTS,MIN_MEANINGFUL_DIFFERENCE_POINTS,MIN_PRACTICE_PATTERN_UNITS,
      MIN_RECORDS_FOR_COACH_TREND,MIN_TIMER_COVERAGE_FOR_PLAN_READ
    }=Config;
    const {
      confidenceAtLeast,descriptiveEvidenceConfidence,labelCompare,minutesLabel,num,numberLabel,pct,percentLabel,
      round,shortDate,signedMinutesLabel,sum
    }=Primitives;
    const {
      practicePacerReading
    }=PacerEvidence;
  function computeMilestones(modelBase){
    const days=Math.max(1,modelBase.recordCount||0);
    const completionDays=Math.max(0,num(modelBase.advanced&&modelBase.advanced.completionDayCount));
    const actualAvg=modelBase.recordCount?modelBase.overview.actual/days:0;
    const planGapAvg=modelBase.recordCount?modelBase.overview.actualVsPlanned/days:0;
    const totalGap=modelBase.overview.actualVsPlanned;
    return [
      {label:'Study streak',value:`${modelBase.streak.current}d`,note:`${modelBase.streak.dayCount||0} activity-evidenced day${modelBase.streak.dayCount===1?'':'s'} in ${modelBase.windowLabel||'selected window'} · best ${modelBase.streak.longest}d`},
      {label:'Strong days',value:`${modelBase.overview.strongDays}/${completionDays}`,note:`80%+ work completion on eligible days · descriptive benchmark · ${Math.max(0,modelBase.recordCount-completionDays)} no-work saved day${Math.max(0,modelBase.recordCount-completionDays)===1?'':'s'} excluded.`},
      {label:'Actual focus / day',value:minutesLabel(actualAvg),note:`Average per saved day. Total tracked: ${minutesLabel(modelBase.overview.actual)}.`},
      {label:'Plan gap / day',value:signedMinutesLabel(planGapAvg),note:`Tracked focus minus planned work; read with ${percentLabel(modelBase.sampleAudit&&modelBase.sampleAudit.timerPlannedCoverage)} Timer coverage. Total gap: ${signedMinutesLabel(totalGap)}.`}
    ];
  }
  function coachSurfaceForDomain(domain){
    const key=String(domain||'performance');
    if(['output','planning'].includes(key))return 'output';
    if(['start','schedule','friction','execution','pacer'].includes(key))return 'execution';
    if(['coverage','areas'].includes(key))return 'areas';
    if(key==='fitness')return 'fitness';
    if(key==='dynamics')return 'dynamics';
    return 'performance';
  }
  function coachThemeFor(domain,topic){
    const d=String(domain||'performance'),t=String(topic||d);
    if(d==='pacer')return 'timed-practice-pacing';
    if(['coverage','areas'].includes(d)||['coverage','area-completion','allocation','allocation-gap'].includes(t))return 'area-coverage-and-allocation';
    if(d==='planning'||t==='workload')return 'plan-realism';
    if(['start','schedule'].includes(d)||['start-rhythm','schedule'].includes(t))return 'schedule-control';
    if(d==='friction'||['friction','cascade'].includes(t))return 'focus-friction-and-recovery';
    if(t==='evidence')return 'evidence-quality';
    return 'output-direction';
  }
  function pushSignal(list,text,tag='Insight',tone='quiet',meta={}){
    const kind=['concern','positive','context'].includes(meta.kind)?meta.kind:'context';
    const domain=String(meta.domain||'performance');
    const topic=String(meta.topic||domain);
    const surface=String(meta.surface||coachSurfaceForDomain(domain));
    const confidence=meta.confidence&&typeof meta.confidence==='object'?meta.confidence:null;
    list.push({
      text,tag,tone,
      _domain:domain,
      _surface:surface,
      _surfaceLabel:String(meta.surfaceLabel||''),
      _targetId:String(meta.targetId||''),
      _topic:topic,
      _theme:String(meta.theme||coachThemeFor(domain,topic)),
      _kind:kind,
      _priority:Math.max(0,num(meta.priority)),
      _confidence:confidence,
      _confidenceRank:confidence?num(COACH_CONFIDENCE_RANK[confidence.key],0):0,
      _compact:meta.compact!==false,
      _order:list.length
    });
  }
  function coachSignalOrder(left,right){
    const kindRank={concern:3,positive:2,context:1};
    return num(kindRank[right._kind])-num(kindRank[left._kind])||
      num(right._priority)-num(left._priority)||
      num(right._confidenceRank)-num(left._confidenceRank)||
      num(left._order)-num(right._order);
  }
  function publicCoachSignal(signal){
    const surface=COACH_SURFACES.find(item=>item.key===signal._surface)||COACH_SURFACES[1],confidence=signal._confidence;
    return {
      text:signal.text||'',tag:signal.tag||'Insight',tone:signal.tone||'quiet',kind:signal._kind||'context',domain:signal._domain||'performance',topic:signal._topic||'insight',theme:signal._theme||'output-direction',
      surfaceKey:surface.key,surfaceLabel:signal._surfaceLabel||surface.label,targetId:signal._targetId||surface.targetId,confidenceLabel:confidence&&confidence.label||null,confidenceTone:confidence&&confidence.tone||'quiet'
    };
  }
  function coachDiversityKey(signal){return signal._domain==='pacer'?'execution:pacer':String(signal._surface||'performance');}
  function coachThemeRepresentatives(signals){
    const groups=new Map();
    (Array.isArray(signals)?signals:[]).forEach(signal=>{
      const key=String(signal._theme||'output-direction');
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(signal);
    });
    return [...groups.values()].map(group=>{
      const ordered=group.slice().sort(coachSignalOrder),dominant=ordered[0];
      const opposing=ordered.find(signal=>
        signal!==dominant&&
        signal._confidenceRank>=COACH_CONFIDENCE_RANK.emerging&&
        dominant._confidenceRank>=COACH_CONFIDENCE_RANK.emerging&&
        ((signal._kind==='positive'&&dominant._kind==='concern')||(signal._kind==='concern'&&dominant._kind==='positive'))&&
        Math.abs(num(signal._priority)-num(dominant._priority))<=COACH_MATERIAL_CONCERN_MARGIN
      );
      if(!opposing)return dominant;
      const positive=dominant._kind==='positive'?dominant:opposing;
      const concern=dominant._kind==='concern'?dominant:opposing;
      const weaker=num(positive._confidenceRank)<=num(concern._confidenceRank)?positive:concern;
      return {...dominant,
        text:`Mixed evidence: ${positive.tag} is favourable, while ${concern.tag} points the other way. Keep watching before changing the plan.`,
        tag:'Mixed signal',tone:'quiet',_topic:`mixed:${dominant._theme}`,
        _confidence:weaker._confidence,_confidenceRank:weaker._confidenceRank,
        _priority:Math.max(num(dominant._priority),num(opposing._priority))
      };
    });
  }
  function rankCoachSignals(signals,limit=COACH_SIGNAL_LIMIT){
    const eligible=(Array.isArray(signals)?signals:[]).filter(signal=>signal._compact!==false&&signal._confidenceRank>=COACH_CONFIDENCE_RANK.emerging);
    const ordered=coachThemeRepresentatives(eligible).sort(coachSignalOrder);
    const primary=ordered.find(signal=>signal._kind==='concern')||ordered[0];
    if(!primary)return [];
    const chosen=[primary],diversityKeys=new Set([coachDiversityKey(primary)]),topics=new Set([primary._topic]);
    for(const signal of ordered){
      if(chosen.length>=limit)break;
      const diversityKey=coachDiversityKey(signal);
      if(signal===primary||diversityKeys.has(diversityKey)||topics.has(signal._topic))continue;
      chosen.push(signal);diversityKeys.add(diversityKey);topics.add(signal._topic);
    }
    for(const signal of ordered){
      if(chosen.length>=limit)break;
      if(chosen.includes(signal)||topics.has(signal._topic))continue;
      chosen.push(signal);topics.add(signal._topic);
    }
    const pacer=ordered.find(signal=>signal._domain==='pacer'&&signal._confidenceRank>=COACH_CONFIDENCE_RANK.emerging&&signal._kind!=='context');
    if(pacer&&!chosen.includes(pacer)){
      const replaceable=chosen.map((signal,index)=>({signal,index})).filter(row=>row.index>0&&row.signal._kind!=='concern').sort((a,b)=>coachSignalOrder(b.signal,a.signal));
      if(chosen.length<limit)chosen.push(pacer);
      else if(replaceable.length)chosen[replaceable[0].index]=pacer;
    }
    return chosen.slice(0,limit).map(publicCoachSignal);
  }
  function coachSurfaceFallback(model,surface){
    const guardrail=model&&model.guardrails&&model.guardrails.sample||{label:'Low sample',tone:'low'};
    const base={
      tag:'No clear signal',tone:'quiet',kind:'context',surfaceKey:surface.key,surfaceLabel:surface.label,targetId:surface.targetId,
      confidenceLabel:'No qualifying signal',confidenceTone:'low'
    };
    if(surface.key==='fitness')return {...base,confidenceLabel:'No usable state evidence',text:'No usable Output state or component-state estimate is available from the all-history evidence.'};
    if(surface.key==='performance'){
      const eligible=num(model&&model.advanced&&model.advanced.completionDayCount),strong=num(model&&model.overview&&model.overview.strongDays);
      const rated=num(model&&model.advanced&&model.advanced.qualityPairCount);
      return {...base,confidenceLabel:guardrail.label||'Descriptive sample',confidenceTone:guardrail.tone||'quiet',text:`The selected window has ${strong}/${eligible} completion-eligible days at 80%+ work completion and ${rated} rated day${rated===1?'':'s'}. No additional performance finding cleared the coaching gates.`};
    }
    if(surface.key==='output'){
      const completion=model&&model.overview&&Number.isFinite(model.overview.completion)?percentLabel(model.overview.completion,1):'unavailable';
      const days=num(model&&model.advanced&&model.advanced.completionDayCount);
      const stability=model&&model.advanced&&model.advanced.outputStability&&model.advanced.outputStability.label||'not established';
      return {...base,confidenceLabel:guardrail.label||'Descriptive sample',confidenceTone:guardrail.tone||'quiet',text:`Window work completion is ${completion} across ${days} completion-eligible day${days===1?'':'s'}; output stability is ${String(stability).toLowerCase()}. No additional output concern cleared the coaching gates.`};
    }
    if(surface.key==='execution'){
      const practiceUnits=num(model&&model.practice&&model.practice.units);
      const paceText=practiceUnits?` Practice Pacing has ${practiceUnits} completed unit${practiceUnits===1?'':'s'}, but no additional mature pace finding qualified.`:' No completed Practice Pacer evidence is available.';
      return {...base,confidenceLabel:'No qualifying execution pattern',text:`No daily-execution pattern cleared the coaching gates in this window.${paceText}`};
    }
    if(surface.key==='areas')return {...base,confidenceLabel:'No qualifying area signal',text:'No top-level area currently produces an evidence-qualified Coverage Watch, allocation, or completion takeaway.'};
    return {...base,confidenceLabel:'No qualifying model signal',text:'No uncertainty-aware Study Dynamics pattern cleared the effect-size and evidence gates.'};
  }
  function coachSurfaceTakeaways(model,signals,coachSignals=[]){
    const source=Array.isArray(signals)?signals:[];
    const represented=new Set((Array.isArray(coachSignals)?coachSignals:[]).map(signal=>signal&&signal.surfaceKey).filter(Boolean));
    const usedTopics=new Set((Array.isArray(coachSignals)?coachSignals:[]).map(signal=>signal&&signal.topic).filter(Boolean));
    const usedThemes=new Set((Array.isArray(coachSignals)?coachSignals:[]).map(signal=>signal&&signal.theme).filter(Boolean));
    const rows=COACH_SURFACES.filter(surface=>!represented.has(surface.key)).map((surface,index)=>{
      const candidates=source.filter(signal=>signal._surface===surface.key&&!usedTopics.has(signal._topic)&&!usedThemes.has(signal._theme)).slice().sort(coachSignalOrder);
      const selected=candidates[0]||null;
      if(selected){usedTopics.add(selected._topic);usedThemes.add(selected._theme);}
      return {index,selected,public: selected?publicCoachSignal(selected):coachSurfaceFallback(model,surface)};
    });
    rows.sort((left,right)=>{
      if(left.selected&&right.selected)return coachSignalOrder(left.selected,right.selected);
      if(left.selected)return -1;
      if(right.selected)return 1;
      return left.index-right.index;
    });
    return rows.slice(0,COACH_SYNTHESIS_LIMIT).map(row=>row.public);
  }
  function hasBestSubjectEvidence(subject){
    return !!subject&&num(subject.blocks)>=3&&(num(subject.planned)>=90||num(subject.actual)>=60);
  }
  function coachAreaAllocationGap(model){
    const rows=(model&&Array.isArray(model.subjects)?model.subjects:[]).filter(row=>num(row.planned)>0||num(row.completed)>0);
    const totalPlanned=sum(rows.map(row=>row.planned)),totalCompleted=sum(rows.map(row=>row.completed));
    if(rows.length<2||totalPlanned<MIN_ALLOCATION_EVIDENCE_PLANNED||totalCompleted<MIN_ALLOCATION_EVIDENCE_COMPLETED)return null;
    const shares=rows.map(row=>({
      label:row.label,
      gap:round((num(row.completed)/totalCompleted-num(row.planned)/totalPlanned)*100,1)
    }));
    const under=shares.slice().sort((a,b)=>a.gap-b.gap||String(a.label).localeCompare(String(b.label)))[0];
    const over=shares.slice().sort((a,b)=>b.gap-a.gap||String(a.label).localeCompare(String(b.label)))[0];
    const effect=Math.max(Math.abs(num(under&&under.gap)),Math.abs(num(over&&over.gap)));
    if(effect<MIN_DYNAMIC_ALIGNMENT_GAP_POINTS)return null;
    return {under,over,effect,confidence:descriptiveEvidenceConfidence(model.advanced.completionDayCount,totalCompleted)};
  }
  function pushFitnessCoachSignal(signals,model){
    const fitness=model.fitness||{};
    const performance=fitness.performanceState||{};
    const state=performance.current;
    if(!state)return;
    const trajectory=performance.trajectory||{};
    const confidence=fitness.readiness||performance.confidence;
    const recentEnough=!Number.isFinite(performance.daysSinceLastEvidence)||performance.daysSinceLastEvidence<=FITNESS_LOW_STATE_MAX_STALENESS_DAYS;
    const reliablyLow=recentEnough&&confidenceAtLeast(confidence,'reliable')&&num(state.estimate)>=0&&state.estimate<FITNESS_LOW_STATE_THRESHOLD&&Number.isFinite(state.high)&&state.high<FITNESS_LOW_STATE_UPPER_BOUND;
    const falling=trajectory.key==='falling';
    const positive=['rising','recovering'].includes(trajectory.key);
    const stateText=fitness.summary&&fitness.summary.stateText||percentLabel(state.estimate,1);
    if(falling){
      pushSignal(signals,`Output state is falling at ${stateText}.`,trajectory.label||'Falling state','watch',{
        domain:'fitness',surface:'fitness',topic:'trajectory',kind:'concern',priority:98,confidence,compact:confidenceAtLeast(confidence,'emerging')
      });
      return;
    }
    if(reliablyLow){
      pushSignal(signals,`Output state is persistently low at ${stateText}; even the upper model range remains below ${FITNESS_LOW_STATE_UPPER_BOUND}%.`, 'Low current state','watch',{
        domain:'fitness',surface:'fitness',topic:'fitness-low-state',kind:'concern',priority:96,confidence,compact:true
      });
      return;
    }
    if(positive){
      pushSignal(signals,`Output state is ${trajectory.label.toLowerCase()} at ${stateText}.`,trajectory.label||'Current state','good',{
        domain:'fitness',surface:'fitness',topic:'trajectory',kind:'positive',priority:58,confidence,compact:confidenceAtLeast(confidence,'emerging')
      });
      return;
    }
    pushSignal(signals,`Output state is ${trajectory.label.toLowerCase()} at ${stateText}.`,trajectory.label||'Current state','quiet',{
      domain:'fitness',surface:'fitness',topic:'fitness-state',kind:'context',priority:34,confidence,compact:false
    });
  }
  function pushPacerCoachSignal(signals,model){
    const practice=model&&model.practice||{};
    if(!num(practice.units))return;
    const reading=practice.coachReading||practice.reading||practicePacerReading(practice);
    const concern=reading.kind==='concern'||reading.tone==='watch';
    const positive=reading.kind==='positive'||reading.tone==='strong'||reading.tone==='good';
    const kind=concern?'concern':positive?'positive':'context';
    const confidence=reading.confidence||practice.maturity&&practice.maturity.confidence||{key:'weak',label:'Early pace evidence',tone:'low'};
    const confidencePriority=confidence.key==='reliable'?116:confidence.key==='emerging'?112:106;
    const severe=num(practice.medianRunPace)>125||practice.plannedUnits>=MIN_PRACTICE_PATTERN_UNITS&&(num(practice.plannedRunCompletionMedian)<60||num(practice.completedPlannedRunRate)<50);
    pushSignal(signals,reading.text,reading.tag||'Practice Pacer',reading.tone||'quiet',{
      domain:'pacer',surface:'execution',surfaceLabel:'Execution · Practice Pacing',targetId:'insights-practice',topic:reading.topic||'pacer',kind,
      priority:concern?Math.min(120,confidencePriority+(severe?4:0)):positive?66:24,confidence,
      compact:practice.patternReady&&kind!=='context'
    });
  }
  function pushDynamicsCoachSignals(signals,model){
    const dynamics=model&&model.dynamics||{};
    const change=dynamics.changePoint||{};
    if(change.detected&&confidenceAtLeast(change.confidence,'emerging')){
      const improving=num(change.delta)>0;
      pushSignal(signals,`From ${shortDate(change.date)} onward, daily work completion shifted ${improving?'up':'down'} from ${percentLabel(change.beforeMean,1)} to ${percentLabel(change.afterMean,1)}. This identifies a change in the recorded performance phase, not its cause.`,'Regime change',improving?'good':'watch',{
        domain:'dynamics',surface:'dynamics',topic:'trajectory',kind:improving?'positive':'concern',priority:improving?70:104,confidence:change.confidence
      });
    }
    const workload=dynamics.workload||{};
    if(workload.ready&&workload.tradeoff&&confidenceAtLeast(workload.confidence,'emerging')){
      const trade=workload.tradeoff;
      const strongPart=Number.isFinite(trade.reliabilityDrop)?` and ${trade.reliabilityDrop} strong-day points`:'';
      pushSignal(signals,`At ${minutesLabel(trade.high.planned)} planned work, the workload curve is ${trade.completionDrop} completion points${strongPart} below the lower-load comparison. Treat this as a workload warning, not causal proof.`,'Workload trade-off','watch',{
        domain:'dynamics',surface:'dynamics',topic:'workload',kind:'concern',priority:108,confidence:workload.confidence
      });
    }else if(workload.forecast&&workload.forecast.completionReady&&confidenceAtLeast(workload.confidence,'emerging')){
      const forecast=workload.forecast;
      const strongPart=forecast.strongReady?` and a ${percentLabel(forecast.strongProbability,1)} chance of an 80%+ day`:'';
      pushSignal(signals,`The ${minutesLabel(forecast.scenarioPlanned)} next-plan scenario estimates ${percentLabel(forecast.completionMean,1)} completion (${percentLabel(forecast.completionLow,0)}–${percentLabel(forecast.completionHigh,0)} ${forecast.rangeReady?'backtest-checked 80% range':'estimated model range'})${strongPart}.`,'Next-plan forecast','quiet',{
        domain:'dynamics',surface:'dynamics',topic:'workload',kind:'context',priority:56,confidence:workload.confidence,compact:false
      });
    }else if(workload.ready&&workload.recommendation&&confidenceAtLeast(workload.confidence,'emerging')){
      const recommendation=workload.recommendation;
      pushSignal(signals,`The workload curve's realistic region is ${minutesLabel(recommendation.minPlanned)}–${minutesLabel(recommendation.maxPlanned)}. Past-day forecast checks are still pending, so this remains historical workload evidence rather than next-day guidance.`,'Planning range','quiet',{
        domain:'dynamics',surface:'dynamics',topic:'workload',kind:'context',priority:50,confidence:workload.confidence,compact:false
      });
    }
    const cascade=dynamics.cascade||{};
    if(cascade.ready&&cascade.primary&&confidenceAtLeast(cascade.primary.confidence,'emerging')){
      const terminal=String(cascade.primary.text||'').toLowerCase().includes('terminal-collapse');
      const negative=terminal||num(cascade.primary.effect)<-MIN_EVIDENCE_EFFECT_POINTS;
      const positive=!negative&&num(cascade.primary.effect)>=MIN_EVIDENCE_EFFECT_POINTS;
      pushSignal(signals,cascade.primary.text,'Execution cascade',negative?'watch':positive?'good':'quiet',{
        domain:'dynamics',surface:'dynamics',topic:'cascade',kind:negative?'concern':positive?'positive':'context',priority:negative?94:positive?54:34,confidence:cascade.primary.confidence,
        compact:negative||positive
      });
    }
    const allocation=dynamics.allocation||{};
    if(allocation.ready&&num(allocation.divergence)>.02&&confidenceAtLeast(allocation.confidence,'emerging')){
      const shifts=[];
      if(allocation.topOver)shifts.push(`${allocation.topOver.label} ${allocation.topOver.gap>0?'+':''}${allocation.topOver.gap} share pts`);
      if(allocation.topUnder)shifts.push(`${allocation.topUnder.label} ${allocation.topUnder.gap} share pts`);
      const concern=num(allocation.divergence)>.08;
      pushSignal(signals,`${allocation.label}. ${shifts.length?`Largest movements: ${shifts.join('; ')}.`:'Completed work moved away from the planned area mix.'}`,'Allocation dynamics',concern?'watch':'quiet',{
        domain:'dynamics',surface:'dynamics',topic:'allocation',kind:concern?'concern':'context',priority:concern?82:38,confidence:allocation.confidence,compact:concern
      });
    }
    const bayesian=dynamics.bayesian||{};
    const clearest=bayesian.clearest;
    if(clearest&&clearest.meaningful&&confidenceAtLeast(clearest.estimate&&clearest.estimate.confidence,'emerging')){
      const positive=num(clearest.effect)>0;
      pushSignal(signals,`${clearest.label} is the clearest hierarchically pooled ${String(clearest.dimension||'completion pattern').toLowerCase()}: ${Math.abs(num(clearest.effect))} points ${positive?'above':'below'} its learned population mean.`,'Completion pattern',positive?'good':'watch',{
        domain:'dynamics',surface:'dynamics',topic:'pattern',kind:positive?'positive':'concern',priority:positive?48:72,confidence:clearest.estimate.confidence
      });
    }
  }
  function selectSignals(model){
    const signals=[];
    const delaySignalRows=(model.startDelays||[]).filter(b=>b.blocks>=MIN_BLOCKS_FOR_SIGNAL&&Number.isFinite(num(b.completion,null)));
    const bestDelay=delaySignalRows.slice().sort((a,b)=>num(b.completion)-num(a.completion)||b.blocks-a.blocks||String(a.id).localeCompare(String(b.id)))[0];
    const weakDelay=delaySignalRows.length>=2?delaySignalRows.slice().sort((a,b)=>num(a.completion)-num(b.completion)||b.blocks-a.blocks||String(a.id).localeCompare(String(b.id)))[0]:null;
    const lateDelay=(model.startDelays||[]).filter(b=>b.blocks>=MIN_BLOCKS_FOR_SIGNAL&&String(b.id).includes('late')).sort((a,b)=>num(a.completion)-num(b.completion)||b.blocks-a.blocks||String(a.id).localeCompare(String(b.id)))[0];
    const bestSubject=model.subjects.filter(hasBestSubjectEvidence).sort((a,b)=>num(b.completion)-num(a.completion)||b.blocks-a.blocks||num(b.planned)-num(a.planned)||labelCompare(a,b))[0];
    const weakSubject=model.subjects.filter(s=>(s.blocks>=2||s.windowAbsent)&&num(s.coverageWatchScore)>=35).sort((a,b)=>num(b.coverageWatchScore)-num(a.coverageWatchScore)||num(b.allocationScore)-num(a.allocationScore)||num(a.coverageCompletion)-num(b.coverageCompletion)||labelCompare(a,b))[0];
    const areaAllocation=coachAreaAllocationGap(model);
    const actualPlanRatio=model.overview.planned>0?model.overview.actual/model.overview.planned:null;
    const rawTimerCoverage=model.sampleAudit&&model.sampleAudit.timerPlannedCoverage;
    const timerCoverage=rawTimerCoverage===null||rawTimerCoverage===undefined?null:Number(rawTimerCoverage);
    const delayDifference=bestDelay&&weakDelay?Math.round(num(bestDelay.completion)-num(weakDelay.completion)):0;
    if(model.advanced.trendCompletionDayCount>=MIN_RECORDS_FOR_COACH_TREND&&model.advanced.completionSlopePerWeek!==null&&Math.abs(model.advanced.completionSlopePerWeek)>=3){
      const rising=model.advanced.completionSlopePerWeek>0;
      const trendBasis=String(model.trendBasis&&model.trendBasis.label||model.windowLabel||'selected window').toLowerCase();
      pushSignal(signals,rising
        ? `Across the ${trendBasis}, your work-completion trend is rising by about ${model.advanced.completionSlopePerWeek} points per week. Protect whatever routine is creating that lift.`
        : `Across the ${trendBasis}, your work-completion trend is slipping by about ${Math.abs(model.advanced.completionSlopePerWeek)} points per week. Simplify the next plan before trying to push harder.`,
        rising?'Improving':'Watch',rising?'good':'watch',{
          domain:'output',kind:rising?'positive':'concern',
          topic:'trajectory',priority:(rising?38:82)+Math.min(rising?12:15,Math.abs(model.advanced.completionSlopePerWeek)),confidence:model.guardrails.trend
        });
    }
    if(model.advanced.completionDayCount>=5&&model.advanced.outputStability&&model.advanced.outputStability.label==='Volatile'){
      pushSignal(signals,`Work completion is volatile across ${model.advanced.completionDayCount} eligible days (${model.advanced.completionSd} point variability). Make the next plan easier to repeat before treating a good day as the new baseline.`,'Output stability','watch',{
        domain:'output',topic:'stability',kind:'concern',priority:74+Math.min(14,num(model.advanced.completionSd)/3),confidence:model.guardrails.sample
      });
    }else if(model.advanced.completionDayCount>=5&&model.advanced.outputStability&&model.advanced.outputStability.label==='Stable'&&num(model.overview.completion)>=80){
      pushSignal(signals,`Work completion is both strong (${percentLabel(model.overview.completion,1)}) and stable across ${model.advanced.completionDayCount} eligible days. Preserve the current planning rhythm.`,'Output stability','good',{
        domain:'output',topic:'stability',kind:'positive',priority:42,confidence:model.guardrails.sample
      });
    }
    if(model.recordCount>=MIN_RECORDS_FOR_COACH_TREND&&timerCoverage>=MIN_TIMER_COVERAGE_FOR_PLAN_READ&&model.advanced.plannedSlopePerWeek!==null&&model.advanced.actualSlopePerWeek!==null&&model.advanced.plannedSlopePerWeek>45&&model.advanced.actualSlopePerWeek<15){
      pushSignal(signals,`Your planned study load is rising faster than actual focus. Keep the next few days realistic before increasing load.`,'Planning load','watch',{domain:'planning',topic:'workload',kind:'concern',priority:92,confidence:model.guardrails.sample});
    }else if(model.recordCount>=MIN_RECORDS_FOR_COACH_TREND&&model.advanced.trendCompletionDayCount>=MIN_RECORDS_FOR_COACH_TREND&&timerCoverage>=MIN_TIMER_COVERAGE_FOR_PLAN_READ&&model.advanced.actualSlopePerWeek!==null&&model.advanced.completionSlopePerWeek!==null&&model.advanced.actualSlopePerWeek>30&&model.advanced.completionSlopePerWeek<0){
      pushSignal(signals,`Actual study time is rising, but work-completion reliability is falling. More time may be adding friction instead of clarity.`,'Trade-off','watch',{domain:'output',topic:'workload',kind:'concern',priority:110,confidence:model.guardrails.trend});
    }else if(actualPlanRatio!==null&&actualPlanRatio<0.75&&model.recordCount>=3&&timerCoverage>=MIN_TIMER_COVERAGE_FOR_PLAN_READ&&num(model.overview.completion)<80){
      pushSignal(signals,`You are tracking less actual focus than the plan assumes. A smaller plan may produce a cleaner win-rate.`,'Planning load','watch',{domain:'planning',topic:'workload',kind:'concern',priority:76+Math.min(14,Math.max(0,.75-actualPlanRatio)*60),confidence:model.guardrails.sample});
    }
    if(delaySignalRows.length>=2&&bestDelay&&delayDifference>=MIN_MEANINGFUL_DIFFERENCE_POINTS)pushSignal(signals,`${bestDelay.label} starts have the clearest start-time pattern right now: ${percentLabel(bestDelay.completion)} work completion across ${bestDelay.blocks} blocks, ${Math.round(delayDifference)} points above the weakest sampled bucket.`,'Start timing','good',{domain:'start',topic:'start-rhythm',kind:'positive',priority:34+Math.min(12,delayDifference/2),confidence:model.guardrails.sample});
    if(weakSubject&&weakSubject.coverageWatchScore>=35){
      const tail=num(weakSubject.evidenceStrength)<.55?' Evidence is still thin.':'';
      const recency=weakSubject.neverStudied?'has no saved study-activity evidence':`was last studied ${weakSubject.daysSinceLast??0} day${weakSubject.daysSinceLast===1?'':'s'} ago`;
      const text=weakSubject.windowAbsent
        ? `${weakSubject.label} has no work blocks in this window. It is known from ${weakSubject.historicalDays} earlier saved allocation day${weakSubject.historicalDays===1?'':'s'}, ${recency}, and has ${weakSubject.allocation}.`
        : `${weakSubject.label} is the clearest Coverage Watch signal: score ${weakSubject.coverageWatchScore}, ${weakSubject.allocation}, ${percentLabel(weakSubject.coverageCompletion)} work completion, and ${recency}.${tail}`;
      pushSignal(signals,text,'Coverage watch','watch',{domain:'coverage',topic:'coverage',kind:'concern',priority:68+Math.min(20,num(weakSubject.coverageWatchScore)*.4)+(weakSubject.windowAbsent?8:0)+(num(weakSubject.evidenceStrength)>=.55?4:0),confidence:model.guardrails.sample});
    }
    if(areaAllocation){
      pushSignal(signals,`Compared with its planned share, ${areaAllocation.under.label} received ${numberLabel(Math.abs(areaAllocation.under.gap),1)} fewer completion-share points, while ${areaAllocation.over.label} received ${numberLabel(areaAllocation.over.gap,1)} more.`, 'Allocation gap','watch',{
        domain:'areas',surface:'areas',topic:'allocation-gap',kind:'concern',priority:88+Math.min(12,areaAllocation.effect/2),confidence:areaAllocation.confidence
      });
    }
    if(lateDelay&&lateDelay.completion<70&&bestDelay&&num(bestDelay.completion)-num(lateDelay.completion)>=MIN_MEANINGFUL_DIFFERENCE_POINTS){
      const tone=lateDelay.blocks<5?'quiet':'watch';
      pushSignal(signals,`${lateDelay.label} starts are linked with weaker work completion in the saved sample${lateDelay.blocks<5?', but the sample is still small. Treat it as volatile, not bad.':'.'}`,'Start delay',tone,{domain:'start',topic:'start-rhythm',kind:'concern',priority:58+Math.min(16,delayDifference*.5)+(lateDelay.blocks>=5?5:0),confidence:model.guardrails.sample});
    }else if(weakDelay&&weakDelay.id!==bestDelay?.id&&weakDelay.completion<70&&delayDifference>=MIN_MEANINGFUL_DIFFERENCE_POINTS){
      const tone=weakDelay.blocks<5?'quiet':'watch';
      pushSignal(signals,`${weakDelay.label} starts are the weakest start-rhythm bucket in the saved sample${weakDelay.blocks<5?', but the sample is still small. Treat it as volatile, not bad.':'.'}`,'Start rhythm',tone,{domain:'start',topic:'start-rhythm',kind:'concern',priority:56+Math.min(16,delayDifference*.5)+(weakDelay.blocks>=5?5:0),confidence:model.guardrails.sample});
    }
    const shiftedDays=num(model.schedule.shiftedDays),shiftedRate=model.recordCount?shiftedDays/model.recordCount*100:0;
    const averageShift=num(model.schedule.averageDailyPeakShiftOnShiftedDays);
    if(model.recordCount>=3&&shiftedDays>=2&&(shiftedRate>=15||averageShift>=30))pushSignal(signals,`Schedule movement appears on ${model.schedule.shiftedDays}/${model.recordCount} saved days; average largest movement on shifted days is ${minutesLabel(model.schedule.averageDailyPeakShiftOnShiftedDays)}.`,'Schedule','watch',{domain:'schedule',topic:'schedule',kind:'concern',priority:48+Math.min(20,shiftedRate*.4)+Math.min(10,averageShift/10),confidence:model.guardrails.sample});
    if(model.interruption.hasTimerEvidence&&num(model.interruption.interruptionRate)>=25)pushSignal(signals,`Focus friction is visible in ${percentLabel(model.interruption.interruptionRate)} of ${model.interruption.blockCount} Timer-backed work blocks after excluding accepted Pomodoro recovery. Worst affected: ${model.interruption.worstAffected||'not clear yet'}.`,'Focus friction','watch',{domain:'friction',topic:'friction',kind:'concern',priority:72+Math.min(22,num(model.interruption.interruptionRate)*.4),confidence:model.guardrails.sample});
    const eligibleDays=num(model.advanced&&model.advanced.completionDayCount),strongDays=num(model.overview&&model.overview.strongDays),strongRate=eligibleDays?pct(strongDays,eligibleDays):null;
    if(eligibleDays>=5&&Number.isFinite(strongRate)){
      if(strongRate<=25&&num(model.overview.completion)<70)pushSignal(signals,`${strongDays}/${eligibleDays} completion-eligible days reached the descriptive 80% strong-day threshold; aggregate work completion is ${percentLabel(model.overview.completion,1)}.`,'Training record','watch',{domain:'performance',topic:'training-record',kind:'concern',priority:64+Math.min(12,Math.max(0,25-strongRate)*.4),confidence:model.guardrails.sample});
      else if(strongRate>=60&&num(model.overview.completion)>=80)pushSignal(signals,`${strongDays}/${eligibleDays} completion-eligible days reached 80%+ work completion, with ${percentLabel(model.overview.completion,1)} aggregate completion.`,'Training record','good',{domain:'performance',topic:'training-record',kind:'positive',priority:40,confidence:model.guardrails.sample});
    }
    const qualityPairs=num(model.advanced&&model.advanced.qualityPairCount),qualityCorrelation=num(model.advanced&&model.advanced.qualityCompletionCorrelation,null);
    if(qualityPairs>=6&&Number.isFinite(qualityCorrelation)&&Math.abs(qualityCorrelation)>=.35){
      const positive=qualityCorrelation>0;
      pushSignal(signals,positive
        ? `Across ${qualityPairs} rated completion days, higher self-rated study quality has moved with higher work completion. Treat the link as descriptive, not causal.`
        : `Across ${qualityPairs} rated completion days, higher self-rated study quality has not moved with higher work completion. Review whether the rating and the plan are measuring different things.`,
      'Rated quality relationship',positive?'good':'watch',{domain:'quality',topic:'quality',kind:positive?'positive':'concern',priority:positive?36:60,confidence:descriptiveEvidenceConfidence(qualityPairs,model.overview.completed)});
    }
    if(bestSubject)pushSignal(signals,`${bestSubject.label} has the highest sufficiently sampled work completion: ${percentLabel(bestSubject.completion)} over ${bestSubject.blocks} blocks.`,'Highest sampled completion','good',{domain:'coverage',topic:'area-completion',kind:'positive',priority:30,confidence:model.guardrails.sample});
    pushFitnessCoachSignal(signals,model);
    pushPacerCoachSignal(signals,model);
    pushDynamicsCoachSignals(signals,model);
    if(!signals.length)pushSignal(signals,'Save a few days in Review and this page will start reading the daily-record pattern clearly.','Low sample','low',{domain:'performance',topic:'evidence',kind:'context',priority:10,confidence:model.guardrails.sample});
    const coach=rankCoachSignals(signals);
    const visibleCoach=coach.slice(0,COACH_VISIBLE_SIGNAL_LIMIT);
    return {
      bestDelay,weakDelay,bestSubject,weakSubject,
      coach,
      surfaces:coachSurfaceTakeaways(model,signals,visibleCoach),
      candidateCount:signals.length
    };
  }
    return Object.freeze({
      computeMilestones,hasBestSubjectEvidence,selectSignals
    });
  })(InsightsConfig,InsightsPrimitives,InsightsPacerEvidence);

  // M8.11 MODEL ENGINE COMPONENT
  const InsightsModelEngine=((Config,Primitives,Records,Analytics,PacerEvidence,StudyFitness,Dynamics,Coach)=>{
    const {
      DEFAULT_INSIGHT_WINDOW_KEY,DIRECTIONAL_TREND_HORIZON_DAYS,EVIDENCE_BASIS,PLUGIN_VERSION
    }=Config;
    const {
      dateDay,dateFromDay,isIsoDate,localIsoDate,mean,num,pct,round
    }=Primitives;
    const {
      filterCanonicalRecordsForInsightWindow,insightWindowByKey,normalizeRecords,normalizeRecordsAsync,normalizeSummaries,
      recordsRevisionKey,summariesRevisionKey
    }=Records;
    const {
      computeAdvanced,computeBlockOrder,computeCompletionSources,computeDailySeries,computeFocusFrictionSources,
      computeInterruption,computeKindSummary,computeOutcomes,computeProgressEvidence,computeQualityEvidence,
      computeResourceMix,computeSampleAudit,computeStartDelayBuckets,computeStreak,computeSubjects,
      computeSummaryStreak,createEvidenceIndex,progressEvidenceStrength,recordRows,rowsActual,rowsCompleted,rowsPlanned,
      sampleStrength,trendStrength
    }=Analytics;
    const {
      computePracticePacer
    }=PacerEvidence;
    const {
      compactFitnessResult,computeFitnessPerformanceState,computeScheduleSummary,computeStudyFitness
    }=StudyFitness;
    const {
      computeStudyDynamics
    }=Dynamics;
    const {
      computeMilestones,selectSignals
    }=Coach;
  function createDirectionalBasis(records,currentStudyDate,windowOption={}){
    const rows=Array.isArray(records)?records:[];
    const currentDay=isIsoDate(currentStudyDate)?dateDay(currentStudyDate):null;
    const latestRecordDay=rows.length?dateDay(rows[rows.length-1].date):null;
    const toDay=Number.isFinite(currentDay)&&Number.isFinite(latestRecordDay)
      ?Math.max(currentDay,latestRecordDay)
      :Number.isFinite(currentDay)?currentDay:latestRecordDay;
    const fromDay=Number.isFinite(toDay)?toDay-DIRECTIONAL_TREND_HORIZON_DAYS+1:null;
    const recordCount=Number.isFinite(fromDay)?rows.filter(record=>{const day=dateDay(record.date);return Number.isFinite(day)&&day>=fromDay&&day<=toDay;}).length:rows.length;
    const capped=recordCount<rows.length;
    return Object.freeze({
      key:capped?'latest-two-years':'selected-window',
      label:capped?'Latest 2 years':String(windowOption.summary||windowOption.label||'Selected window'),
      horizonDays:DIRECTIONAL_TREND_HORIZON_DAYS,fromDay,toDay,
      from:Number.isFinite(fromDay)?dateFromDay(fromDay):null,to:Number.isFinite(toDay)?dateFromDay(toDay):null,
      capped,recordCount,selectedRecordCount:rows.length
    });
  }
  function filterDailyForDirectionalBasis(daily,basis){
    if(!basis||!Number.isFinite(basis.fromDay)||!Number.isFinite(basis.toDay))return Array.isArray(daily)?daily:[];
    return (Array.isArray(daily)?daily:[]).filter(row=>Number.isFinite(row&&row.day)&&row.day>=basis.fromDay&&row.day<=basis.toDay);
  }
  function createAllHistoryContext(modelRecords,options,classifyTaskOutcome){
    const currentStudyDate=isIsoDate(options.currentStudyDate)?options.currentStudyDate:localIsoDate();
    const trendBasis=createDirectionalBasis(modelRecords,currentStudyDate,{summary:EVIDENCE_BASIS.history});
    const boundedRecords=Number.isFinite(trendBasis.fromDay)&&Number.isFinite(trendBasis.toDay)
      ?modelRecords.filter(record=>{const day=dateDay(record.date);return Number.isFinite(day)&&day>=trendBasis.fromDay&&day<=trendBasis.toDay;})
      :[];
    const modelEvidence=createEvidenceIndex(boundedRecords,classifyTaskOutcome);
    const modelDaily=computeDailySeries(modelEvidence);
    const modelTrendDaily=filterDailyForDirectionalBasis(modelDaily,trendBasis);
    const modelSubjects=computeSubjects(modelEvidence,currentStudyDate,options.subjectReferenceSummaries);
    const modelQuality=boundedRecords.map(record=>Number(record.studyQuality)).filter(value=>Number.isFinite(value)&&value>0);
    const dynamicsModel={
      windowLabel:'Latest 2 years',recordCount:boundedRecords.length,currentStudyDate,trendBasis,
      calendarRange:{start:boundedRecords[0]?.date||null,end:boundedRecords[boundedRecords.length-1]?.date||null},daily:modelDaily,
      overview:{
        planned:rowsPlanned(modelEvidence.work),completed:rowsCompleted(modelEvidence.work),actual:rowsActual(modelEvidence.work),
        completion:pct(rowsCompleted(modelEvidence.work),rowsPlanned(modelEvidence.work)),averageQuality:modelQuality.length?round(mean(modelQuality)):null
      },
      subjects:modelSubjects,advanced:computeAdvanced(modelDaily,modelTrendDaily),interruption:computeInterruption(modelEvidence),
      sampleAudit:computeSampleAudit(modelEvidence),schedule:computeScheduleSummary(boundedRecords)
    };
    const performanceState=computeFitnessPerformanceState(dynamicsModel,modelEvidence);
    const historyMeta={
      records:modelRecords.length,
      workBlocks:modelRecords.reduce((total,record)=>total+(Array.isArray(record&&record.tasks)?record.tasks.filter(task=>task&&task.kind==='work').length:0),0),
      start:modelRecords[0]?.date||null,end:modelRecords[modelRecords.length-1]?.date||null,
      modelRecords:boundedRecords.length,modelStart:boundedRecords[0]?.date||null,modelEnd:boundedRecords[boundedRecords.length-1]?.date||null,
      horizonDays:DIRECTIONAL_TREND_HORIZON_DAYS,capped:boundedRecords.length<modelRecords.length,
      fitness:{performanceState}
    };
    return Object.freeze({modelEvidence,dynamicsModel,performanceState,historyMeta});
  }
  function buildAllHistoryInsights(context,detail=false){
    const {modelEvidence,dynamicsModel,performanceState,historyMeta}=context;
    const dynamics=computeStudyDynamics(dynamicsModel,modelEvidence,historyMeta,detail);
    const fitness=computeStudyFitness({...dynamicsModel,dynamics},modelEvidence,{performanceState});
    return Object.freeze({dynamics,fitness:detail?fitness:compactFitnessResult(fitness)});
  }
  function buildInsightsFromCanonical(records,options,allHistory,classifyTaskOutcome,summarizePracticeRuns,reusable=null){
    const evidence=reusable&&reusable.evidence||createEvidenceIndex(records,classifyTaskOutcome);
    const work=evidence.work;
    const planned=reusable?.overview?.planned??rowsPlanned(work),completed=reusable?.overview?.completed??rowsCompleted(work),actual=reusable?.overview?.actual??rowsActual(work);
    const quality=reusable?.overview?null:records.map(r=>Number(r.studyQuality)).filter(v=>Number.isFinite(v)&&v>0);
    const currentStudyDate=isIsoDate(options.currentStudyDate)?options.currentStudyDate:localIsoDate();
    const windowEndDay=isIsoDate(options.windowTo)?dateDay(options.windowTo):null;
    const currentStudyDay=dateDay(currentStudyDate);
    const subjectReferenceDate=Number.isFinite(windowEndDay)&&Number.isFinite(currentStudyDay)
      ? dateFromDay(Math.max(windowEndDay,currentStudyDay))
      : Number.isFinite(windowEndDay)?dateFromDay(windowEndDay):currentStudyDate;
    const streakSummaries=normalizeSummaries(options.streakSummaries);
    const windowOption=insightWindowByKey(options.windowKey||(Number.isFinite(num(options.windowDays,null))?String(num(options.windowDays)):DEFAULT_INSIGHT_WINDOW_KEY));
    const trendBasis=createDirectionalBasis(records,currentStudyDate,windowOption);
    const analyticalRecords=trendBasis.capped
      ?records.filter(record=>{const day=dateDay(record.date);return Number.isFinite(day)&&day>=trendBasis.fromDay&&day<=trendBasis.toDay;})
      :records;
    const analyticalEvidence=analyticalRecords===records?evidence:createEvidenceIndex(analyticalRecords,classifyTaskOutcome);
    const daily=reusable&&analyticalEvidence===evidence&&reusable.daily?reusable.daily:computeDailySeries(analyticalEvidence);
    const trendDaily=reusable&&reusable.advanced?null:filterDailyForDirectionalBasis(daily,trendBasis);
    const strongDays=records.reduce((count,record)=>{
      const rows=recordRows(evidence,record,'work'),completion=pct(rowsCompleted(rows),rowsPlanned(rows));
      return count+(Number.isFinite(completion)&&Math.round(completion)>=80?1:0);
    },0);
    const allRecordCount=Number.isFinite(num(options.allRecordCount,null))?num(options.allRecordCount):records.length;
    const model={
      version:PLUGIN_VERSION,windowDays:Number.isFinite(num(options.windowDays,null))?num(options.windowDays):(windowOption.days||null),
      windowKey:windowOption.key,windowLabel:options.windowLabel||windowOption.summary,allRecordCount,recordCount:records.length,taskCount:work.length,currentStudyDate,trendBasis,
      dateRange:{start:records[0]?.date||null,end:records[records.length-1]?.date||null},
      calendarRange:{start:analyticalRecords[0]?.date||null,end:analyticalRecords[analyticalRecords.length-1]?.date||null},
      daily,
      overview:{planned,completed,actual,completion:pct(completed,planned),actualVsPlanned:actual-planned,strongDays,averageQuality:reusable?.overview?reusable.overview.averageQuality:(quality.length?round(quality.reduce((a,b)=>a+b,0)/quality.length):null)},
      streak:streakSummaries.length?computeSummaryStreak(streakSummaries,currentStudyDate):computeStreak(evidence,currentStudyDate),
      subjects:reusable?.subjects||computeSubjects(evidence,subjectReferenceDate,options.subjectReferenceSummaries),startDelays:computeStartDelayBuckets(evidence),blockOrder:computeBlockOrder(evidence),
      interruption:reusable?.interruption||computeInterruption(evidence),frictionSources:computeFocusFrictionSources(evidence),completionSources:computeCompletionSources(evidence),progressEvidence:computeProgressEvidence(evidence),
      outcomes:computeOutcomes(evidence),qualityEvidence:computeQualityEvidence(daily),sampleAudit:reusable?.sampleAudit||computeSampleAudit(evidence),support:computeKindSummary(evidence.support),fixed:computeKindSummary(evidence.fixed),
      resourceMix:computeResourceMix(evidence),practice:computePracticePacer(records,summarizePracticeRuns,trendBasis),schedule:reusable?.schedule||computeScheduleSummary(records)
    };
    model.advanced=reusable?.advanced||computeAdvanced(daily,trendDaily);
    model.dynamics=allHistory.dynamics;
    model.fitness=allHistory.fitness;
    model.guardrails={sample:sampleStrength(records.length,work.length),trend:trendStrength(model.advanced.completionSlopePerWeek,model.advanced.trendCompletionDayCount),variability:model.advanced.outputStability,progress:progressEvidenceStrength(model.progressEvidence)};
    model.milestones=computeMilestones(model);
    model.interpretation=Object.freeze({signals:selectSignals(model)});
    return model;
  }
  function createInsightsEngine(dependencies={}){
    const classifyTaskOutcome=dependencies.classifyTaskOutcome;
    const summarizePracticeRuns=dependencies.summarizePracticeRuns;
    if(typeof classifyTaskOutcome!=='function')throw new Error('Study Director outcome classifier is unavailable.');
    if(typeof summarizePracticeRuns!=='function')throw new Error('Study Director Practice Pacer evidence is unavailable.');
    const PREPARED_REVISION_CACHE_LIMIT=2,HISTORY_CACHE_LIMIT=2;
    const preparedRevisions=new Map(),historyCache=new Map();
    const remember=(cache,key,value,limit)=>{cache.delete(key);cache.set(key,value);while(cache.size>limit)cache.delete(cache.keys().next().value);return value;};
    const trustedRevision=value=>{
      const clean=String(value||'').trim();
      return clean&&clean.length<=160?`dataset:${clean}`:'';
    };
    const finishPrepared=(records,external='')=>{
      const revision=external||recordsRevisionKey(records),cached=preparedRevisions.get(revision);
      return cached
        ?remember(preparedRevisions,revision,cached,PREPARED_REVISION_CACHE_LIMIT)
        :remember(preparedRevisions,revision,Object.freeze({records:Object.freeze(records),revision}),PREPARED_REVISION_CACHE_LIMIT);
    };
    const prepare=(recordsInput,revisionHint=null)=>{
      const external=trustedRevision(revisionHint);
      if(external&&preparedRevisions.has(external))return remember(preparedRevisions,external,preparedRevisions.get(external),PREPARED_REVISION_CACHE_LIMIT);
      return finishPrepared(normalizeRecords(recordsInput),external);
    };
    const prepareAsync=async(recordsInput,revisionHint=null,yieldTask=null)=>{
      const external=trustedRevision(revisionHint);
      if(external&&preparedRevisions.has(external))return remember(preparedRevisions,external,preparedRevisions.get(external),PREPARED_REVISION_CACHE_LIMIT);
      return finishPrepared(await normalizeRecordsAsync(recordsInput,yieldTask),external);
    };
    // A worker receives records already normalized by this same engine on the
    // host. Re-walking and copying the full history there buys no additional
    // canonicalization, so preserve that prepared representation directly.
    const reusePrepared=(recordsInput,revision)=>{
      if(!Array.isArray(recordsInput))throw new TypeError('Prepared Insights records are invalid.');
      const key=String(revision||'').trim();
      if(!key||key.length>200)throw new TypeError('Prepared Insights revision is invalid.');
      return Object.freeze({records:Object.freeze(recordsInput),revision:key});
    };
    const historyEntry=(prepared,options={})=>{
      const currentStudyDate=isIsoDate(options.currentStudyDate)?options.currentStudyDate:localIsoDate();
      const key=`${prepared.revision}|${currentStudyDate}|${options.subjectReferenceRevision||summariesRevisionKey(options.subjectReferenceSummaries)}`;
      if(historyCache.has(key))return remember(historyCache,key,historyCache.get(key),HISTORY_CACHE_LIMIT);
      const contextOptions=Object.freeze({currentStudyDate,subjectReferenceSummaries:options.subjectReferenceSummaries});
      const context=createAllHistoryContext(prepared.records,contextOptions,classifyTaskOutcome);
      return remember(historyCache,key,{prepared,contextOptions,compact:buildAllHistoryInsights(context,false),reusable:context,audit:null},HISTORY_CACHE_LIMIT);
    };
    const labEvidence=entry=>entry.audit||(entry.audit=buildAllHistoryInsights(createAllHistoryContext(entry.prepared.records,entry.contextOptions,classifyTaskOutcome),true));
    const releaseTransient=()=>{historyCache.forEach(entry=>{entry.audit=null;});};
    const buildPrepared=(records,prepared,options={})=>{
      const entry=historyEntry(prepared,options),context=entry.reusable;
      const reusable=context&&records===prepared.records&&context.historyMeta.capped===false
        ?{
          evidence:context.modelEvidence,daily:context.dynamicsModel.daily,
          overview:context.dynamicsModel.overview,subjects:context.dynamicsModel.subjects,
          advanced:context.dynamicsModel.advanced,interruption:context.dynamicsModel.interruption,
          sampleAudit:context.dynamicsModel.sampleAudit,schedule:context.dynamicsModel.schedule
        }
        :null;
      let model;
      try{model=buildInsightsFromCanonical(records,options,entry.compact,classifyTaskOutcome,summarizePracticeRuns,reusable);}
      finally{entry.reusable=null;}
      Object.defineProperty(model,'getLabEvidence',{enumerable:false,value:()=>labEvidence(entry)});
      return model;
    };
    return Object.freeze({
      build:(recordsInput,options={})=>{
        const records=prepare(recordsInput).records;
        const prepared=Array.isArray(options.modelRecords)?prepare(options.modelRecords):prepare(recordsInput);
        return buildPrepared(records,prepared,options);
      },
      prepare,
      prepareAsync,
      reusePrepared,
      buildPrepared,
      releaseTransient,
      getLabEvidence:(prepared,options)=>labEvidence(historyEntry(prepared,options)),
      filterPreparedWindow:(prepared,key,currentStudyDate=null)=>filterCanonicalRecordsForInsightWindow(prepared.records,key,currentStudyDate)
    });
  }
    return Object.freeze({
      createInsightsEngine
    });
  })(InsightsConfig,InsightsPrimitives,InsightsRecords,InsightsAnalytics,InsightsPacerEvidence,InsightsStudyFitness,InsightsDynamics,InsightsCoach);


  const InsightsModel=Object.freeze({
    Config:InsightsConfig,Primitives:InsightsPrimitives,Records:InsightsRecords,Analytics:InsightsAnalytics,
    PacerEvidence:InsightsPacerEvidence,StudyFitness:InsightsStudyFitness,Dynamics:InsightsDynamics,
    Coach:InsightsCoach,ModelEngine:InsightsModelEngine
  });
  Object.defineProperty(global,'StudyDirectorInsightsModel',{value:InsightsModel,writable:false,configurable:true});
})(globalThis);
