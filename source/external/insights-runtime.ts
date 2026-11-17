/*
  Study Director Insights — checked retained runtime
  Copyright © 2026 Shubham Tiwari and Dr Satyam Kumar. All rights reserved.
*/
import type {
  FitnessPerformanceState,FitnessResult,ForecastCalibration,ForecastSelectionCalibration,InsightRecord,InsightsBuildOptions,
  InsightsEngine,InsightsLabEvidence,InsightsModelRuntime,InsightsPreparedWindow,InsightsResult,PreparedInsights
} from './insights-model.ts';
import type {
  InsightsComputation,InsightsComputeBridgeRuntime,InsightsComputeResult
} from './insights-compute.ts';
import type {InsightsRenderingRuntime} from './insights-rendering.ts';
import type {InsightsHostBoundary} from '../core/insights-host.ts';

type ModelRuntime=InsightsModelRuntime;
type Rendering=InsightsRenderingRuntime;
type LabModel=Omit<InsightsResult,'dynamics'|'fitness'>&Readonly<{dynamics:InsightsLabEvidence['dynamics'];fitness:FitnessResult}>;
type UnionKeys<T>=T extends T?keyof T:never;
type UnionValue<T,K extends PropertyKey>=T extends T?K extends keyof T?T[K]:never:never;
type CompleteUnion<T>={ [K in UnionKeys<T>]?:UnionValue<T,K>|undefined };
type LabDynamics=InsightsLabEvidence['dynamics'];
type LabAllocation=CompleteUnion<LabDynamics['allocation']>;
type LabDynamicAllocation=CompleteUnion<NonNullable<LabAllocation['dynamic']>>;
type LabWorkload=CompleteUnion<LabDynamics['workload']>;
type LabForecast=CompleteUnion<NonNullable<LabWorkload['forecast']>>;
type LabCalibration=CompleteUnion<ForecastCalibration|ForecastSelectionCalibration>;
type SummaryInput=Parameters<ModelRuntime['Records']['normalizeSummaries']>[0];
type LabCell=string|number|null|undefined;
type LabRow=readonly LabCell[];
type LabRows=readonly LabRow[];
type LabTableOptions=Readonly<{wide?:boolean;columns?:string|null;mobileScroll?:boolean}>;
type FrictionSource=InsightsResult['frictionSources'][number];
type SourceMix=Readonly<Record<string,number|null|undefined>>;
type Capabilities=Readonly<Record<string,number>>;
type PreviewSource=Readonly<{type?:string;mode?:string;target?:string;label?:string;revision?:string}>;
type DailySummary=ReturnType<ModelRuntime['Records']['normalizeSummaries']>[number];
type InsightDataSource=InsightsHostBoundary['appInsights']['dataSource'];
type InsightNotifications=InsightsHostBoundary['appInsights']['notifications'];
type PublicPreview=Readonly<{clear(target:string):unknown;useSample(options:Readonly<{label:string;target:'insights';today:string}>):PromiseLike<Readonly<{ok?:boolean}>>|Readonly<{ok?:boolean}>}>;
interface InsightsPluginApi {
  readonly capabilities:Capabilities;
  readonly insights:Readonly<{notifications:InsightNotifications;dataSource:InsightDataSource}>;
  readonly logic:InsightsHostBoundary['logic'];
  readonly preview:PublicPreview;
  readonly ui:Readonly<{registerTab(input:Readonly<{id:string;label:string;icon:string;render:(context:InsightsRenderContext)=>unknown;ready:()=>Promise<boolean>}>):boolean;goTab?(tab:string):unknown}>;
}
interface InsightsRenderContext {readonly pane?:HTMLElement|null;readonly restoreScroll?:boolean}
interface DeviceState{readInsightsWindow(fallback:string):unknown;writeInsightsWindow(value:string):unknown}
interface RuntimeWindow extends Window {
  StudyDirector?:InsightsPluginApi&Readonly<{registerPlugin?:(descriptor:InsightsPluginDescriptor)=>boolean;data?:Readonly<{deviceState?:Partial<DeviceState>}>}>;
  __StudyDirectorInsightsPrefetch?:Readonly<Record<string,unknown>>;
  __StudyDirectorInsightsLastProfile?:InsightsProfile;
}
interface InsightsPluginDescriptor {
  readonly name:string;readonly version:string;readonly requires:Capabilities;readonly setup:(api:InsightsPluginApi)=>boolean;
}
interface ProfileAccumulator {
  started:number;shellMs:number;revisionMs:number;recordLoadMs:number;evidencePreparationMs:number;modelComputeMs:number;workerRoundTripMs:number;
  domMs:number;maxDomChunkMs:number;domChunks:number;layoutPaintMs:number;maxLongTaskMs:number;mode:string;records:number;source?:string;sentRecords?:number;
}
interface InsightsProfile {
  readonly shellMs:number;readonly revisionMs:number;readonly recordLoadMs:number;readonly evidencePreparationMs:number;readonly modelComputeMs:number;
  readonly workerRoundTripMs:number;readonly domMs:number;readonly maxDomChunkMs:number;readonly domChunks:number;readonly layoutPaintMs:number;
  readonly completeMs:number;readonly maxLongTaskMs:number;readonly mode:string;readonly source:string;readonly sentRecords:number;readonly records:number;readonly modelSignature:string;
}
type Session=Readonly<{
  baseKey:string;source:PreviewSource|null;currentStudyDate:string;datasetRevision:string|null;summaries:readonly DailySummary[];
  summaryRevision:string;prepared:PreparedInsights;
}>;
type PlannedModel=Readonly<{windowInfo:InsightsPreparedWindow;fullKey:string;modelOptions:InsightsBuildOptions}>;
type Prefetched=Readonly<{baseKey:string;windowKey:string;fullKey:string;result:InsightsComputeResult}>;
type PrefetchStatus=Readonly<Record<string,unknown>>;
interface ViewState {
  pane:HTMLElement|null;rendered:boolean;renderedKey:string;renderedBaseKey:string;renderedWindowKey:string;session:Session|null;
  scrollWindow:number;scrollMain:number;errorTimer:number|null;suppressScroll:boolean;paneObserver:MutationObserver|null;lastProfile:InsightsProfile|null;
  navigationReady:Promise<boolean>;prefetching:Promise<PrefetchStatus>|null;prefetchWorking:boolean;prefetched:Prefetched|null;
}
type IdleScheduler={yield?:()=>Promise<void>};
declare function createInsightsRendering(
  Config:ModelRuntime['Config'],Primitives:ModelRuntime['Primitives'],PacerEvidence:ModelRuntime['PacerEvidence'],Coach:ModelRuntime['Coach']
):Rendering;

function bootInsightsRuntime(){
'use strict';
const finiteNumber=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const errorName=(error:unknown)=>error instanceof Error?error.name:'';
const errorCode=(error:unknown)=>error&&typeof error==='object'&&'code' in error?String((error as {code?:unknown}).code||''):'';
  const window=(globalThis.window||globalThis) as RuntimeWindow;
  const TAB_ID='insights';
  const REQUIRED_CAPABILITIES:Capabilities=Object.freeze({
    pluginApi:1,
    tabRegistry:1,
    insightsDataSource:1,
    insightsRecordView:1,
    outcomeClassifier:1,
    practicePacerEvidence:1
  });

  const InsightsModel=Reflect.get(globalThis,'StudyDirectorInsightsModel') as ModelRuntime|undefined;
  if(!InsightsModel)throw new Error('Study Director Insights model is unavailable.');
  const {
    Config:InsightsConfig,Primitives:InsightsPrimitives,Records:InsightsRecords,
    PacerEvidence:InsightsPacerEvidence,Coach:InsightsCoach,ModelEngine:InsightsModelEngine
  }=InsightsModel;
  try{Reflect.deleteProperty(globalThis,'StudyDirectorInsightsModel');}catch(error){}

  // The checked worker entry above owns compute transport. In a worker the
  // shared asset stops here, before any DOM/render/runtime components exist.
  if(typeof document==='undefined'&&typeof self!=='undefined'&&typeof self.postMessage==='function')return;
  const InsightsWorkerModel=Reflect.get(globalThis,'StudyDirectorInsightsComputeBridge') as InsightsComputeBridgeRuntime|undefined;
  if(!InsightsWorkerModel||InsightsWorkerModel.format!=='study-director.insights-compute-bridge'||InsightsWorkerModel.version!==1){
    throw new Error('Study Director Insights compute bridge is unavailable.');
  }
  try{Reflect.deleteProperty(globalThis,'StudyDirectorInsightsComputeBridge');}catch(error){}
  function insightWindowDeviceState(){
    const state=window.StudyDirector?.data?.deviceState;
    if(!state||typeof state.readInsightsWindow!=='function'||typeof state.writeInsightsWindow!=='function')throw new Error('Study Director Insights device-state capability is unavailable.');
    return state as DeviceState;
  }
  function readInsightWindowKey(){
    const {DEFAULT_INSIGHT_WINDOW_KEY}=InsightsConfig;
    try{return InsightsRecords.normalizeInsightWindowKey(insightWindowDeviceState().readInsightsWindow(DEFAULT_INSIGHT_WINDOW_KEY)||DEFAULT_INSIGHT_WINDOW_KEY);}
    catch(error){return DEFAULT_INSIGHT_WINDOW_KEY;}
  }
  function writeInsightWindowKey(key:unknown){
    const clean=InsightsRecords.normalizeInsightWindowKey(key);
    try{insightWindowDeviceState().writeInsightsWindow(clean);}catch(error){}
    return clean;
  }

  // M8.9 checked renderer factory is defined before this view source and is
  // constructed only here, after the worker-only exit above.
  const computeBridge=InsightsWorkerModel;
  const InsightsRendering=createInsightsRendering(InsightsConfig,InsightsPrimitives,InsightsPacerEvidence,InsightsCoach);

  // M8.10 ANALYTICS LAB COMPONENT
  const InsightsAnalyticsLab=((Config:ModelRuntime['Config'],Primitives:ModelRuntime['Primitives'],Rendering:Rendering)=>{
    const {
      BOCPD_DETECTION_PROBABILITY,BOCPD_EXPECTED_REGIME_DAYS,FITNESS_PARAMETER_UPDATE_CADENCE,
      FITNESS_PARAMETER_WINDOW_OBSERVATIONS,FITNESS_RECENT_LOAD_DAYS,FITNESS_SOURCE_WEIGHTS,
      FITNESS_TRAJECTORY_DELTA_POINTS,FITNESS_TRAJECTORY_LOOKBACK_DAYS,FORECAST_BRIER_BASELINE_TOLERANCE,
      FORECAST_CALIBRATION_FOLDS,FORECAST_COMPLETION_RANGE_MAX_COVERAGE_ERROR_POINTS,
      FORECAST_COMPLETION_RANGE_TARGET,FORECAST_MAX_CALIBRATION_ERROR_POINTS,FORECAST_MAX_COMPLETION_MAE_POINTS,
      FORECAST_MIN_NAIVE_MAE_GAIN_POINTS,MIN_BLOCKS_FOR_SIGNAL,MIN_CHANGE_POINT_DAYS,
      MIN_CHANGE_POINT_DELTA_POINTS,MIN_CHANGE_POINT_SEGMENT_DAYS,MIN_FORECAST_BACKTESTS,
      MAX_PRACTICE_TREND_EXACT_DAYS,MIN_PRACTICE_COMPARABLE_RUNS,MIN_PRACTICE_COMPARABLE_UNITS,MIN_PRACTICE_PATTERN_UNITS,
      MIN_PRACTICE_POSITION_DAYS,MIN_PRACTICE_POSITION_RUNS,MIN_PRACTICE_POSITION_UNITS,MIN_PRACTICE_TREND_DAYS,
      MIN_RECORDS_FOR_TREND,MIN_TIMER_COVERAGE_FOR_PLAN_READ,MIN_WORKLOAD_FRONTIER_DAYS,
      MIN_WORKLOAD_FRONTIER_SPAN,MIN_WORKLOAD_LOCAL_SUPPORT_DAYS,OUTCOME_KEYS,PRACTICE_CONTROLLED_MAX,
      PRACTICE_CONTROLLED_MIN,PRACTICE_TREND_JACKKNIFE_BLOCKS,WORKLOAD_LOCAL_SUPPORT_RADIUS_SD
    }=Config;
    const {
      apportionedPercents,clampPct,delayLabel,evidenceMinutesLabel,finiteOrNull,labelCompare,millisecondsLabel,
      minutesLabel,num,numberLabel,pct,percentLabel,scheduleShiftLabel,shortDate,signedMillisecondsLabel,
      signedMinutesLabel
    }=Primitives;
    const {
      Layout,completionStabilityChart,el,evidenceIntervalLabel,evidenceNote,kvItem,lazyDisclosure,
      planRealismScatter,qualityCorrelationEvidence,renderAreaConversionEvidence,sectionTitle
    }=Rendering;
  function metricGuideItem(label:string,copy:string){
    return kvItem('insights-definition-item ui-canvas',label,copy);
  }
  function renderWorkCompletionDefinition(){
    const box=el('div','insights-definition-strip ui-inset');
    const grid=el('div','insights-definition-grid');
    grid.append(
      metricGuideItem('Work completion','Completed work divided by planned work, weighted by planned minutes. Each block contributes planned minutes × saved completion %. Aggregate completion weights blocks by plan; mean daily completion gives each completion-eligible saved day equal weight.'),
      metricGuideItem('Completion source','Completion comes from Done/Total, manual %, focus-time fallback, finished-status-only, or skipped. Explicit progress beats time fallback; finished without evidence is not treated as full completion.'),
      metricGuideItem('Actual focus','Timer-tracked work focus time, excluding pauses and accepted break time.'),
      metricGuideItem('Tracked time / plan','Actual focus divided by planned work time. If it supplies task completion because no stronger progress evidence exists, the result is marked time-derived.'),
      metricGuideItem('Plan gap / day','Average daily tracked focus minus planned work. Interpret it with Timer coverage; untracked blocks are not assumed to be zero-effort blocks.'),
      metricGuideItem('Timer coverage','Planned-minute-weighted share of work represented by Timer-backed blocks. Blocks without Timer evidence are unknown, not clean.'),
      metricGuideItem('Output stability','SD of daily work completion: stable below 14 points, mixed from 14 to below 25, volatile at 25+. The label needs at least 5 completion days and is not a performance score.'),
      metricGuideItem('Trend slope','Linear regression of daily work completion against calendar date, reported in percentage points per week. It uses the selected window up to a latest-two-year horizon and is directional and descriptive, not a forecast.'),
      metricGuideItem('Rated quality relationship','Contextual Pearson correlation between explicit 1–5 rated day quality and daily work completion across paired completion-eligible days. It needs 3+ pairs and variation in both values; the plain-language label is primary while r remains visible.'),
      metricGuideItem('Schedule movement','Adjusted work-block timing against the original plan. Largest movement describes magnitude; typical net movement is weighted by shifted blocks, with positive values later and negative values earlier. Movement may reflect drift or deliberate replanning.'),
      metricGuideItem('Focus friction','Unplanned focus interruption among Timer-backed blocks: manual pause, inactive-gap break, and only the overrun part of a Pomodoro break.'),
      metricGuideItem('Accepted recovery','Pomodoro break time that stayed within the planned break allowance. It is recovery, not friction.'),
      metricGuideItem('Pomodoro overrun','Pomodoro break time beyond the planned break allowance. This is counted as focus friction.'),
      metricGuideItem('Coverage Watch','Uses top-level areas with saved allocation within the rolling previous 365 days. Recency is based on study-activity evidence, not merely planning an area. Its descriptive pressure combines recency (36%), under-allocation (25%), low completion (18%), missed outcomes (10%), and selected-window absence (11%), then moderates the result by rolling-year allocation and normalized evidence confidence. Allocation is not exam importance.'),
      metricGuideItem('Focus-to-output','Completed work divided by actual focus using the same Timer-backed area blocks. It needs 2+ paired blocks, 60m paired plan and focus, and 65%+ paired coverage; n<3 or under 120m focus remains early. Time-derived evidence is labelled, not treated as independent.')
    );
    box.append(el('div','insights-definition-title ui-label','How to read the numbers'),grid);
    return box;
  }
  function reliabilityItem(label:string,value:LabCell,note:LabCell=''){
    return kvItem('insights-reliability-item ui-canvas',label,value,note);
  }
  function sampleCountLabel(value:unknown,minimum=MIN_BLOCKS_FOR_SIGNAL){
    const count=Math.max(0,num(value));
    return count>0&&count<minimum?`${count} · early`:`${count}`;
  }
  function labSection(label:string,note:string,wide=false){
    const section=el('section','insights-dossier-section ui-card'+(wide?' insights-lab-wide':''));
    section.appendChild(sectionTitle(label,note));
    return section;
  }
  function labTable(headers:readonly string[],rows:LabRows,{wide=false,columns=null,mobileScroll=false}:LabTableOptions={}){
    const table=el('div','insights-table '+(mobileScroll?'mobile-scroll':'compact-mobile'));
    table.setAttribute('role','table');
    table.setAttribute('aria-colcount',String(headers.length));
    table.setAttribute('aria-rowcount',String(rows.length+1));
    const template=columns||`minmax(${wide?'160':'130'}px,1fr) repeat(${Math.max(0,headers.length-1)},minmax(${wide?'78':'58'}px,.7fr))`;
    const add=(cells:readonly LabCell[],head=false)=>{
      const row=el('div',(head?'insights-table-row head ui-label':'insights-table-row ui-mono')+(wide?' wide':''));
      row.setAttribute('role','row');
      row.setAttribute('aria-rowindex',String(table.children.length+1));
      row.style.gridTemplateColumns=template;
      cells.forEach((cell,index)=>{
        const node=el('div',index?'num':(head?'':'subject ui-label'),cell);
        node.setAttribute('role',head?'columnheader':'cell');
        node.setAttribute('aria-colindex',String(index+1));
        if(!head){
          node.dataset['label']=headers[index]||'';
          node.setAttribute('aria-label',`${headers[index]||'Value'}: ${cell}`);
        }
        row.appendChild(node);
      });
      table.appendChild(row);
    };
    add(headers,true);
    rows.forEach(cells=>add(cells,false));
    return table;
  }
  function progressiveLabTable(headers:readonly string[],rows:LabRows,options:LabTableOptions={},label='rows',batchSize=10){
    const data=Array.isArray(rows)?rows:[];
    const wrap=el('div','insights-progressive-table');
    const host=el('div','insights-progressive-host');
    const controls=el('div','insights-progressive-controls ui-mono');
    const status=el('span',null,'');
    const more=el('button','mini-btn ui-btn','');
    more.type='button';
    let visible=Math.min(batchSize,data.length);
    const render=()=>{
      host.replaceChildren(labTable(headers,data.slice(0,visible),options));
      const remaining=Math.max(0,data.length-visible);
      status.textContent=`Showing ${visible} of ${data.length} ${label}${data.length===1?'':'s'} · newest first`;
      if(remaining){
        more.hidden=false;
        more.textContent=`Show ${Math.min(batchSize,remaining)} more · ${remaining} remaining`;
      }else{
        more.hidden=true;
      }
    };
    more.addEventListener('click',()=>{visible=Math.min(data.length,visible+batchSize);render();});
    controls.append(status,more);
    wrap.append(host,controls);
    render();
    return wrap;
  }
  function renderSampleReliability(model:InsightsResult){
    const audit=model.sampleAudit||{};
    const progress=model.progressEvidence||{};
    const section=labSection('1. Sample & reliability','Can I trust this window of data?',true);
    const grid=el('div','insights-reliability-grid');
    const days=model.recordCount||0;
    const startEvidence=audit.startEvidenceBlocks||0;
    grid.append(
      reliabilityItem('Selected window',model.windowLabel||'Selected window',model.dateRange.start&&model.dateRange.end?`${shortDate(model.dateRange.start)} to ${shortDate(model.dateRange.end)}`:''),
      reliabilityItem('Saved days',`${days}`,model.allRecordCount&&model.allRecordCount!==days?`${days} of ${model.allRecordCount} canonical days shown`:'Canonical daily records'),
      reliabilityItem('Work blocks',`${audit.workBlocks||model.taskCount||0}`,`${audit.supportBlocks||0} support · ${audit.fixedBlocks||0} fixed anchors`),
      reliabilityItem('Planned work',minutesLabel(audit.plannedWork||model.overview.planned||0),'Core work/study blocks only'),
      reliabilityItem('Actual focus',minutesLabel(audit.actualFocus||model.overview.actual||0),'Timer-tracked focus, pauses excluded'),
      reliabilityItem('Timer coverage',percentLabel(audit.timerPlannedCoverage),`Planned-minute weighted · ${audit.timerBackedBlocks||0}/${audit.workBlocks||0} blocks Timer-backed`),
      reliabilityItem('Blocks with pause events',`${audit.eventEvidenceBlocks||0}/${audit.pauseEligibleBlocks||0}`,audit.pauseEligibleBlocks?'Timer-backed blocks containing at least one saved pause event':'No Timer-backed pause sample yet'),
      reliabilityItem('Start-time evidence',`${startEvidence}/${audit.workBlocks||model.taskCount||0}`,startEvidence?'Captured local minute or saved UTC offset':'No captured start-time evidence in this window'),
      reliabilityItem('Progress evidence',progress.total?`${Math.round(num(progress.explicitRate))}% of work blocks explicit`:'No work blocks',`${progress.timeDerivedBlocks||0} time-derived · ${(progress.unverifiedBlocks||0)+(progress.missingBlocks||0)} unverified or missing`)
    );
    section.appendChild(grid);
    const completionSourceRows=(model.completionSources||[]).filter(row=>row.blocks>0);
    const sourceDisplayShares=apportionedPercents(completionSourceRows.map(row=>row.blocks));
    const sourceRows=completionSourceRows.map((row,index)=>[
      row.label,
      row.blocks,
      percentLabel(sourceDisplayShares[index]),
      minutesLabel(row.planned||0),
      minutesLabel(row.completed||0),
      row.key==='finished-unverified'||row.key==='none'?'Not counted':percentLabel(row.completion)
    ]);
    if(sourceRows.length){
    section.appendChild(labTable(['Completion source','Blocks','Block share','Planned work','Completed equivalent','Completion'],sourceRows,{wide:true,columns:'minmax(180px,1.2fr) 72px 90px 110px 150px 110px'}));
      section.appendChild(evidenceNote('Completion source shows how each work block was interpreted: explicit Done/Total or manual %, time-derived focus fallback, finished without verification, skipped, or no progress source. Finished or missing progress without evidence is shown as not counted, rather than observed zero output.'));
    }
    return section;
  }
  function renderOutcomeEvidence(model:InsightsResult){
    const section=labSection('2. Output stability, outcomes & quality','How stable is my output, and how does it relate to rated day quality?',true);
    section.appendChild(Layout.chart(()=>completionStabilityChart(model.daily)));
    section.appendChild(evidenceNote('Average line shows typical work completion. The descriptive reference band uses ±2 standard deviations; marked days sit outside that band and are prompts for review, not judgments.'));
    const outputDays=model.daily.filter(d=>Number.isFinite(d.completion)).length;
    const stabilityReady=outputDays>=5;
    section.appendChild(labTable(['Statistic','Value','n','Reading'],[
      ['Aggregate work completion',model.overview.completion===null?'No data':percentLabel(model.overview.completion),model.taskCount||0,'planned-minute weighted across work blocks'],
      ['Mean daily work completion',model.advanced.completionMean===null?'No data':`${numberLabel(model.advanced.completionMean)}%`,outputDays,'each completion-eligible saved day weighted equally'],
      ['Work-completion SD',model.advanced.completionSd===null?'No data':`${numberLabel(model.advanced.completionSd)} pts`,outputDays,'completion variability in percentage points'],
      ['Output stability',stabilityReady?model.advanced.outputStability.label:'Early evidence',outputDays,stabilityReady?'descriptive: stable, mixed, or volatile':'need at least 5 completion days'],
      ['Trend slope',model.advanced.completionSlopePerWeek===null?'No data':`${model.advanced.completionSlopePerWeek} pts/wk`,model.advanced.trendCompletionDayCount,model.advanced.trendCompletionDayCount>=MIN_RECORDS_FOR_TREND?`directional read · ${model.trendBasis&&model.trendBasis.label||model.windowLabel||'Selected window'}`:'low sample'],
    ],{wide:true,columns:'minmax(180px,1fr) 100px 64px minmax(180px,1fr)'}));
    const outcomeLabels={full:'Full completion',partial:'Partial completion',skipped:'Skipped','untouched':'Untouched','finished-unverified':'Finished / unverified','zero-output':'Attempted / 0%'};
    const counts=model.outcomes&&model.outcomes.counts||{};
    const outcomeDisplayShares=apportionedPercents(OUTCOME_KEYS.map(key=>counts[key]||0));
    section.appendChild(labTable(['Outcome classifier','Blocks','Block share'],OUTCOME_KEYS.map((key,index)=>[
      outcomeLabels[key]||key,
      counts[key]||0,
      percentLabel(outcomeDisplayShares[index])
    ]),{wide:true,columns:'minmax(180px,1fr) 72px 82px'}));
    const qualityCard=el('section','insights-card soft ui-card insights-lab-wide');
    qualityCard.appendChild(sectionTitle('Rated quality relationship evidence','Daily work completion by explicit 1–5 rated day quality; unrated days are excluded.'));
    const qualityLink=qualityCorrelationEvidence(model);
    qualityCard.appendChild(labTable(['Statistic','Value','n','Reading'],[[
      'Rated quality–completion correlation',qualityLink.value,qualityLink.n,qualityLink.note
    ]],{wide:true,columns:'minmax(190px,1fr) 90px 64px minmax(250px,1.5fr)'}));
    const qualityRows=(model.qualityEvidence||[]).map(row=>[
      `${row.rating}/5`,
      sampleCountLabel(row.days),
      row.averageCompletion===null?'No data':`${row.averageCompletion}%`,
      row.averageActual===null?'No Timer data':`${minutesLabel(row.averageActual)} · n=${row.trackedDays}`,
      percentLabel(row.timerCoverage)
    ]);
    qualityCard.appendChild(qualityRows.length
      ? labTable(['Rated quality','Rated days','Mean daily completion','Avg tracked focus / tracked day','Timer coverage'],qualityRows,{columns:'minmax(90px,.7fr) 92px 150px 190px 110px'})
      : evidenceNote('No quality ratings saved in this window.'));
    section.appendChild(qualityCard);
    return section;
  }
  function renderPlanRealismEvidence(model:InsightsResult){
    const section=labSection('3. Plan realism','Planned work versus tracked focus, with coverage-limited days treated as unknown.',true);
    section.appendChild(Layout.chart(()=>planRealismScatter(model.daily)));
    const days=Math.max(1,model.recordCount||0);
    const timerCoverage=finiteOrNull(model.sampleAudit&&model.sampleAudit.timerPlannedCoverage);
    section.appendChild(labTable(['Metric','Value','Reading'],[
      ['Planned work / day',minutesLabel(model.overview.planned/days),'Average planned core work per saved day'],
      ['Actual focus / day',minutesLabel(model.overview.actual/days),'Average timer-tracked focus per saved day'],
      ['Timer coverage',percentLabel(timerCoverage),'Share of planned work represented by Timer-backed blocks'],
      ['Plan gap / day',signedMinutesLabel(model.overview.actualVsPlanned/days),'Tracked focus minus planned work; interpret with Timer coverage'],
      ['Tracked time / plan',percentLabel(pct(model.overview.actual,model.overview.planned)),'Tracked focus against planned work time']
    ],{wide:true,columns:'minmax(160px,1fr) 110px minmax(170px,1fr)'}));
    if(!finiteNumber(timerCoverage)||timerCoverage<MIN_TIMER_COVERAGE_FOR_PLAN_READ){
      section.appendChild(evidenceNote(`Coverage-limited: plan-realism coaching is withheld below ${MIN_TIMER_COVERAGE_FOR_PLAN_READ}% Timer coverage because untracked blocks are unknown, not zero effort. Daily chart points below that threshold remain visible but unclassified.`,'insights-lab-caution'));
    }
    return section;
  }
  function renderExecutionMechanics(model:InsightsResult){
    const section=labSection('4. Execution mechanics','Where does execution break down?',true);
    const grid=el('div','insights-dossier-grid');
    const delayCard=el('section','insights-card soft ui-card');
    delayCard.appendChild(sectionTitle('Start-delay evidence','Timezone-stable captured starts only; days without them are excluded from delay buckets.'));
    const delayRows=(model.startDelays||[]).filter(row=>num(row.blocks)>0);
    delayCard.appendChild(delayRows.length
      ? labTable(['Delay bucket','Blocks','Completion','Avg delay'],delayRows.map(row=>[
          row.label,sampleCountLabel(row.blocks),percentLabel(row.completion),row.averageDelay===null?'No data':delayLabel(row.averageDelay)
        ]),{columns:'minmax(145px,1fr) 92px 112px 100px'})
      : evidenceNote('No captured start-time evidence in this window.'));
    const orderCard=el('section','insights-card soft ui-card');
    orderCard.appendChild(sectionTitle('Planned block position','Output by the block’s planned ordinal, not actual execution order.'));
    orderCard.appendChild(labTable(['Position','Blocks','Completion','Missed','Avg tracked focus / Timer block'],model.blockOrder.map(row=>[
      row.label,
      sampleCountLabel(row.blocks),
      percentLabel(row.completion),
      num(row.outcomeCounts&&row.outcomeCounts.skipped)+num(row.outcomeCounts&&row.outcomeCounts.untouched),
      row.timerBackedBlocks?`${minutesLabel(num(row.timerBackedActual)/row.timerBackedBlocks)} · n=${row.timerBackedBlocks}/${row.blocks}`:'No Timer data'
    ]),{columns:'minmax(105px,1fr) 90px 112px 72px 170px'}));
    const scheduleCard=el('section','insights-card soft ui-card insights-lab-wide');
    const schedule=model.schedule||{};
    scheduleCard.appendChild(sectionTitle('Schedule movement evidence','Movement of adjusted work blocks from their original planned times.'));
    scheduleCard.appendChild(labTable(['Metric','Value','Reading'],[
      ['Shifted days',`${schedule.shiftedDays||0}/${model.recordCount||0}`,'Saved days containing at least one shifted work block'],
      ['Shifted work blocks',schedule.shiftedBlocks||0,'Total adjusted work blocks in the selected window'],
      ['Average largest movement',schedule.shiftedDays?minutesLabel(schedule.averageDailyPeakShiftOnShiftedDays):'No data','Average daily maximum across shifted days'],
      ['Worst saved-day movement',schedule.shiftedDays?minutesLabel(schedule.maxDailyShiftMinutes):'No data','Largest absolute work-block movement in the window'],
      ['Typical net movement',schedule.shiftedDays?scheduleShiftLabel(schedule.typicalNetShiftMinutes):'No data','Shifted-block weighted direction; positive means later, negative means earlier']
    ],{wide:true,columns:'minmax(180px,1fr) 120px minmax(260px,1.6fr)'}));
    grid.append(delayCard,orderCard,scheduleCard);
    section.appendChild(grid);
    section.appendChild(evidenceNote(`Delay uses Timer actual start against adjusted planned start when available, otherwise original planned start. Planned block position groups 6th+ together so long plans remain readable. Counts below ${MIN_BLOCKS_FOR_SIGNAL} are retained as early evidence, not promoted as patterns.`));
    return section;
  }
  function frictionSourceRow(row:FrictionSource){
    const item=el('div','insights-friction-source-row');
    const head=el('div','insights-friction-source-head');
    head.append(
      el('div','insights-friction-source-name ui-label',row.label),
      el('div','insights-friction-source-value ui-mono',`${evidenceMinutesLabel(row.minutes)} · ${row.events} event${row.events===1?'':'s'} · ${row.blocks} block${row.blocks===1?'':'s'}`)
    );
    const track=el('div','insights-track');
    const fill=el('div','insights-fill');
    fill.style.width=clampPct(row.share)+'%';
    track.appendChild(fill);
    item.append(head,track);
    return item;
  }
  function renderFrictionEvidence(model:InsightsResult){
    const section=labSection('5. Focus friction & breaks','What interrupted focus, and were breaks controlled?',true);
    const grid=el('div','insights-dossier-grid');
    const sourceCard=el('section','insights-card soft ui-card insights-friction-source-card');
    sourceCard.appendChild(sectionTitle('Focus friction by source','Manual pauses, inactive gaps and Pomodoro overrun; bar length shows share of total friction time.'));
    const sourceRows=(model.frictionSources||[]).filter(row=>row.events>0||row.minutes>0);
    if(sourceRows.length){
      const list=el('div','insights-friction-source-list');
      sourceRows.forEach(row=>list.appendChild(frictionSourceRow(row)));
      sourceCard.appendChild(list);
    }else if(!model.interruption.hasTimerEvidence){
      sourceCard.appendChild(evidenceNote('No Timer-backed work blocks are available for a focus-friction read.'));
    }else{
      sourceCard.appendChild(evidenceNote(`No unplanned focus-friction events were recorded across ${model.interruption.blockCount} Timer-backed work blocks. Accepted Pomodoro recovery time is excluded.`));
    }
    const breakCard=el('section','insights-card soft ui-card');
    const p=model.interruption.pomodoro||{};
    breakCard.appendChild(sectionTitle('Break discipline','Pomodoro recovery and overrun evidence.'));
    breakCard.appendChild(labTable(['Break metric','Value','Reading'],[
      ['Pomodoro breaks',p.breakCount||0,'Accepted planned breaks'],
      ['Accepted recovery',evidenceMinutesLabel(p.recoveryMinutes||0),'Excluded from focus friction'],
      ['Overrun',evidenceMinutesLabel(p.overrunMinutes||0),'Counted as friction'],
      ['On-time return',percentLabel(p.onTimeRate),`${p.onTimeBreaks||0}/${p.breakCount||0} breaks`],
      ['Overrun / accepted break',p.averageOverrunMinutes===null?'No data':`${p.averageOverrunMinutes}m`,'Average across every accepted break']
    ],{wide:true,columns:'minmax(130px,1fr) 82px minmax(150px,1fr)'}));
    const subjectCard=el('section','insights-card soft ui-card insights-lab-wide');
    subjectCard.appendChild(sectionTitle('Focus friction by top-level area','Every affected top-level area, sorted by friction after nested labels are combined.'));
    const subjectRows=(model.interruption.subjects||[]).filter(row=>row.frictionSeconds>0||row.affected>0).map(row=>[
      row.label,
      `${row.affected||0}/${row.blocks||0} · ${percentLabel(row.interruptionRate)}`,
      row.frictionCount||0,
      evidenceMinutesLabel(row.pauseMinutes||0),
      minutesLabel(row.actual||0),
      row.pausesPerFocusHour===null?'—':`${row.pausesPerFocusHour}/hr${num(row.actual)<60?' · early':''}`
    ]);
    subjectCard.appendChild(subjectRows.length
      ? labTable(['Area','Affected blocks','Pauses','Friction','Focus','Pauses/focus hr'],subjectRows,{wide:true,columns:'minmax(150px,1.35fr) 130px 66px 82px 88px 128px'})
      : evidenceNote(model.interruption.hasTimerEvidence?'No top-level area focus-friction clusters in this Timer-backed sample.':'Need Timer-backed work blocks for top-level area friction.'));
    grid.append(sourceCard,breakCard,subjectCard);
    section.appendChild(grid);
    section.appendChild(evidenceNote(`Friction denominators use ${model.interruption.blockCount||0}/${model.interruption.workBlockCount||0} Timer-backed work blocks; untracked blocks are unknown, not interruption-free.`));
    return section;
  }
  function renderSubjectEvidence(model:InsightsResult){
    const section=labSection('6. Top-level area audit','Complete supporting evidence for area completion, Focus-to-output, and Coverage Watch claims.',true);
    if(!model.subjects.length){
      section.appendChild(evidenceNote('No academic/work top-level areas detected yet.'));
      return section;
    }
    const rows=model.subjects.slice().sort((a,b)=>num(b.coverageWatchScore)-num(a.coverageWatchScore)||num(b.planned)-num(a.planned)||labelCompare(a,b)).map(row=>[
      row.label,
      row.windowAbsent?'Absent':`${minutesLabel(row.planned||0)} → ${minutesLabel(row.completed||0)}`,
      minutesLabel(row.actual||0),
      row.windowAbsent?'No data':percentLabel(row.completion),
      row.lastDate?`${shortDate(row.lastDate)} · ${row.daysSinceLast??0}d`:'No activity evidence',
      row.coverageWatchEligible?`${minutesLabel(row.historicalPlanned||0)} · ${row.historicalDays||0}d · ${row.allocation||'saved allocation'}`:'Outside 1y',
      row.coverageWatchEligible?`${Math.round(num(row.evidenceStrength)*100)}%`:'—',
      row.coverageWatchEligible?String(row.coverageWatchScore||0):'—'
    ]);
    section.appendChild(el('div','insights-mobile-scroll-cue ui-label','Swipe table →'));
    section.appendChild(labTable(['Area','Window plan → completed','Tracked focus','Work completion','Last studied','Rolling 1y evidence','Confidence','Watch'],rows,{wide:true,mobileScroll:true,columns:'minmax(150px,1.5fr) minmax(145px,1.15fr) minmax(88px,.7fr) minmax(102px,.8fr) minmax(110px,.9fr) minmax(190px,1.45fr) minmax(82px,.65fr) minmax(58px,.45fr)'}));
    section.appendChild(renderAreaConversionEvidence(model));
    section.appendChild(evidenceNote('All detected top-level areas are retained; rows are sorted by Coverage Watch and then selected-window planned work. Rolling 1y evidence shows planned work, saved allocation days and descriptive allocation. “Last studied” requires completion, Timer focus, an explicit attempted/zero-output result, or a finished-unverified result; merely planning, skipping, or leaving an area untouched does not refresh recency. Confidence normalizes the available block, time and day evidence. Areas allocated only outside the 365-day horizon remain outside the watch, while “All” can still show their lifetime output. Allocation describes records, not exam importance.'));
    return section;
  }
  function renderPracticeEvidence(model:InsightsResult){
    const practice=model.practice||{};
    const section=labSection('7. Practice Pacer evidence','Run-balanced pacing, finishing, position, segment, unit-size and evidence-audit details; raw unit timings remain in Review and Library.',true);
    if(!practice.units){
      section.appendChild(evidenceNote('No accepted completed Practice Pacer runs are saved in this window. Active, reset and discarded runs are excluded.'));
      const audit=practice.audit||{};
      if(num(audit.savedRuns))section.appendChild(evidenceNote(`Evidence audit: ${audit.acceptedRuns||0}/${audit.savedRuns} saved runs accepted; ${audit.excludedRuns||0} excluded.`));
      return section;
    }
    const trend=practice.trend||{},position=practice.position||{},audit=practice.audit||{};
    const summary=el('div','insights-reliability-grid');
    summary.append(
      reliabilityItem('Planned-run completion',practice.plannedRuns?percentLabel(practice.plannedRunCompletionMedian,1):'No planned runs',practice.plannedRuns?`Median run completion · ${practice.completedPlannedRuns}/${practice.plannedRuns} runs fully completed · aggregate units ${practice.completedPlannedUnits}/${practice.plannedUnits}`:'Open-ended runs excluded'),
      reliabilityItem('Finished within time',practice.completedPlannedRuns?percentLabel(practice.completedWithinTimeRate,1):'No completed plans',practice.completedPlannedRuns?`${practice.completedWithinTimeRuns}/${practice.completedPlannedRuns} completed planned runs`:'Needs a fully completed planned run'),
      reliabilityItem('Median finishing margin',practice.completedPlannedRuns?signedMillisecondsLabel(practice.medianFinishingMarginMs):'No completed plans',practice.completedPlannedRuns?`Median full-budget use ${percentLabel(practice.medianCompletedRunTimeUsed,1)}`:'Open or incomplete runs excluded'),
      reliabilityItem('Typical unit pace',percentLabel(practice.typicalUnitPace,1),'Median of run-level unit medians; each run has equal influence'),
      reliabilityItem('Robust pace direction',trend.slopePerWeek===null?'No data':`${trend.slopePerWeek>0?'+':''}${trend.slopePerWeek} pts/wk`,practice.trendReady?(trend.stable?`Stable · ${percentLabel(trend.stability,0)} block-jackknife consistency · ${practice.trendBasis&&practice.trendBasis.label||'Selected window'}`:`No stable direction · ${practice.trendBasis&&practice.trendBasis.label||'Selected window'}`):`Needs more practice-day evidence · ${practice.trendBasis&&practice.trendBasis.label||'Selected window'}`),
      reliabilityItem('Pace-slippage onset',position.onset?position.onset.label:`Need ${MIN_PRACTICE_POSITION_RUNS} runs with ${MIN_PRACTICE_POSITION_UNITS}+ units`,position.onset?`${percentLabel(position.onset.medianPace,1)} · +${numberLabel(position.onset.medianDeltaFromOpening,1)} pts from opening`:`${position.eligibleRuns||0} eligible run${num(position.eligibleRuns)===1?'':'s'}`),
      reliabilityItem('Within-run spread',practice.spreadComparableRuns>=MIN_PRACTICE_COMPARABLE_RUNS?`${practice.medianWithinRunSpread} pts`:`Need ${MIN_PRACTICE_COMPARABLE_RUNS} runs`,'Median middle-50% unit-pace range'),
      reliabilityItem('Evidence accepted',`${audit.acceptedRuns||0}/${audit.savedRuns||0} runs`,`${audit.acceptedUnits||0}/${audit.encounteredUnits||0} saved unit entries accepted`)
    );
    section.appendChild(summary);
    const distributionRows=(practice.distribution||[]).map(row=>[row.label,row.count,percentLabel(row.share,1)]);
    if(distributionRows.length)section.appendChild(labTable(['Completed-run pace band','Runs','Share'],distributionRows,{columns:'minmax(190px,1fr) 72px 90px'}));
    if((position.profile||[]).length){
      const rows=position.profile.map(row=>[row.label,row.runs,row.days,percentLabel(row.medianPace,1),finiteNumber(row.medianDeltaFromOpening)?`${row.medianDeltaFromOpening>0?'+':''}${row.medianDeltaFromOpening} pts`:'—',row.ready?'Ready':'Early']);
      section.appendChild(labTable(['Run position','Runs','Days','Median pace','Change from opening','Evidence'],rows,{wide:true,columns:'minmax(145px,1.2fr) 62px 62px 105px 140px 90px'}));
    }
    const areaRows=(practice.areas||[]).map(row=>[row.label,row.units,row.runs,row.days,row.maturity&&row.maturity.label||'Early',percentLabel(row.medianRunPace,1),percentLabel(row.typicalUnitPace,1),`${row.controlledRuns}/${row.runs} · ${percentLabel(row.controlledRunRate,1)}`]);
    section.appendChild(labTable(['Top-level area','Units','Runs','Days','Evidence','Median run pace','Typical unit','Controlled runs'],areaRows,{wide:true,columns:'minmax(160px,1.45fr) 62px 58px 58px 88px 116px 104px 138px'}));
    const modeRows=(practice.modes||[]).map(row=>[row.label,row.units,row.runs,row.days,row.maturity&&row.maturity.label||'Early',percentLabel(row.medianRunPace,1),percentLabel(row.typicalUnitPace,1),`${row.controlledRuns}/${row.runs} · ${percentLabel(row.controlledRunRate,1)}`]);
    section.appendChild(labTable(['Setup','Units','Runs','Days','Evidence','Median run pace','Typical unit','Controlled runs'],modeRows,{wide:true,columns:'minmax(150px,1.3fr) 62px 58px 58px 88px 116px 104px 138px'}));
    if((practice.repeatedSegments||[]).length){
      const rows=practice.repeatedSegments.map(row=>[row.area,row.modeLabel,row.label,`${row.units}/${row.plannedUnits}`,row.runs,row.days,percentLabel(row.medianCompletion,1),`${row.completedSegments}/${row.runs} · ${percentLabel(row.completedSegmentRate,1)}`,percentLabel(row.medianPace,1),finiteNumber(row.medianRelativeDelta)?`${row.medianRelativeDelta>0?'+':''}${row.medianRelativeDelta} pts`:'—',row.maturity.label]);
      section.appendChild(labTable(['Area','Setup','Repeated segment','Units done / planned','Runs','Days','Median completion','Fully completed','Median pace','Vs rest of run','Evidence'],rows,{wide:true,columns:'minmax(130px,1fr) 110px minmax(150px,1.2fr) 104px 58px 58px 118px 120px 100px 110px 88px'}));
    }
    const sizeRows=(practice.unitSizeGroups&&practice.unitSizeGroups.all||[]).map(row=>[row.family==='marks'?'Marks':'Target time',row.label,row.units,row.runs,row.days,row.maturity.label,percentLabel(row.medianPace,1),`${row.controlledRuns}/${row.runs} · ${percentLabel(row.controlledRunRate,1)}`,`${row.overBudgetRuns}/${row.runs} · ${percentLabel(row.overBudgetRunRate,1)}`,`${row.belowBandRuns}/${row.runs} · ${percentLabel(row.belowBandRunRate,1)}`]);
    if(sizeRows.length)section.appendChild(labTable(['Grouping','Band','Units','Runs','Days','Evidence','Run-balanced pace','Controlled','Over budget','Below 80%'],sizeRows,{wide:true,columns:'94px minmax(170px,1.4fr) 58px 58px 58px 88px 130px 128px 128px 128px'}));
    const orderedRuns=(practice.runRows||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||num(b.index)-num(a.index));
    const runRows=orderedRuns.map(row=>[
      shortDate(row.date),`${row.area} · ${row.block}`,row.modeLabel,row.plannedUnits?`${row.units}/${row.plannedUnits}`:String(row.units),percentLabel(row.runPace,1),row.units>=MIN_PRACTICE_COMPARABLE_UNITS?`${percentLabel(row.medianUnitPace,1)} · IQR ${row.paceSpread} pts`:percentLabel(row.medianUnitPace,1),row.controlled?'Controlled':row.runPace<PRACTICE_CONTROLLED_MIN?'Below 80%':'Over budget',`${millisecondsLabel(row.actualMs)} / ${millisecondsLabel(row.targetMs)}`,row.completePlanned?signedMillisecondsLabel(row.finishingMarginMs):'—'
    ]);
    section.appendChild(el('div','insights-mobile-scroll-cue ui-label','Swipe table →'));
    section.appendChild(progressiveLabTable(['Date','Area / linked block','Setup','Units','Run pace','Typical unit / spread','Band','Actual / target','Finish margin'],runRows,{wide:true,mobileScroll:true,columns:'80px minmax(210px,1.7fr) 118px 72px 92px 150px 98px 138px 110px'},'run'));
    if((practice.segmentRows||[]).length){
      const orderedSegments=practice.segmentRows.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.runId).localeCompare(String(a.runId)));
      const rows=orderedSegments.map(row=>[shortDate(row.date),row.area,row.label,`${row.units}/${row.plannedUnits}`,percentLabel(row.completion,1),row.targetMs?`${millisecondsLabel(row.actualMs)} / ${millisecondsLabel(row.targetMs)}`:'Not attempted',percentLabel(row.paceRatio,1),finiteNumber(row.relativeDelta)?`${row.relativeDelta>0?'+':''}${row.relativeDelta} pts`:'—']);
      section.appendChild(progressiveLabTable(['Date','Area','Segment','Units','Completion','Actual / completed target','Pace','Vs rest of run'],rows,{wide:true,columns:'80px minmax(140px,1fr) minmax(170px,1.2fr) 76px 100px 170px 90px 110px'},'segment'));
    }
    if((audit.reasonRows||[]).length)section.appendChild(labTable(['Excluded evidence reason','Saved runs'],audit.reasonRows.map(row=>[row.reason,row.count]),{columns:'minmax(210px,1fr) 90px'}));
    section.appendChild(evidenceNote(`Finishing margin uses only fully completed planned runs: full target time minus actual time. Position analysis replaces the old half-versus-half read by comparing five relative run bands and looking for sustained overrun versus each run’s opening baseline. Repeated segments are grouped only within compatible plan structures in the same top-level area and setup; both follow-through and pace versus the rest of the same runs are retained. Marks and target-duration groups are run-balanced. Evidence audit counts saved rows rejected before analysis. Timing does not establish correctness or quality.`));
    return section;
  }
  function renderPracticeMetricDefinitions(){
    const box=el('div','insights-definition-strip ui-inset');
    const grid=el('div','insights-definition-grid');
    grid.append(
      metricGuideItem('Planned-run finishing margin','For a fully completed planned run, the complete target budget minus actual run time. Positive means time remained; negative means the run finished over budget. Incomplete and open-ended runs are excluded.'),
      metricGuideItem('Finished within time','Share of fully completed planned runs whose total actual time did not exceed the complete planned target. This is separate from planned-unit follow-through.'),
      metricGuideItem('Typical unit pace','The median unit pace is calculated separately inside each run, then the median is taken across runs. This prevents a high-volume run from silently dominating lower-volume practice.'),
      metricGuideItem('Controlled pacing band',`${PRACTICE_CONTROLLED_MIN}–${PRACTICE_CONTROLLED_MAX}% of target is treated as controlled. Below ${PRACTICE_CONTROLLED_MIN}% leaves substantial time in hand but is not automatically good; above ${PRACTICE_CONTROLLED_MAX}% is over budget. Correctness and quality are not stored.`),
      metricGuideItem('Planned-run completion','Completed units divided by planned units within each planned run, then the median across runs so every run has equal influence. The fully completed-run rate is shown alongside; aggregate unit completion remains technical supporting evidence.'),
      metricGuideItem('Pace-slippage position',`Runs with ${MIN_PRACTICE_POSITION_UNITS}+ completed units are divided into five relative position bands. Each band is compared with that run’s opening baseline, then medians are taken across runs. A slippage claim needs ${MIN_PRACTICE_POSITION_RUNS}+ runs across ${MIN_PRACTICE_POSITION_DAYS}+ days and sustained overrun.`),
      metricGuideItem('Repeated segment performance',`Repeated labels are grouped only within compatible plan structures in the same top-level area and setup. Segment completion is retained even when a segment is not attempted, while completed-unit pace is compared with the rest of the same run before aggregation.`),
      metricGuideItem('Marks / target-duration bands','When marks exist, repeated marks values are compared directly or in a few balanced bands. Otherwise, meaningful target-duration variation is grouped into short, medium and long targets. Every run has equal influence inside a band.'),
      metricGuideItem('Evidence audit','Counts saved runs and unit entries encountered, accepted and excluded before Practice Pacer analysis, with general exclusion reasons. Active and discarded runs are not part of saved evidence.'),
      metricGuideItem('Robust pace direction',`Median pairwise slope of each practice day’s run-balanced median pace against calendar date. The exact all-pairs estimator is retained through ${MAX_PRACTICE_TREND_EXACT_DAYS} trend days; larger samples deterministically retain ${MAX_PRACTICE_TREND_EXACT_DAYS} time-stratified days including the first, last and recent evidence. Interpretation begins at ${MIN_PRACTICE_TREND_DAYS}+ practice days and ${MIN_PRACTICE_PATTERN_UNITS}+ units and requires up to ${PRACTICE_TREND_JACKKNIFE_BLOCKS} contiguous block-jackknife checks plus first- and last-block stability.`),
      metricGuideItem('Within-run pace spread',`The interquartile range of normalized unit pace within each run, then the median across ${MIN_PRACTICE_COMPARABLE_RUNS}+ comparable runs. Larger values mean the typical unit pace hides greater within-run variation.`)
    );
    box.append(el('div','insights-definition-title ui-label','Practice Pacer definitions'),grid);
    return box;
  }
  function renderFitnessMetricDefinitions(){
    const box=el('div','insights-definition-strip ui-inset');
    const grid=el('div','insights-definition-grid');
    grid.append(
      metricGuideItem('Current study-state components','Three separate all-history estimates: Output state from canonical completion; Schedule control from captured starts and saved movement; Focus control from Timer friction and accepted Pomodoro returns. Rated quality remains separate context. The components are never combined into one score.'),
      metricGuideItem('State model range',`An approximate 95% interval derived from each component’s filter variance, clipped to 0–100%. Process and measurement noise are regularised estimates learned chronologically from at most ${FITNESS_PARAMETER_WINDOW_OBSERVATIONS} prior informative observations, refreshed every ${FITNESS_PARAMETER_UPDATE_CADENCE}.`),
      metricGuideItem('Progress-source weight',`Explicit and skipped progress carry weight 1; time-derived progress ${FITNESS_SOURCE_WEIGHTS['time-derived']}; finished-unverified ${FITNESS_SOURCE_WEIGHTS.unverified}; missing progress 0. The weight changes measurement uncertainty, never the saved completion value.`),
      metricGuideItem('Missing days','Unsaved calendar days never become zero output. Without a component observation, its last point estimate is held while process uncertainty widens; elapsed time alone cannot improve or weaken the estimated state.'),
      metricGuideItem('Fitness trajectory',`Current state is compared with roughly ${FITNESS_TRAJECTORY_LOOKBACK_DAYS} days earlier. Rising or falling requires ${FITNESS_TRAJECTORY_DELTA_POINTS}+ points plus at least three recent usable observations; otherwise the read is stable or uncertain. Recovering additionally requires a restrained rebound from a prior trough.`),
      metricGuideItem('Load match',`Recent planned work averages the latest ${FITNESS_RECENT_LOAD_DAYS} completion-eligible days and is compared with the estimated efficient region from the Study Dynamics workload response. It does not prove that workload caused completion.`)
    );
    box.append(el('div','insights-definition-title ui-label','Current Study State definitions'),grid);
    return box;
  }
  function renderDynamicsMetricDefinitions(){
    const box=el('div','insights-definition-strip ui-inset');
    const grid=el('div','insights-definition-grid');
    grid.append(
      metricGuideItem('Hierarchical posterior','Each area, actual-start band, or planned-position dimension learns a population mean and concentration by numerical hyper-posterior integration. Group posteriors are partially pooled toward that learned population; sparse groups move farther than well-sampled groups.'),
      metricGuideItem('Effective sample size','Kish effective n from planned-minute weights. It falls when a few long blocks dominate, so ten unequal blocks can carry less evidence than ten comparable blocks.'),
      metricGuideItem('Signal strength','Weak, emerging, reliable, and strong labels use effective sample size plus interval width for Bayesian rates. Non-rate structural reads use saved-day and work-volume gates. A strong label is not a causal claim.'),
      metricGuideItem('Online regime probability',`Bayesian online change-point detection maintains a posterior over possible run lengths with an expected ${BOCPD_EXPECTED_REGIME_DAYS}-day regime. A displayed shift needs ${percentLabel(BOCPD_DETECTION_PROBABILITY*100,0)}+ recent-change probability, ${MIN_CHANGE_POINT_DELTA_POINTS}+ mean points, and ${MIN_CHANGE_POINT_SEGMENT_DAYS}+ eligible days on both sides.`),
      metricGuideItem('Plan-alignment concentration','Jensen–Shannon divergence compares planned and completed-equivalent top-level area shares on independently normalised bases. Effective-area counts are inverse concentration. Uniform allocation is never assumed to be desirable.'),
      metricGuideItem('Adjusted sequence models',`Regularised discrete-time logistic models estimate next-block strength and terminal-collapse hazard while jointly accounting for previous block state, recorded friction, missing friction evidence, intervening support, after-noon start, missing start-time evidence, planned position, and daily planned load. Hazard risk sets stop when a missed tail begins; models activate only after genuine outcome and event diversity.`),
      metricGuideItem('Workload response surface',`After ${MIN_WORKLOAD_FRONTIER_DAYS}+ eligible days spanning about ${minutesLabel(MIN_WORKLOAD_FRONTIER_SPAN)}, regularised probabilistic curves estimate completion and 80%+ day probability continuously across planned work while accounting for the one-sided recent completion state. A realistic region requires ${MIN_WORKLOAD_LOCAL_SUPPORT_DAYS}+ nearby observed days inside a ${numberLabel(WORKLOAD_LOCAL_SUPPORT_RADIUS_SD,1)} SD workload radius, with a 45-minute minimum radius.`),
      metricGuideItem('State-aware forecast competition','The baseline workload model competes with a larger model using origin-causal prior-day Output state, Schedule control, and Focus control estimates. Every historical predictor is fixed using only evidence available before that forecast date; the larger model activates only when held-out completion error improves materially without weakening probability calibration.'),
      metricGuideItem('Restrained interactions & allocation drift',`Only Area × time, late position × workload, and previous result × support break are tested. Four-cell sample and effect-size gates apply first; the interaction must then repeat in the same material direction across the early and late evidence halves. Mirrored descriptions are deduplicated. Weekly plan alignment tracks recurring crowd-out and direction over time.`),
      metricGuideItem('Next-plan forecast',`Tomorrow-style completion guidance activates after ${MIN_FORECAST_BACKTESTS}+ qualifying rolling one-step-ahead forecasts, completion MAE at or below ${FORECAST_MAX_COMPLETION_MAE_POINTS} points, at least ${FORECAST_MIN_NAIVE_MAE_GAIN_POINTS} point improvement over the recent-seven-day median benchmark, and ${MIN_WORKLOAD_LOCAL_SUPPORT_DAYS}+ nearby workload days. Its range is labelled as an ${percentLabel(FORECAST_COMPLETION_RANGE_TARGET*100,0)} prediction range only when leave-one-out historical coverage is within ${FORECAST_COMPLETION_RANGE_MAX_COVERAGE_ERROR_POINTS} points of target; otherwise it is labelled an estimated model range. The 80%+ day chance separately requires both outcomes, ${FORECAST_CALIBRATION_FOLDS}-fold cross-fitted recalibration, calibration error at or below ${FORECAST_MAX_CALIBRATION_ERROR_POINTS} points, and Brier score no more than ${FORECAST_BRIER_BASELINE_TOLERANCE} above the personal base-rate forecast.`)
    );
    box.append(el('div','insights-definition-title ui-label','Study Dynamics definitions'),grid);
    return box;
  }
  function renderMetricGuideSection(){
    const section=labSection('10. Metric guide','Reference definitions for the numbers above.',true);
    const details=lazyDisclosure('insights-metric-guide-disclosure ui-inset','Open reference definitions',()=>{
      const body=el('div','insights-metric-guide-body');
      body.append(renderWorkCompletionDefinition(),renderPracticeMetricDefinitions(),renderFitnessMetricDefinitions(),renderDynamicsMetricDefinitions());
      return body;
    });
    section.appendChild(details);
    return section;
  }
  function fitnessSourceMixLabel(plannedByGroup:SourceMix|null|undefined){
    const labels:Readonly<Record<string,string>>={explicit:'explicit','time-derived':'time',unverified:'unverified',skipped:'skipped',missing:'missing'};
    const parts=Object.entries(plannedByGroup||{}).filter(([,value])=>num(value)>0).map(([key,value])=>`${labels[key]||key} ${minutesLabel(value)}`);
    return parts.join(' · ')||'No planned evidence';
  }
  function resolveLabModel(model:InsightsResult):LabModel{
    const evidence=model.getLabEvidence();
    return {...model,dynamics:evidence.dynamics,fitness:evidence.fitness};
  }
  function renderFitnessEvidence(model:InsightsResult){
    const section=labSection('8. Current Study State model evidence','The state tracker remains inspectable without expanding the normal report or Analytics Lab by default.',true);
    const details=lazyDisclosure('insights-fitness-model-evidence ui-inset','Open state & weighting evidence',()=>{
      const auditModel=resolveLabModel(model);
      const body=el('div','insights-fitness-model-evidence-body');
      const fitness:FitnessResult=auditModel.fitness;
      const state:FitnessPerformanceState=fitness.performanceState;
      const parameters=fitness.parameters;
      const learned=parameters.learned;
      const current=state.current;
      const overview=el('section','insights-card soft ui-card');
      overview.appendChild(sectionTitle('State model audit',`A regularised multivariate learned-transition filter. Historical updates and parameter learning are origin-causal: each dated state uses only evidence available by that date. Parameter fits use at most ${FITNESS_PARAMETER_WINDOW_OBSERVATIONS} prior informative observations; absent components remain missing rather than becoming zero.`));
      overview.appendChild(labTable(['Metric','Value','Interpretation'],[
        ['Output state',current?percentLabel(current.estimate,1):'No estimate',current?`${percentLabel(current.low,0)}–${percentLabel(current.high,0)} approximate 95% model range`:'No usable progress-source evidence'],
        ['Trajectory',state.trajectory&&state.trajectory.label||'Uncertain',finiteNumber(state.trajectory?.delta)?`${finiteNumber(state.trajectory.delta)&&state.trajectory.delta>0?'+':''}${state.trajectory.delta} points across ${state.trajectory.lookbackDays} days`:'No restrained comparison'],
        ['Evidence',`${state.observedDays||0} observed · ${numberLabel(state.effectiveDays,1)} equivalent days`,`${fitness.readiness&&fitness.readiness.label||'Weak signal'} · last usable evidence ${state.lastEvidenceDate?shortDate(state.lastEvidenceDate):'unavailable'}`],
        ['Learned process SD',(learned?.processSd||[]).map((value:number)=>numberLabel(value,1)).join(' · ')||'Not learned','Output state · Schedule control · Focus control; uncertainty widens across unsaved gaps'],
        ['Learned measurement SD',(learned?.measurementSd||[]).map((value:number)=>numberLabel(value,1)).join(' · ')||'Not learned','Current bounded-window parameter summary; historical forecast states remain origin-causal'],
        ['Historical forecast causality',state.forecastCausal?'Origin-causal':'Not established',state.forecastCausal?`Prior-day state predictors use only evidence available before each forecast date; parameters refresh every ${state.parameterUpdateCadence||FITNESS_PARAMETER_UPDATE_CADENCE} observations from at most ${state.parameterWindowObservations||FITNESS_PARAMETER_WINDOW_OBSERVATIONS} prior observations.`:'State-aware forecast cannot win model selection.'],
        ['Cross-state learning',`${learned?.completePairs||0} complete adjacent pairs`,state.multivariateReady?'Multivariate state available':'Sparse components remain independently uncertain'],
        ['Progress weights',`Explicit ${numberLabel(parameters.sourceWeights&&parameters.sourceWeights.explicit,2)} · time ${numberLabel(parameters.sourceWeights&&parameters.sourceWeights['time-derived'],2)} · unverified ${numberLabel(parameters.sourceWeights&&parameters.sourceWeights.unverified,2)}`,'Skipped is explicit zero evidence; missing progress receives zero update weight']
      ],{wide:true,columns:'minmax(155px,1fr) minmax(165px,1fr) minmax(280px,1.7fr)'}));
      const dimensionRows=Object.values(state.dimensions||{}).map((dimension,index)=>[
        dimension.label,dimension.current?percentLabel(dimension.current.estimate,1):'Unknown',dimension.current?`${percentLabel(dimension.current.low,0)}–${percentLabel(dimension.current.high,0)}`:'—',dimension.observedDays||0,
        learned.processSd&&Number.isFinite(learned.processSd[index])?numberLabel(learned.processSd[index],1):'—',learned.measurementSd&&Number.isFinite(learned.measurementSd[index])?numberLabel(learned.measurementSd[index],1):'—',numberLabel(dimension.persistence,2),dimension.confidence&&dimension.confidence.label||'Weak signal'
      ]);
      if(dimensionRows.length)overview.appendChild(labTable(['Latent component','Current','95% range','Observed days','Process SD','Measure SD','Empirical persistence','Strength'],dimensionRows,{wide:true,columns:'minmax(150px,1.2fr) 82px 104px 92px 90px 94px 130px 112px'}));
      body.appendChild(overview);
      const stateByDate=new Map((state.history||[]).map(row=>[row.date,row]));
      const observationRows=(state.observations||[]).slice().sort((a,b)=>b.day-a.day).map(observation=>{
        const filtered=stateByDate.get(observation.date)||{};
        const filteredStates=filtered.states||{};
        return [
          shortDate(observation.date),
          Number.isFinite(observation.completion)?percentLabel(observation.completion,1):'No completion',
          Number.isFinite(observation.components&&observation.components.execution&&observation.components.execution.value)?percentLabel(observation.components.execution.value,1):'Unknown',
          Number.isFinite(observation.components&&observation.components.recovery&&observation.components.recovery.value)?percentLabel(observation.components.recovery.value,1):'Unknown',
          minutesLabel(observation.planned),
          fitnessSourceMixLabel(observation.plannedByGroup),
          numberLabel(observation.evidenceWeight,2),
          Number.isFinite(filtered.estimate)?percentLabel(filtered.estimate,1):'No state',
          filteredStates.execution?percentLabel(filteredStates.execution.estimate,1):'—',
          filteredStates.recovery?percentLabel(filteredStates.recovery.estimate,1):'—'
        ];
      });
      const observations=el('section','insights-card soft ui-card');
      observations.appendChild(sectionTitle('Daily state observations','Newest saved days first; reveal ten more at a time.'));
      observations.appendChild(progressiveLabTable(['Date','Completion obs.','Schedule obs.','Focus obs.','Planned','Progress-source mix','Weight','Output state','Schedule control','Focus control'],observationRows,{wide:true,mobileScroll:true,columns:'82px 116px 112px 112px 84px minmax(220px,1.5fr) 70px 104px 106px 106px'},'observation'));
      observations.appendChild(evidenceNote('Completion remains canonical planned-minute-weighted output. Schedule control uses captured start delay and saved schedule movement; movement may reflect disruption or deliberate adaptation. Focus control uses Timer-backed friction and accepted Pomodoro returns only. Rated quality is separate context. Each component has separate missingness and uncertainty; none is a health or intelligence measure.'));
      body.appendChild(observations);
      return body;
    });
    section.appendChild(details);
    return section;
  }
  function renderDynamicsEvidence(model:InsightsResult){
    const section=labSection('9. Study Dynamics model evidence','Posterior grids, online regime probabilities, adjusted sequence coefficients, response curves, and rolling calibration remain available without lengthening the normal surface.',true);
    const details=lazyDisclosure('insights-dynamics-evidence ui-inset','Open uncertainty & model evidence',()=>{
      const body=el('div','insights-dynamics-evidence-body');
      const auditModel=resolveLabModel(model);
      const dynamics:LabDynamics=auditModel.dynamics;
      const bayesian=dynamics.bayesian;
      const patternRows=(bayesian.dimensions||[]).flatMap(dimension=>(dimension.rows||[]).map(row=>[
        dimension.label,row.label,row.blocks,minutesLabel(row.planned),percentLabel(row.rawCompletion,1),percentLabel(row.estimate.mean,1),evidenceIntervalLabel(row.estimate),numberLabel(row.nEff,1),row.estimate.confidence.label
      ]));
      if(patternRows.length){
        const patternCard=el('section','insights-card soft ui-card');
        patternCard.appendChild(sectionTitle('Hierarchical posterior evidence','Each dimension learns its own population mean and concentration through numerical hyper-posterior integration; groups are then partially pooled.'));
        patternCard.appendChild(labTable(['Dimension','Hierarchy','Population posterior','Concentration','Groups','Eff. n'],(bayesian.dimensions||[]).map(dimension=>[
          dimension.label,dimension.ready?'Learned hierarchy':'Weak-prior fallback',`${percentLabel(dimension.populationMean,1)} · 95% ${percentLabel(dimension.populationLow,0)}–${percentLabel(dimension.populationHigh,0)}`,numberLabel(dimension.populationConcentration,1),dimension.groups||0,numberLabel(dimension.totalEffective,1)
        ]),{wide:true,columns:'140px 130px minmax(210px,1.3fr) 110px 70px 76px'}));
        patternCard.appendChild(progressiveLabTable(['Dimension','Group','Blocks','Planned','Raw','Posterior','95% range','Eff. n','Strength'],patternRows,{wide:true,mobileScroll:true,columns:'130px minmax(145px,1.2fr) 64px 86px 72px 84px 104px 70px 118px'},'pattern'));
        body.appendChild(patternCard);
      }
      const change=dynamics.changePoint||{};
      const changeCard=el('section','insights-card soft ui-card');
      changeCard.appendChild(sectionTitle('Online regime evidence','Bayesian run-length probabilities are updated in date order; the reported date is inferred from the strongest recent-change posterior.'));
      changeCard.appendChild(labTable(['Evidence','Value','Gate / reading'],[
        ['Completion days',change.days||0,`Minimum ${change.minimumDays||MIN_CHANGE_POINT_DAYS}`],
        ['Candidate date',change.date?shortDate(change.date):'No candidate',`${change.beforeDays||0} before · ${change.afterDays||0} after`],
        ['Mean separation',change.delta===null||change.delta===undefined?'No data':`${change.delta>0?'+':''}${change.delta} pts`,`${MIN_CHANGE_POINT_DELTA_POINTS}+ absolute points`],
        ['Peak recent-change posterior',percentLabel(change.probability,1),`${percentLabel(BOCPD_DETECTION_PROBABILITY*100,0)}+ required`],
        ['Current modal run',Number.isFinite(change.currentRunLength)?`${change.currentRunLength} eligible days`:'Unavailable',Number.isFinite(change.currentRegimeMean)?`Current regime mean ${percentLabel(change.currentRegimeMean,1)}`:'No regime estimate'],
        ['Decision',change.detected?'Regime change detected':'No qualifying change',change.reason||'']
      ],{wide:true,columns:'minmax(160px,1fr) 130px minmax(230px,1.5fr)'}));
      const regimeRows=(change.history||[]).slice().reverse().map(row=>[shortDate(row.date),percentLabel(row.completion,1),percentLabel(row.changeProbability*100,1),percentLabel(row.recentChangeProbability*100,1),row.modalRunLength,percentLabel(row.regimeMean,1)]);
      if(regimeRows.length)changeCard.appendChild(progressiveLabTable(['Date','Completion','New-regime P','Recent-change P','Modal run','Regime mean'],regimeRows,{wide:true,columns:'82px 88px 104px 116px 84px 104px'},'regime day'));
      body.appendChild(changeCard);
      const allocation:LabAllocation=dynamics.allocation;
      if(allocation.ready){
        const allocationCard=el('section','insights-card soft ui-card');
        allocationCard.appendChild(sectionTitle('Allocation-distance evidence',`${allocation.label} · Jensen–Shannon divergence ${allocation.divergence} (${allocation.divergencePercent}% of its bounded scale).`));
        allocationCard.appendChild(labTable(['Area','Planned share','Completed share','Shift','Window plan','Completed equivalent'],allocation.rows.map(row=>[
          row.label,percentLabel(row.plannedShare,1),percentLabel(row.completedShare,1),`${row.gap>0?'+':''}${row.gap} pts`,minutesLabel(row.planned),minutesLabel(row.completed)
        ]),{wide:true,columns:'minmax(150px,1.3fr) 105px 120px 82px 100px 150px'}));
        body.appendChild(allocationCard);
      }
      const cascade=dynamics.cascade||{};
      if(cascade.transitions||num(cascade.adjusted&&cascade.adjusted.hazard&&cascade.adjusted.hazard.rows)){
        const cascadeCard=el('section','insights-card soft ui-card');
        const adjusted=cascade.adjusted||{};
        cascadeCard.appendChild(sectionTitle('Adjusted sequence evidence',`${cascade.transitions} adjacent transitions · ${(adjusted.hazard&&adjusted.hazard.rows)||0} hazard rows · ${(adjusted.hazard&&adjusted.hazard.events)||0} terminal-collapse events.`));
        const effectRows=[
          ...(adjusted.transition&&adjusted.transition.effects||[]).map(row=>['Next-block strength',row.label,row.oddsRatio,`${row.oddsLow}–${row.oddsHigh}`,row.clear?'Clear':'Uncertain',adjusted.transition.confidence.label]),
          ...(adjusted.hazard&&adjusted.hazard.effects||[]).map(row=>['Terminal-collapse hazard',row.label,row.oddsRatio,`${row.oddsLow}–${row.oddsHigh}`,row.clear?'Clear':'Uncertain',adjusted.hazard.confidence.label])
        ];
        if(effectRows.length)cascadeCard.appendChild(labTable(['Model','Covariate','Odds ratio','95% range','Interval','Strength'],effectRows,{wide:true,mobileScroll:true,columns:'155px minmax(190px,1.4fr) 92px 102px 84px 112px'}));
        else cascadeCard.appendChild(evidenceNote(adjusted.reason||'Adjusted models are not yet estimable.'));
        body.appendChild(cascadeCard);
      }
      const interactions=dynamics.interactions;
      const dynamicAllocation:LabDynamicAllocation=allocation.dynamic??{};
      const allocationPeriods=dynamicAllocation.allPeriods||dynamicAllocation.periods||[];
      if(allocationPeriods.length){
        const dynamicCard=el('section','insights-card soft ui-card');
        dynamicCard.appendChild(sectionTitle('Allocation over time','All completed eligible weeks determine persistence; directional trend uses at most the latest two years. The current open week is shown separately as provisional, and lifetime allocation remains the anchor.'));
        dynamicCard.appendChild(labTable(['Week','Status','Planned','Completed eq.','Divergence'],allocationPeriods.slice().reverse().map(period=>[`${shortDate(period.start)}–${shortDate(period.end)}`,period.provisional?'Provisional':'Completed',minutesLabel(period.planned),minutesLabel(period.completed),numberLabel(finiteNumber(period.divergence)?period.divergence*100:null,1)]),{wide:true,columns:'minmax(150px,1fr) 90px 100px 110px 100px'}));
        dynamicCard.appendChild(evidenceNote(dynamicAllocation.ready&&dynamicAllocation.trend?`${dynamicAllocation.trend.label} · ${dynamicAllocation.trendBasis&&dynamicAllocation.trendBasis.label||'directional basis'}. ${dynamicAllocation.persistentUnder?`${dynamicAllocation.persistentUnder.label} was under plan in ${dynamicAllocation.persistentUnder.under}/${dynamicAllocation.persistentUnder.periods} completed eligible weeks.`:'No area cleared the persistent under-allocation gate.'}${dynamicAllocation.provisionalPeriod?' The current week is excluded from those calculations.':''}`:dynamicAllocation.reason));
        body.appendChild(dynamicCard);
      }
      if(interactions.tests&&interactions.tests.length){
        const interactionCard=el('section','insights-card soft ui-card');
        interactionCard.appendChild(sectionTitle('Restrained interaction checks','Difference-in-differences after shrinkage; all four cells must clear row and day gates, then the direction must repeat across early and late evidence halves.'));
        interactionCard.appendChild(labTable(['Combination','Effect','Cells ready','Early half','Late half','Stable','Retained'],interactions.tests.filter(test=>test.ready||test.key!=='area-time').map(test=>[
          test.label,
          finiteNumber(test.effect)?`${test.effect>0?'+':''}${test.effect} pts`:'—',
          test.ready?'Yes':'No',
          Number.isFinite(test.stability&&test.stability.earlyEffect)?`${test.stability.earlyEffect>0?'+':''}${test.stability.earlyEffect} pts`:'—',
          Number.isFinite(test.stability&&test.stability.lateEffect)?`${test.stability.lateEffect>0?'+':''}${test.stability.lateEffect} pts`:'—',
          test.stability&&test.stability.ready?'Yes':'No',
          test.meaningful?'Yes':'No'
        ]),{wide:true,columns:'minmax(180px,1.2fr) 88px 88px 88px 88px 76px 78px'}));
        interactionCard.appendChild(evidenceNote(interactions.reason));
        body.appendChild(interactionCard);
      }
      const workload:LabWorkload=dynamics.workload;
      if(workload.ready){
        const workloadCard=el('section','insights-card soft ui-card');
        const calibration=workload.calibration||{};
        workloadCard.appendChild(sectionTitle('Response-surface & forecast evidence',`${workload.days} eligible days · planned span ${minutesLabel(workload.span)} · ${calibration.label||'calibration pending'}.`));
        workloadCard.appendChild(labTable(['Calibration evidence','Value','Reading'],[
          ['Rolling completion backtests',calibration.backtests||0,`${MIN_FORECAST_BACKTESTS}+ required for completion calibration`],
          ['Rolling strong-day backtests',calibration.strongBacktests||0,`${MIN_FORECAST_BACKTESTS}+ with both outcomes required for probability calibration`],
          ['Cross-fitted recalibration',calibration.crossFitReady?'Ready':'Not ready',`${FORECAST_CALIBRATION_FOLDS} stratified folds; every displayed diagnostic prediction remains held out from its recalibration fit`],
          ['Strong-day Brier score',calibration.brier===null||calibration.brier===undefined?'Unavailable':numberLabel(calibration.brier,3),`Cross-fitted score; personal base-rate benchmark ${calibration.baselineBrier===null||calibration.baselineBrier===undefined?'unavailable':numberLabel(calibration.baselineBrier,3)}`],
          ['Calibration error',calibration.calibrationError===null||calibration.calibrationError===undefined?'Unavailable':`${calibration.calibrationError}%`,'Weighted absolute predicted-versus-observed gap across three probability bins'],
          ['Completion MAE',calibration.completionMae===null||calibration.completionMae===undefined?'Unavailable':`${calibration.completionMae} pts`,'Mean absolute one-step completion error'],
          ['Naïve median MAE',calibration.naiveCompletionMae===null||calibration.naiveCompletionMae===undefined?'Unavailable':`${calibration.naiveCompletionMae} pts`,`Recent-seven-day median benchmark; model gain ${Number.isFinite(calibration.naiveMaeGain)?`${calibration.naiveMaeGain>0?'+':''}${calibration.naiveMaeGain} pts`:'unavailable'} · ${FORECAST_MIN_NAIVE_MAE_GAIN_POINTS}+ required`],
          ['Completion-range status',calibration.intervalReady?'Backtest-checked 80% range':'Estimated model range',calibration.intervalReady?`${percentLabel(calibration.completionRange&&calibration.completionRange.coverage,1)} leave-one-out coverage across ${calibration.completionRange&&calibration.completionRange.coverageTests||0} checks`:(calibration.intervalReason||'Historical range coverage has not passed')],
          ['Completion-range half-width',Number.isFinite(calibration.completionRange&&calibration.completionRange.halfWidthPoints)?`${calibration.completionRange.halfWidthPoints} pts`:'Unavailable',`Finite-sample ${percentLabel(FORECAST_COMPLETION_RANGE_TARGET*100,0)} absolute-error quantile from held-out rolling forecasts`],
          ['Selected forecast model',workload.forecast&&workload.forecast.modelLabel||calibration.selectedModelLabel||'Baseline workload model',calibration.selectionReason||'The simpler model remains the default unless the expanded state model wins held-out tests.'],
          ['State predictor causality',calibration.comparison&&calibration.comparison.causalGuard?'Origin-causal':'Guarded',calibration.comparison&&calibration.comparison.causalGuard?'Every historical state predictor used only evidence available before its forecast date.':'The state-aware model cannot win selection.'],
          ['Baseline vs state-aware MAE',`${numberLabel(calibration.candidates&&calibration.candidates.baseline&&calibration.candidates.baseline.completionMae,1)} vs ${numberLabel(calibration.candidates&&calibration.candidates.stateAware&&calibration.candidates.stateAware.completionMae,1)} pts`,Number.isFinite(calibration.comparison&&calibration.comparison.maeGain)?`State-aware gain ${calibration.comparison.maeGain>0?'+':''}${calibration.comparison.maeGain} points; ${calibration.comparison.requiredMaeGain}+ required`:'State-aware comparison not yet complete'],
          ['Local workload support',workload.recommendation?`${workload.recommendation.localSupport} days at anchor`:'Region withheld',workload.recommendation?`${MIN_WORKLOAD_LOCAL_SUPPORT_DAYS}+ nearby days required inside ${minutesLabel(workload.localSupport&&workload.localSupport.radius||45)}`:workload.recommendationReason||'No locally supported region'],
          ['Completion forecast',workload.forecast&&workload.forecast.completionReady?'Calibrated':'Abstained',workload.forecast&&workload.forecast.completionReady?'Rolling error, naïve-benchmark, and local-support gates cleared':workload.forecast&&workload.forecast.completionReason||calibration.completionReason||'Completion surface remains descriptive'],
          ['Strong-day forecast',workload.forecast&&workload.forecast.strongReady?'Calibrated':'Withheld',workload.forecast&&workload.forecast.strongReady?'Outcome diversity, probability calibration, and local-support gates cleared':workload.forecast&&workload.forecast.strongReason||calibration.strongReason||workload.strongReason||'Strong-day probability unavailable']
        ],{wide:true,columns:'minmax(180px,1fr) 150px minmax(280px,1.6fr)'}));
        if((workload.empiricalBands||[]).length)workloadCard.appendChild(labTable(['Empirical band','Days','Plan range','Mean plan','Mean completion','Strong days','Expected completed'],workload.empiricalBands.map(band=>[
          band.label,band.days,`${minutesLabel(band.minPlanned)}–${minutesLabel(band.maxPlanned)}`,minutesLabel(band.meanPlanned),percentLabel(band.meanCompletion,1),`${band.strongDays}/${band.days} · ${percentLabel(band.strongRate,1)}`,minutesLabel(band.expectedCompleted)
        ]),{wide:true,mobileScroll:true,columns:'105px 62px 135px 90px 118px 125px 135px'}));
        if((workload.observations||[]).length)workloadCard.appendChild(progressiveLabTable(['Date','Planned','Completion','Completed equivalent','Strong day'],workload.observations.slice().reverse().map(row=>[
          shortDate(row.date),minutesLabel(row.planned),percentLabel(row.completion,1),minutesLabel(row.completed),row.strong?'Yes':'No'
        ]),{wide:true,mobileScroll:true,columns:'90px 100px 100px 150px 90px'},'workload day'));
        workloadCard.appendChild(progressiveLabTable(['Planned','Completion','Estimated model range','P(strong)','Probability range','Expected completed','Nearby days','Frontier'],(workload.curve||[]).map(row=>[
          minutesLabel(row.planned),percentLabel(row.completionMean,1),`${percentLabel(row.completionLow,0)}–${percentLabel(row.completionHigh,0)}`,Number.isFinite(row.strongProbability)?percentLabel(row.strongProbability,1):'Unavailable',Number.isFinite(row.strongLow)&&Number.isFinite(row.strongHigh)?`${percentLabel(row.strongLow,0)}–${percentLabel(row.strongHigh,0)}`:'Unavailable',minutesLabel(row.expectedCompleted),row.localSupport||0,row.frontier?'Yes':'Dominated'
        ]),{wide:true,mobileScroll:true,columns:'92px 96px 150px 96px 128px 128px 88px 88px'},'response point'));
        body.appendChild(workloadCard);
      }
      body.appendChild(evidenceNote('Study Dynamics estimates use all saved eligible history, while the selected Insights window controls surrounding display context. Confidence labels express evidence quantity and interval precision; they do not establish causation, generalise to other people, or replace the underlying saved records.'));
      return body;
    });
    section.appendChild(details);
    return section;
  }
  function renderAnalyticsLab(model:InsightsResult){
    return lazyDisclosure('insights-dynamics-lab ui-disclosure','Analytics Lab: Evidence & Audit',()=>{
      const body=el('div','insights-dynamics-lab-body');
      body.append(
        el('div','insights-dossier-intro ui-inset ui-mono','Use Analytics Lab when you want to understand or verify an Insight. It shows how much usable data is available, how completely Timer and progress were recorded, what was excluded, and the evidence behind each finding. It is read-only and never changes your records.'),
        renderSampleReliability(model),renderOutcomeEvidence(model),renderPlanRealismEvidence(model),renderExecutionMechanics(model),renderFrictionEvidence(model),renderSubjectEvidence(model),renderPracticeEvidence(model),renderFitnessEvidence(model),renderDynamicsEvidence(model),renderMetricGuideSection()
      );
      return body;
    },true);
  }
    return Object.freeze({
      renderAnalyticsLab
    });
  })(InsightsConfig,InsightsPrimitives,InsightsRendering);



  // M8.12 RETAINED VIEW COMPONENT
  const InsightsRetainedView=((Primitives:ModelRuntime['Primitives'],Records:ModelRuntime['Records'],Rendering:Rendering,AnalyticsLab:Readonly<{renderAnalyticsLab(model:InsightsResult):HTMLElement}>)=>{
    const {
      localIsoDate
    }=Primitives;
    const {
      filterSummariesForInsightWindow,normalizeSummaries,summariesRevisionKey
    }=Records;
    const {
      Layout,clusterHeader,el,injectStyles,renderCoach,renderDemoBanner,renderEmptyState,renderExecutionSurface,
      renderMetrics,renderSectionNavigation,renderStudyDynamics,renderStudyFitnessReport,renderSubjectCoverage,
      renderTrainingLog,renderVisuals,renderWindowSelector
    }=Rendering;
    const {
      renderAnalyticsLab
    }=AnalyticsLab;
  // Sections below the first screen skip layout and paint until they come
  // near the viewport; they stay in the accessibility tree, find-in-page and
  // anchor navigation. Their last rendered height is remembered.
  function belowFold<T extends HTMLElement>(node:T):T{
    if(node&&node.classList)node.classList.add('insights-below-fold');
    return node;
  }
  async function renderModel(pane:HTMLElement,model:InsightsResult,options:Readonly<{source?:PreviewSource|null;api:InsightsPluginApi;currentStudyDate:string;isCurrent?:()=>boolean;onShell?:(value:number)=>void;onWindowChange?:(key:string)=>unknown;reload:()=>unknown}>){
    const started=performance.now();let maxChunkMs=0,chunks=0;
    const appendChunk=(callback:()=>void)=>{
      const chunkStarted=performance.now();callback();
      maxChunkMs=Math.max(maxChunkMs,performance.now()-chunkStarted);chunks+=1;
    };
    const nextChunk=async(callback:()=>void)=>{
      // Keep secondary sections cooperative without forcing one complete display
      // frame per section. scheduler.yield lets input, style and paint work run
      // between chunks without turning nine short DOM units into nine frame waits.
      if(globalThis.scheduler&&typeof globalThis.scheduler.yield==='function')await globalThis.scheduler.yield();
      else await new Promise(resolve=>setTimeout(resolve,0));
      if(typeof options.isCurrent==='function'&&!options.isCurrent())return false;
      appendChunk(callback);return true;
    };
    Layout.purge(pane);Layout.mark();
    pane.replaceChildren();
    injectStyles();
    const wrap=el('div','insights-wrap');
    const hero=el('section','insights-hero ui-panel');
    hero.id='insights-overview';
    hero.classList.add('insights-anchor-target');
    const heroHeading=el('div','insights-hero-heading');
    heroHeading.append(
      el('div','insights-kicker ui-label','Study Coach + Evidence Dashboard'),
      el('div','insights-title ui-title','Insights')
    );
    hero.append(heroHeading,renderWindowSelector(model,options.onWindowChange));
    wrap.appendChild(hero);
    if(options.source&&options.source.type==='demo')wrap.appendChild(renderDemoBanner(options.api,options.reload));
    pane.appendChild(wrap);
    if(typeof options.onShell==='function')options.onShell(performance.now()-started);
    if(!model.allRecordCount){
      wrap.appendChild(renderEmptyState(options.api,options.reload,options.currentStudyDate));
      return {domMs:performance.now()-started,maxChunkMs,chunks};
    }
    if(!model.recordCount)wrap.appendChild(el('div','insights-empty ui-card ui-mono',`${model.windowLabel||'The selected window'} contains no saved days. All-history Current Study State and Study Dynamics remain available; selected-window sections show no current evidence.`));
    if(!await nextChunk(()=>{
      wrap.appendChild(renderSectionNavigation());
      const head=clusterHeader('Coach & Current State','The synthesis layer: evidence first, two immediate priorities, and four additional surface reads when available.');
      head.id='insights-coach';head.classList.add('insights-anchor-target');wrap.append(head,renderCoach(model));
    }))return {cancelled:true,domMs:performance.now()-started,maxChunkMs,chunks};
    if(!await nextChunk(()=>{
      const section=renderStudyFitnessReport(model);section.id='insights-fitness';section.classList.add('insights-anchor-target');wrap.appendChild(section);
    }))return {cancelled:true,domMs:performance.now()-started,maxChunkMs,chunks};
    if(!await nextChunk(()=>{
      const head=clusterHeader('Performance','The training record and output evidence: what was planned, completed, sustained, and repeated across the selected window.');
      head.id='insights-performance';head.classList.add('insights-anchor-target');wrap.append(head,belowFold(renderMetrics(model)));
    }))return {cancelled:true,domMs:performance.now()-started,maxChunkMs,chunks};
    if(!await nextChunk(()=>wrap.appendChild(belowFold(renderTrainingLog(model)))))return {cancelled:true,domMs:performance.now()-started,maxChunkMs,chunks};
    if(!await nextChunk(()=>{
      const head=clusterHeader('Study Output','Work-completion trends, weekly rhythm, plan realism, and calendar intensity for the selected window.');
      head.id='insights-output';head.classList.add('insights-anchor-target');wrap.append(head,belowFold(renderVisuals(model)));
    }))return {cancelled:true,domMs:performance.now()-started,maxChunkMs,chunks};
    if(!await nextChunk(()=>{
      const head=clusterHeader('Execution','Daily execution mechanics and timed-practice pacing, kept as two distinct views.');
      head.id='insights-execution';head.classList.add('insights-anchor-target');wrap.append(head,belowFold(renderExecutionSurface(model)));
    }))return {cancelled:true,domMs:performance.now()-started,maxChunkMs,chunks};
    if(!await nextChunk(()=>{
      const head=clusterHeader('Area Coverage','Describes area work completion, planned-versus-completed allocation, known absences, and Coverage Watch signals.');
      head.id='insights-areas';head.classList.add('insights-anchor-target');wrap.append(head,belowFold(renderSubjectCoverage(model)));
    }))return {cancelled:true,domMs:performance.now()-started,maxChunkMs,chunks};
    if(!await nextChunk(()=>{
      const section=renderStudyDynamics(model);section.id='insights-dynamics';section.classList.add('insights-anchor-target');wrap.appendChild(belowFold(section));
    }))return {cancelled:true,domMs:performance.now()-started,maxChunkMs,chunks};
    if(!await nextChunk(()=>{
      const section=renderAnalyticsLab(model);section.id='insights-lab';section.classList.add('insights-anchor-target');wrap.appendChild(section);
    }))return {cancelled:true,domMs:performance.now()-started,maxChunkMs,chunks};
    return {domMs:performance.now()-started,maxChunkMs,chunks};
  }
  const InsightsRenderCoordinator=(()=>{
    let generation=0;
    return Object.freeze({
      begin(){generation+=1;return generation;},
      isCurrent(token:number){return token===generation;}
    });
  })();
  function supportsCapabilities(api:InsightsPluginApi|null|undefined,requirements:Capabilities){
    const capabilities=api&&api.capabilities;
    return !!capabilities&&Object.entries(requirements).every(([key,minimum])=>Number(capabilities[key]||0)>=Number(minimum));
  }
  function sourceIdentity(source:PreviewSource|null|undefined){
    const row=source&&typeof source==='object'?source:{};
    return [row.type||'real',row.mode||'',row.target||'',row.label||'',row.revision||''].map(value=>String(value)).join('|');
  }
  function renderInitialInsightsLoading(pane:HTMLElement){
    pane.setAttribute('aria-busy','true');
    const panel=el('section','ui-panel plugin-loading-panel');
    panel.append(
      el('div','ui-label','Study Coach + Evidence Dashboard'),
      el('h1','ui-title','Insights'),
      el('div','ui-status','Preparing your saved study history…'),
      el('div','ui-body plugin-loading-copy','Your study record is being prepared. Later visits in this app session will reopen the retained view instantly unless the underlying data changes.')
    );
    const track=el('div','plugin-loading-track');
    track.setAttribute('aria-hidden','true');
    panel.appendChild(track);
    pane.replaceChildren(panel);
  }
  function showInsightsUpdateStatus(pane:HTMLElement,text='Updating insights…',error=false){
    let status=pane.querySelector('.insights-update-status');
    if(!status){
      status=el('div','insights-update-status ui-inset ui-mono');
      pane.appendChild(status);
    }
    status.classList.toggle('err',!!error);
    status.setAttribute('role',error?'alert':'status');
    status.setAttribute('aria-live',error?'assertive':'polite');
    status.textContent=text;
    pane.setAttribute('aria-busy',error?'false':'true');
    return status;
  }
  function clearInsightsUpdateStatus(pane:HTMLElement){
    pane.querySelector('.insights-update-status')?.remove();
    pane.setAttribute('aria-busy','false');
  }
  function createInsightsView(api:InsightsPluginApi,engine:InsightsEngine){
    const computation=computeBridge.create(api,engine);
    const state:ViewState={
      pane:null,
      rendered:false,
      renderedKey:'',
      renderedBaseKey:'',
      renderedWindowKey:'',
      session:null,
      scrollWindow:0,
      scrollMain:0,
      errorTimer:null,
      suppressScroll:false,
      paneObserver:null,
      lastProfile:null,
      navigationReady:Promise.resolve(true),
      prefetching:null,
      prefetchWorking:false,
      prefetched:null
    };
    const main=document.querySelector<HTMLElement>('.main');
    const observePane=(pane:HTMLElement)=>{
      if(state.pane===pane&&state.paneObserver)return;
      if(state.paneObserver)state.paneObserver.disconnect();
      state.pane=pane;
      if(typeof MutationObserver!=='function')return;
      state.paneObserver=new MutationObserver(()=>{
        if(pane.hidden||!pane.classList.contains('on')){computation.release();engine.releaseTransient();}
      });
      state.paneObserver.observe(pane,{attributes:true,attributeFilter:['class','hidden']});
    };
    const captureScroll=()=>{
      const pane=state.pane;
      if(state.suppressScroll||!state.rendered||!pane||!pane.classList.contains('on'))return;
      state.scrollWindow=Math.max(0,window.scrollY||document.documentElement.scrollTop||0);
      state.scrollMain=Math.max(0,main&&main.scrollTop||0);
    };
    window.addEventListener('scroll',captureScroll,{passive:true});
    if(main)main.addEventListener('scroll',captureScroll,{passive:true});
    const restoreScroll=({immediate=false}:Readonly<{immediate?:boolean}>={})=>{
      const pane=state.pane;
      state.suppressScroll=true;
      const apply=()=>{
        if(pane&&pane.classList.contains('on')){
          if(main)main.scrollTop=state.scrollMain;
          window.scrollTo(0,state.scrollWindow);
        }
      };
      if(immediate){apply();requestAnimationFrame(()=>{state.suppressScroll=false;});return Promise.resolve(true);}
      return new Promise(resolve=>requestAnimationFrame(()=>{
        apply();resolve(true);requestAnimationFrame(()=>{state.suppressScroll=false;});
      }));
    };
    const readDatasetRevision=async(dataSource:InsightDataSource):Promise<string|null>=>{
      if(typeof dataSource.getDatasetRevision!=='function')return null;
      try{return await dataSource.getDatasetRevision();}catch(error){return null;}
    };
    const loadSession=async({dataSource,source,sourceKey,currentStudyDate,datasetRevision,isCurrent,profile}:Readonly<{dataSource:InsightDataSource;source:PreviewSource|null;sourceKey:string;currentStudyDate:string;datasetRevision:string|null;isCurrent:()=>boolean;profile:Pick<ProfileAccumulator,'recordLoadMs'|'evidencePreparationMs'>}>):Promise<Session|null>=>{
      const loadStarted=performance.now();
      const readCanonicalInputs=async():Promise<readonly [SummaryInput,readonly InsightRecord[]]>=>{
        if(typeof dataSource.getDailySnapshot==='function'){
          const snapshot=await dataSource.getDailySnapshot();
          return [Array.isArray(snapshot&&snapshot.summaries)?snapshot.summaries:[],Array.isArray(snapshot&&snapshot.records)?snapshot.records:[]];
        }
        return Promise.all([
          typeof dataSource.getDailySummaries==='function'?dataSource.getDailySummaries():[],
          dataSource.getDailyRecords({})
        ]);
      };
      let rawSummaries:SummaryInput=[],rawRecords:readonly InsightRecord[]=[],summaries:readonly DailySummary[]=[],records:readonly InsightRecord[]=[],stable=false;
      for(let attempt=0;attempt<3&&!stable;attempt+=1){
        [rawSummaries,rawRecords]=await readCanonicalInputs();
        summaries=normalizeSummaries(rawSummaries);records=Array.isArray(rawRecords)?rawRecords:[];
        if(!isCurrent())return null;
        const afterSource=typeof dataSource.getRecordSource==='function'?dataSource.getRecordSource():source;
        const afterSourceKey=sourceIdentity(afterSource);
        const afterRevision=await readDatasetRevision(dataSource);
        if(!isCurrent())return null;
        stable=afterSourceKey===sourceKey&&((datasetRevision&&afterRevision===datasetRevision)||(!datasetRevision&&!afterRevision));
        source=afterSource;sourceKey=afterSourceKey;datasetRevision=afterRevision;
      }
      if(!stable)return null;
      profile.recordLoadMs+=performance.now()-loadStarted;
      const evidenceStarted=performance.now();
      records=computation.enrichRecords(records);
      const scheduler=Reflect.get(globalThis,'scheduler') as IdleScheduler|undefined;
      const yieldPreparation=()=>scheduler&&typeof scheduler.yield==='function'
        ?globalThis.scheduler.yield()
        :new Promise(resolve=>setTimeout(resolve,0));
      const prepared=await engine.prepareAsync(records,datasetRevision,yieldPreparation);
      profile.evidencePreparationMs+=performance.now()-evidenceStarted;
      const summaryRevision=summariesRevisionKey(summaries);
      const finalSourceRevision=datasetRevision||String(source&&source.revision||'');
      const baseKey=`${sourceKey}|${currentStudyDate}|${finalSourceRevision||'fallback'}`;
      return Object.freeze({baseKey,source,currentStudyDate,datasetRevision,summaries,summaryRevision,prepared});
    };
    // One description of the model a session and window need, shared by the
    // visible render and idle pre-computation so their keys always agree.
    const planModel=(session:Session,windowKey:unknown,currentStudyDate:string):PlannedModel=>{
      const canonicalSummaryCount=new Set(session.summaries.map(summary=>summary.date)).size;
      const windowInfo=engine.filterPreparedWindow(session.prepared,windowKey,currentStudyDate);
      const fullKey=`${session.baseKey}|${windowInfo.key}|${session.summaryRevision}|${session.prepared.revision}`;
      const windowSummaries=filterSummariesForInsightWindow(session.summaries,windowInfo);
      const modelOptions={
        windowKey:windowInfo.key,
        windowDays:windowInfo.days,
        windowLabel:windowInfo.label,
        windowFrom:windowInfo.from,
        windowTo:windowInfo.to,
        allRecordCount:Math.max(canonicalSummaryCount,windowInfo.allRecordCount),
        currentStudyDate,
        streakSummaries:windowSummaries,
        subjectReferenceSummaries:session.summaries,
        subjectReferenceRevision:session.summaryRevision
      };
      return {windowInfo,fullKey,modelOptions};
    };
    // Idle pre-computation. A long saved history is read and its model built
    // while the app is idle and Insights is closed, so opening the tab draws a
    // ready model instead of waiting on a cold worker. It only reads data, runs
    // only with a worker, a trusted dataset revision and a visible page, and its
    // result is used only when every key part still matches.
    const PREFETCH_IDLE_TIMEOUT_MS=10000;
    const publishPrefetch=(status:Readonly<Record<string,unknown>>):PrefetchStatus=>{
      const result=Object.freeze({...status,at:Number(performance.now().toFixed(2))});
      window.__StudyDirectorInsightsPrefetch=result;
      return result;
    };
    const whenIdle=()=>new Promise<void>(resolve=>{
      if(typeof requestIdleCallback==='function')requestIdleCallback(()=>resolve(),{timeout:PREFETCH_IDLE_TIMEOUT_MS});
      else setTimeout(resolve,200);
    });
    const insightsOpen=()=>{const pane=document.getElementById('pane-insights');return !!pane&&!pane.hidden&&pane.classList.contains('on');};
    const runPrefetch=async():Promise<PrefetchStatus>=>{
      await whenIdle();
      if(document.visibilityState==='hidden')return publishPrefetch({state:'skipped',reason:'hidden'});
      if(insightsOpen())return publishPrefetch({state:'skipped',reason:'open'});
      if(!computation.supported())return publishPrefetch({state:'skipped',reason:'no-worker'});
      // From here an opening of the tab waits for this work and reuses it.
      state.prefetchWorking=true;
      const started=performance.now();
      const dataSource=api.insights.dataSource;
      const source=typeof dataSource.getRecordSource==='function'?dataSource.getRecordSource():null;
      if(!source||source.type!=='real')return publishPrefetch({state:'skipped',reason:'not-saved-data'});
      const currentStudyDate=typeof dataSource.getCurrentStudyDate==='function'?dataSource.getCurrentStudyDate():localIsoDate();
      const windowKey=readInsightWindowKey();
      const datasetRevision=await readDatasetRevision(dataSource);
      if(!datasetRevision)return publishPrefetch({state:'skipped',reason:'no-revision'});
      const sourceKey=sourceIdentity(source),baseKey=`${sourceKey}|${currentStudyDate}|${datasetRevision}`;
      if(state.rendered&&state.renderedBaseKey===baseKey&&state.renderedWindowKey===windowKey)return publishPrefetch({state:'skipped',reason:'view-current'});
      if(state.prefetched&&state.prefetched.baseKey===baseKey&&state.prefetched.windowKey===windowKey)return publishPrefetch({state:'ready',reason:'already-prepared'});
      const timing={recordLoadMs:0,evidencePreparationMs:0};
      const session=state.session&&state.session.baseKey===baseKey?state.session:await loadSession({dataSource,source,sourceKey,currentStudyDate,datasetRevision,isCurrent:()=>true,profile:timing});
      if(!session||session.baseKey!==baseKey)return publishPrefetch({state:'skipped',reason:'revision-changed'});
      state.session=session;
      const plan=planModel(session,windowKey,currentStudyDate);
      if(Math.max(plan.windowInfo.records.length,session.prepared.records.length)<computation.minimumRecords)return publishPrefetch({state:'skipped',reason:'short-history',recordLoadMs:timing.recordLoadMs});
      const result=await computation.build(plan.windowInfo.records,session.prepared,plan.modelOptions);
      if(!insightsOpen())computation.release();
      state.prefetched=Object.freeze({baseKey,windowKey,fullKey:plan.fullKey,result});
      return publishPrefetch({state:'ready',reason:'prepared',mode:result.mode,records:plan.windowInfo.records.length,recordLoadMs:Number(timing.recordLoadMs.toFixed(2)),evidencePreparationMs:Number(timing.evidencePreparationMs.toFixed(2)),modelComputeMs:Number(result.computeMs.toFixed(2)),workerRoundTripMs:Number(result.roundTripMs.toFixed(2)),totalMs:Number((performance.now()-started).toFixed(2))});
    };
    const prefetch=():Promise<PrefetchStatus>=>{
      if(state.prefetching)return state.prefetching;
      const running=runPrefetch().catch(error=>publishPrefetch({state:errorName(error)==='AbortError'?'skipped':'failed',reason:errorName(error)==='AbortError'?'superseded':'error'})).finally(()=>{if(state.prefetching===running){state.prefetching=null;state.prefetchWorking=false;}});
      state.prefetching=running;
      return running;
    };
    const publishProfile=(profile:ProfileAccumulator,model:InsightsResult|null=null):InsightsProfile=>{
      const result=Object.freeze({
        shellMs:Number(profile.shellMs.toFixed(2)),revisionMs:Number(profile.revisionMs.toFixed(2)),recordLoadMs:Number(profile.recordLoadMs.toFixed(2)),
        evidencePreparationMs:Number(profile.evidencePreparationMs.toFixed(2)),modelComputeMs:Number(profile.modelComputeMs.toFixed(2)),workerRoundTripMs:Number(profile.workerRoundTripMs.toFixed(2)),
        domMs:Number(profile.domMs.toFixed(2)),maxDomChunkMs:Number(profile.maxDomChunkMs.toFixed(2)),domChunks:profile.domChunks,
        layoutPaintMs:Number(profile.layoutPaintMs.toFixed(2)),completeMs:Number((performance.now()-profile.started).toFixed(2)),
        maxLongTaskMs:Number(profile.maxLongTaskMs.toFixed(2)),mode:profile.mode,source:profile.source||(profile.mode==='retained'?'retained':'computed'),sentRecords:profile.sentRecords||0,records:profile.records,
        modelSignature:model?JSON.stringify({
          overview:model.overview,
          streak:{current:model.streak&&model.streak.current,longest:model.streak&&model.streak.longest,latest:model.streak&&model.streak.latest},
          subjects:(model.subjects||[]).map(row=>[row.label,row.blocks,row.planned,row.completed,row.actual,row.completion]),
          practice:model.practice?{days:model.practice.practiceDays,runs:model.practice.runs,units:model.practice.units,median:model.practice.medianPace,trend:model.practice.trend}:null,
          advanced:model.advanced?{completionDays:model.advanced.completionDayCount,trendDays:model.advanced.trendCompletionDayCount,slope:model.advanced.completionSlopePerWeek,stability:model.advanced.outputStability}:null
        }):''
      });
      state.lastProfile=result;window.__StudyDirectorInsightsLastProfile=result;
      window.dispatchEvent(new CustomEvent('studydirector:insights-profile',{detail:result}));
      return result;
    };
    const render=async(context:InsightsRenderContext)=>{
      const pane=context&&context.pane;
      if(!pane)return;
      observePane(pane);
      state.suppressScroll=true;
      if(context&&context.restoreScroll!==false)restoreScroll({immediate:true});
      else if(context&&context.restoreScroll===false){state.scrollWindow=0;state.scrollMain=0;restoreScroll({immediate:true});}
      if(state.errorTimer){clearTimeout(state.errorTimer);state.errorTimer=null;}
      const token=InsightsRenderCoordinator.begin();
      const notice=api.insights.notifications.begin({id:'report',foreground:false,announce:false,title:'Insights',message:'Preparing your saved study history…',action:{label:'Retry',run:()=>render(context)}});
      // Join only work that is already reading data; a pre-computation still
      // waiting for idle time sees the open tab and stands down by itself.
      const joining=state.prefetchWorking?state.prefetching:null;
      if(!joining){computation.cancel();computation.warm();}
      const profile:ProfileAccumulator={started:performance.now(),shellMs:0,revisionMs:0,recordLoadMs:0,evidencePreparationMs:0,modelComputeMs:0,workerRoundTripMs:0,domMs:0,maxDomChunkMs:0,domChunks:0,layoutPaintMs:0,maxLongTaskMs:0,mode:'retained',records:0};
      let longTaskObserver=null;
      try{
        if(typeof PerformanceObserver==='function'&&PerformanceObserver.supportedEntryTypes?.includes('longtask')){
          longTaskObserver=new PerformanceObserver(list=>list.getEntries().forEach(entry=>{profile.maxLongTaskMs=Math.max(profile.maxLongTaskMs,entry.duration);}));
          longTaskObserver.observe({type:'longtask',buffered:false});
        }
      }catch(error){longTaskObserver=null;}
      try{
        const firstRender=!state.rendered;
        if(firstRender){
          let resolveNavigationReady;
          state.navigationReady=new Promise(resolve=>{resolveNavigationReady=resolve;});
          renderInitialInsightsLoading(pane);
          profile.shellMs=performance.now()-profile.started;
          resolveNavigationReady(true);
          await new Promise(resolve=>requestAnimationFrame(resolve));
        }else state.navigationReady=Promise.resolve(true);
        if(joining){
          // An idle pre-computation is already reading this history: finish it
          // and reuse it rather than start the same work again.
          await joining;
          if(!InsightsRenderCoordinator.isCurrent(token))return;
        }
        const dataSource=api.insights.dataSource;
        const currentStudyDate=typeof dataSource.getCurrentStudyDate==='function'?dataSource.getCurrentStudyDate():localIsoDate();
        const source=typeof dataSource.getRecordSource==='function'?dataSource.getRecordSource():null;
        const windowKey=readInsightWindowKey();
        const revisionStarted=performance.now();
        const datasetRevision=await readDatasetRevision(dataSource);
        profile.revisionMs=performance.now()-revisionStarted;
        if(!InsightsRenderCoordinator.isCurrent(token))return;
        const sourceKey=sourceIdentity(source);
        const sourceRevision=datasetRevision||String(source&&source.revision||'');
        const baseKey=`${sourceKey}|${currentStudyDate}|${sourceRevision||'fallback'}`;
        if(state.rendered&&sourceRevision&&state.renderedBaseKey===baseKey&&state.renderedWindowKey===windowKey){
          clearInsightsUpdateStatus(pane);
          restoreScroll();
          publishProfile(profile);
          return;
        }
        if(!firstRender){
          notice.update({message:windowKey===state.renderedWindowKey?'Updating insights…':'Updating the selected window…'});
          showInsightsUpdateStatus(pane,notice.read()?.message||'');
          await new Promise(resolve=>{requestAnimationFrame(resolve);});
          if(!InsightsRenderCoordinator.isCurrent(token))return;
        }
        let session=sourceRevision&&state.session&&state.session.baseKey===baseKey?state.session:null;
        if(!session)session=await loadSession({dataSource,source,sourceKey,currentStudyDate,datasetRevision,isCurrent:()=>InsightsRenderCoordinator.isCurrent(token),profile});
        if(!session||!InsightsRenderCoordinator.isCurrent(token))return;
        const {windowInfo,fullKey,modelOptions}=planModel(session,windowKey,currentStudyDate);
        const effectiveBaseKey=session.baseKey;
        if(state.rendered&&state.renderedKey===fullKey){
          state.session=session;
          clearInsightsUpdateStatus(pane);
          restoreScroll();
          return;
        }
        const prefetched=state.prefetched&&state.prefetched.fullKey===fullKey?state.prefetched:null;
        state.prefetched=null;
        const modelResult=prefetched?prefetched.result:await computation.build(windowInfo.records,session.prepared,modelOptions);
        profile.source=prefetched?'prefetched':'computed';profile.sentRecords=prefetched?0:Number(modelResult.sentRecords)||0;
        const model=modelResult.model;profile.mode=modelResult.mode;profile.modelComputeMs=modelResult.computeMs;profile.workerRoundTripMs=modelResult.roundTripMs;profile.records=windowInfo.records.length;
        if(!InsightsRenderCoordinator.isCurrent(token))return;
        const previousScroll=state.rendered;
        const renderMetrics=await renderModel(pane,model,{
          source:session.source,
          api,
          currentStudyDate,
          isCurrent:()=>InsightsRenderCoordinator.isCurrent(token),
          onShell:value=>{profile.shellMs=profile.shellMs||value;},
          onWindowChange:key=>{writeInsightWindowKey(key);render(context);},
          reload:()=>render(context)
        });
        if(renderMetrics.cancelled||!InsightsRenderCoordinator.isCurrent(token))return;
        profile.domMs=renderMetrics.domMs;profile.maxDomChunkMs=renderMetrics.maxChunkMs;profile.domChunks=renderMetrics.chunks;
        state.rendered=true;
        state.renderedKey=fullKey;
        state.renderedBaseKey=effectiveBaseKey;
        state.renderedWindowKey=windowInfo.key;
        state.session=session;
        clearInsightsUpdateStatus(pane);
        if(previousScroll)restoreScroll();
        else{
          state.scrollWindow=0;state.scrollMain=0;
          requestAnimationFrame(()=>{
            if(pane.classList.contains('on')){if(main)main.scrollTop=0;window.scrollTo(0,0);}
            requestAnimationFrame(()=>{state.suppressScroll=false;});
          });
        }
        const paintStarted=performance.now();
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        profile.layoutPaintMs=performance.now()-paintStarted;
        publishProfile(profile,model);
      }catch(error){
        if(!InsightsRenderCoordinator.isCurrent(token))return;
        if(errorName(error)==='AbortError'){notice.finish('cancelled','',{announce:false});pane.setAttribute('aria-busy','false');return;}
        const message=errorCode(error)==='INSIGHTS_PROCESSING_FAILED'?'Insights processing failed. Retry the report.':'Could not read saved daily records for insights.';
        notice.finish('failed',message+(state.rendered?' The previous view is still available.':''),{announce:false,cue:'none'});
        const retry=el('button','btn ui-btn insights-retry','Retry');retry.type='button';retry.addEventListener('click',()=>render(context),{once:true});
        if(state.rendered){
          const status=showInsightsUpdateStatus(pane,notice.read()?.message||message,true);
          status.appendChild(retry);restoreScroll();
        }else{
          state.suppressScroll=false;
          const status=el('div','insights-empty ui-card ui-mono',notice.read()?.message||message);status.setAttribute('role','status');status.appendChild(retry);pane.replaceChildren(status);
        }
        pane.setAttribute('aria-busy','false');
      }finally{
        if(notice.read()?.lifecycle==='running')notice.finish(InsightsRenderCoordinator.isCurrent(token)?'succeeded':'cancelled','',{announce:false,cue:'none'});
        longTaskObserver?.disconnect();
      }
    };
    return Object.freeze({render,prefetch,ready:async()=>{await state.navigationReady;await restoreScroll();return true;},profile:()=>state.lastProfile});
  }
    return Object.freeze({
      createInsightsView,supportsCapabilities
    });
  })(InsightsPrimitives,InsightsRecords,InsightsRendering,InsightsAnalyticsLab);

  // M8.13 PLUGIN RUNTIME COMPONENT
  ((Config:ModelRuntime['Config'],Rendering:Rendering,ModelEngine:ModelRuntime['ModelEngine'],RetainedView:Readonly<{createInsightsView(api:InsightsPluginApi,engine:InsightsEngine):Readonly<{render:(context:InsightsRenderContext)=>Promise<void>;prefetch:()=>Promise<PrefetchStatus>;ready:()=>Promise<boolean>;profile:()=>InsightsProfile|null}>;supportsCapabilities(api:InsightsPluginApi|null|undefined,requirements:Capabilities):boolean}>)=>{
    const {
      PLUGIN_VERSION
    }=Config;
    const {
      Layout
    }=Rendering;
    const {
      createInsightsEngine
    }=ModelEngine;
    const {
      createInsightsView,supportsCapabilities
    }=RetainedView;
  function setup(api:InsightsPluginApi){
    if(!supportsCapabilities(api,REQUIRED_CAPABILITIES)||!api.ui||!api.insights||!api.insights.dataSource||typeof api.insights.dataSource.getDailyRecords!=='function'||!api.logic||typeof api.logic.classifyTaskOutcome!=='function'||typeof api.logic.summarizePracticeRuns!=='function')return false;
    const engine=createInsightsEngine({classifyTaskOutcome:api.logic.classifyTaskOutcome,summarizePracticeRuns:api.logic.summarizePracticeRuns});
    const view=createInsightsView(api,engine);
    const registered=api.ui.registerTab({
      id:TAB_ID,
      label:'Insights',
      icon:'✦',
      render:view.render,
      ready:view.ready
    });
    if(registered){
      // Prepare a long history while the app is idle, and again when the page
      // returns to view (the dataset may have changed meanwhile).
      view.prefetch();
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')view.prefetch();});
    }
    if(registered&&document.documentElement.dataset['insightsResizeBound']!=='1'){
      document.documentElement.dataset['insightsResizeBound']='1';
      window.addEventListener('resize',()=>Layout.resize(()=>document.getElementById('pane-insights')));
    }
    return registered;
  }
  const PLUGIN_READY_EVENT='studydirector:ready';
  const PLUGIN_DESCRIPTOR:InsightsPluginDescriptor=Object.freeze({name:'SD-insights',version:PLUGIN_VERSION,requires:REQUIRED_CAPABILITIES,setup});
  const MAX_REGISTRATION_ATTEMPTS=2;
  let registrationAttempts=0;
  let registrationComplete=false;
  function connectPlugin(){
    if(registrationComplete)return true;
    const register=window.StudyDirector&&window.StudyDirector.registerPlugin;
    if(typeof register!=='function'||registrationAttempts>=MAX_REGISTRATION_ATTEMPTS)return false;
    registrationAttempts+=1;
    try{registrationComplete=register(PLUGIN_DESCRIPTOR)===true;}catch(error){}
    if(!registrationComplete&&registrationAttempts<MAX_REGISTRATION_ATTEMPTS)Promise.resolve().then(connectPlugin);
    return registrationComplete;
  }
  function boot(){
    const api=window.StudyDirector;
    if(api&&typeof api.registerPlugin==='function')connectPlugin();
    else window.addEventListener(PLUGIN_READY_EVENT,connectPlugin,{once:true});
  }
  boot();
    return Object.freeze({version:PLUGIN_VERSION});
  })(InsightsConfig,InsightsRendering,InsightsModelEngine,InsightsRetainedView);
}
bootInsightsRuntime();
export type StudyDirectorInsightsRuntime=true;
