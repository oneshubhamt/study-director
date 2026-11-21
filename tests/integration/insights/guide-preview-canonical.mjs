import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readScript} from '../../../build/source-script.mts';
import {PRODUCTION_LIMITS} from '../../../contracts/production-limits.mjs';
import {RUNTIME_DATA_CONTRACT} from '../../../contracts/canonical-identities.mjs';

const codecContext=vm.createContext({console});
for(const file of ['source/core/internal.ts','source/core/domain.ts','source/core/foundation-host.ts','source/core/practice-pacer.ts','source/core/record-codecs.ts']){
  vm.runInContext(readScript(file),codecContext,{filename:file});
}
const registry=vm.runInContext("globalThis[Symbol.for('studyDirector.internalModules.v1')]",codecContext);
const limits=PRODUCTION_LIMITS,freeze=Object.freeze;
const Domain=registry.require('domain',1,freeze({
  maxAreaNameChars:limits.maxAreaNameChars,maxDurationMinutes:limits.maxDurationMinutes,maxScheduleChars:limits.maxScheduleChars,
  maxScheduleRows:limits.maxScheduleRows,maxTaskNameChars:limits.maxTaskNameChars,maxTasksPerDay:limits.maxTasksPerDay,maxUnitChars:limits.maxUnitChars
}));
const Foundation=registry.require('foundation-host',1);
const primitives=Foundation.createPrimitives({document:{createElement(){throw new Error('DOM creation is not used by this codec witness.');}},APP_LIMITS:limits,CompletionModel:Domain.CompletionModel});
const PracticePacer=registry.require('practice-pacer',1);
const practice=PracticePacer.createModel(freeze({ports:freeze({
  configuration:freeze({APP_LIMITS:limits}),
  domain:freeze({boundedInt:primitives.boundedInt,boundedNumber:primitives.boundedNumber,clampArray:primitives.clampArray,clampText:primitives.clampText,fmtS:value=>String(value??'')})
})}));
const normalizeTimestamp=(value,fallback=null)=>{const parsed=Date.parse(String(value||''));return Number.isFinite(parsed)?new Date(parsed).toISOString():fallback;};
const normalizeStudyQuality=value=>value===null?null:(Number.isInteger(Number(value))&&Number(value)>=1&&Number(value)<=5?Number(value):null);
const dailyRecordCodec=registry.require('record-codecs',1).createDailyRecordCodec(freeze({
  limits,dataContract:RUNTIME_DATA_CONTRACT,domain:Domain,keyedRecord:primitives.KeyedRecord,
  helpers:freeze({
    boundedInt:primitives.boundedInt,boundedNumber:primitives.boundedNumber,clampText:primitives.clampText,clampEditorContent:primitives.clampText,
    editorContentWithinLimits:()=>true,optionalBoundedNumber:primitives.optionalBoundedNumber,optionalText:primitives.optionalText,safeBoolean:primitives.safeBoolean,
    sameDataValue:primitives.sameDataValue,normalizeStudyQuality,todayISO:()=> '2026-09-16',
    dateInsightsMeta:iso=>{const date=new Date(String(iso)+'T00:00:00Z'),dayOfWeek=date.getUTCDay();return freeze({dayOfWeek,dayName:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayOfWeek]});},
    sanitizePracticeRun:practice.sanitizePracticeRun
  }),
  timestamps:freeze({normalizeTimestamp,normalizeImportedTimestamp:normalizeTimestamp,normalizeImportedEpochMillis:(value,fallback=null)=>Number.isFinite(Number(value))?Number(value):fallback}),
  timer:freeze({modes:freeze({PAUSED:'paused',RUNNING:'running'}),defaultBreakSeconds:()=>300})
}));

let descriptor=null;
const windowListeners=new Map();
const context=vm.createContext({
  console,Date,Math,Object,Promise,String,Number,Array,Set,Map,
  window:{
    StudyDirector:{registerPlugin(value){descriptor=value;return true;}},
    addEventListener(type,listener){
      const listeners=windowListeners.get(type)||[];listeners.push(listener);windowListeners.set(type,listeners);
    }
  }
});
vm.runInContext(readScript('source/external/guide.ts'),context,{filename:'source/external/guide.ts'});
assert.ok(descriptor,'Guide plugin should register.');

let tabRegistrationAttempts=0,historyRegistrations=0;
const retryApi=Object.freeze({
  capabilities:Object.freeze({pluginApi:1,tabRegistry:1,planDraft:1,previewRecords:1,installation:1,workspaceHistory:1}),
  ui:Object.freeze({
    registerTab(){tabRegistrationAttempts+=1;return tabRegistrationAttempts>1?true:undefined;},goTab(){},
    workspaceHistory:Object.freeze({
      register(){historyRegistrations+=1;return true;},open(){},replace(){},close(){return true;},closed(){}
    })
  }),
  plan:Object.freeze({loadDraft(){return Promise.resolve({ok:true});}}),
  preview:Object.freeze({useSample(){return Promise.resolve({ok:true});},clear(){}}),
  installation:Object.freeze({status(){return Object.freeze({});},prompt(){},inspect(){},showHelp(){}})
});
assert.equal(descriptor.setup(retryApi),false,'a non-true tab registration result must keep plugin setup retryable');
assert.equal(descriptor.setup(retryApi),true,'the retry must complete Guide setup');
assert.equal(descriptor.setup(retryApi),true,'completed Guide setup remains idempotent');
assert.equal(historyRegistrations,1,'Guide retries must reuse one Legal Center history registration');
assert.equal(tabRegistrationAttempts,2,'successful Guide setup must not register the tab again');
assert.equal(windowListeners.get('studydirector:installationchange')?.length,1,'Guide retries must install one installation listener');
const provider=descriptor.previewProviders?.insights;
assert.equal(typeof provider,'function','Guide must expose the Insights sample provider.');
const records=provider({today:'2026-09-16'});
assert.equal(records.length,28,'Guide preview must provide the full sample window.');
const expectedKeys=[
  'version','recordKind','date','savedAt','sourceRevision','quote','reflection','studyQuality','realTimeSnapshot','schedule','results','practiceRuns','carryForwardDraft',
  'updatedAt'
].sort();
for(const record of records){
  assert.equal(record.version,16,'Guide preview must emit the current DailyRecord schema.');
  assert.equal(record.recordKind,'study');
  assert.ok(Array.isArray(record.schedule));
  assert.ok(Array.isArray(record.practiceRuns));
  assert.deepEqual(Object.keys(record).sort(),expectedKeys,'Guide preview must use the exact canonical DailyRecord envelope.');
  for(const row of record.schedule){
    assert.deepEqual(Object.keys(row).sort(),['area','duration','id','kind','measure','name','start','target'],'Guide sample schedule rows must use the current stored shape.');
  }
  for(const result of Object.values(record.results)){
    assert.notEqual(result.skipped,false,'canonical DailyResult omits a false skipped flag');
    assert.notEqual(result.doneFlag,false,'canonical DailyResult omits a false doneFlag');
    for(const key of ['actualStart','actualEnd']){
      if(result[key])assert.equal(new Date(result[key]).toISOString(),result[key],`Guide sample ${key} must already be canonical ISO.`);
    }
    for(const pause of result.pauseEvents||[]){
      assert.equal(new Date(pause.startedAt).toISOString(),pause.startedAt,'Guide sample pause start must already be canonical ISO.');
      assert.equal(new Date(pause.endedAt).toISOString(),pause.endedAt,'Guide sample pause end must already be canonical ISO.');
    }
  }
  for(const run of record.practiceRuns)assert.notEqual(run.partial,false,'canonical Practice runs omit a false partial flag');
  const canonical=dailyRecordCodec.sanitizeCurrentDailyRecord(record);
  if(!canonical){
    const ids=new Set(record.schedule.map(row=>row.id));
    const badResults=Object.entries(record.results).map(([id,result])=>({
      id,result,clean:dailyRecordCodec.normalizeDailyResultEntry(result,record.schedule.find(row=>row.id===id))
    })).filter(row=>!row.clean||!primitives.sameDataValue(row.result,row.clean));
    const badRuns=record.practiceRuns.map((run,index)=>({index,clean:practice.sanitizePracticeRun(run,{allowedTaskIds:ids}),run}))
      .filter(row=>!row.clean||!primitives.sameDataValue(row.run,row.clean));
    assert.fail(`Guide sample ${record.date} is rejected by the current DailyRecord codec; badResult=${JSON.stringify(badResults[0]||null)} badRun=${JSON.stringify(badRuns[0]||null)}`);
  }
}
console.log(JSON.stringify({status:'PASS',suite:'guide-preview-canonical',records:records.length,schema:16,nestedCanonical:true,productionCodec:true},null,2));
