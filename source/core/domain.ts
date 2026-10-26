import type {PilotRegistry} from '../../types/pilot.ts';
import type {DomainLimits,TaskInput,ScheduleRow,RowInput,TimelineRow,TimelineEntry,ScheduleParse,CompletionSource,CompletionInput,CompletionResult,TaskOutcome} from '../../types/domain.ts';
(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:PilotRegistry|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
registry.define('domain',1,limits=>{
  const requiredLimits=Object.freeze([
    'maxAreaNameChars','maxDurationMinutes','maxScheduleChars','maxScheduleRows',
    'maxTaskNameChars','maxTasksPerDay','maxUnitChars'
  ] as const);
  if(!limits||!Object.isFrozen(limits)||Object.keys(limits).sort().join('|')!==[...requiredLimits].sort().join('|')){
    throw new TypeError('Study Director domain limits are incomplete or not frozen.');
  }
  if(requiredLimits.some(key=>!Number.isInteger(limits[key])||limits[key]<=0)){
    throw new TypeError('Study Director domain limits must be positive integers.');
  }
  function clampText(value:unknown,max:number){
    const text=String(value??'');
    const limit=Math.max(0,Number(max)||0);
    return text.length>limit?text.slice(0,limit):text;
  }
  function boundedInt(value:unknown,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={}){
    const n=Number(value);
    if(!Number.isFinite(n))return fallback;
    const integer=Math.trunc(n);
    return Math.min(max,Math.max(min,integer));
  }
  function makeTaskId(task:TaskInput|null|undefined,index:number){
    const slug=String((task&&task.name)||'task').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,28)||'task';
    return `t${String(index+1).padStart(2,'0')}_${slug}`;
  }
const TimeModel=(()=>{
  const rolloverHour=4;
  const dayMinutes=1440;
  function clockToMinute(value:unknown){const[h,m]=String(value||'0:0').split(':').map(Number);return h!*60+m!;}
  function formatHHMM(value:unknown){
    let minute=Number(value)||0;
    minute=((minute%dayMinutes)+dayMinutes)%dayMinutes;
    const h=Math.floor(minute/60),m=minute%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  function clockMinuteToStudyMinute(value:unknown){
    const minute=((Number(value)%dayMinutes)+dayMinutes)%dayMinutes;
    return (minute-rolloverHour*60+dayMinutes)%dayMinutes;
  }
  function studyMinuteToClockMinute(value:unknown){
    const minute=Number(value)||0;
    return ((minute+rolloverHour*60)%dayMinutes+dayMinutes)%dayMinutes;
  }
  function studyMinuteToHHMM(value:unknown){return formatHHMM(studyMinuteToClockMinute(value));}
  function currentStudySecond(date=new Date()){
    const clockSeconds=date.getHours()*3600+date.getMinutes()*60+date.getSeconds()+date.getMilliseconds()/1000;
    const rolloverSeconds=rolloverHour*3600;
    return ((clockSeconds-rolloverSeconds)%86400+86400)%86400;
  }
  function formatSeconds(seconds:number){
    const negative=seconds<0,absolute=Math.abs(seconds);
    const h=Math.floor(absolute/3600),m=Math.floor((absolute%3600)/60),s=absolute%60;
    const base=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    const out=h>0?`${String(h).padStart(2,'0')}:${base}`:base;
    return negative?`-${out}`:out;
  }
  function formatOvertime(seconds:number){
    const absolute=Math.abs(seconds),m=Math.floor(absolute/60),s=absolute%60;
    return `+${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function formatDuration(minutes:number){
    if(minutes<60)return minutes+'m';
    const h=Math.floor(minutes/60),remainder=minutes%60;
    return remainder?h+'h '+remainder+'m':h+'h';
  }
  function isValidHHMM(value:unknown){
    const match=String(value||'').trim().match(/^(\d{1,2}):(\d{2})$/);
    if(!match)return false;
    const h=Number(match[1]),m=Number(match[2]);
    return Number.isInteger(h)&&Number.isInteger(m)&&h>=0&&h<=23&&m>=0&&m<=59;
  }
  function normalizeHHMM(value:unknown){
    if(!isValidHHMM(value))return '';
    const [h,m]=String(value).trim().split(':').map(Number);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  function isValidIsoDate(value:unknown){
    const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!match)return false;
    const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
    if(month<1||month>12||day<1||day>31)return false;
    const date=new Date(Date.UTC(year,month-1,day));
    return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
  }
  function isoDateDay(value:unknown){
    if(!isValidIsoDate(value))return null;
    const parts=String(value).split('-').map(Number);
    return Math.floor(Date.UTC(parts[0]!,parts[1]!-1,parts[2]!)/86400000);
  }
  function minuteOfDay(date=new Date()){return date.getHours()*60+date.getMinutes();}
  function positiveMinutes(value:unknown){const n=Number(value);return Number.isFinite(n)&&n>0?n:0;}
  return Object.freeze({
    rolloverHour,dayMinutes,clockToMinute,formatHHMM,clockMinuteToStudyMinute,studyMinuteToClockMinute,
    studyMinuteToHHMM,currentStudySecond,formatSeconds,formatOvertime,formatDuration,isValidHHMM,
    normalizeHHMM,isValidIsoDate,isoDateDay,minuteOfDay,positiveMinutes
  });
})();
  const STUDY_DAY_ROLLOVER_HOUR=TimeModel.rolloverHour;
  const STUDY_DAY_MINUTES=TimeModel.dayMinutes;
  const t2m=TimeModel.clockToMinute;
  const clockMinuteToStudyMinute=TimeModel.clockMinuteToStudyMinute;
  const isValidHHMM=TimeModel.isValidHHMM;
  const normalizeHHMM=TimeModel.normalizeHHMM;
  const positiveMinutes=TimeModel.positiveMinutes;
const ScheduleModel=(()=>{
  const supportAreas=new Set(['routine','gym','exercise','hobby','break','personal','admin','social','socialisation','socialization']);
  const workKindAliases=new Set(['work','study','academic','subject','clinical','project','writing','test']);
  const supportKindAliases=new Set(['support','routine','gym','exercise','hobby','break','personal','admin','social','socialisation','socialization']);
  const fixedKindAliases=new Set(['fixed','meal','rest','sleep']);
  function cleanIdentifierText(value:unknown){return String(value||'').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu,' ');}
  function token(value:unknown){return cleanIdentifierText(value).trim().toLowerCase().replace(/\s+/g,' ');}
  function normalizeKind(kind:unknown,area:unknown='',task:unknown=''){
    const key=token(kind),areaKey=token(area),taskKey=token(task);
    if(workKindAliases.has(key))return 'work';
    if(supportKindAliases.has(key))return 'support';
    if(fixedKindAliases.has(key)||fixedKindAliases.has(areaKey))return 'fixed';
    if(supportAreas.has(areaKey)||supportAreas.has(taskKey))return 'support';
    return 'work';
  }
  function isWork(task:TaskInput|null|undefined){return (task&&task.kind)==='work';}
  function isSupport(task:TaskInput|null|undefined){return (task&&task.kind)==='support';}
  function isFixed(task:TaskInput|null|undefined){return (task&&task.kind)==='fixed';}
  function isTrackable(task:TaskInput|null|undefined){return isWork(task)||isSupport(task);}
  function isPomodoroEligible(task:TaskInput|null|undefined){return isWork(task);}
  function hasNotes(task:TaskInput|null|undefined){return isTrackable(task);}
  function normalizeTarget(value:unknown){
    const raw=String(value??'').trim();
    if(raw===''||raw==='—'||raw==='-')return null;
    const n=Number(raw);
    return Number.isFinite(n)&&n>=0?Math.min(1000000,n):null;
  }
  function areaValue(task:TaskInput|null|undefined){return (task&&task.area)||'';}
  function measureValue(task:TaskInput|null|undefined,fallback='units'){return (task&&task.measure)||fallback;}
  function targetValue(task:TaskInput|null|undefined){return task?(task.target??null):null;}
  function normalizeArea(value:unknown){
    return cleanIdentifierText(value).split('>').map(part=>part.trim().replace(/\s+/g,' ')).filter(Boolean).join(' > ').toLowerCase();
  }
  function displayArea(value:unknown){
    return cleanIdentifierText(value).split('>').map(part=>part.trim().replace(/\s+/g,' ')).filter(Boolean).join(' > ')||'General Study';
  }
  function areaLabel(task:TaskInput|null|undefined){return displayArea(areaValue(task)||'General Study');}
  function areaKey(task:TaskInput|null|undefined){return normalizeArea(areaLabel(task));}
  function parentAreaKeys(key:unknown){
    const parts=String(key||'').split(' > ').map(part=>part.trim()).filter(Boolean),out=[];
    for(let i=1;i<parts.length;i++)out.push(parts.slice(0,i).join(' > '));
    return out;
  }
  function makeRow({start,dur,name,kind='work',area='',measure='',target=null}:RowInput):ScheduleRow{
    return {
      start,dur,name:clampText(cleanIdentifierText(name),limits.maxTaskNameChars),kind:normalizeKind(kind,area,name),
      area:clampText(cleanIdentifierText(area),limits.maxAreaNameChars),
      measure:clampText(cleanIdentifierText(measure),limits.maxUnitChars),target
    };
  }
  function headerLike(parts:string[]){
    const keys=(parts||[]).map(token);
    return keys[0]==='start'&&['mins','minutes','duration','dur'].includes(keys[1]!)&&['task','name'].includes(keys[2]!);
  }
  function splitCsvLine(line:string){
    const parts=[];let current='';let quoted=false;
    const text=String(line||'');
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(ch==='"'){
        if(quoted&&text[i+1]==='"'){current+='"';i++;continue;}
        quoted=!quoted;continue;
      }
      if(ch===','&&!quoted){parts.push(current.trim());current='';continue;}
      current+=ch;
    }
    if(quoted)return {parts:[],error:'unterminated quoted comma field'};
    parts.push(current.trim());
    return {parts,error:''};
  }
  function hasUnquotedPipe(line:string){
    const text=String(line||'');let quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(ch==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;continue;}
      if(ch==='|'&&!quoted)return true;
    }
    return false;
  }
  function splitColumns(line:string){
    const text=String(line||'');
    if(hasUnquotedPipe(text))return {parts:text.split('|').map(part=>part.trim()),separator:'pipe',error:''};
    const parsed=splitCsvLine(text);
    return {parts:parsed.parts,separator:'comma',error:parsed.error};
  }
  function analyzeTimeline(rows:ScheduleRow[],lineNos:number[]=[]){
    const timeline=(rows||[]).map((row,index)=>{
      const clockStart=t2m(row.start),start=clockMinuteToStudyMinute(clockStart),end=start+positiveMinutes(row.dur);
      return {index,row,lineNo:lineNos[index]||index+1,clockStart,start,end,crossesMidnight:clockStart<1440&&clockStart+positiveMinutes(row.dur)>1440};
    });
    const errors:string[]=[],warnings:string[]=[];
    let previous:TimelineEntry|null=null,latestEnd=-Infinity,latestEndRow:TimelineEntry|null=null,midnightCrossingCount=0;
    timeline.forEach(entry=>{
      if(entry.crossesMidnight)midnightCrossingCount+=1;
      if(isTrackable(entry.row)&&entry.end>STUDY_DAY_MINUTES){
        errors.push(`Line ${entry.lineNo}: ${entry.row.name} runs past the 04:00 study-day boundary. End work/support by 04:00 or mark a genuine sleep/rest anchor as fixed.`);
      }
      if(previous){
        if(entry.start<previous.start){
          const detail=entry.clockStart<STUDY_DAY_ROLLOVER_HOUR*60
            ?'Post-midnight rows must remain after all evening rows and stay in increasing order up to 03:59.'
            :'Rows must follow the 4 a.m. study day in chronological order.';
          errors.push(`Line ${entry.lineNo}: ${entry.row.start} appears before line ${previous.lineNo} (${previous.row.start}). ${detail}`);
        }else if(entry.start<latestEnd){
          const owner=latestEndRow||previous;
          errors.push(`Line ${entry.lineNo}: ${entry.row.name} overlaps line ${owner.lineNo} (${owner.row.name}) by ${Math.ceil(latestEnd-entry.start)} minute(s).`);
        }else if(entry.start>previous.end){
          warnings.push(`Unscheduled gap of ${Math.round(entry.start-previous.end)}m between line ${previous.lineNo} (${previous.row.name}) and line ${entry.lineNo} (${entry.row.name}).`);
        }
      }
      if(entry.end>latestEnd){latestEnd=entry.end;latestEndRow=entry;}
      previous=entry;
    });
    if(midnightCrossingCount>1)errors.push('More than one row crosses midnight. This is ambiguous and usually indicates overlapping overnight blocks.');
    return {timeline,errors,warnings};
  }
  function warningsMessage(warnings:unknown,limit=3){
    const rows=Array.isArray(warnings)?(warnings as unknown[]).filter(Boolean):[];
    if(!rows.length)return '';
    return '⚠ '+rows.slice(0,limit).join(' · ')+(rows.length>limit?` · +${rows.length-limit} more gap warning(s)`:'' );
  }
  function parseText(rawOriginal:unknown):ScheduleParse{
    const rawOriginalText=String(rawOriginal||''),raw=rawOriginalText.trim();
    if(!raw)return {ok:false,kind:'empty',message:'⚠ Nothing to load.',parsed:[],rawOriginal:rawOriginalText,raw};
    if(rawOriginalText.length>limits.maxScheduleChars)return {ok:false,kind:'too-large',message:'⚠ Schedule is too large. Shorten it before loading.',parsed:[],rawOriginal:rawOriginalText,raw};
    const lines=raw.split('\n').map((text,index)=>({text:text.trim(),lineNo:index+1})).filter(row=>row.text.length>0&&!row.text.startsWith('//')&&!row.text.startsWith('#'));
    if(lines.length>limits.maxScheduleRows)return {ok:false,kind:'too-many-rows',message:'⚠ Too many schedule rows. Maximum allowed is '+limits.maxScheduleRows+'.',parsed:[],rawOriginal:rawOriginalText,raw};
    const parsed:ScheduleRow[]=[],parsedLineNos:number[]=[],errors:string[]=[];
    lines.forEach(row=>{
      const split=splitColumns(row.text),lineNo=row.lineNo;
      if(split.error){errors.push(`Line ${lineNo}: ${split.error}. Close the quote or remove the quote mark.`);return;}
      const parts=split.parts;
      if(headerLike(parts))return;
      if(parts.length!==7){
        const tip=split.separator==='comma'?'For comma-separated rows, wrap any field containing a comma in double quotes.':'Avoid extra | inside fields.';
        errors.push(`Line ${lineNo}: expected 7 columns but found ${parts.length}. Use START | MINS | TASK | KIND | AREA | MEASURE | TARGET. ${tip}`);return;
      }
      const start=normalizeHHMM(parts[0]),duration=Number(parts[1]),name=clampText(parts[2],limits.maxTaskNameChars);
      if(!isValidHHMM(parts[0])){errors.push(`Line ${lineNo}: bad time "${parts[0]}"`);return;}
      if(!Number.isFinite(duration)||!Number.isInteger(duration)||duration<=0||duration>limits.maxDurationMinutes){errors.push(`Line ${lineNo}: bad duration "${parts[1]}"`);return;}
      if(!name){errors.push(`Line ${lineNo}: missing task name`);return;}
      const kindToken=token(parts[3]);
      if(!workKindAliases.has(kindToken)&&!supportKindAliases.has(kindToken)&&!fixedKindAliases.has(kindToken)){
        errors.push(`Line ${lineNo}: bad kind "${parts[3]}". Use work/study/writing/test, support/gym/exercise/hobby/socialisation, or fixed/meal/rest/sleep.`);return;
      }
      if(!String(parts[4]||'').trim()){errors.push(`Line ${lineNo}: missing area. Use a subject, domain, Personal, Meal, Rest, or Sleep.`);return;}
      parsed.push(makeRow({start,dur:duration,name,kind:parts[3],area:parts[4]||'',measure:parts[5]||'',target:normalizeTarget(parts[6])}));
      parsedLineNos.push(lineNo);
    });
    if(errors.length)return {ok:false,kind:'errors',message:'⚠ Errors: '+errors.slice(0,8).join(' · ')+(errors.length>8?' · …':''),errors,parsed:[],rawOriginal:rawOriginalText,raw};
    if(!parsed.length)return {ok:false,kind:'no-tasks',message:'⚠ No valid tasks found.',parsed:[],rawOriginal:rawOriginalText,raw};
    const timelineCheck=analyzeTimeline(parsed,parsedLineNos);
    if(timelineCheck.errors.length)return {ok:false,kind:'timeline',message:'⚠ Timeline errors: '+timelineCheck.errors.slice(0,8).join(' · ')+(timelineCheck.errors.length>8?' · …':''),errors:timelineCheck.errors,warnings:timelineCheck.warnings,parsed:[],rawOriginal:rawOriginalText,raw};
    return {ok:true,kind:'ok',parsed,warnings:timelineCheck.warnings,timeline:timelineCheck.timeline,rawOriginal:rawOriginalText,raw};
  }
  function buildTasks<T extends TaskInput>(rows:readonly T[]){
    const seen=new Set();
    return (rows||[]).map((task,index)=>{
      let id=String(task&&task.id||'').trim();
      if(!id||seen.has(id))id=makeTaskId(task,index);
      while(seen.has(id))id+=`_${index+1}`;
      seen.add(id);
      return {...task,id};
    });
  }
  function textFromRows(rows:ScheduleRow[]){
    return (rows||[]).map(task=>{
      const row=makeRow({start:task.start,dur:task.dur,name:task.name,kind:task.kind||'work',area:areaValue(task),measure:measureValue(task,''),target:targetValue(task)});
      return [row.start,row.dur,row.name,row.kind,row.area,row.measure,row.target??''].join(' | ');
    }).join('\n');
  }
  function fingerprint(rows:ScheduleRow[]){
    return (rows||[]).map(task=>[task.start,task.dur,task.name,task.kind||'',areaValue(task),measureValue(task,''),targetValue(task)??''].join('~')).join('|');
  }
  function rowMinute(row:TimelineRow,primary:keyof TimelineRow,alternate:keyof TimelineRow,fallback=0){
    const value=row&&row[primary]!==undefined?row[primary]:(row&&row[alternate]),n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }
  function chronologicalRows<T extends TimelineRow>(rows:readonly T[]){
    return [...(rows||[])].sort((a,b)=>{
      const aStart=rowMinute(a,'start','startMin'),bStart=rowMinute(b,'start','startMin');
      const aEnd=rowMinute(a,'end','endMin',aStart),bEnd=rowMinute(b,'end','endMin',bStart);
      return (aStart-bStart)||(aEnd-bEnd)||(Number(a?.idx??0)-Number(b?.idx??0));
    });
  }
  function startMinutes(rows:ScheduleRow[]){return (rows||[]).map(row=>clockMinuteToStudyMinute(t2m(row.start)));}
  return Object.freeze({
    token,normalizeKind,isWork,isSupport,isFixed,isTrackable,isPomodoroEligible,hasNotes,
    normalizeTarget,makeRow,parseText,isCanonicalText:(text:unknown)=>parseText(text).ok,analyzeTimeline,warningsMessage,
    buildTasks,textFromRows,fingerprint,chronologicalRows,startMinutes,normalizeArea,displayArea,areaValue,
    measureValue,targetValue,areaLabel,areaKey,parentAreaKeys,cleanIdentifierText
  });
})();
  const isWorkBlock=ScheduleModel.isWork;
const COMPLETION_SOURCES=Object.freeze({
  UNITS:'units',MANUAL:'manual',TIME:'time',FINISHED_TIME:'finished-time',
  FINISHED_UNVERIFIED:'finished-unverified',SKIPPED:'skipped',NONE:'none'
});
const CompletionModel=(()=>{
  function normalizeSource(value:unknown):CompletionSource{
    const clean=String(value||'').trim().toLowerCase();
    return Object.values(COMPLETION_SOURCES).includes(clean as CompletionSource)?clean as CompletionSource:COMPLETION_SOURCES.NONE;
  }
  function clampPercent(value:unknown){return Math.max(0,Math.min(100,Number(value)||0));}
  function fromUnits(done:unknown,total:unknown){
    const doneValue=Number(done),totalValue=Number(total);
    return Number.isFinite(doneValue)&&Number.isFinite(totalValue)&&totalValue>0?clampPercent(doneValue/totalValue*100):null;
  }
  function parseProgressNumber(value:unknown){
    const text=String(value??'').trim();
    if(!text)return null;
    const n=Number(text);
    return Number.isFinite(n)?n:null;
  }
  function progressInput(doneValue:unknown,totalValue:unknown,defaultTotal:unknown=null){
    const doneRaw=parseProgressNumber(doneValue),totalText=String(totalValue??'').trim();
    const totalRaw=totalText?parseProgressNumber(totalValue):null,fallbackTotal=parseProgressNumber(defaultTotal);
    const done=doneRaw===null?null:Math.max(0,doneRaw);
    const total=totalText?(totalRaw!==null&&totalRaw>0?totalRaw:null):(fallbackTotal!==null&&fallbackTotal>0?fallbackTotal:null);
    return {done,total,pct:done!==null&&total!==null?fromUnits(done,total):null,hasDone:done!==null,hasTotal:total!==null};
  }
  function fromFocus(actualSeconds:unknown,plannedSeconds:unknown,{cap=100}={}){
    const actual=Number(actualSeconds),planned=Number(plannedSeconds);
    if(!Number.isFinite(actual)||actual<=0||planned<=0)return null;
    return Math.max(0,Math.min(cap,actual/planned*100));
  }
  function storedSource(source:unknown){
    const clean=normalizeSource(source);
    return clean===COMPLETION_SOURCES.NONE?COMPLETION_SOURCES.MANUAL:clean;
  }
  function needsFocus({skipped=false,source=COMPLETION_SOURCES.NONE,storedPct=null,unitPct=null,preferStoredAuto=false}:CompletionInput={}){
    if(skipped)return false;
    const cleanSource=normalizeSource(source),stored=storedPct===null||storedPct===undefined?null:clampPercent(storedPct);
    if(cleanSource===COMPLETION_SOURCES.MANUAL&&stored!==null)return false;
    if(unitPct!==null&&unitPct!==undefined)return false;
    const automatic=cleanSource===COMPLETION_SOURCES.TIME||cleanSource===COMPLETION_SOURCES.FINISHED_TIME||cleanSource===COMPLETION_SOURCES.FINISHED_UNVERIFIED;
    if(stored!==null&&!automatic)return false;
    return !(preferStoredAuto&&stored!==null);
  }
  function resolve({skipped=false,source=COMPLETION_SOURCES.NONE,storedPct=null,unitPct=null,focusPct=null,doneFlag=false,preferStoredAuto=false}:CompletionInput={}){
    if(skipped)return {pct:0,source:COMPLETION_SOURCES.SKIPPED};
    const cleanSource=normalizeSource(source);
    const stored=storedPct===null||storedPct===undefined?null:clampPercent(storedPct);
    if(cleanSource===COMPLETION_SOURCES.MANUAL&&stored!==null)return {pct:stored,source:cleanSource};
    if(unitPct!==null&&unitPct!==undefined)return {pct:clampPercent(unitPct),source:COMPLETION_SOURCES.UNITS};
    const automatic=cleanSource===COMPLETION_SOURCES.TIME||cleanSource===COMPLETION_SOURCES.FINISHED_TIME||cleanSource===COMPLETION_SOURCES.FINISHED_UNVERIFIED;
    if(stored!==null&&!automatic)return {pct:stored,source:storedSource(cleanSource)};
    if(preferStoredAuto&&stored!==null)return {pct:stored,source:storedSource(cleanSource)};
    if(focusPct!==null&&focusPct!==undefined)return {pct:clampPercent(focusPct),source:doneFlag?COMPLETION_SOURCES.FINISHED_TIME:COMPLETION_SOURCES.TIME};
    if(stored!==null)return {pct:stored,source:storedSource(cleanSource)};
    if(doneFlag)return {pct:0,source:COMPLETION_SOURCES.FINISHED_UNVERIFIED};
    return {pct:0,source:COMPLETION_SOURCES.NONE};
  }
  return Object.freeze({normalizeSource,clampPercent,fromUnits,parseProgressNumber,progressInput,fromFocus,storedSource,needsFocus,resolve});
})();
  const normalizeCompletionSource=CompletionModel.normalizeSource;
const TASK_OUTCOMES=Object.freeze({
  FULL:'full',PARTIAL:'partial',SKIPPED:'skipped',UNTOUCHED:'untouched',
  FINISHED_UNVERIFIED:'finished-unverified',ZERO_OUTPUT:'zero-output'
});
const OutcomeModel=(()=>{
  function classify(task:TaskInput={}){
    const source=normalizeCompletionSource(task.completionSource),pct=CompletionModel.clampPercent(task.completion);
    if(task.skipped||source===COMPLETION_SOURCES.SKIPPED)return TASK_OUTCOMES.SKIPPED;
    if(pct>=100)return TASK_OUTCOMES.FULL;
    if(pct>0)return TASK_OUTCOMES.PARTIAL;
    if(source===COMPLETION_SOURCES.UNITS||source===COMPLETION_SOURCES.MANUAL||Number(task.actualSeconds)>0)return TASK_OUTCOMES.ZERO_OUTPUT;
    if(task.doneFlag||source===COMPLETION_SOURCES.FINISHED_UNVERIFIED)return TASK_OUTCOMES.FINISHED_UNVERIFIED;
    return TASK_OUTCOMES.UNTOUCHED;
  }
  function emptyCounts():Record<TaskOutcome,number>{return Object.fromEntries(Object.values(TASK_OUTCOMES).map(outcome=>[outcome,0])) as Record<TaskOutcome,number>;}
  function count(tasks:TaskInput[]){
    const counts=emptyCounts();
    (tasks||[]).filter(isWorkBlock).forEach(task=>{counts[classify(task)]+=1;});
    return counts;
  }
  function sanitizeCounts(counts:unknown){
    const clean=emptyCounts(),source:Record<string,unknown>=counts&&typeof counts==='object'?counts as Record<string,unknown>:{};
    (Object.keys(clean) as TaskOutcome[]).forEach(key=>{clean[key]=boundedInt(source[key],{min:0,max:limits.maxTasksPerDay,fallback:0});});
    return clean;
  }
  function total(counts:unknown){return Object.values(sanitizeCounts(counts)).reduce((sum,value)=>sum+value,0);}
  function info(outcome:unknown){
    if(outcome===TASK_OUTCOMES.FULL)return {status:'full',label:'Full'};
    if(outcome===TASK_OUTCOMES.PARTIAL)return {status:'partial',label:'Partial'};
    if(outcome===TASK_OUTCOMES.SKIPPED)return {status:'skipped',label:'Explicitly Skipped'};
    if(outcome===TASK_OUTCOMES.FINISHED_UNVERIFIED)return {status:'finished-unverified',label:'Finished · No Evidence'};
    if(outcome===TASK_OUTCOMES.ZERO_OUTPUT)return {status:'zero-output',label:'Attempted · 0%'};
    return {status:'untouched',label:'Untouched'};
  }
  function summary(counts:unknown,{includeZero=true}={}){
    const clean=sanitizeCounts(counts);
    const parts=[`${clean[TASK_OUTCOMES.FULL]} full`,`${clean[TASK_OUTCOMES.PARTIAL]} partial`,`${clean[TASK_OUTCOMES.SKIPPED]} skipped`,`${clean[TASK_OUTCOMES.UNTOUCHED]} untouched`,`${clean[TASK_OUTCOMES.FINISHED_UNVERIFIED]} finished/no evidence`];
    if(includeZero||clean[TASK_OUTCOMES.ZERO_OUTPUT])parts.push(`${clean[TASK_OUTCOMES.ZERO_OUTPUT]} attempted/0%`);
    return parts.join(' · ');
  }
  return Object.freeze({classify,emptyCounts,count,sanitizeCounts,total,info,summary});
})();
  return Object.freeze({
    format:'study-director.domain',
    contractVersion:1,
    TimeModel,
    ScheduleModel,
    CompletionModel,
    OutcomeModel,
    COMPLETION_SOURCES,
    TASK_OUTCOMES,
    makeTaskId
  });
});
})();
