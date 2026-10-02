(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject}=registry.contracts;
registry.define('practice-pacer',1,()=>{
  const freeze=Object.freeze;
  const MODEL_PORT_FIELDS=freeze({
    configuration:freeze(['APP_LIMITS']),
    domain:freeze(['boundedInt','boundedNumber','clampArray','clampText','fmtS'])
  });
  const CONTROLLER_PORT_FIELDS=freeze({
    configuration:freeze(['APP_LIMITS']),
    state:freeze(['TASKS','TIMER_MODES','TaskIdentity','TimerState']),
    schedule:freeze(['isTaskResolved','isWorkBlock']),
    persistence:freeze(['persistPracticeCueMode','persistPracticeTarget','saveLiveDraft','writeLiveDraftNow']),
    view:freeze(['document','isExecutePaneVisible','setElementAttribute','setElementClass','setElementDisabled','setElementHidden','setElementStyle','setElementText','setTextSafe']),
    userPreferences:freeze(['notifications','readUserDefaults']),
    ownership:freeze(['appCanMutate']),
    clock:freeze(['nowMs'])
  });
  function createModel(input){
    exactObject(input,['ports'],'Practice Pacer model input');
    const ports=exactObject(input.ports,Object.keys(MODEL_PORT_FIELDS),'Practice Pacer model ports');
    for(const [name,fields] of Object.entries(MODEL_PORT_FIELDS))exactObject(ports[name],fields,'Practice Pacer model '+name+' port');
    const {APP_LIMITS}=ports.configuration;
    const {boundedInt,boundedNumber,clampArray,clampText,fmtS}=ports.domain;
/* PRACTICE PACER · 1. PARSING AND VALIDATION */
const PRACTICE_PAUSE_CAUSES=Object.freeze({MANUAL:'manual',MAIN:'main',BLOCK:'block',TASK:'task',SESSION:'session',GAP:'gap'});
const PRACTICE_PLAN_MODES=Object.freeze({TIME:'time',MARKS:'marks'});
const PRACTICE_SETUP_MODES=Object.freeze({SIMPLE:'simple',VARIABLE:'variable'});
const PRACTICE_CUE_MODES=Object.freeze({QUIET:'quiet',STRICT:'strict'});
const PRACTICE_CUE_DEFAULT=PRACTICE_CUE_MODES.STRICT;
function sanitizePracticeCueMode(value){return Object.values(PRACTICE_CUE_MODES).includes(value)?value:PRACTICE_CUE_DEFAULT;}
function formatPracticeMs(value){return fmtS(Math.floor(Math.max(0,Number(value)||0)/1000));}
function parsePracticeDurationMs(value,{optional=false}={}){
  const text=String(value??'').trim().toLowerCase();
  if(!text)return optional?null:0;
  let seconds=null;
  const suffix=text.match(/^(\d+(?:\.\d+)?)\s*([smh])$/);
  if(suffix){
    const amount=Number(suffix[1]);
    seconds=amount*(suffix[2]==='h'?3600:suffix[2]==='m'?60:1);
  }else if(/^\d+(?:\.\d+)?$/.test(text)){
    seconds=Number(text)*60;
  }else{
    const parts=text.split(':');
    if(parts.length===2||parts.length===3){
      const nums=parts.map(part=>/^\d+$/.test(part)?Number(part):NaN);
      if(nums.every(Number.isFinite)&&nums.slice(1).every(part=>part>=0&&part<60)){
        seconds=parts.length===3?nums[0]*3600+nums[1]*60+nums[2]:nums[0]*60+nums[1];
      }
    }
  }
  if(!Number.isFinite(seconds))return 0;
  const ms=Math.round(seconds*1000);
  return ms>=APP_LIMITS.minPracticeTargetMs&&ms<=APP_LIMITS.maxPracticeTargetMs?ms:0;
}
function validPracticeMs(value,{min=1,max=APP_LIMITS.maxPracticeTargetMs}={}){
  const n=Number(value);
  return Number.isFinite(n)&&n>=min&&n<=max?Math.round(n):0;
}
function validPracticeTotalUnits(value){
  const n=Number(value);
  return Number.isInteger(n)&&n>=1&&n<=APP_LIMITS.maxPracticeUnitsPerRun?n:0;
}
function sanitizePracticeUnitMs(values,limit=APP_LIMITS.maxPracticeUnitsPerRun){
  const out=[];
  clampArray(values,limit).forEach(value=>{
    const ms=validPracticeMs(value);
    if(ms>0)out.push(Math.round(ms));
  });
  return out;
}
function sanitizePracticeTaskId(value,allowedTaskIds=null){
  const taskId=clampText(value||'',80).trim();
  if(!taskId||taskId.startsWith('@index:'))return null;
  return allowedTaskIds instanceof Set&&!allowedTaskIds.has(taskId)?null:taskId;
}
function sanitizePracticeRun(value,{unitLimit=APP_LIMITS.maxPracticeUnitsPerRun,allowedTaskIds=null}={}){
  if(!value||typeof value!=='object')return null;
  const targetMs=validPracticeMs(value.targetMs,{min:APP_LIMITS.minPracticeTargetMs});
  if(!targetMs)return null;
  const unitMs=sanitizePracticeUnitMs(value.unitMs,unitLimit);
  if(!unitMs.length)return null;
  const clean={targetMs:Math.round(targetMs),unitMs};
  if(value.partial===true)clean.partial=true;
  const taskId=sanitizePracticeTaskId(value.taskId,allowedTaskIds);if(taskId)clean.taskId=taskId;
  const sessionTargetMs=validPracticeMs(value.sessionTargetMs,{min:APP_LIMITS.minPracticeTargetMs});
  const unitPlan=sanitizePracticeUnitPlan(value.unitPlan),planUnits=practiceCleanPlanUnitCount(unitPlan);
  if(unitPlan&&planUnits>=unitMs.length&&(unitPlan.mode!==PRACTICE_PLAN_MODES.MARKS||sessionTargetMs)){
    clean.unitPlan=unitPlan;
    if(unitPlan.mode===PRACTICE_PLAN_MODES.MARKS)clean.sessionTargetMs=Math.round(sessionTargetMs);
  }else{
    const totalUnits=validPracticeTotalUnits(value.totalUnits)||(unitPlan&&planUnits>=unitMs.length?planUnits:0);
    if(totalUnits>=unitMs.length)clean.totalUnits=totalUnits;
    else if(sessionTargetMs)clean.sessionTargetMs=Math.round(sessionTargetMs);
  }
  return clean;
}
function sanitizePracticeRuns(values,{allowedTaskIds=null}={}){
  const out=[];let unitsLeft=APP_LIMITS.maxPracticeUnitsPerDay;
  clampArray(values,APP_LIMITS.maxPracticeRunsPerDay).forEach(value=>{
    if(unitsLeft<=0)return;
    const run=sanitizePracticeRun(value,{unitLimit:Math.min(APP_LIMITS.maxPracticeUnitsPerRun,unitsLeft),allowedTaskIds});
    if(!run)return;
    out.push(run);unitsLeft-=run.unitMs.length;
  });
  return out;
}
function sanitizePracticeActive(value,{unitLimit=APP_LIMITS.maxPracticeUnitsPerRun-1}={}){
  if(!value||typeof value!=='object')return null;
  const taskId=sanitizePracticeTaskId(value.taskId);if(!taskId)return null;
  const targetMs=validPracticeMs(value.targetMs,{min:APP_LIMITS.minPracticeTargetMs});
  if(!targetMs)return null;
  const clean={
    taskId,targetMs:Math.round(targetMs),unitMs:sanitizePracticeUnitMs(value.unitMs,Math.max(0,unitLimit)),
    currentMs:Math.round(boundedNumber(value.currentMs,{min:0,max:APP_LIMITS.maxPracticeTargetMs,fallback:0})),
    anchorMs:null,pauseCause:null,cueStage:boundedInt(value.cueStage,{min:0,max:2,fallback:value.targetCued?2:0})
  };
  const sessionTargetMs=validPracticeMs(value.sessionTargetMs,{min:APP_LIMITS.minPracticeTargetMs});
  const unitPlan=sanitizePracticeUnitPlan(value.unitPlan),planUnits=practiceCleanPlanUnitCount(unitPlan);
  if(unitPlan&&planUnits>clean.unitMs.length&&(unitPlan.mode!==PRACTICE_PLAN_MODES.MARKS||sessionTargetMs)){
    clean.unitPlan=unitPlan;
    if(unitPlan.mode===PRACTICE_PLAN_MODES.MARKS)clean.sessionTargetMs=Math.round(sessionTargetMs);
  }else{
    const totalUnits=validPracticeTotalUnits(value.totalUnits)||(unitPlan&&planUnits>clean.unitMs.length?planUnits:0);
    if(totalUnits>clean.unitMs.length)clean.totalUnits=totalUnits;
    else if(sessionTargetMs)clean.sessionTargetMs=Math.round(sessionTargetMs);
  }
  const rawAnchorMs=Number(value.anchorMs);
  const anchorMs=Number.isFinite(rawAnchorMs)&&rawAnchorMs>0?Math.min(4102444800000,rawAnchorMs):0;
  if(anchorMs)clean.anchorMs=Math.round(anchorMs);
  const causes=Object.values(PRACTICE_PAUSE_CAUSES);
  if(!clean.anchorMs)clean.pauseCause=causes.includes(value.pauseCause)?value.pauseCause:PRACTICE_PAUSE_CAUSES.MANUAL;
  return clean;
}
function sanitizePracticeState(value){
  if(!value||typeof value!=='object')return {active:null,runs:[]};
  const runs=sanitizePracticeRuns(value.runs);
  const used=runs.reduce((sum,run)=>sum+run.unitMs.length,0);
  const active=used<APP_LIMITS.maxPracticeUnitsPerDay&&runs.length<APP_LIMITS.maxPracticeRunsPerDay
    ? sanitizePracticeActive(value.active,{unitLimit:Math.min(APP_LIMITS.maxPracticeUnitsPerRun-1,Math.max(0,APP_LIMITS.maxPracticeUnitsPerDay-used-1))})
    : null;
  return {active,runs};
}
function practiceRunInputFromActive(active,unitMs,{includeTask=true,partial=false}={}){
  const raw={targetMs:active&&active.targetMs,unitMs:Array.isArray(unitMs)?unitMs.slice():[]};
  if(partial)raw.partial=true;
  if(includeTask&&active&&active.taskId)raw.taskId=active.taskId;
  if(active&&active.sessionTargetMs)raw.sessionTargetMs=active.sessionTargetMs;
  const unitPlan=sanitizePracticeUnitPlan(active&&active.unitPlan);
  if(unitPlan)raw.unitPlan=unitPlan;
  else{
    const totalUnits=validPracticeTotalUnits(active&&active.totalUnits);
    if(totalUnits)raw.totalUnits=totalUnits;
  }
  return raw;
}
/* PRACTICE PACER · 2. PLAN CONSTRUCTION */
function sanitizePracticeUnitPlan(value){
  if(!value||typeof value!=='object')return null;
  const mode=Object.values(PRACTICE_PLAN_MODES).includes(value.mode)?value.mode:null;
  const source=Array.isArray(value.groups)?value.groups:null;
  if(!mode||!source||!source.length||source.length>APP_LIMITS.maxPracticePlanGroups)return null;
  const groups=[];let totalUnits=0;
  for(const row of source){
    const count=validPracticeTotalUnits(Array.isArray(row)?row[0]:row&&row.count);
    const rawValue=Array.isArray(row)?row[1]:row&&row.value;
    let planValue=0;
    if(mode===PRACTICE_PLAN_MODES.TIME)planValue=validPracticeMs(rawValue,{min:APP_LIMITS.minPracticeTargetMs});
    else{
      const marks=Number(rawValue);
      if(Number.isFinite(marks)&&marks>0&&marks<=APP_LIMITS.maxPracticeMarksPerUnit)planValue=Math.round(marks*1000)/1000;
    }
    if(!count||!planValue||totalUnits+count>APP_LIMITS.maxPracticeUnitsPerRun)return null;
    const previous=groups[groups.length-1];
    if(previous&&previous[1]===planValue)previous[0]+=count;
    else groups.push([count,planValue]);
    totalUnits+=count;
  }
  if(!groups.length)return null;
  const clean={mode,groups};
  if(Object.prototype.hasOwnProperty.call(value,'segments')){
    if(!Array.isArray(value.segments)||!value.segments.length||value.segments.length>APP_LIMITS.maxPracticePlanGroups)return null;
    const segments=[];let previousEnd=0;
    for(const row of value.segments){
      const end=Number(Array.isArray(row)?row[0]:row&&row.end);
      if(!Number.isInteger(end)||end<=previousEnd||end>totalUnits)return null;
      const label=clampText(Array.isArray(row)?row[1]:row&&row.label,APP_LIMITS.maxUnitChars).replace(/[|\r\n]+/g,' ').replace(/\s+/g,' ').trim();
      segments.push(label?[end,label]:[end]);previousEnd=end;
    }
    if(previousEnd!==totalUnits)return null;
    clean.segments=segments;
  }
  return clean;
}
function practiceCleanPlanUnitCount(plan){return plan&&Array.isArray(plan.groups)?plan.groups.reduce((sum,row)=>sum+row[0],0):0;}
function parsePracticeUnitPlan(value,{sessionTargetMs=null,requireSession=true}={}){
  const text=String(value??'').trim();
  if(!text)return {plan:null,error:''};
  const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(!lines.length||lines.length>APP_LIMITS.maxPracticePlanGroups)return {plan:null,error:`Use no more than ${APP_LIMITS.maxPracticePlanGroups} segments.`};
  const segmented=lines.length>1||lines.some(line=>line.includes('|'));
  const groups=[],segments=[];let mode=null,totalUnits=0,groupCount=0;
  const pattern=/^(\d+)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(seconds?|secs?|sec|s|minutes?|mins?|min|hours?|hrs?|hr|h|marks?)$/i;
  for(const line of lines){
    const parts=line.split('|');
    if(parts.length>2)return {plan:null,error:'Use only one “|” between a segment label and its plan.'};
    const label=parts.length===2?clampText(parts[0],APP_LIMITS.maxUnitChars).trim():'';
    if(parts.length===2&&!label)return {plan:null,error:'Add a short segment label before “|”.'};
    const tokens=String(parts.length===2?parts[1]:parts[0]).split(/[,;]+/).map(token=>token.trim()).filter(Boolean);
    if(!tokens.length||groupCount+tokens.length>APP_LIMITS.maxPracticePlanGroups)return {plan:null,error:`Use no more than ${APP_LIMITS.maxPracticePlanGroups} budget groups.`};
    for(const token of tokens){
      const match=token.match(pattern);
      if(!match){
        if(/^(\d+)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*m$/i.test(token))return {plan:null,error:'“m” is ambiguous. Write “min” for minutes or “marks” for marks.'};
        return {plan:null,error:'Use groups such as 5×10 min or 3×15 marks.'};
      }
      const count=validPracticeTotalUnits(Number(match[1])),amount=Number(match[2]),suffix=match[3].toLowerCase();
      const tokenMode=/^marks?$/.test(suffix)?PRACTICE_PLAN_MODES.MARKS:PRACTICE_PLAN_MODES.TIME;
      if(mode&&mode!==tokenMode)return {plan:null,error:'Use either fixed time or marks in one plan, not both.'};
      mode=tokenMode;
      let planValue=0;
      if(mode===PRACTICE_PLAN_MODES.MARKS){
        if(Number.isFinite(amount)&&amount>0&&amount<=APP_LIMITS.maxPracticeMarksPerUnit)planValue=Math.round(amount*1000)/1000;
      }else{
        const factor=/^h/.test(suffix)?3600000:/^s/.test(suffix)?1000:60000;
        planValue=validPracticeMs(amount*factor,{min:APP_LIMITS.minPracticeTargetMs});
      }
      if(!count||!planValue||totalUnits+count>APP_LIMITS.maxPracticeUnitsPerRun)return {plan:null,error:`The plan must contain 1–${APP_LIMITS.maxPracticeUnitsPerRun} valid units.`};
      groups.push([count,planValue]);totalUnits+=count;groupCount++;
    }
    if(segmented)segments.push(label?[totalUnits,label]:[totalUnits]);
  }
  if(mode===PRACTICE_PLAN_MODES.MARKS&&requireSession&&!validPracticeMs(sessionTargetMs,{min:APP_LIMITS.minPracticeTargetMs}))return {plan:null,error:'A marks plan needs the overall Paper time.'};
  const plan=sanitizePracticeUnitPlan({mode,groups,...(segmented?{segments}:{})});
  if(plan&&mode===PRACTICE_PLAN_MODES.MARKS&&validPracticeMs(sessionTargetMs,{min:APP_LIMITS.minPracticeTargetMs})){
    const probe={targetMs:APP_LIMITS.minPracticeTargetMs,sessionTargetMs,unitPlan:plan};
    const context=createPracticePlanContext(probe,plan);
    if(context.unitTargets.some(targetMs=>targetMs<APP_LIMITS.minPracticeTargetMs))return {plan:null,error:'The session target is too short for this marks distribution.'};
  }
  return plan?{plan,error:''}:{plan:null,error:'The paper plan is not valid.'};
}
function createPracticePlanContext(run,cleanPlan=undefined){
  const targetMs=validPracticeMs(run&&run.targetMs,{min:APP_LIMITS.minPracticeTargetMs});
  const sessionTargetMs=validPracticeMs(run&&run.sessionTargetMs,{min:APP_LIMITS.minPracticeTargetMs});
  const unitPlan=cleanPlan===undefined?sanitizePracticeUnitPlan(run&&run.unitPlan):cleanPlan;
  const planUnits=practiceCleanPlanUnitCount(unitPlan),totalUnits=validPracticeTotalUnits(run&&run.totalUnits);
  const plannedUnits=planUnits||totalUnits||0;
  const unitTargets=[],unitMarks=[],targetPrefixMs=[0];
  if(unitPlan){
    const totalWeight=unitPlan.mode===PRACTICE_PLAN_MODES.MARKS?unitPlan.groups.reduce((sum,row)=>sum+row[0]*row[1],0):0;
    let cumulativeWeight=0,allocatedMs=0;
    unitPlan.groups.forEach(([count,value])=>{
      for(let offset=0;offset<count;offset++){
        let unitTargetMs=value,marks=null;
        if(unitPlan.mode===PRACTICE_PLAN_MODES.MARKS){
          marks=value;cumulativeWeight+=value;
          const nextAllocated=sessionTargetMs&&totalWeight?Math.round(sessionTargetMs*cumulativeWeight/totalWeight):allocatedMs+targetMs;
          unitTargetMs=Math.max(1,nextAllocated-allocatedMs);allocatedMs=nextAllocated;
        }
        unitTargets.push(unitTargetMs);unitMarks.push(marks);targetPrefixMs.push(targetPrefixMs[targetPrefixMs.length-1]+unitTargetMs);
      }
    });
  }
  const derivedSessionTargetMs=unitPlan&&unitPlan.mode===PRACTICE_PLAN_MODES.TIME
    ? targetPrefixMs[targetPrefixMs.length-1]
    : !unitPlan&&plannedUnits&&targetMs?plannedUnits*targetMs:0;
  const effectiveSessionTargetMs=unitPlan&&unitPlan.mode===PRACTICE_PLAN_MODES.MARKS?sessionTargetMs:(derivedSessionTargetMs||sessionTargetMs);
  const segments=[];
  if(unitPlan&&unitPlan.segments){
    let start=0;
    unitPlan.segments.forEach((row,index)=>{
      const end=row[0],label=row[1]||`Segment ${index+1}`;
      segments.push({index,label,start,end,units:end-start,targetMs:(targetPrefixMs[end]||0)-(targetPrefixMs[start]||0)});start=end;
    });
  }
  return {targetMs,unitPlan,plannedUnits,sessionTargetMs,effectiveSessionTargetMs,unitTargets,unitMarks,targetPrefixMs,segments};
}
function resolvePracticeConfiguration({targetMs,sessionTargetMs=0,totalUnits=0,unitPlan=null}={}){
  targetMs=validPracticeMs(targetMs,{min:APP_LIMITS.minPracticeTargetMs});
  sessionTargetMs=validPracticeMs(sessionTargetMs,{min:APP_LIMITS.minPracticeTargetMs});
  totalUnits=validPracticeTotalUnits(totalUnits);
  unitPlan=sanitizePracticeUnitPlan(unitPlan);
  const planUnits=practiceCleanPlanUnitCount(unitPlan);
  let plannedUnits=planUnits||totalUnits||0,plannedSessionMs=0;
  if(unitPlan){
    totalUnits=0;
    if(unitPlan.mode===PRACTICE_PLAN_MODES.MARKS){
      if(!sessionTargetMs)return {ok:false,error:'A marks plan needs the overall Paper time.'};
      plannedSessionMs=sessionTargetMs;
      const context=createPracticePlanContext({targetMs:targetMs||APP_LIMITS.minPracticeTargetMs,sessionTargetMs,unitPlan},unitPlan);
      if(context.unitTargets.some(value=>value<APP_LIMITS.minPracticeTargetMs))return {ok:false,error:'The Paper time is too short for this marks distribution.'};
      targetMs=context.unitTargets[0]||targetMs;
    }else{
      sessionTargetMs=0;plannedSessionMs=unitPlan.groups.reduce((sum,row)=>sum+row[0]*row[1],0);
      targetMs=unitPlan.groups[0]?.[1]||targetMs;
    }
  }else{
    sessionTargetMs=0;
    if(!targetMs)return {ok:false,error:'Enter a Unit target such as 10, 1:30, or 90s.'};
    if(totalUnits)plannedSessionMs=targetMs*totalUnits;
  }
  if(plannedSessionMs>APP_LIMITS.maxPracticeTargetMs)return {ok:false,error:`The planned session is longer than ${formatPracticeMs(APP_LIMITS.maxPracticeTargetMs)}.`};
  const effectiveSessionTargetMs=plannedSessionMs||sessionTargetMs;
  const segmentLabel=unitPlan&&unitPlan.segments?` · ${unitPlan.segments.length} segments`:'';
  const totalMarks=unitPlan&&unitPlan.mode===PRACTICE_PLAN_MODES.MARKS
    ? Number(unitPlan.groups.reduce((sum,row)=>sum+row[0]*row[1],0).toFixed(3))
    : 0;
  const summary=unitPlan
    ? `${plannedUnits} units${segmentLabel}${totalMarks?` · ${totalMarks} marks`:''} · ${formatPracticeMs(effectiveSessionTargetMs)}`
    : plannedUnits
      ? `${plannedUnits} units · ${formatPracticeMs(effectiveSessionTargetMs)} total`
      : `Open-ended · ${formatPracticeMs(targetMs)} per unit`;
  return {ok:true,error:'',targetMs,sessionTargetMs,totalUnits,unitPlan,plannedUnits,plannedSessionMs,effectiveSessionTargetMs,summary};
}
function practiceDurationInputText(ms){
  const value=Math.max(0,Math.round(Number(ms)||0));
  if(value%3600000===0)return `${value/3600000}h`;
  if(value%60000===0)return `${value/60000}m`;
  if(value%1000===0)return `${value/1000}s`;
  return `${value/1000}s`;
}
function practicePlanDurationInputText(ms){
  const value=Math.max(0,Math.round(Number(ms)||0));
  if(value%3600000===0)return `${value/3600000} hr`;
  if(value%60000===0)return `${value/60000} min`;
  return `${Math.round(value)/1000} sec`;
}
function practicePlanInputText(plan){
  const clean=sanitizePracticeUnitPlan(plan);if(!clean)return '';
  const groupText=([count,value])=>`${count}×${clean.mode===PRACTICE_PLAN_MODES.MARKS?`${value} marks`:practicePlanDurationInputText(value)}`;
  if(!clean.segments)return clean.groups.map(groupText).join(', ');
  const values=[];clean.groups.forEach(([count,value])=>{for(let i=0;i<count;i++)values.push(value);});
  let start=0;
  return clean.segments.map(row=>{
    const groups=[];
    values.slice(start,row[0]).forEach(value=>{
      const previous=groups[groups.length-1];if(previous&&previous[1]===value)previous[0]++;else groups.push([1,value]);
    });
    start=row[0];
    return `${row[1]?`${row[1]} | `:''}${groups.map(groupText).join(', ')}`;
  }).join('\n');
}
/* PRACTICE PACER · 3. DERIVED PACING MATHEMATICS */
const PRACTICE_CONTROLLED_MIN_RATIO=.8;
function practiceUnitPlanDescriptor(run,index,context=null){
  const ctx=context||createPracticePlanContext(run),ordinal=Math.max(0,Math.floor(Number(index)||0));
  const segment=ctx.segments.find(row=>ordinal>=row.start&&ordinal<row.end)||null;
  return {
    targetMs:ctx.unitTargets[ordinal]||ctx.targetMs,marks:ctx.unitMarks[ordinal]??null,segment,
    segmentUnitIndex:segment?ordinal-segment.start:null
  };
}
function practiceCompletedTargetMs(run,count,context=null){
  const ctx=context||createPracticePlanContext(run),units=Math.max(0,Math.floor(Number(count)||0));
  const planned=Math.min(units,ctx.unitTargets.length),plannedMs=ctx.targetPrefixMs[planned]||0;
  return plannedMs+Math.max(0,units-planned)*ctx.targetMs;
}
function practiceRunProgressRatio(run,elapsedMs,context=null){
  const ctx=context||createPracticePlanContext(run);
  if(!ctx.plannedUnits||!ctx.effectiveSessionTargetMs)return null;
  const completed=Array.isArray(run&&run.unitMs)?Math.min(run.unitMs.length,ctx.plannedUnits):0;
  const currentTarget=completed<ctx.plannedUnits?practiceUnitPlanDescriptor(run,completed,ctx).targetMs||ctx.targetMs:0;
  const currentProgress=currentTarget?Math.min(Math.max(0,Number(elapsedMs)||0),currentTarget):0;
  return Math.min(1,(practiceCompletedTargetMs(run,completed,ctx)+currentProgress)/ctx.effectiveSessionTargetMs);
}
function practiceRemainingPace(run,elapsedMs,context=null){
  const ctx=context||createPracticePlanContext(run),completed=Array.isArray(run&&run.unitMs)?run.unitMs.length:0;
  if(!ctx.plannedUnits||!ctx.effectiveSessionTargetMs||completed>=ctx.plannedUnits)return null;
  const elapsed=Math.max(0,Number(elapsedMs)||0),completedActual=run.unitMs.reduce((sum,ms)=>sum+ms,0);
  const remainingClock=Math.max(0,ctx.effectiveSessionTargetMs-completedActual-elapsed);
  const currentTarget=practiceUnitPlanDescriptor(run,completed,ctx).targetMs||ctx.targetMs;
  const futureUnits=Math.max(0,ctx.plannedUnits-completed-1);
  if(!futureUnits)return null;
  const futureClock=Math.max(0,remainingClock-Math.max(0,currentTarget-elapsed));
  if(!ctx.unitPlan){
    if(!futureClock)return {text:'Recovery pace · session time exhausted',tone:'behind'};
    const average=futureClock/futureUnits,ratio=ctx.targetMs?average/ctx.targetMs:1;
    if(Math.abs(ratio-1)<=.01)return null;
    if(ratio<1)return {text:`Recovery pace · ${formatPracticeMs(average)} per later unit`,tone:'behind'};
    return {text:`Time cushion · ${Math.min(999,Math.round((ratio-1)*100))}% available`,tone:'ahead'};
  }
  const futurePlan=Math.max(0,practiceCompletedTargetMs(run,ctx.plannedUnits,ctx)-practiceCompletedTargetMs(run,completed+1,ctx));
  const ratio=futurePlan?futureClock/futurePlan:0;
  if(Math.abs(ratio-1)<=.01)return null;
  if(ratio<=0)return {text:'Recovery pace · session time exhausted',tone:'behind'};
  if(ratio<1)return {text:`Recovery pace · ${Math.min(999,Math.round((1/ratio-1)*100))}% faster needed`,tone:'behind'};
  return {text:`Time cushion · ${Math.min(999,Math.round((ratio-1)*100))}% available`,tone:'ahead'};
}
function practicePaceBand(actualMs,targetMs){
  const target=Math.max(0,Number(targetMs)||0),ratio=target?Math.max(0,Number(actualMs)||0)/target:0;
  return ratio<PRACTICE_CONTROLLED_MIN_RATIO?'fast':ratio<=1?'controlled':'over';
}
function practicePaceBandLabel(value){return value==='fast'?'Fast':value==='controlled'?'Controlled':'Over target';}
function practiceMedianMs(values){
  const sorted=(values||[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!sorted.length)return 0;
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}
function practiceRunEvidenceFromClean(run,index=0){
  const context=createPracticePlanContext(run,run.unitPlan||null);
  const unitRows=run.unitMs.map((actualMs,unitIndex)=>{
    const descriptor=practiceUnitPlanDescriptor(run,unitIndex,context);
    const targetMs=descriptor.targetMs||run.targetMs;
    return {
      index:unitIndex,actualMs,targetMs,marks:descriptor.marks,deltaMs:actualMs-targetMs,paceRatio:targetMs?actualMs/targetMs:0,paceBand:practicePaceBand(actualMs,targetMs),withinTarget:actualMs<=targetMs,
      segmentIndex:descriptor.segment?descriptor.segment.index:null,segmentLabel:descriptor.segment?descriptor.segment.label:'',
      segmentUnitIndex:descriptor.segmentUnitIndex,segmentUnits:descriptor.segment?descriptor.segment.units:0
    };
  });
  const segmentRows=context.segments.map(segment=>{
    const rows=unitRows.filter(row=>row.segmentIndex===segment.index);
    const actualMs=rows.reduce((sum,row)=>sum+row.actualMs,0),targetMs=rows.reduce((sum,row)=>sum+row.targetMs,0);
    return {
      index:segment.index,label:segment.label,units:rows.length,plannedUnits:segment.units,actualMs,targetMs,plannedTargetMs:segment.targetMs,
      completion:segment.units?Math.min(100,rows.length/segment.units*100):null,complete:segment.units>0&&rows.length>=segment.units,varianceMs:actualMs-targetMs
    };
  });
  const actualMs=unitRows.reduce((sum,row)=>sum+row.actualMs,0);
  const plannedCompletedMs=practiceCompletedTargetMs(run,unitRows.length,context);
  const plannedUnits=context.plannedUnits;
  const sessionTargetMs=context.effectiveSessionTargetMs;
  const complete=!plannedUnits||unitRows.length>=plannedUnits,partial=run.partial===true||!complete;
  const comparisonTargetMs=complete&&sessionTargetMs?sessionTargetMs:plannedCompletedMs;
  const split=Math.ceil(unitRows.length/2),first=unitRows.slice(0,split),second=unitRows.slice(split);
  const average=rows=>rows.length?rows.reduce((sum,row)=>sum+row.actualMs,0)/rows.length:0;
  return {
    index,run,unitRows,segmentRows,units:unitRows.length,plannedUnits,actualMs,comparisonTargetMs,complete,partial,
    varianceMs:actualMs-comparisonTargetMs,withinTarget:unitRows.filter(row=>row.withinTarget).length,fast:unitRows.filter(row=>row.paceBand==='fast').length,controlled:unitRows.filter(row=>row.paceBand==='controlled').length,overTarget:unitRows.filter(row=>row.paceBand==='over').length,
    averageMs:average(unitRows),medianMs:practiceMedianMs(unitRows.map(row=>row.actualMs)),
    fastestMs:unitRows.length?Math.min(...unitRows.map(row=>row.actualMs)):0,slowestMs:unitRows.length?Math.max(...unitRows.map(row=>row.actualMs)):0,
    firstHalfAverageMs:average(first),secondHalfAverageMs:average(second)
  };
}
function summarizeCleanPracticeRuns(runs){
  const runSummaries=runs.map((run,index)=>practiceRunEvidenceFromClean(run,index));
  const unitRows=runSummaries.flatMap(run=>run.unitRows),totalMs=runSummaries.reduce((sum,run)=>sum+run.actualMs,0);
  const comparisonTargetMs=runSummaries.reduce((sum,run)=>sum+run.comparisonTargetMs,0);
  return {
    runs:runs.length,units:unitRows.length,totalMs,comparisonTargetMs,varianceMs:totalMs-comparisonTargetMs,runSummaries,
    plannedUnits:runSummaries.every(run=>run.plannedUnits)?runSummaries.reduce((sum,run)=>sum+run.plannedUnits,0):0,
    averageMs:unitRows.length?totalMs/unitRows.length:0,medianMs:practiceMedianMs(unitRows.map(row=>row.actualMs)),
    partialRuns:runSummaries.filter(run=>run.partial).length,fast:unitRows.filter(row=>row.paceBand==='fast').length,controlled:unitRows.filter(row=>row.paceBand==='controlled').length,
    withinTarget:unitRows.filter(row=>row.withinTarget).length,overTarget:unitRows.filter(row=>row.paceBand==='over').length
  };
}
function summarizePracticeRunsForInsights(values){
  const rawRuns=clampArray(values,APP_LIMITS.maxPracticeRunsPerDay),runs=[],acceptedRawIndexes=[],rejectedRawIndexes=[];
  let unitsLeft=APP_LIMITS.maxPracticeUnitsPerDay;
  rawRuns.forEach((value,rawIndex)=>{
    if(unitsLeft<=0){rejectedRawIndexes.push(rawIndex);return;}
    const run=sanitizePracticeRun(value,{unitLimit:Math.min(APP_LIMITS.maxPracticeUnitsPerRun,unitsLeft)});
    if(!run){rejectedRawIndexes.push(rawIndex);return;}
    runs.push(run);acceptedRawIndexes.push(rawIndex);unitsLeft-=run.unitMs.length;
  });
  const summary=summarizeCleanPracticeRuns(runs);
  summary.runSummaries.forEach((row,index)=>{row.rawIndex=acceptedRawIndexes[index]??index;});
  summary.audit={savedRuns:rawRuns.length,acceptedRawIndexes,rejectedRawIndexes};
  return summary;
}
    return freeze({
      format:'study-director.practice-pacer-model',contractVersion:1,
PRACTICE_PAUSE_CAUSES,
      PRACTICE_PLAN_MODES,
      PRACTICE_SETUP_MODES,
      PRACTICE_CUE_MODES,
      PRACTICE_CUE_DEFAULT,
      PRACTICE_CONTROLLED_MIN_RATIO,
      sanitizePracticeCueMode,
      formatPracticeMs,
      parsePracticeDurationMs,
      validPracticeMs,
      validPracticeTotalUnits,
      sanitizePracticeUnitMs,
      sanitizePracticeTaskId,
      sanitizePracticeRun,
      sanitizePracticeRuns,
      sanitizePracticeActive,
      sanitizePracticeState,
      practiceRunInputFromActive,
      sanitizePracticeUnitPlan,
      practiceCleanPlanUnitCount,
      parsePracticeUnitPlan,
      createPracticePlanContext,
      resolvePracticeConfiguration,
      practiceDurationInputText,
      practicePlanDurationInputText,
      practicePlanInputText,
      practiceUnitPlanDescriptor,
      practiceCompletedTargetMs,
      practiceRunProgressRatio,
      practiceRemainingPace,
      practicePaceBand,
      practicePaceBandLabel,
      practiceMedianMs,
      practiceRunEvidenceFromClean,
      summarizeCleanPracticeRuns,
      summarizePracticeRunsForInsights
    });
  }
  function createController(input){
    exactObject(input,['model','ports'],'Practice Pacer controller input');
    const model=input.model;
    if(!Object.isFrozen(model)||model.format!=='study-director.practice-pacer-model'||model.contractVersion!==1)throw new TypeError('Practice Pacer model is unavailable or incompatible.');
    const ports=exactObject(input.ports,Object.keys(CONTROLLER_PORT_FIELDS),'Practice Pacer controller ports');
    for(const [name,fields] of Object.entries(CONTROLLER_PORT_FIELDS))exactObject(ports[name],fields,'Practice Pacer controller '+name+' port');
    const {APP_LIMITS}=ports.configuration;
    const {TASKS,TIMER_MODES,TaskIdentity,TimerState}=ports.state;
    const {isTaskResolved,isWorkBlock}=ports.schedule;
    const {persistPracticeCueMode,persistPracticeTarget,saveLiveDraft,writeLiveDraftNow}=ports.persistence;
    const {document,isExecutePaneVisible,setElementAttribute,setElementClass,setElementDisabled,setElementHidden,setElementStyle,setElementText,setTextSafe}=ports.view;
    const {notifications,readUserDefaults}=ports.userPreferences;
    const {appCanMutate}=ports.ownership;
    const {nowMs}=ports.clock;
    const {
      PRACTICE_PAUSE_CAUSES,
      PRACTICE_PLAN_MODES,
      PRACTICE_SETUP_MODES,
      PRACTICE_CUE_MODES,
      PRACTICE_CUE_DEFAULT,
      PRACTICE_CONTROLLED_MIN_RATIO,
      sanitizePracticeCueMode,
      formatPracticeMs,
      parsePracticeDurationMs,
      validPracticeMs,
      validPracticeTotalUnits,
      sanitizePracticeUnitMs,
      sanitizePracticeTaskId,
      sanitizePracticeRun,
      sanitizePracticeRuns,
      sanitizePracticeActive,
      sanitizePracticeState,
      practiceRunInputFromActive,
      sanitizePracticeUnitPlan,
      practiceCleanPlanUnitCount,
      parsePracticeUnitPlan,
      createPracticePlanContext,
      resolvePracticeConfiguration,
      practiceDurationInputText,
      practicePlanDurationInputText,
      practicePlanInputText,
      practiceUnitPlanDescriptor,
      practiceCompletedTargetMs,
      practiceRunProgressRatio,
      practiceRemainingPace,
      practicePaceBand,
      practicePaceBandLabel,
      practiceMedianMs,
      practiceRunEvidenceFromClean,
      summarizeCleanPracticeRuns,
      summarizePracticeRunsForInsights
    }=model;

  let cueDelivery=null,cueOccurrence=0;
  function clearCueDelivery(){if(cueDelivery)cueDelivery.resolve();cueDelivery=null;}
  let active=null,runs=[],message='',lastPaintKey='',lastRenderKey='',renderDirty=true,activePlanContext=null,resetPromptArmed=false;
  let setupMode=PRACTICE_SETUP_MODES.SIMPLE,variablePlanKind=null,cueMode=PRACTICE_CUE_DEFAULT,simpleTotalEnabled=false;
  /* 4. Runtime state */
  function resetActivePlanContext(){activePlanContext=active?createPracticePlanContext(active,active.unitPlan||null):null;return activePlanContext;}
  function currentPlanContext(){return activePlanContext||(active?resetActivePlanContext():null);}
  function running(){return !!(active&&Number.isFinite(Number(active.anchorMs))&&Number(active.anchorMs)>0);}
  function completedUnitCount(){return runs.reduce((sum,run)=>sum+run.unitMs.length,0)+(active?active.unitMs.length:0);}
  function currentMsAt(now=nowMs()){
    if(!active)return 0;
    rebaseBackwardClock(now);
    return Math.min(APP_LIMITS.maxPracticeTargetMs,Math.max(0,active.currentMs+(running()?Math.max(0,now-active.anchorMs):0)));
  }
  function sessionMsAt(now=nowMs()){
    return active?active.unitMs.reduce((sum,ms)=>sum+ms,0)+currentMsAt(now):0;
  }
  function pauseAt(now,cause){
    clearCueDelivery();
    if(!active)return false;
    if(running())active.currentMs=Math.round(currentMsAt(now));
    active.anchorMs=null;active.pauseCause=cause||PRACTICE_PAUSE_CAUSES.MANUAL;lastPaintKey='';
    return true;
  }
  function linkedToCurrentTask(){return !!(active&&TaskIdentity.idAt(TimerState.currentIndex)===active.taskId);}
  function canResume(){return !!(active&&!running()&&mainCanRun()&&linkedToCurrentTask());}
  function focusAction(action,fallbackSelector=''){
    let control=[...document.querySelectorAll('[data-action]')].find(candidate=>candidate.dataset.action===action)||null;
    if(!control||control.disabled||control.closest('[hidden]'))control=fallbackSelector?document.querySelector(fallbackSelector):null;
    if(!control||control.disabled||control.closest('[hidden]'))return false;
    try{control.focus({preventScroll:true});}catch(e){control.focus();}
    return document.activeElement===control;
  }
  function start(){
    clearCueDelivery();
    if(!appCanMutate())return false;
    if(active){setMessage('Finish the current practice run before starting another.',true);return false;}
    if(!mainCanRun()){setMessage('Start a work block timer first.',true);return false;}
    if(runs.length>=APP_LIMITS.maxPracticeRunsPerDay||completedUnitCount()>=APP_LIMITS.maxPracticeUnitsPerDay){setMessage('Today’s bounded practice log is full.',true);return false;}
    const config=setupConfiguration();
    if(!config.ok){setMessage(config.error,true);return false;}
    const now=nowMs();
    active={taskId:TaskIdentity.idAt(TimerState.currentIndex),targetMs:config.targetMs,unitMs:[],currentMs:0,anchorMs:now,pauseCause:null,cueStage:0};
    if(config.unitPlan){
      active.unitPlan=config.unitPlan;
      if(config.unitPlan.mode===PRACTICE_PLAN_MODES.MARKS)active.sessionTargetMs=config.sessionTargetMs;
    }else if(config.totalUnits)active.totalUnits=config.totalUnits;
    else if(config.sessionTargetMs)active.sessionTargetMs=config.sessionTargetMs;
    resetActivePlanContext();
    if(!config.unitPlan)persistTarget(config.targetMs);
    message='';lastPaintKey='';saveNow();focusAction('practice-next');
    return true;
  }
  function next(){
    clearCueDelivery();
    if(!appCanMutate()||!active)return false;
    if(!running()){setMessage('Resume the pacer before moving to the next unit.',true);return false;}
    const elapsed=Math.round(currentMsAt());
    if(elapsed<=0)return false;
    active.unitMs.push(elapsed);
    const plannedUnits=currentPlanContext().plannedUnits;
    if(plannedUnits&&active.unitMs.length>=plannedUnits)return finish({includeCurrent:false,message:`Completed ${plannedUnits} planned ${plannedUnits===1?'unit':'units'}.`});
    if(active.unitMs.length>=APP_LIMITS.maxPracticeUnitsPerRun||completedUnitCount()>=APP_LIMITS.maxPracticeUnitsPerDay){
      return finish({includeCurrent:false,message:'Practice run finished at the data limit.'});
    }
    active.currentMs=0;active.anchorMs=nowMs();active.cueStage=0;active.pauseCause=null;message='';lastPaintKey='';saveNow();
    return true;
  }
  function undoLast(){
    clearCueDelivery();
    if(!appCanMutate()||!active||!active.unitMs.length)return false;
    const now=nowMs(),wasRunning=running(),current=Math.round(currentMsAt(now));
    active.currentMs=Math.min(APP_LIMITS.maxPracticeTargetMs,active.unitMs.pop()+current);
    active.anchorMs=wasRunning?now:null;
    if(wasRunning)active.pauseCause=null;
    const targetMs=practiceUnitPlanDescriptor(active,active.unitMs.length,currentPlanContext()).targetMs,ratio=targetMs?active.currentMs/targetMs:0;
    active.cueStage=ratio>=1?2:ratio>=.8?1:0;message='';lastPaintKey='';saveNow();
    return true;
  }
  function requestReset(){
    if(!appCanMutate()||!active)return false;
    resetPromptArmed=true;render();focusAction('practice-reset-confirm');return true;
  }
  function cancelReset(){
    if(!resetPromptArmed)return false;
    resetPromptArmed=false;render();focusAction('practice-reset');return true;
  }
  function confirmReset(){
    if(!appCanMutate()||!active||!resetPromptArmed)return false;
    const prior=active;
    active=null;activePlanContext=null;resetPromptArmed=false;lastPaintKey='';
    fillSetup(prior);message='Settings kept. Edit them or start again.';render();writeLiveDraftNow();focusAction('practice-start','#practice-pacer-setup :is(input,textarea,button):not([disabled])');
    return true;
  }
  function toggle(){
    if(!appCanMutate()||!active)return false;
    if(running()){
      pauseAt(nowMs(),PRACTICE_PAUSE_CAUSES.MANUAL);message='Paused without affecting the main timer.';saveNow();return true;
    }
    if(!canResume()){setMessage('Resume the linked work block timer first.',true);return false;}
    active.anchorMs=nowMs();active.pauseCause=null;message='';lastPaintKey='';saveNow();return true;
  }
  function finish(options={}){
    clearCueDelivery();
    if(!appCanMutate()||!active)return false;
    const includeCurrent=options.includeCurrent!==false;
    const units=active.unitMs.slice();
    const current=Math.round(currentMsAt());
    if(includeCurrent&&current>0)units.push(current);
    const plannedUnits=currentPlanContext().plannedUnits,partial=options.partial===true||(plannedUnits>0&&units.length<plannedUnits);
    const raw=practiceRunInputFromActive(active,units,{partial});
    const run=sanitizePracticeRun(raw,{unitLimit:Math.min(APP_LIMITS.maxPracticeUnitsPerRun,APP_LIMITS.maxPracticeUnitsPerDay-runs.reduce((sum,row)=>sum+row.unitMs.length,0))});
    active=null;activePlanContext=null;resetPromptArmed=false;
    if(run&&runs.length<APP_LIMITS.maxPracticeRunsPerDay)runs.push(run);
    message=options.message||(run?`Recorded ${run.unitMs.length} ${run.unitMs.length===1?'unit':'units'}.`:'Empty run discarded.');
    lastPaintKey='';
    if(options.persist===false)render();else saveNow();
    if(options.focus!==false)focusAction('practice-start','#practice-pacer-setup :is(input,textarea,button):not([disabled])');
    return !!run;
  }
  /* 5. Persistence and sanitisation */
  function saveNow(){resetPromptArmed=false;render();writeLiveDraftNow();}
  function persistTarget(targetMs){try{persistPracticeTarget(targetMs);}catch(e){}}
  function snapshot(){
    const clean=sanitizePracticeState({active,runs});
    return clean.active||clean.runs.length?clean:null;
  }
  function restore(payload,{forcePaused=false,pauseCause=PRACTICE_PAUSE_CAUSES.SESSION,savedAtMs=null}={}){
    clearCueDelivery();
    const clean=sanitizePracticeState(payload);active=clean.active;runs=clean.runs;message='';lastPaintKey='';resetPromptArmed=false;
    resetActivePlanContext();
    if(active){
      const idx=TaskIdentity.indexForId(active.taskId);
      if(idx===null){
        const cutoff=Number.isFinite(Number(savedAtMs))?Math.max(active.anchorMs||0,Number(savedAtMs)):nowMs();
        pauseAt(cutoff,PRACTICE_PAUSE_CAUSES.SESSION);
        const recovered=sanitizePracticeRun(practiceRunInputFromActive(active,[...active.unitMs,...(active.currentMs>0?[active.currentMs]:[])],{includeTask:false,partial:true}),{unitLimit:Math.min(APP_LIMITS.maxPracticeUnitsPerRun,APP_LIMITS.maxPracticeUnitsPerDay-runs.reduce((sum,row)=>sum+row.unitMs.length,0))});
        if(recovered&&runs.length<APP_LIMITS.maxPracticeRunsPerDay)runs.push(recovered);
        active=null;activePlanContext=null;
      }else if(forcePaused||isTaskResolved(idx)){
        const cutoff=Number.isFinite(Number(savedAtMs))?Math.max(active.anchorMs||0,Number(savedAtMs)):nowMs();
        pauseAt(cutoff,isTaskResolved(idx)?PRACTICE_PAUSE_CAUSES.BLOCK:pauseCause);
      }
    }
    render();return !!(active||runs.length);
  }
  function reset(){
    clearCueDelivery();
    active=null;activePlanContext=null;runs=[];message='';lastPaintKey='';resetPromptArmed=false;
    setupMode=PRACTICE_SETUP_MODES.SIMPLE;variablePlanKind=null;simpleTotalEnabled=false;
    ['practice-total-units','practice-unit-plan','practice-session-target'].forEach(id=>{const input=document.getElementById(id);if(input)input.value='';});
    const formatHelp=document.querySelector('.practice-format-help');if(formatHelp)formatHelp.open=false;
    render();
  }
  function removeRun(index){
    if(!appCanMutate())return false;
    const at=Number(index);if(!Number.isInteger(at)||at<0||at>=runs.length)return false;
    runs.splice(at,1);message='';render();writeLiveDraftNow();return true;
  }
  function completedRuns(){return sanitizePracticeRuns(runs);}
  function status(){return {active:active?JSON.parse(JSON.stringify(active)):null,runs:completedRuns(),running:running(),currentMs:currentMsAt(),sessionMs:sessionMsAt()};}
  function remapTaskLinks(taskIdMap){
    if(!(taskIdMap instanceof Map)||!taskIdMap.size)return 0;
    let changed=0;
    if(active&&taskIdMap.has(active.taskId)){active.taskId=taskIdMap.get(active.taskId);changed++;}
    runs.forEach(run=>{
      if(run.taskId&&taskIdMap.has(run.taskId)){run.taskId=taskIdMap.get(run.taskId);changed++;}
    });
    if(changed)lastPaintKey='';
    return changed;
  }
  /* 6. Timer integration */
  function mainCanRun(){return TimerState.mode===TIMER_MODES.RUNNING&&!TimerState.paused&&!TimerState.inactiveGap&&TimerState.runtime&&TimerState.runtime.startMs!==null&&TimerState.runtime.taskIdx===TimerState.currentIndex&&TimerState.currentIndex<TASKS.length&&isWorkBlock(TASKS[TimerState.currentIndex]);}
  function rebaseBackwardClock(now=nowMs()){
    if(active&&running()&&now<active.anchorMs&&appCanMutate())active.anchorMs=now;
    return now;
  }
  function rebaseClock(delta){
    const shift=Number(delta);
    if(active&&running()&&Number.isFinite(shift))active.anchorMs+=shift;
  }
  function pauseFromMain(cause=PRACTICE_PAUSE_CAUSES.MAIN,now=nowMs()){
    clearCueDelivery();
    if(!active||!running())return false;
    pauseAt(now,cause);message=cause===PRACTICE_PAUSE_CAUSES.BLOCK?'The linked block ended.':'Paused with the main timer.';render();saveLiveDraft();return true;
  }
  function resumeFromMain(now=nowMs()){
    if(!active||running()||active.pauseCause!==PRACTICE_PAUSE_CAUSES.MAIN||!mainCanRun())return false;
    const idx=TaskIdentity.indexForId(active.taskId);
    if(idx===null||isTaskResolved(idx)||!linkedToCurrentTask())return false;
    active.anchorMs=now;active.pauseCause=null;message='';lastPaintKey='';render();saveLiveDraft();return true;
  }
  function onMainTaskChanging(nextTaskId,now=nowMs()){
    clearCueDelivery();
    if(!active||active.taskId===nextTaskId||(!running()&&[PRACTICE_PAUSE_CAUSES.BLOCK,PRACTICE_PAUSE_CAUSES.TASK].includes(active.pauseCause)))return false;
    pauseAt(now,PRACTICE_PAUSE_CAUSES.TASK);
    message='Main timer moved to another block. Return to the linked block, finish, or restart this run.';
    render();saveLiveDraft();return true;
  }
  function onBlockResolved(taskId,now=nowMs()){
    clearCueDelivery();
    if(!active||active.taskId!==taskId)return false;
    pauseAt(now,PRACTICE_PAUSE_CAUSES.BLOCK);message='The linked block ended. Finish this run, or resume deliberately.';render();saveLiveDraft();return true;
  }
  function pauseForSessionEnd({persist=true,now=nowMs()}={}){
    clearCueDelivery();
    if(!active)return false;
    pauseAt(now,PRACTICE_PAUSE_CAUSES.SESSION);message='Session ended; the pacer will not resume automatically.';
    if(persist)saveNow();else render();
    return true;
  }
  function onInactiveGapOpened(gap){
    clearCueDelivery();
    if(!active||!running()||!gap)return false;
    const lastMs=Math.max(active.anchorMs,Number(gap.lastMs)||nowMs());
    pauseAt(lastMs,PRACTICE_PAUSE_CAUSES.GAP);message='Waiting for the main timer’s inactive-gap decision.';render();saveLiveDraft();return true;
  }
  function resolveInactiveGap(focusMs,{resume=false,now=nowMs()}={}){
    if(!active||active.pauseCause!==PRACTICE_PAUSE_CAUSES.GAP)return false;
    active.currentMs=Math.min(APP_LIMITS.maxPracticeTargetMs,active.currentMs+Math.max(0,Math.round(Number(focusMs)||0)));
    if(resume&&mainCanRun()){active.anchorMs=now;active.pauseCause=null;message='';}
    else{active.anchorMs=null;active.pauseCause=PRACTICE_PAUSE_CAUSES.MAIN;message='Gap classified; resume the main timer when ready.';}
    lastPaintKey='';render();saveLiveDraft();return true;
  }
  function finalizeForDayClose(){
    clearCueDelivery();return active?finish({persist:false,partial:true,focus:false}):false;}
  /* 7. Rendering */
  function setMessage(text,warn=false){message=String(text||'');render({warn});}
  function syncSetupPresentation(){
    const targetInput=document.getElementById('practice-target');
    const sessionInput=document.getElementById('practice-session-target');
    const totalInput=document.getElementById('practice-total-units');
    const planInput=document.getElementById('practice-unit-plan');
    const simple=setupMode===PRACTICE_SETUP_MODES.SIMPLE;
    const simpleGroup=document.getElementById('practice-simple-setup');if(simpleGroup)simpleGroup.hidden=!simple;
    const variableGroup=document.getElementById('practice-variable-setup');if(variableGroup)variableGroup.hidden=simple;
    const totalOption=document.getElementById('practice-total-option');if(totalOption)totalOption.hidden=!simple||!simpleTotalEnabled;
    const totalToggle=document.getElementById('practice-total-toggle');
    if(totalToggle){
      totalToggle.hidden=!simple;totalToggle.textContent=simpleTotalEnabled?'− Remove total units':'+ Add total units';
      totalToggle.setAttribute('aria-expanded',simpleTotalEnabled?'true':'false');totalToggle.disabled=!!active;
    }
    if(targetInput)targetInput.disabled=!simple;
    if(totalInput)totalInput.disabled=!simple||!simpleTotalEnabled;
    if(planInput)planInput.disabled=simple;
    let probe={plan:null,error:''};
    if(!simple){
      const sessionMs=parsePracticeDurationMs(sessionInput&&sessionInput.value,{optional:true});
      probe=parsePracticeUnitPlan(planInput&&planInput.value,{sessionTargetMs:sessionMs,requireSession:false});
      variablePlanKind=probe.plan?probe.plan.mode:null;
    }
    const marks=!simple&&variablePlanKind===PRACTICE_PLAN_MODES.MARKS;
    const marksGroup=document.getElementById('practice-marks-session');if(marksGroup)marksGroup.hidden=!marks;
    if(sessionInput)sessionInput.disabled=!marks;
    document.querySelectorAll('[data-practice-mode]').forEach(button=>{
      const selected=button.dataset.practiceMode===setupMode;
      button.classList.toggle('on',selected);button.setAttribute('aria-pressed',selected?'true':'false');button.disabled=!!active;
    });
    const cueButton=document.getElementById('practice-cue-toggle');
    if(cueButton){
      const strict=cueMode===PRACTICE_CUE_MODES.STRICT;
      cueButton.textContent=`Cues · ${strict?'Nudge':'Quiet'}`;cueButton.setAttribute('aria-pressed',strict?'true':'false');
      cueButton.title=strict?'Nudges at 80% and target. Click for Quiet.':'Quiet uses colour only. Click for Nudge.';
      cueButton.disabled=!!active;
    }
    return probe;
  }
  function setSetupMode(value){
    const next=Object.values(PRACTICE_SETUP_MODES).includes(value)?value:null;
    if(!next||active||next===setupMode)return !!next&&!active;
    setupMode=next;message='';render();return true;
  }
  function setCueMode(value){
    const next=sanitizePracticeCueMode(value);
    if(active||!appCanMutate())return false;
    cueMode=next;persistPracticeCueMode(next);message='';render();return true;
  }
  function toggleCueMode(){return setCueMode(cueMode===PRACTICE_CUE_MODES.STRICT?PRACTICE_CUE_MODES.QUIET:PRACTICE_CUE_MODES.STRICT);}
  function toggleTotal(){
    if(active||!appCanMutate()||setupMode!==PRACTICE_SETUP_MODES.SIMPLE)return false;
    simpleTotalEnabled=!simpleTotalEnabled;
    const input=document.getElementById('practice-total-units');if(!simpleTotalEnabled&&input)input.value='';
    message='';render();if(simpleTotalEnabled)input?.focus();return true;
  }
  function setupConfiguration(){
    const targetInput=document.getElementById('practice-target');
    const sessionInput=document.getElementById('practice-session-target');
    const totalInput=document.getElementById('practice-total-units');
    const planInput=document.getElementById('practice-unit-plan');
    const presentation=syncSetupPresentation();
    if(setupMode===PRACTICE_SETUP_MODES.SIMPLE){
      const targetMs=parsePracticeDurationMs(targetInput&&targetInput.value);
      const totalText=simpleTotalEnabled?String(totalInput&&totalInput.value||'').trim():'';
      if(!targetMs)return {ok:false,error:'Enter a Unit target such as 10, 1:30, or 90s.'};
      const totalUnits=totalText?validPracticeTotalUnits(Number(totalText)):0;
      if(totalText&&!totalUnits)return {ok:false,error:`Total units must be a whole number from 1 to ${APP_LIMITS.maxPracticeUnitsPerRun}.`};
      return resolvePracticeConfiguration({targetMs,totalUnits});
    }
    const planText=String(planInput&&planInput.value||'').trim();
    if(!planText)return {ok:false,error:'Enter a Paper Plan using explicit “min” or “marks”.'};
    if(presentation.error)return {ok:false,error:presentation.error};
    const sessionText=String(sessionInput&&sessionInput.value||'').trim();
    const sessionTargetMs=parsePracticeDurationMs(sessionText,{optional:true});
    if(variablePlanKind===PRACTICE_PLAN_MODES.MARKS&&sessionText&&!sessionTargetMs)return {ok:false,error:'Enter a valid Paper time, such as 3:00:00.'};
    const parsedPlan=parsePracticeUnitPlan(planText,{sessionTargetMs});
    if(parsedPlan.error)return {ok:false,error:parsedPlan.error};
    if(!parsedPlan.plan)return {ok:false,error:'Enter a valid Paper Plan.'};
    return resolvePracticeConfiguration({sessionTargetMs,unitPlan:parsedPlan.plan});
  }
  function previewSetup(){
    if(active)return null;
    const result=setupConfiguration(),summary=document.getElementById('practice-setup-summary');
    if(summary){summary.textContent=result.ok?result.summary:result.error;summary.className=`practice-setup-summary ui-mono ${result.ok?'valid':'invalid'}`;}
    const startBtn=document.querySelector('[data-action="practice-start"]');
    if(startBtn)startBtn.disabled=!mainCanRun()||!result.ok;
    return result;
  }
  function fillSetup(run){
    const unitPlan=sanitizePracticeUnitPlan(run&&run.unitPlan);
    if(unitPlan){
      setupMode=PRACTICE_SETUP_MODES.VARIABLE;variablePlanKind=unitPlan.mode;
      const planInput=document.getElementById('practice-unit-plan');if(planInput)planInput.value=practicePlanInputText(unitPlan);
      if(unitPlan.mode===PRACTICE_PLAN_MODES.MARKS){
        const sessionInput=document.getElementById('practice-session-target');if(sessionInput)sessionInput.value=practiceDurationInputText(run.sessionTargetMs);
      }
    }else{
      setupMode=PRACTICE_SETUP_MODES.SIMPLE;
      const targetMs=validPracticeMs(run&&run.targetMs,{min:APP_LIMITS.minPracticeTargetMs});
      const targetInput=document.getElementById('practice-target');if(targetInput&&targetMs)targetInput.value=practiceDurationInputText(targetMs);
      const totalInput=document.getElementById('practice-total-units');if(totalInput)totalInput.value=run&&run.totalUnits?String(run.totalUnits):'';
      simpleTotalEnabled=!!(run&&run.totalUnits);
    }
  }
  function maybeCue(now=nowMs(),context=currentPlanContext(),elapsed=currentMsAt(now)){
    if(!appCanMutate()||!active||!running()||cueMode!==PRACTICE_CUE_MODES.STRICT)return false;
    const targetMs=practiceUnitPlanDescriptor(active,active.unitMs.length,context).targetMs;
    const nextStage=elapsed>=targetMs?2:elapsed>=targetMs*.8?1:0;
    if(!nextStage||active.cueStage>=nextStage)return false;
    active.cueStage=nextStage;clearCueDelivery();cueDelivery=notifications.begin({source:'practice',id:'pace',surface:'quiet',foreground:false,cue:nextStage===2?'practice-target':'practice-near',occurrence:String(++cueOccurrence)});saveLiveDraft({markChanged:false});return true;
  }
  function pulse(now=nowMs()){
    if(!active)return null;
    const context=currentPlanContext(),elapsed=currentMsAt(now);
    maybeCue(now,context,elapsed);
    return {context,elapsed};
  }
  function paintProgress(now=nowMs(),sample=null,force=false){
    if(!active||!isExecutePaneVisible()||(!force&&!running()))return false;
    const context=sample&&sample.context||currentPlanContext();
    const elapsed=sample&&Number.isFinite(sample.elapsed)?sample.elapsed:currentMsAt(now);
    const unitTargetMs=practiceUnitPlanDescriptor(active,active.unitMs.length,context).targetMs||active.targetMs;
    const unitFill=document.getElementById('practice-unit-progress-fill');
    const ratio=unitTargetMs?elapsed/unitTargetMs:0;
    let changed=setElementStyle(unitFill,'width',`${Math.min(100,Math.max(0,ratio*100)).toFixed(3)}%`);
    const runFill=document.getElementById('practice-run-progress-fill');
    const progress=practiceRunProgressRatio(active,elapsed,context);
    changed=setElementStyle(runFill,'width',progress===null?'0%':`${Math.min(100,Math.max(0,progress*100)).toFixed(3)}%`)||changed;
    return changed;
  }
  function paint(now=nowMs(),force=false){
    const sample=pulse(now);if(!sample)return;
    if(!force&&!isExecutePaneVisible())return;
    const {context,elapsed}=sample,second=Math.floor(elapsed/1000);
    const unitTargetMs=practiceUnitPlanDescriptor(active,active.unitMs.length,context).targetMs||active.targetMs;
    const plannedUnits=context.plannedUnits,sessionTargetMs=context.effectiveSessionTargetMs;
    const key=[second,active.unitMs.length,unitTargetMs,plannedUnits,sessionTargetMs,active.pauseCause||'',running()].join(':');
    if(!force&&key===lastPaintKey)return;
    lastPaintKey=key;
    const completedActualMs=active.unitMs.reduce((sum,ms)=>sum+ms,0);
    const sessionElapsed=completedActualMs+elapsed;
    const clock=document.getElementById('practice-unit-clock');
    const ratio=unitTargetMs?elapsed/unitTargetMs:0;
    if(clock){clock.textContent=formatPracticeMs(elapsed);clock.className='practice-unit-clock'+(ratio>=1?' over':ratio>=.8?' near':'');}
    const unitProgress=document.getElementById('practice-unit-progress'),unitFill=document.getElementById('practice-unit-progress-fill'),unitOver=document.getElementById('practice-unit-progress-over');
    paintProgress(now,sample,true);
    if(unitProgress&&unitFill){
      const percent=Math.min(100,Math.max(0,ratio*100)),band=practicePaceBand(elapsed,unitTargetMs),overrun=Math.max(0,elapsed-unitTargetMs);
      unitFill.className=`practice-unit-progress-fill ${band}`;
      unitProgress.setAttribute('aria-valuenow',String(Math.round(percent)));
      unitProgress.setAttribute('aria-valuetext',overrun>0?`${formatPracticeMs(overrun)} over target`:`${formatPracticeMs(elapsed)} of ${formatPracticeMs(unitTargetMs)}`);
      if(unitOver){unitOver.hidden=overrun<1000;unitOver.textContent=overrun>=1000?`+${formatPracticeMs(overrun)} over`:'';}
    }
    const runProgress=document.getElementById('practice-run-progress'),runFill=document.getElementById('practice-run-progress-fill');
    if(runProgress&&runFill){
      const progress=practiceRunProgressRatio(active,elapsed,context),visible=progress!==null;
      runProgress.hidden=!visible;
      if(visible){
        const percent=Math.min(100,Math.max(0,progress*100));
        runProgress.setAttribute('aria-valuenow',String(Math.round(percent)));runProgress.setAttribute('aria-valuetext',`${Math.round(percent)}% of planned run`);
      }
    }
    const descriptor=practiceUnitPlanDescriptor(active,active.unitMs.length,context);
    setTextSafe('practice-unit-meta',descriptor.segment
      ? `${descriptor.segment.label} · Unit ${descriptor.segmentUnitIndex+1} of ${descriptor.segment.units}`
      : `Unit ${active.unitMs.length+1}${plannedUnits?` of ${plannedUnits}`:''}`);
    setTextSafe('practice-target-label',`target ${formatPracticeMs(unitTargetMs)}`);
    const sessionBox=document.getElementById('practice-session-clock');
    if(sessionBox){
      const sessionRatio=sessionTargetMs?sessionElapsed/sessionTargetMs:0;
      sessionBox.hidden=!sessionTargetMs;
      sessionBox.className='practice-session-clock ui-mono'+(sessionRatio>=1?' over':sessionRatio>=.8?' near':'');
    }
    if(sessionTargetMs){
      const overrun=Math.max(0,sessionElapsed-sessionTargetMs);
      setTextSafe('practice-session-value',`${formatPracticeMs(sessionElapsed)} / ${formatPracticeMs(sessionTargetMs)}${overrun>=1000?` · +${formatPracticeMs(overrun)}`:''}`);
    }
    const pace=document.getElementById('practice-pace');
    if(pace){
      pace.className='practice-pace ui-mono'+(ratio>=1?' over':'');
      const overtime=Math.max(0,elapsed-unitTargetMs);
      pace.textContent=ratio>=1?(overtime<1000?'Target reached':`Over target by ${formatPracticeMs(overtime)}`):ratio>=.8?`${formatPracticeMs(unitTargetMs-elapsed)} to target`:'On pace';
    }
    const recovery=document.getElementById('practice-recovery');
    if(recovery){
      recovery.className='practice-recovery ui-mono';
      const remaining=practiceRemainingPace(active,elapsed,context);
      recovery.hidden=!remaining;recovery.textContent=remaining?remaining.text:'';
      if(remaining&&remaining.tone)recovery.classList.add(remaining.tone);
    }
  }
  function render(options={}){
    const setup=document.getElementById('practice-pacer-setup'),live=document.getElementById('practice-pacer-live');
    if(!setup||!live)return;
    const context=active?currentPlanContext():null;
    const key=[
      !!active,active&&active.taskId||'',active&&active.unitMs.length||0,active&&active.pauseCause||'',running(),resetPromptArmed,
      message,!!options.warn,setupMode,variablePlanKind||'',cueMode,simpleTotalEnabled,appCanMutate(),mainCanRun(),canResume(),
      context&&context.plannedUnits||0,context&&context.effectiveSessionTargetMs||0
    ].join('|');
    if(!isExecutePaneVisible()&&!options.force){renderDirty=true;lastRenderKey=key;return;}
    if(!options.force&&!renderDirty&&key===lastRenderKey){paint(nowMs(),true);return;}
    lastRenderKey=key;renderDirty=false;
    setElementHidden(setup,!!active);setElementHidden(live,!active);
    const stateEl=document.getElementById('practice-pacer-state');
    if(stateEl){
      const pausedLabel=active&&active.pauseCause===PRACTICE_PAUSE_CAUSES.MAIN?'Main paused'
        :active&&active.pauseCause===PRACTICE_PAUSE_CAUSES.BLOCK?'Block ended'
        :active&&active.pauseCause===PRACTICE_PAUSE_CAUSES.TASK?'Task changed'
        :active&&active.pauseCause===PRACTICE_PAUSE_CAUSES.SESSION?'Session ended'
        :active&&active.pauseCause===PRACTICE_PAUSE_CAUSES.GAP?'Gap check':'Paused';
      setElementText(stateEl,!active?'Ready':resetPromptArmed?'Restart?':running()?'Running':pausedLabel);
    }
    const msg=document.getElementById('practice-pacer-message');
    if(msg){
      const fallback=!appCanMutate()?'Read only in this tab.':mainCanRun()?'Ready for a practice run.':'Start while a work block timer is running.';
      setElementText(msg,message||fallback);setElementClass(msg,'practice-pacer-message ui-mono'+(options.warn?' warn':''));
    }
    const startBtn=document.querySelector('[data-action="practice-start"]');
    setElementDisabled(startBtn,!mainCanRun()||!!active);
    const toggle=document.getElementById('practice-toggle');
    if(toggle){setElementText(toggle,running()?'Pause':'Resume');setElementDisabled(toggle,!running()&&!canResume());}
    const nextBtn=document.querySelector('[data-action="practice-next"]');
    if(nextBtn){
      const plannedUnits=active?currentPlanContext().plannedUnits:0;
      setElementText(nextBtn,active&&plannedUnits&&active.unitMs.length+1>=plannedUnits?'Finish Run':'Next Unit');
      setElementDisabled(nextBtn,!running());
    }
    const finishBtn=document.querySelector('[data-action="practice-finish"]');setElementDisabled(finishBtn,!active);
    const corrections=document.getElementById('practice-pacer-corrections');setElementHidden(corrections,!active||resetPromptArmed);
    const undoBtn=document.getElementById('practice-undo');setElementDisabled(undoBtn,!active||!active.unitMs.length);
    const resetBtn=document.getElementById('practice-reset');
    if(resetBtn){setElementDisabled(resetBtn,!active);setElementAttribute(resetBtn,'aria-expanded',resetPromptArmed?'true':'false');}
    const resetConfirm=document.getElementById('practice-reset-confirm');setElementHidden(resetConfirm,!active||!resetPromptArmed);
    const resetConfirmBtn=document.querySelector('[data-action="practice-reset-confirm"]');setElementDisabled(resetConfirmBtn,!active);
    const decision=document.getElementById('practice-pacer-decision');
    const decisionCause=active&&[PRACTICE_PAUSE_CAUSES.BLOCK,PRACTICE_PAUSE_CAUSES.TASK,PRACTICE_PAUSE_CAUSES.SESSION].includes(active.pauseCause);
    if(decision){
      setElementHidden(decision,!decisionCause);
      if(decisionCause)decision.textContent=active.pauseCause===PRACTICE_PAUSE_CAUSES.SESSION
        ?'The session ended. Finish this run, or return to its linked block before resuming.'
        :active.pauseCause===PRACTICE_PAUSE_CAUSES.TASK
          ?'The main timer moved to another block. Return to the linked block, finish, or restart this run.'
          :'The linked block ended. Finish this run, or resume deliberately to continue it.';
    }
    const liveMsg=document.getElementById('practice-pacer-live-message');
    if(liveMsg){
      const visible=!!(active&&message&&!decisionCause);
      setElementHidden(liveMsg,!visible);setElementText(liveMsg,visible?message:'');setElementClass(liveMsg,'practice-pacer-live-message ui-mono'+(options.warn?' warn':''));
    }
    if(!active)previewSetup();
    paint(nowMs(),true);
  }
  function hydrateDefault(){
    const input=document.getElementById('practice-target');if(!input)return;
    const saved=readUserDefaults();
    if(saved&&saved.practiceTargetMs)input.value=formatPracticeMs(saved.practiceTargetMs);
    clearCueDelivery();cueMode=sanitizePracticeCueMode(saved&&saved.practiceCueMode);
    render();
  }
  function setupStatus(){return {mode:setupMode,variablePlanKind,cueMode,totalEnabled:simpleTotalEnabled};}
  return Object.freeze({start,next,undoLast,requestReset,cancelReset,confirmReset,toggle,finish,pauseFromMain,resumeFromMain,onMainTaskChanging,onBlockResolved,pauseForSessionEnd,onInactiveGapOpened,resolveInactiveGap,rebaseClock,finalizeForDayClose,snapshot,restore,reset,removeRun,completedRuns,status,remapTaskLinks,pulse,paintProgress,paint,render,hydrateDefault,previewSetup,setSetupMode,setCueMode,toggleCueMode,toggleTotal,setupStatus});
  }
  return freeze({format:'study-director.practice-pacer-module',contractVersion:1,createModel,createController});
});
})();
