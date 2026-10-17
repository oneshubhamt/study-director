(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('compatibility-codecs',1,()=>{
  const freeze=Object.freeze;
  function create(input){
    exactObject(input,['limits','dataContract','keyedRecord','dailyRecordCodec','activeSessionCodec','personalDataCodec','helpers','timestamps','domain'],'Compatibility codec input');
    if(!Object.isFrozen(input.limits)||!Object.isFrozen(input.dataContract)||!Object.isFrozen(input.keyedRecord)||!Object.isFrozen(input.dailyRecordCodec)||!Object.isFrozen(input.activeSessionCodec)||!Object.isFrozen(input.personalDataCodec)||!Object.isFrozen(input.domain))throw new TypeError('Compatibility codec contracts must be frozen.');
    functions(input.helpers,['boundedInt','boundedNumber','optionalBoundedNumber','optionalText','clampText','clampEditorContent','editorContentWithinLimits','sameDataValue','sanitizePracticeRun','activeSessionScheduleFingerprint','isValidIsoDate','isCanonicalScheduleText'],'Compatibility codec helpers');
    functions(input.timestamps,['normalizeTimestamp','normalizeImportedTimestamp'],'Compatibility timestamp contract');
    const APP_LIMITS=input.limits,DATA_CONTRACT=input.dataContract,KeyedRecord=input.keyedRecord;
    const DailyRecordCodec=input.dailyRecordCodec,ActiveSessionCodec=input.activeSessionCodec,PersonalDataCodec=input.personalDataCodec;
    const {boundedInt,boundedNumber,optionalBoundedNumber,optionalText,clampText,clampEditorContent,editorContentWithinLimits,sameDataValue,sanitizePracticeRun,activeSessionScheduleFingerprint,isValidIsoDate,isCanonicalScheduleText}=input.helpers;
    const {normalizeTimestamp,normalizeImportedTimestamp}=input.timestamps;
    const {TimeModel,ScheduleModel}=input.domain;
    const isValidHHMM=TimeModel.isValidHHMM,normalizeHHMM=TimeModel.normalizeHHMM;
    const normalizeAreaName=ScheduleModel.normalizeArea,displayAreaName=ScheduleModel.displayArea;
    function optionalEditorContent(value,plainMax){
      if(typeof value!=='string'||!editorContentWithinLimits(value))return null;
      const clean=clampEditorContent(value,plainMax);return clean===value?clean:null;
    }
    function losslessFields(source,normalized,keys){
      const clean={};let degraded=false;
      keys.forEach(key=>{
        if(!Object.prototype.hasOwnProperty.call(source,key))return;
        if(normalized&&Object.prototype.hasOwnProperty.call(normalized,key)&&sameDataValue(source[key],normalized[key]))clean[key]=normalized[key];
        else degraded=true;
      });
      return {clean,degraded};
    }
    function sanitizeHistoricalScheduleEntry(row){
      if(!row||typeof row!=='object'||Array.isArray(row))return null;
      const entry={
        id:optionalText(row.id,80),
        start:typeof row.start==='string'&&isValidHHMM(row.start)&&normalizeHHMM(row.start)===row.start?row.start:null,
        duration:optionalBoundedNumber(row.duration,{min:0,max:APP_LIMITS.maxDurationMinutes,integer:true}),
        name:optionalText(row.name,APP_LIMITS.maxTaskNameChars),
        kind:['work','support','fixed'].includes(row.kind)?row.kind:null
      };
      if(!entry.id||entry.id.startsWith('@index:')||entry.start===null||entry.duration===null||entry.name===null||!entry.kind)return null;
      let degraded=false;
      [['area',APP_LIMITS.maxAreaNameChars],['measure',APP_LIMITS.maxUnitChars]].forEach(([key,max])=>{const value=optionalText(row[key],max);if(value===null)degraded=true;else entry[key]=value;});
      if(row.target===null)entry.target=null;
      else{const target=optionalBoundedNumber(row.target,{min:0,max:1000000});if(target===null)degraded=true;else entry.target=target;}
      return {entry,degraded};
    }
    function sanitizeHistoricalResult(value,scheduleEntry){
      if(!value||typeof value!=='object'||Array.isArray(value))return {result:null,degraded:!!value};
      const normalized=DailyRecordCodec.normalizeDailyResultEntry(value,scheduleEntry);
      const fields=['adjustedStart','completion','completionSource','done','total','actualSeconds','actualStart','actualEnd','actualStartLocalMinute','actualStartUtcOffsetMinutes','actualStartTimeZone','pauseEvents','sessionCount','skipped','doneFlag'];
      const result=losslessFields(value,normalized,fields);
      return {result:Object.keys(result.clean).length?result.clean:null,degraded:result.degraded};
    }
    function sanitizeHistoricalMetrics(value){
      if(!value||typeof value!=='object'||Array.isArray(value))return {metrics:null,degraded:true};
      const max=APP_LIMITS.maxDurationMinutes*APP_LIMITS.maxTasksPerDay,metrics={};let degraded=false;
      const limits={originalPlannedStudyMinutes:[0,max],completedEquivalentMinutes:[0,max],actualFocusMinutes:[0,max],completionPercent:[0,100],averageBlockCompletion:[0,100],actualVsPlannedMinutes:[-max,max],actualVsCompletedMinutes:[-max,max],shiftedStudyBlocks:[0,APP_LIMITS.maxTasksPerDay],totalScheduleShiftMinutes:[0,max],netScheduleShiftMinutes:[-max,max]};
      Object.entries(limits).forEach(([key,[min,maxValue]])=>{if(value[key]===undefined){degraded=true;return;}const clean=optionalBoundedNumber(value[key],{min,max:maxValue,integer:key==='shiftedStudyBlocks'});if(clean===null)degraded=true;else metrics[key]=clean;});
      return {metrics:Object.keys(metrics).length?metrics:null,degraded};
    }
    function sanitizeHistoricalPracticeRuns(value,allowedTaskIds){
      if(value===undefined)return {runs:null,degraded:false};
      if(!Array.isArray(value))return {runs:null,degraded:true};
      const runs=[];let degraded=value.length>APP_LIMITS.maxPracticeRunsPerDay,unitsLeft=APP_LIMITS.maxPracticeUnitsPerDay;
      value.slice(0,APP_LIMITS.maxPracticeRunsPerDay).forEach(raw=>{
        const target=optionalBoundedNumber(raw&&raw.targetMs,{min:APP_LIMITS.minPracticeTargetMs,max:APP_LIMITS.maxPracticeTargetMs,integer:true});
        const units=Array.isArray(raw&&raw.unitMs)?raw.unitMs:null;
        if(target===null||!units||!units.length||units.length>Math.min(APP_LIMITS.maxPracticeUnitsPerRun,unitsLeft)||units.some(ms=>optionalBoundedNumber(ms,{min:1,max:APP_LIMITS.maxPracticeTargetMs,integer:true})===null)){degraded=true;return;}
        const normalized=sanitizePracticeRun(raw,{unitLimit:units.length,allowedTaskIds});
        const result=losslessFields(raw,normalized,['targetMs','unitMs','partial','taskId','sessionTargetMs','totalUnits','unitPlan']);
        if(!result.clean.targetMs||!result.clean.unitMs){degraded=true;return;}
        runs.push(result.clean);unitsLeft-=units.length;degraded=degraded||result.degraded;
      });
      return {runs,degraded};
    }
    function sanitizeHistoricalDailyRecord(record){
      if(!record||typeof record!=='object'||Array.isArray(record)||!DailyRecordCodec.isSupportedSavedDate(record.date))return null;
      const sourceVersion=optionalBoundedNumber(record.version,{min:1,max:Number.MAX_SAFE_INTEGER,integer:true});
      if(sourceVersion!==null&&sourceVersion>DATA_CONTRACT.schemas.DailyRecord.version)return null;
      const date=String(record.date),schedule=[],results=KeyedRecord.create(),seenIds=new Set();let degraded=record.degraded===true||sourceVersion!==DATA_CONTRACT.schemas.DailyRecord.version;
      if(Array.isArray(record.schedule)){
        record.schedule.slice(0,APP_LIMITS.maxTasksPerDay).forEach(row=>{const clean=sanitizeHistoricalScheduleEntry(row);if(!clean||seenIds.has(clean.entry.id)){degraded=true;return;}schedule.push(clean.entry);seenIds.add(clean.entry.id);degraded=degraded||clean.degraded;});
        if(record.schedule.length>APP_LIMITS.maxTasksPerDay)degraded=true;
      }else degraded=true;
      if(record.results&&typeof record.results==='object'&&!Array.isArray(record.results)){
        Object.entries(record.results).forEach(([taskId,value])=>{if(!seenIds.has(taskId)){degraded=true;return;}const clean=sanitizeHistoricalResult(value,schedule.find(entry=>entry.id===taskId));if(clean.result)results[taskId]=clean.result;degraded=degraded||clean.degraded;});
      }else degraded=true;
      const metrics=sanitizeHistoricalMetrics(record.metrics);degraded=degraded||metrics.degraded;
      const dayOfWeek=optionalBoundedNumber(record.dayOfWeek,{min:0,max:6,integer:true}),dayName=optionalText(record.dayName,20),savedAt=normalizeImportedTimestamp(record.savedAt,new Date().toISOString()),sourceRevision=optionalBoundedNumber(record.sourceRevision,{min:0,max:Number.MAX_SAFE_INTEGER,integer:true});
      if(dayOfWeek===null||dayName===null||savedAt===null||sourceRevision===null)degraded=true;
      const clean={version:sourceVersion,date,dayOfWeek,dayName,savedAt,sourceRevision,metrics:metrics.metrics,schedule:Array.isArray(record.schedule)?schedule:null,results:record.results&&typeof record.results==='object'&&!Array.isArray(record.results)?results:null};
      [['quote',APP_LIMITS.maxQuoteChars],['carryForwardDraft',APP_LIMITS.maxCarryForwardChars]].forEach(([key,max])=>{const value=optionalText(record[key],max);clean[key]=value;if(value===null)degraded=true;});
      clean.reflection=optionalEditorContent(record.reflection,APP_LIMITS.maxReflectionChars);if(clean.reflection===null)degraded=true;
      clean.studyQuality=record.studyQuality===null?null:optionalBoundedNumber(record.studyQuality,{min:1,max:5,integer:true});if(record.studyQuality!==null&&clean.studyQuality===null)degraded=true;
      if(record.realTimeSnapshot===null||record.realTimeSnapshot===undefined)clean.realTimeSnapshot=null;
      else{const snapshot=DailyRecordCodec.compactRealTimeSnapshot(record.realTimeSnapshot);clean.realTimeSnapshot=snapshot&&sameDataValue(snapshot,record.realTimeSnapshot)?snapshot:null;if(!clean.realTimeSnapshot)degraded=true;}
      const practice=sanitizeHistoricalPracticeRuns(record.practiceRuns,seenIds);if(practice.runs)clean.practiceRuns=practice.runs;degraded=degraded||practice.degraded;
      if(record.deleted===true)return null;
      clean.updatedAt=normalizeImportedTimestamp(record.updatedAt,savedAt);if(!clean.updatedAt)degraded=true;if(degraded)clean.degraded=true;
      return clean;
    }
    function dailyRecord(record){
      const historical=sanitizeHistoricalDailyRecord(record);if(!historical)return null;
      const schedule=(historical.schedule||[]).map(row=>({id:row.id,start:row.start,duration:row.duration,name:row.name,kind:row.kind,area:row.area??'',measure:row.measure??'',target:row.target??null}));
      if(!Array.isArray(historical.schedule))return null;
      const results=KeyedRecord.create();
      for(const [id,value] of Object.entries(historical.results||{})){const clean=DailyRecordCodec.normalizeDailyResultEntry(value,schedule.find(row=>row.id===id));if(clean)results[id]=clean;}
      const runs=[];for(const raw of Array.isArray(historical.practiceRuns)?historical.practiceRuns:[]){const clean=sanitizePracticeRun(raw,{unitLimit:APP_LIMITS.maxPracticeUnitsPerRun,allowedTaskIds:new Set(schedule.map(row=>row.id))});if(clean)runs.push(clean);}
      const updatedAt=normalizeImportedTimestamp(historical.updatedAt,historical.savedAt||new Date().toISOString());if(!updatedAt)return null;
      const candidate={version:DATA_CONTRACT.schemas.DailyRecord.version,recordKind:'study',date:String(historical.date),savedAt:normalizeImportedTimestamp(historical.savedAt,updatedAt),updatedAt,sourceRevision:boundedInt(historical.sourceRevision,{min:0,max:Number.MAX_SAFE_INTEGER,fallback:0}),quote:String(historical.quote??''),reflection:String(historical.reflection??''),studyQuality:historical.studyQuality===null?null:boundedInt(historical.studyQuality,{min:1,max:5,fallback:null}),realTimeSnapshot:historical.realTimeSnapshot?DailyRecordCodec.compactRealTimeSnapshot(historical.realTimeSnapshot):null,schedule,results,practiceRuns:runs,carryForwardDraft:String(historical.carryForwardDraft??'')};
      return DailyRecordCodec.sanitizeCurrentDailyRecord(candidate);
    }
    // Notes saved before permanent ids were keyed by their name. Each such key
    // becomes an id worked out from the name (FNV-1a, 64 bits, over its UTF-8
    // bytes), so every older copy of a note, on this device or in a backup,
    // turns into the same id. A deleted note's old key gets the same treatment
    // behind the trash prefix.
    const NoteKeys=DailyRecordCodec.noteKeys,TRASH_PREFIX=String(DATA_CONTRACT.schemas.Note.trashKeyPrefix||''),utf8=new TextEncoder();
    function derivedNoteId(name){
      let hash=0xcbf29ce484222325n;
      for(const byte of utf8.encode(name)){hash^=BigInt(byte);hash=(hash*0x100000001b3n)&0xffffffffffffffffn;}
      return 'n_'+hash.toString(16).padStart(16,'0');
    }
    function noteKey(value){
      const raw=String(value||'');if(NoteKeys.isKey(raw))return raw;
      if(raw.startsWith(TRASH_PREFIX)){const old=raw.slice(TRASH_PREFIX.length).trim();return old?TRASH_PREFIX+derivedNoteId(TRASH_PREFIX+old):'';}
      const name=normalizeAreaName(raw);return name?derivedNoteId(name):'';
    }
    function note(value,keyHint=''){
      const source=value&&typeof value==='object'&&!Array.isArray(value)?value:null;if(!source||source.deleted===true)return null;
      const current=DailyRecordCodec.sanitizeCurrentNote(source,keyHint);if(current)return current;
      const oldKey=String(source.key||keyHint||''),name=normalizeAreaName(oldKey.startsWith(TRASH_PREFIX)?'':oldKey),key=noteKey(oldKey),text=optionalEditorContent(source.text,APP_LIMITS.maxNoteChars);if(!key||text===null)return null;
      const label=optionalText(source.label,APP_LIMITS.maxAreaNameChars),updatedAt=normalizeImportedTimestamp(source.updatedAt,new Date().toISOString());if(!updatedAt)return null;
      const title=label!==null&&normalizeAreaName(label)?label:name?clampText(displayAreaName(name),APP_LIMITS.maxAreaNameChars):null;if(!title)return null;
      const candidate={version:DATA_CONTRACT.schemas.Note.version,key,label:title,text,updatedAt};
      return DailyRecordCodec.sanitizeCurrentNote(candidate,key);
    }
    function migrateSessionSnapshot(snapshot){
      if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))return snapshot;
      const legacy=snapshot.reflectionDraft&&typeof snapshot.reflectionDraft==='object'?snapshot.reflectionDraft:null;
      const existing=snapshot.review&&typeof snapshot.review==='object'?snapshot.review:null;
      const review={
        reflection:String(existing?.reflection??legacy?.reflection??''),
        studyQuality:existing?.studyQuality??legacy?.studyQuality??null
      };
      const migrated={...snapshot,version:DATA_CONTRACT.schemas.SessionSnapshot.version,review};
      delete migrated.reflectionDraft;
      return migrated;
    }
    function activeSession(session){
      if(!session||typeof session!=='object'||session.deleted===true)return null;
      const version=Number(session.version);if(!Number.isSafeInteger(version)||version<1||version>DATA_CONTRACT.schemas.ActiveSession.version)return null;
      const candidate=ActiveSessionCodec.normalize({id:DATA_CONTRACT.schemas.ActiveSession.key,type:'activeSession',version:DATA_CONTRACT.schemas.ActiveSession.version,revision:session.revision,date:session.date,status:session.status,scheduleText:session.scheduleText,snapshot:migrateSessionSnapshot(session.snapshot),suspendedAt:session.suspendedAt??null,updatedAt:session.updatedAt});
      return candidate?ActiveSessionCodec.sanitizeCurrent(candidate):null;
    }
    function localRecoveryEnvelope(raw){
      if(!raw||typeof raw!=='object'||Number(raw.version)!==DATA_CONTRACT.schemas.LocalRecoveryEnvelope.version)return null;
      const shell=raw.shell&&typeof raw.shell==='object'?raw.shell:null;
      if(!shell||shell.id!==DATA_CONTRACT.schemas.ActiveSession.key||!isValidIsoDate(shell.date)||!isCanonicalScheduleText(shell.scheduleText))return null;
      const revision=boundedNumber(raw.revision||shell.revision,{min:1,max:Number.MAX_SAFE_INTEGER,fallback:0});if(!revision)return null;
      const snapshot=ActiveSessionCodec.sanitizeSessionSnapshot(migrateSessionSnapshot(raw.snapshot),shell.date,activeSessionScheduleFingerprint(shell),revision);if(!snapshot)return null;
      const updatedAt=normalizeTimestamp(raw.updatedAt||shell.updatedAt,new Date().toISOString());
      const cleanShell={id:DATA_CONTRACT.schemas.ActiveSession.key,type:'activeSession',version:DATA_CONTRACT.schemas.ActiveSession.version,revision,date:shell.date,status:shell.status==='suspended'?'suspended':'active',scheduleText:shell.scheduleText,suspendedAt:shell.suspendedAt||null,updatedAt};
      return {version:DATA_CONTRACT.schemas.LocalRecoveryEnvelope.version,revision,shell:cleanShell,snapshot,updatedAt};
    }
    function protectedPreferences(value){
      if(!value||typeof value!=='object'||Array.isArray(value)||Number(value.version)!==1)return null;
      try{
        const studentName=value.studentName==null?null:optionalText(value.studentName,APP_LIMITS.maxStudentNameChars||100);
        const quote=value.quote==null?null:optionalText(value.quote,APP_LIMITS.maxQuoteChars||1000);
        const practiceTargetMs=value.practiceTargetMs==null?null:Number(value.practiceTargetMs);
        const practiceCueMode=value.practiceCueMode==null?null:optionalText(value.practiceCueMode,41);
        const updatedAt=value.updatedAt==null?null:optionalText(value.updatedAt,40);
        if(value.studentName!=null&&studentName===null)return null;if(value.quote!=null&&quote===null)return null;
        if(practiceTargetMs!==null&&(!Number.isFinite(practiceTargetMs)||practiceTargetMs<(APP_LIMITS.minPracticeTargetMs||1000)||practiceTargetMs>(APP_LIMITS.maxPracticeTargetMs||86400000)))return null;
        if(practiceCueMode!==null&&!['quiet','strict'].includes(practiceCueMode))return null;
        if(updatedAt!==null&&!Number.isFinite(Date.parse(updatedAt)))return null;
        const clean={version:1,studentName,quote,practiceTargetMs,practiceCueMode,updatedAt};
        return sameDataValue(clean,value)?clean:null;
      }catch{return null;}
    }
    function personalData(value){
      if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Unsupported legacy personal-data value.');
      if(Number(value.version)===2)return PersonalDataCodec.normalize(value);
      if(Number(value.version)!==1)throw new Error('Unsupported legacy personal-data version.');
      return {version:2,plans:PersonalDataCodec.plans(value.plans),preferences:PersonalDataCodec.preferences(value.preferences)};
    }
    return freeze({format:'study-director.compatibility-codecs',contractVersion:1,dailyRecord,note,noteKey,activeSession,localRecoveryEnvelope,protectedPreferences,personalData});
  }
  return freeze({format:'study-director.compatibility-codecs-module',contractVersion:1,create});
});
})();
