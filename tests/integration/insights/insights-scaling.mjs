import {insightsModelSources,readInsightsModelRuntimeSource} from '../../helpers/insights-model-runtime.mjs';
import assert from 'node:assert/strict';
import {writeArtifact} from '../../helpers/artifacts.mjs';
import {realInsightsProviders} from '../../helpers/insights-providers.mjs';
import vm from 'node:vm';

const sourcePath=insightsModelSources.join('+');
const source=readInsightsModelRuntimeSource();
const context=vm.createContext({console});
vm.runInContext(source,context,{filename:sourcePath});
const retryContext=vm.createContext({console});
vm.runInContext(source,retryContext,{filename:sourcePath});
const firstRetryModel=retryContext.StudyDirectorInsightsModel;
assert.equal(retryContext.createInsightsModelRuntime,undefined,'type-only runtime factory must not remain callable after model assembly');
vm.runInContext(source,retryContext,{filename:sourcePath});
assert.notEqual(retryContext.StudyDirectorInsightsModel,firstRetryModel,'classic Insights model source must remain re-evaluable for the optional-plugin retry path');
assert.equal(retryContext.createInsightsModelRuntime,undefined,'retry evaluation must also retire the type-only runtime factory');
const {Config,PacerEvidence:Pacer,ModelEngine}=context.StudyDirectorInsightsModel;
const {classifyTaskOutcome,summarizePracticeRuns,practice:practiceProvider}=realInsightsProviders();


const {Analytics,Primitives,Records,StudyFitness,Dynamics}=context.StudyDirectorInsightsModel;
const classifyFoundationOutcome=task=>task.completion>=100?'full':task.completion>0?'partial':task.skipped?'skipped':'untouched';
// The real-provider witness must use production configuration, not a copied
// unit-test profile. These bounds deliberately differ from older test defaults.
assert.equal(practiceProvider.sanitizePracticeRun({targetMs:4000,unitMs:[1000]}),null,'production Practice Pacer rejects a target below 5 seconds');
assert.equal(practiceProvider.sanitizePracticeRun({targetMs:6*60*60*1000,unitMs:[60000]})?.targetMs,6*60*60*1000,'production Practice Pacer permits targets beyond the old 4-hour test cap');

// Hand-computable foundation witnesses: unavailable evidence is not zero,
// calendar windows include exact boundaries, and core aggregates conserve input.
const emptyEvidence=Analytics.createEvidenceIndex([],classifyFoundationOutcome);
assert.deepEqual(JSON.parse(JSON.stringify(Analytics.computeDailySeries(emptyEvidence))),[]);
assert.equal(Primitives.pct(0,0),null,'missing denominator must remain unavailable, not measured zero');
assert.equal(Primitives.pct(0,10),0,'measured zero with a known denominator must remain zero');
const boundaryRecords=Records.normalizeRecords([
  {date:'2026-07-11',tasks:[{id:'before',kind:'work',dur:30,completion:100,completionSource:'manual',actualSeconds:1800}]},
  {date:'2026-07-12',tasks:[{id:'start',kind:'work',dur:60,completion:50,completionSource:'manual',actualSeconds:1800}]},
  {date:'2026-08-10',tasks:[{id:'end',kind:'work',dur:40,completion:0,completionSource:'manual',actualSeconds:0}]}
]);
const boundaryWindow=Records.filterCanonicalRecordsForInsightWindow(boundaryRecords,'30','2026-08-10');
assert.deepEqual(Array.from(boundaryWindow.records,record=>record.date),['2026-07-12','2026-08-10'],'30-day window must include both exact calendar boundaries');
const boundaryEvidence=Analytics.createEvidenceIndex(boundaryWindow.records,classifyFoundationOutcome);
const boundaryDaily=Analytics.computeDailySeries(boundaryEvidence);
assert.equal(boundaryDaily.reduce((sum,row)=>sum+row.planned,0),100);
assert.equal(boundaryDaily.reduce((sum,row)=>sum+row.completed,0),30);
assert.equal(boundaryDaily[1].completion,0,'explicit zero completion must survive analytical preparation');
assert.equal(boundaryDaily[1].actual,0,'explicit zero actual time must survive analytical preparation');

// Canonical preparation rejects invalid dates, removes non-positive planned
// tasks, chooses the newest same-day record, sorts deterministically, and
// leaves its caller-owned input untouched.
const dirtyCanonicalInput=[
  null,
  {date:'not-a-date',tasks:[]},
  {date:'2026-08-09',updatedAt:'2026-08-09T08:00:00.000Z',tasks:[
    {id:'old',kind:'work',dur:30,completion:100,completionSource:'manual',actualSeconds:1800},
    {id:'drop-zero-plan',kind:'work',dur:0,completion:100,completionSource:'manual',actualSeconds:60}
  ]},
  {date:'2026-08-08',updatedAt:'2026-08-08T12:00:00.000Z',tasks:[
    {id:'earlier',kind:'work',dur:20,completion:50,completionSource:'manual',actualSeconds:600}
  ]},
  {date:'2026-08-09',updatedAt:'2026-08-09T09:00:00.000Z',tasks:[
    {id:'new',kind:'work',dur:40,completion:75,completionSource:'manual',actualSeconds:1800}
  ]}
];
const dirtyCanonicalBefore=JSON.stringify(dirtyCanonicalInput);
const normalizedDirty=Records.normalizeRecords(dirtyCanonicalInput);
assert.equal(JSON.stringify(dirtyCanonicalInput),dirtyCanonicalBefore,'canonical preparation must not mutate caller-owned input');
assert.deepEqual(Array.from(normalizedDirty,record=>record.date),['2026-08-08','2026-08-09']);
assert.deepEqual(Array.from(normalizedDirty[1].tasks,task=>task.id),['new'],'newest same-day evidence must win without retaining zero-plan tasks from an older duplicate');

// Formatter reuse must preserve calendar labels across local year boundaries,
// leap days, daylight-saving changes and both extremes of time-zone offsets.
const originalTimezone=process.env.TZ;
try{
  const {Primitives}=context.StudyDirectorInsightsModel;
  const year=Number(Primitives.localIsoDate().slice(0,4));
  const dates=[...Array.from({length:12},(_,month)=>`${year}-${String(month+1).padStart(2,'0')}-15`),
    ...Array.from({length:7},(_,index)=>`${year}-01-${String(index+1).padStart(2,'0')}`),
    `${year-1}-12-31`,`${year+1}-01-01`,'2024-02-29','2024-03-31','2024-11-03'];
  for(const timezone of ['UTC','Asia/Kolkata','America/Adak','Europe/Berlin','Pacific/Kiritimati']){
    process.env.TZ=timezone;
    const currentYear=Primitives.localIsoDate().slice(0,4);
    for(const date of dates){
      const native=new Date(date+'T00:00:00');
      assert.equal(Primitives.dayName(date),native.toLocaleDateString('en-IN',{weekday:'short'}));
      assert.equal(Primitives.shortDate(date),native.toLocaleDateString('en-IN',{day:'numeric',month:'short',...(date.slice(0,4)!==currentYear?{year:'2-digit'}:{})}));
    }
  }
  assert.equal(Primitives.dayName('invalid'),'');
  assert.equal(Primitives.shortDate('invalid'),'No date');
}finally{
  if(originalTimezone===undefined)delete process.env.TZ;else process.env.TZ=originalTimezone;
}

const DAY_MS=86400000;
const isoFromDay=day=>new Date(day*DAY_MS).toISOString().slice(0,10);
const dayFromIso=date=>Math.floor(Date.parse(`${date}T00:00:00Z`)/DAY_MS);
const endDate='2026-08-10';
const endDay=dayFromIso(endDate);

function percentileSorted(sorted,fraction){
  const position=(sorted.length-1)*fraction;
  const lower=Math.floor(position),upper=Math.ceil(position),weight=position-lower;
  return lower===upper?sorted[lower]:sorted[lower]*(1-weight)+sorted[upper]*weight;
}

function exactSlopeReference(values){
  const slopes=[];
  for(let left=0;left<values.length;left+=1){
    for(let right=left+1;right<values.length;right+=1){
      slopes.push((values[right]-values[left])/(right-left));
    }
  }
  slopes.sort((a,b)=>a-b);
  return {
    slope:percentileSorted(slopes,.5)*7,
    low:percentileSorted(slopes,.25)*7,
    high:percentileSorted(slopes,.75)*7,
    count:slopes.length
  };
}

function practiceRecord(date,pace,completion=80,index=0){
  const targetMs=60000;
  const actualMs=Math.max(1000,Math.round(targetMs*pace/100));
  return {
    date,
    tasks:[
      {id:`a-${index}`,name:'Practice set',area:'Practice',kind:'work',dur:30,completion,completionSource:'manual',actualSeconds:completion*18},
      {id:`b-${index}`,name:'Supporting work',area:'Review',kind:'work',dur:30,completion:Math.max(0,Math.min(100,100-completion/2)),completionSource:'manual',actualSeconds:1200}
    ],
    practiceRuns:[{taskId:`a-${index}`,targetMs,totalUnits:4,unitMs:[actualMs,actualMs,actualMs,actualMs]}]
  };
}

function recordsForPaces(paces,startDay=endDay-paces.length+1){
  return paces.map((pace,index)=>practiceRecord(isoFromDay(startDay+index),pace,70+(index%25),index));
}

function trendBasis(records,horizonDays=730){
  const toDay=dayFromIso(records.at(-1).date);
  return {key:'latest-two-years',label:'Latest 2 years',horizonDays,fromDay:toDay-horizonDays+1,toDay,from:isoFromDay(toDay-horizonDays+1),to:isoFromDay(toDay),capped:records.length>horizonDays};
}

function roundRef(value,digits=1){
  const scale=10**digits;
  return Math.round(value*scale)/scale;
}

function assertClose(actual,expected,tolerance,message){
  assert.ok(Number.isFinite(actual),`${message}: expected a finite value, received ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message}: expected ${expected} ± ${tolerance}, received ${actual}`);
}

function detailedDynamicsFixture(records,{performanceState=null,currentStudyDate=null}={}){
  const normalized=Records.normalizeRecords(records);
  const evidence=Analytics.createEvidenceIndex(normalized,classifyTaskOutcome);
  const daily=Analytics.computeDailySeries(evidence);
  const first=daily[0]?.date??null,last=daily.at(-1)?.date??null;
  const today=currentStudyDate??last??endDate;
  const planned=daily.reduce((sum,row)=>sum+row.planned,0);
  const completed=daily.reduce((sum,row)=>sum+row.completed,0);
  const fromDay=first?Primitives.dateDay(first):null,toDay=last?Primitives.dateDay(last):null;
  const model={
    daily,
    currentStudyDate:today,
    calendarRange:{start:first,end:last},
    overview:{completion:planned>0?completed/planned*100:null,averageQuality:null},
    advanced:{completionDayCount:daily.filter(row=>Number.isFinite(row.completion)).length,qualityPairCount:0},
    subjects:[],
    trendBasis:{
      key:'fixture',label:'Fixture',horizonDays:Config.DIRECTIONAL_TREND_HORIZON_DAYS,
      fromDay,toDay,from:first,to:last,capped:false,recordCount:normalized.length,selectedRecordCount:normalized.length
    }
  };
  const historyMeta={
    records:normalized.length,workBlocks:evidence.work.length,start:first,end:last,
    modelRecords:normalized.length,modelStart:first,modelEnd:last,horizonDays:Config.DIRECTIONAL_TREND_HORIZON_DAYS,capped:false,
    ...(performanceState?{fitness:{performanceState}}:{})
  };
  return {records:normalized,evidence,daily,model,dynamics:Dynamics.computeStudyDynamics(model,evidence,historyMeta,true)};
}

const exactPaces=Array.from({length:60},(_,index)=>90+index*.37+((index*17)%11-5)*.8);
const exactRecords=recordsForPaces(exactPaces);
const exactPractice=Pacer.computePracticePacer(exactRecords,summarizePracticeRuns,trendBasis(exactRecords));
const exactReference=exactSlopeReference(exactPaces.map(value=>Math.round(value*10)/10));
assert.equal(exactPractice.trend.exact,true);
assert.equal(exactPractice.trend.sampledDays,60);
assert.equal(exactPractice.trend.pairCount,exactReference.count);
assert.equal(exactPractice.trend.slopePerWeek,Math.round(exactReference.slope*10)/10);
assert.equal(exactPractice.trend.lowPerWeek,Math.round(exactReference.low*10)/10);
assert.equal(exactPractice.trend.highPerWeek,Math.round(exactReference.high*10)/10);
assert.equal(exactPractice.trend.blockCount,10);
assert.equal(Object.hasOwn(exactPractice.trend,'leaveOneOut'),false);

const stablePaces=Array.from({length:90},(_,index)=>50+index);
const stablePractice=Pacer.computePracticePacer(recordsForPaces(stablePaces),summarizePracticeRuns,trendBasis(recordsForPaces(stablePaces)));
assert.equal(stablePractice.trend.stable,true);
assert.equal(stablePractice.trend.endpointStable,true);
assert.equal(stablePractice.trend.stability,100);

const densePaces=Array.from({length:1000},(_,index)=>85+index*.015+Math.sin(index/9)*4);
const denseRecords=recordsForPaces(densePaces,endDay-densePaces.length+1);
Pacer.computePracticePacer(denseRecords.slice(-30),summarizePracticeRuns,trendBasis(denseRecords.slice(-30)));
const annualPractice=Pacer.computePracticePacer(denseRecords.slice(-365),summarizePracticeRuns,trendBasis(denseRecords.slice(-365)));
assert.equal(annualPractice.trend.sampledDays,Config.MAX_PRACTICE_TREND_EXACT_DAYS);
const denseFirst=Pacer.computePracticePacer(denseRecords,summarizePracticeRuns,{...trendBasis(denseRecords,1000),fromDay:denseRecords.length?dayFromIso(denseRecords[0].date):null});
const denseSecond=Pacer.computePracticePacer(denseRecords,summarizePracticeRuns,{...trendBasis(denseRecords,1000),fromDay:dayFromIso(denseRecords[0].date)});
assert.deepEqual(denseFirst.trend,denseSecond.trend);
assert.equal(denseFirst.trend.exact,false);
assert.equal(denseFirst.trend.eligibleDays,1000);
assert.equal(denseFirst.trend.sampledDays,Config.MAX_PRACTICE_TREND_EXACT_DAYS);
assert.equal(denseFirst.trend.pairCount,Config.MAX_PRACTICE_TREND_EXACT_DAYS*(Config.MAX_PRACTICE_TREND_EXACT_DAYS-1)/2);
assert.equal(denseFirst.trend.blockCount,Config.PRACTICE_TREND_JACKKNIFE_BLOCKS);

// P5.9B numerical/provider witnesses use the actual canonical Outcome and
// Practice Pacer providers. Threshold-adjacent pace classification must not
// collapse 79.9% into the controlled 80% boundary.
const thresholdRecords=recordsForPaces([79.9,80],endDay-1);
const thresholdPractice=Pacer.computePracticePacer(thresholdRecords,summarizePracticeRuns,trendBasis(thresholdRecords));
assert.equal(thresholdPractice.runRows[0].controlled,false,'79.9% of target is below the controlled-pace boundary');
assert.equal(thresholdPractice.runRows[1].controlled,true,'80% of target is exactly inside the controlled-pace boundary');
assert.equal(thresholdPractice.controlledRuns,1);

const rejectedPractice=Pacer.computePracticePacer([{
  date:endDate,tasks:[{id:'invalid-pacer',name:'Practice',area:'Practice',kind:'work',dur:30,completion:0,completionSource:'none',actualSeconds:0}],
  practiceRuns:[{taskId:'invalid-pacer',targetMs:0,totalUnits:1,unitMs:[1000]}]
}],summarizePracticeRuns,trendBasis([{date:endDate}]));
assert.equal(rejectedPractice.audit.savedRuns,1);
assert.equal(rejectedPractice.audit.acceptedRuns,0);
assert.equal(rejectedPractice.audit.excludedRuns,1,'the real Practice Pacer sanitizer must reject an invalid target');

const providerEngine=ModelEngine.createInsightsEngine({classifyTaskOutcome,summarizePracticeRuns});
const providerDate=endDate;
const providerRecords=[{date:providerDate,tasks:[
  {id:'full',name:'Full',area:'Provider',kind:'work',dur:10,completion:100,completionSource:'manual',actualSeconds:600},
  {id:'skipped',name:'Skipped',area:'Provider',kind:'work',dur:10,completion:0,completionSource:'skipped',actualSeconds:0,skipped:true},
  {id:'zero',name:'Zero',area:'Provider',kind:'work',dur:10,completion:0,completionSource:'manual',actualSeconds:60},
  {id:'untouched',name:'Untouched',area:'Provider',kind:'work',dur:10,completion:0,completionSource:'none',actualSeconds:0}
],practiceRuns:[]}];
const providerPrepared=providerEngine.prepare(providerRecords,'real-provider-outcomes');
const providerModel=providerEngine.buildPrepared(providerPrepared.records,providerPrepared,{windowKey:'all',windowLabel:'All records',allRecordCount:1,currentStudyDate:providerDate});
assert.deepEqual(JSON.parse(JSON.stringify(providerModel.outcomes.counts)),{
  full:1,partial:0,skipped:1,untouched:1,'finished-unverified':0,'zero-output':1
},'Insights must consume the canonical outcome classifier rather than a local approximation');
assert.equal(providerModel.fitness.performanceState.observedDays,1);
assert.equal(providerModel.fitness.performanceState.confidence.key,'weak','one observed day must remain weak fitness evidence');

const changePointRecords=Array.from({length:12},(_,index)=>({
  date:isoFromDay(endDay-11+index),
  tasks:[{id:`cp-${index}`,name:'Change point',area:'Provider',kind:'work',dur:30,completion:index<6?40:80,completionSource:'manual',actualSeconds:1200}],
  practiceRuns:[]
}));
const changePointEngine=ModelEngine.createInsightsEngine({classifyTaskOutcome,summarizePracticeRuns});
const elevenPrepared=changePointEngine.prepare(changePointRecords.slice(0,11),'change-point-11');
const elevenModel=changePointEngine.buildPrepared(elevenPrepared.records,elevenPrepared,{windowKey:'all',windowLabel:'All records',allRecordCount:11,currentStudyDate:changePointRecords[10].date});
assert.equal(elevenModel.dynamics.changePoint.ready,false);
assert.equal(elevenModel.dynamics.changePoint.minimumDays,Config.MIN_CHANGE_POINT_DAYS);
const twelvePrepared=changePointEngine.prepare(changePointRecords,'change-point-12');
const twelveModel=changePointEngine.buildPrepared(twelvePrepared.records,twelvePrepared,{windowKey:'all',windowLabel:'All records',allRecordCount:12,currentStudyDate:changePointRecords[11].date});
assert.equal(twelveModel.dynamics.changePoint.ready,true,'the change-point evidence gate must open exactly at the configured minimum day count');

const workloadRecords=Array.from({length:36},(_,index)=>{
  const planned=60+(index%6)*30;
  const completion=[92,88,82,76,68,60][index%6]+((Math.floor(index/6)%3)-1);
  return {
    date:isoFromDay(endDay-35+index),
    tasks:[{id:`workload-${index}`,name:'Workload frontier',area:'Provider',kind:'work',dur:planned,completion,completionSource:'manual',actualSeconds:Math.round(planned*completion/100*60)}],
    practiceRuns:[]
  };
});
const workloadEngine=ModelEngine.createInsightsEngine({classifyTaskOutcome,summarizePracticeRuns});
const workloadPrepared=workloadEngine.prepare(workloadRecords,'workload-supported-frontier');
const workloadModel=workloadEngine.buildPrepared(workloadPrepared.records,workloadPrepared,{windowKey:'all',windowLabel:'All records',allRecordCount:workloadRecords.length,currentStudyDate:workloadRecords.at(-1).date});
assert.equal(workloadModel.dynamics.workload.days,36);
assert.equal(workloadModel.dynamics.workload.span,150);
assert.equal(workloadModel.dynamics.workload.ready,true,'36 varied workload days must clear the descriptive response-surface gate');
assert.ok(workloadModel.dynamics.workload.recommendation,'a locally supported workload surface must produce a recommendation');
assert.ok(workloadModel.dynamics.workload.recommendation.minPlanned<=workloadModel.dynamics.workload.recommendation.typicalPlanned);
assert.ok(workloadModel.dynamics.workload.recommendation.typicalPlanned<=workloadModel.dynamics.workload.recommendation.maxPlanned);

// Exact strong-day semantics: 80%+ means the unrounded value must be at
// least 80. Borderline 79.x values must not leak into counts, workload
// classification, strong-day fitting or forecast calibration labels.
const strongBoundaryValues=[79.49,79.5,79.9,80];
const strongBoundaryRecords=strongBoundaryValues.map((completion,index)=>({
  date:isoFromDay(endDay-10+index),
  tasks:[{id:`strong-boundary-${index}`,name:'Boundary',area:'Threshold',kind:'work',dur:60,completion,completionSource:'manual'}],
  practiceRuns:[]
}));
const strongBoundaryEngine=ModelEngine.createInsightsEngine({classifyTaskOutcome,summarizePracticeRuns});
const strongBoundaryPrepared=strongBoundaryEngine.prepare(strongBoundaryRecords,'strong-day-boundary');
const strongBoundaryModel=strongBoundaryEngine.buildPrepared(strongBoundaryPrepared.records,strongBoundaryPrepared,{
  windowKey:'all',windowLabel:'All records',allRecordCount:strongBoundaryRecords.length,currentStudyDate:strongBoundaryRecords.at(-1).date
});
assert.equal(strongBoundaryModel.overview.strongDays,1,'only exact 80%+ completion may count as a strong day');
assert.deepEqual(
  Array.from(strongBoundaryModel.getLabEvidence().dynamics.workload.observations,row=>row.strong),
  [false,false,false,true],
  'workload/forecast strong-day labels must use the exact 80% boundary without rounding'
);

// Hierarchical posterior weak-prior witness. With two one-block groups the
// hierarchy gate stays closed (nEff total 2), so the posterior is a Beta
// update from a 50% prior with four effective prior blocks. The analytic
// posterior means are exactly 60% and 40%; the production grid approximation
// must stay within one point of those independently calculated answers.
const hierarchyFixture=detailedDynamicsFixture([
  {date:'2026-07-01',tasks:[{id:'hier-a',name:'Alpha',area:'Alpha',kind:'work',dur:60,completion:100,completionSource:'manual'}],practiceRuns:[]},
  {date:'2026-07-02',tasks:[{id:'hier-b',name:'Beta',area:'Beta',kind:'work',dur:60,completion:0,completionSource:'manual'}],practiceRuns:[]}
]);
const hierarchyArea=hierarchyFixture.dynamics.bayesian.dimensions.find(row=>row.key==='area');
assert.ok(hierarchyArea,'area hierarchy must be present');
assert.equal(hierarchyArea.ready,false,'two effective observations must remain below the hierarchy evidence gate');
assert.equal(hierarchyArea.totalEffective,2);
assert.equal(hierarchyFixture.dynamics.bayesian.baseline,50);
const hierarchyPrior=Config.EVIDENCE_PRIOR_EFFECTIVE_BLOCKS;
for(const [label,raw] of [['Alpha',100],['Beta',0]]){
  const row=hierarchyArea.rows.find(candidate=>candidate.label===label);
  assert.ok(row,`missing hierarchical row for ${label}`);
  const analytic=(raw*row.nEff+50*hierarchyPrior)/(row.nEff+hierarchyPrior);
  assert.equal(row.estimate.method,'weak-prior-grid');
  assert.equal(row.estimate.prior,50);
  assertClose(row.estimate.mean,analytic,1,`${label} weak-prior posterior mean`);
}

// Current Study State one-observation Kalman-style witness. One explicit
// block yields design measurement SD 24, default persistence .85 and process
// SD 6. Compute the first posterior variance independently and compare the
// reported interval rather than snapshotting the model.
const stateDate='2026-07-10';
const stateRecords=[{date:stateDate,tasks:[{id:'state-single',name:'State',area:'State',kind:'work',dur:60,completion:73.4,completionSource:'manual'}],practiceRuns:[]}];
const stateNormalized=Records.normalizeRecords(stateRecords);
const stateEvidence=Analytics.createEvidenceIndex(stateNormalized,classifyTaskOutcome);
const stateDaily=Analytics.computeDailySeries(stateEvidence);
const singleState=StudyFitness.computeFitnessPerformanceState({daily:stateDaily,currentStudyDate:stateDate,calendarRange:{start:stateDate,end:stateDate}},stateEvidence);
assert.ok(singleState.current,'single explicit day must produce an output-state estimate');
assert.equal(singleState.parameters.empiricalPersistence[0],.85);
assert.equal(singleState.parameters.processSd[0],6);
assert.equal(singleState.parameters.measurementSd[0],24);
const initialVariance=24**2;
const predictedVariance=.85**2*initialVariance+6**2;
const gain=predictedVariance/(predictedVariance+24**2);
const posteriorVariance=predictedVariance*(1-gain);
const stateRadius=1.96*Math.sqrt(posteriorVariance);
assert.equal(singleState.current.estimate,73.4);
assertClose(singleState.current.low,roundRef(Math.max(0,73.4-stateRadius),1),.1,'single-day state lower bound');
assertClose(singleState.current.high,roundRef(Math.min(100,73.4+stateRadius),1),.1,'single-day state upper bound');
const gapDate='2026-07-11';
const gapRecords=Records.normalizeRecords([...stateRecords,{date:gapDate,tasks:[],practiceRuns:[]}]);
const gapEvidence=Analytics.createEvidenceIndex(gapRecords,classifyTaskOutcome);
const gapDaily=Analytics.computeDailySeries(gapEvidence);
const gapState=StudyFitness.computeFitnessPerformanceState({daily:gapDaily,currentStudyDate:gapDate,calendarRange:{start:stateDate,end:gapDate}},gapEvidence);
assert.equal(gapState.current.estimate,singleState.current.estimate,'a no-evidence day must hold the last output-state point estimate');
assert.ok(
  gapState.current.high-gapState.current.low>=singleState.current.high-singleState.current.low,
  'missing evidence must never make the current-state interval narrower'
);

// Adjusted sequence/hazard witness. Twelve fully strong days alternate with
// twelve days that end in a missed tail beginning at block 3. Raw transition
// and hazard counts are hand-computable; the adjusted models must recover the
// corresponding coefficient directions after regularisation.
const sequenceRecords=Array.from({length:24},(_,dayIndex)=>{
  const collapse=dayIndex%2===1;
  const completions=collapse?[60,60,null,null]:[90,90,90,90];
  return {
    date:isoFromDay(endDay-80+dayIndex),
    tasks:completions.map((completion,position)=>({
      id:`sequence-${dayIndex}-${position}`,name:`Block ${position+1}`,area:'Sequence',kind:'work',dur:30,studyOrdinal:position+1,
      ...(completion===null?{}:{completion,completionSource:'manual'})
    })),
    practiceRuns:[]
  };
});
const sequenceDynamics=detailedDynamicsFixture(sequenceRecords).dynamics.cascade;
assert.equal(sequenceDynamics.transitions,72);
assert.equal(sequenceDynamics.nextStrong,36);
const strongTransition=sequenceDynamics.transitionRows.find(row=>row.key==='strong');
const attemptedTransition=sequenceDynamics.transitionRows.find(row=>row.key==='attempted');
const missedTransition=sequenceDynamics.transitionRows.find(row=>row.key==='missed');
assert.equal(strongTransition.total,36);assert.equal(strongTransition.counts.strong,36);
assert.equal(attemptedTransition.total,24);assert.equal(attemptedTransition.counts.attempted,12);assert.equal(attemptedTransition.counts.missed,12);
assert.equal(missedTransition.total,12);assert.equal(missedTransition.counts.missed,12);
const thirdHazard=sequenceDynamics.hazardRows.find(row=>row.key==='3');
assert.ok(thirdHazard);assert.equal(thirdHazard.daysAtRisk,24);assert.equal(thirdHazard.collapses,12);assert.equal(thirdHazard.rate,50);
assert.equal(sequenceDynamics.adjusted.transition.ready,true);
assert.equal(sequenceDynamics.adjusted.transition.rows,72);
assert.equal(sequenceDynamics.adjusted.transition.strong,36);
const previousStrongEffect=sequenceDynamics.adjusted.transition.effects.find(row=>row.label==='Previous block strong');
assert.ok(previousStrongEffect?.coefficient>0,'adjusted next-block model must recover the deliberately positive previous-strong effect');
assert.equal(sequenceDynamics.adjusted.hazard.ready,true);
assert.equal(sequenceDynamics.adjusted.hazard.rows,84);
assert.equal(sequenceDynamics.adjusted.hazard.events,12);
const laterHazardEffect=sequenceDynamics.adjusted.hazard.effects.find(row=>row.label==='Later planned position');
assert.ok(laterHazardEffect?.coefficient>0,'adjusted terminal-collapse model must recover the deliberately later-position hazard');

// Four-cell interaction witness. Equal 60-minute cells make the shrinkage
// arithmetic explicit: raw cells 90/50/60/50 around a 62.5 baseline produce
// full-sample estimates 83.1/53.1/60.6/53.1 and a 22.5-point interaction.
// Each early/late half has six dates per cell and independently yields 18.0.
const interactionRecords=Array.from({length:12},(_,index)=>({
  date:isoFromDay(endDay-45+index),
  tasks:[
    {id:`ia-am-${index}`,name:'Alpha morning',area:'Alpha',kind:'work',dur:60,completion:90,completionSource:'manual',actualStartLocalMinute:9*60},
    {id:`ia-pm-${index}`,name:'Alpha afternoon',area:'Alpha',kind:'work',dur:60,completion:50,completionSource:'manual',actualStartLocalMinute:14*60},
    {id:`ib-am-${index}`,name:'Beta morning',area:'Beta',kind:'work',dur:60,completion:60,completionSource:'manual',actualStartLocalMinute:9*60},
    {id:`ib-pm-${index}`,name:'Beta afternoon',area:'Beta',kind:'work',dur:60,completion:50,completionSource:'manual',actualStartLocalMinute:14*60}
  ],
  practiceRuns:[]
}));
const interactionDynamics=detailedDynamicsFixture(interactionRecords).dynamics.interactions;
const areaMorning=interactionDynamics.tests.find(row=>row.label==='Alpha × Morning');
assert.ok(areaMorning,'Alpha × Morning interaction witness must be present');
assert.equal(areaMorning.cells.a.raw,90);assert.equal(areaMorning.cells.b.raw,50);assert.equal(areaMorning.cells.c.raw,60);assert.equal(areaMorning.cells.d.raw,50);
assert.equal(areaMorning.cells.a.estimate,83.1);assert.equal(areaMorning.cells.b.estimate,53.1);assert.equal(areaMorning.cells.c.estimate,60.6);assert.equal(areaMorning.cells.d.estimate,53.1);
assert.equal(areaMorning.effect,22.5);
assert.equal(areaMorning.stability.ready,true);
assert.equal(areaMorning.stability.earlyEffect,18);
assert.equal(areaMorning.stability.lateEffect,18);
assert.equal(areaMorning.meaningful,true);

// Forecast/calibration/model-selection witness. Completion is deliberately
// driven by the prior day's origin-causal execution state, while workload is
// independent. The state-aware candidate therefore has a known information
// advantage. Independently recompute reported MAE, naïve MAE, base-rate Brier
// and binned calibration error from the public held-out rows.
let forecastSeed=17;
const forecastExecution=Array.from({length:60},()=>{
  forecastSeed=forecastSeed*48271%2147483647;
  return 20+(forecastSeed%71);
});
const forecastDates=Array.from({length:60},(_,index)=>isoFromDay(endDay-150+index));
const forecastRecords=forecastDates.map((date,index)=>{
  const planned=60+((index*5)%6)*30;
  const completion=index===0?70:Math.min(98,50+.6*forecastExecution[index-1]);
  return {
    date,
    tasks:[{id:`forecast-${index}`,name:'Forecast',area:'Forecast',kind:'work',dur:planned,completion,completionSource:'manual'}],
    practiceRuns:[]
  };
});
const forecastHistory=forecastDates.map((date,index)=>({
  date,day:dayFromIso(date),
  states:{capacity:{estimate:50},execution:{estimate:forecastExecution[index]},recovery:{estimate:50}}
}));
const lastExecution=forecastExecution.at(-1);
const forecastPerformanceState={
  forecastCausal:true,
  basis:{historicalMode:'origin-causal'},
  history:forecastHistory,
  dimensions:{
    capacity:{current:{estimate:50}},
    execution:{current:{estimate:lastExecution}},
    recovery:{current:{estimate:50}}
  }
};
const forecastDynamics=detailedDynamicsFixture(forecastRecords,{performanceState:forecastPerformanceState}).dynamics.workload;
const forecastCalibration=forecastDynamics.calibration;
assert.equal(forecastCalibration.selectedModel,'state-aware','the deliberately informative origin-causal state predictor must win model selection');
assert.equal(forecastCalibration.comparison.stateWins,true);
assert.ok(forecastCalibration.comparison.maeGain>=Config.MIN_STATE_AWARE_MAE_GAIN_POINTS);
const stateCandidate=forecastCalibration.candidates.stateAware;
assert.equal(stateCandidate.backtests,Config.MIN_FORECAST_BACKTESTS);
const heldOut=Array.from(stateCandidate.predictions);
const referenceCompletionMae=roundRef(heldOut.reduce((sum,row)=>sum+Math.abs(row.completionMean-row.actualCompletion),0)/heldOut.length*100,1);
const naiveRows=heldOut.filter(row=>Number.isFinite(row.naiveCompletion));
const referenceNaiveMae=roundRef(naiveRows.reduce((sum,row)=>sum+Math.abs(row.naiveCompletion-row.actualCompletion),0)/naiveRows.length*100,1);
assert.equal(stateCandidate.completionMae,referenceCompletionMae);
assert.equal(stateCandidate.naiveCompletionMae,referenceNaiveMae);
assert.equal(stateCandidate.naiveMaeGain,roundRef(referenceNaiveMae-referenceCompletionMae,1));
assert.equal(stateCandidate.crossFitReady,true,'balanced held-out strong/non-strong outcomes must support cross-fitted calibration');
const strongHeldOut=Array.from(stateCandidate.strongPredictions);
const baseStrongRate=strongHeldOut.reduce((sum,row)=>sum+row.actualStrong,0)/strongHeldOut.length;
const referenceBaselineBrier=roundRef(strongHeldOut.reduce((sum,row)=>sum+(baseStrongRate-row.actualStrong)**2,0)/strongHeldOut.length,3);
assert.equal(stateCandidate.baselineBrier,referenceBaselineBrier);
const calibrationWeight=stateCandidate.bins.reduce((sum,bin)=>sum+bin.count,0);
const referenceCalibrationError=roundRef(stateCandidate.bins.reduce((sum,bin)=>sum+(bin.count/calibrationWeight)*Math.abs((bin.predicted??0)-(bin.observed??0)),0)*100,1);
assert.equal(stateCandidate.calibrationError,referenceCalibrationError);

const historyDays=1100;
const historyStart=endDay-historyDays+1;
const historyRecords=Array.from({length:historyDays},(_,index)=>{
  const recentIndex=index-(historyDays-Config.DIRECTIONAL_TREND_HORIZON_DAYS);
  const recent=recentIndex>=0;
  const pace=recent?125-recentIndex*.06:65+index*.12;
  const completion=recent?45+recentIndex*.05:95-index*.08;
  return practiceRecord(isoFromDay(historyStart+index),pace,Math.max(5,Math.min(100,completion)),index);
});
const engine=ModelEngine.createInsightsEngine({classifyTaskOutcome,summarizePracticeRuns});
const canonicalPrepared=engine.prepare(historyRecords,'canonical-worker-reuse');
const asyncEngine=ModelEngine.createInsightsEngine({classifyTaskOutcome,summarizePracticeRuns});
let asyncYields=0;
const asyncPrepared=await asyncEngine.prepareAsync(historyRecords,'canonical-worker-reuse',async()=>{asyncYields++;await Promise.resolve();});
assert.deepEqual(asyncPrepared,canonicalPrepared,'cooperative Insights preparation must be semantically identical to synchronous preparation');
assert.ok(asyncYields>0,'large Insights preparation must yield cooperatively');
const workerPrepared=engine.reusePrepared(canonicalPrepared.records,canonicalPrepared.revision);
assert.equal(workerPrepared.records,canonicalPrepared.records,'the worker handoff must reuse host-normalized canonical records instead of normalizing them again');
assert.equal(workerPrepared.revision,canonicalPrepared.revision);
const prepared=engine.prepare(historyRecords);
const allWindow=engine.filterPreparedWindow(prepared,'all',endDate);
const model=engine.buildPrepared(allWindow.records,prepared,{windowKey:'all',windowLabel:'All records',allRecordCount:historyDays,currentStudyDate:endDate});
const exactPlanned=historyRecords.flatMap(record=>record.tasks).reduce((sum,task)=>sum+task.dur,0);
const exactCompleted=historyRecords.flatMap(record=>record.tasks).reduce((sum,task)=>sum+task.dur*task.completion/100,0);
const exactActual=historyRecords.flatMap(record=>record.tasks).reduce((sum,task)=>sum+task.actualSeconds/60,0);
assert.equal(model.recordCount,historyDays);
assert.equal(model.allRecordCount,historyDays);
assert.equal(model.overview.planned,exactPlanned);
assert.equal(model.overview.completed,exactCompleted);
assert.equal(model.overview.actual,exactActual);
assert.equal(model.subjects.reduce((sum,row)=>sum+row.planned,0),exactPlanned);
assert.equal(model.completionSources.reduce((sum,row)=>sum+row.blocks,0),historyDays*2);
assert.equal(model.completionSources.length,1);
assert.equal(model.sampleAudit.workBlocks,historyDays*2);
assert.equal(model.practice.practiceDays,historyDays);
assert.equal(model.practice.runs,historyDays);
assert.equal(model.practice.units,historyDays*4);
assert.equal(model.practice.audit.savedRuns,historyDays);
assert.equal(model.practice.audit.acceptedRuns,historyDays);
assert.equal(model.practice.distribution.reduce((sum,row)=>sum+row.count,0),historyDays);
assert.equal(model.trendBasis.label,'Latest 2 years');
assert.equal(model.trendBasis.capped,true);
assert.equal(model.trendBasis.recordCount,Config.DIRECTIONAL_TREND_HORIZON_DAYS);
assert.equal(model.advanced.completionDayCount,Config.DIRECTIONAL_TREND_HORIZON_DAYS);
assert.equal(model.advanced.trendCompletionDayCount,Config.DIRECTIONAL_TREND_HORIZON_DAYS);
assert.equal(model.daily.length,Config.DIRECTIONAL_TREND_HORIZON_DAYS);
assert.equal(model.advanced.rolling7.length,Config.DIRECTIONAL_TREND_HORIZON_DAYS);
assert.equal(model.practice.trendBasis.selectedPracticeDays,historyDays);
assert.equal(model.practice.trendBasis.practiceDays,Config.DIRECTIONAL_TREND_HORIZON_DAYS);
assert.equal(model.practice.trend.sampledDays,Config.MAX_PRACTICE_TREND_EXACT_DAYS);
assert.ok(model.practice.trend.slopePerWeek<0,'Practice pace direction did not use the recent two-year horizon');
assert.ok(model.advanced.completionSlopePerWeek>0,'Work-completion direction did not use the recent two-year horizon');
assert.equal(model.dynamics.history.records,historyDays);
assert.equal(model.dynamics.allocation.dynamic.trendBasis.label,'Latest 2 years');
assert.equal(model.dynamics.allocation.dynamic.trendBasis.capped,true);
assert.ok(model.dynamics.allocation.dynamic.trendBasis.selectedPeriods>model.dynamics.allocation.dynamic.trendBasis.periods);

// The 590-day browser performance fixture stays inside the 730-day directional
// horizon. Its first All-history render may reuse the all-history evidence
// index and daily series, but the result must be byte-for-byte equivalent to
// the ordinary path that receives an independent window array.
const reuseRecords=historyRecords.slice(-590),reuseOptions={windowKey:'all',windowLabel:'All records',allRecordCount:590,currentStudyDate:endDate};
const reuseEngine=ModelEngine.createInsightsEngine({classifyTaskOutcome,summarizePracticeRuns}),reusePrepared=reuseEngine.prepare(reuseRecords,'uncapped-reuse');
const reusedModel=reuseEngine.buildPrepared(reuseEngine.filterPreparedWindow(reusePrepared,'all',endDate).records,reusePrepared,reuseOptions);
const referenceEngine=ModelEngine.createInsightsEngine({classifyTaskOutcome,summarizePracticeRuns}),referencePrepared=referenceEngine.prepare(reuseRecords,'uncapped-reference');
const referenceModel=referenceEngine.buildPrepared([...referencePrepared.records],referencePrepared,reuseOptions);
assert.deepEqual(JSON.parse(JSON.stringify(reusedModel)),JSON.parse(JSON.stringify(referenceModel)),'uncapped All-history intermediate reuse must not change Insights model output');


const evidence={
  status:'PASS',
  exactSmallSample:{days:60,pairs:exactPractice.trend.pairCount,slope:exactPractice.trend.slopePerWeek,quantiles:[exactPractice.trend.lowPerWeek,exactPractice.trend.highPerWeek]},
  boundedAnnualSample:{eligibleDays:annualPractice.trend.eligibleDays,sampledDays:annualPractice.trend.sampledDays,pairs:annualPractice.trend.pairCount,blocks:annualPractice.trend.blockCount},
  boundedLargeSample:{eligibleDays:denseFirst.trend.eligibleDays,sampledDays:denseFirst.trend.sampledDays,pairs:denseFirst.trend.pairCount,blocks:denseFirst.trend.blockCount},
  horizon:{selectedDays:model.recordCount,trendDays:model.advanced.trendCompletionDayCount,label:model.trendBasis.label,descriptivePracticeDays:model.practice.practiceDays,trendPracticeDays:model.practice.trendBasis.practiceDays},
  fullModel:{days:historyDays},
  uncappedAllHistoryReuse:{days:reuseRecords.length,parity:true},
  providerAndThresholdWitnesses:{realProviders:true,productionPacerLimits:true,controlledBoundary:[79.9,80],strongDayBoundary:strongBoundaryValues,changePointDays:[11,12],workloadFrontier:{days:36,span:150,recommendation:true}},
  advancedNumericalWitnesses:{hierarchicalWeakPrior:true,currentStatePosterior:true,adjustedSequenceHazard:true,interactionDifferenceInDifferences:true,forecastCalibrationAndSelection:true},
  canonicalPreparation:{invalidDateRejected:true,duplicateResolution:'newest',nonPositivePlanRejected:true,callerInputImmutable:true},
  classicRetryReevaluation:true
};
writeArtifact('insights-scaling.json',`${JSON.stringify(evidence,null,2)}\n`);
console.log(JSON.stringify(evidence,null,2));
