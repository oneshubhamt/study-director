import {readScript} from '../../build/source-script.mts';
import vm from 'node:vm';

const freeze=Object.freeze;
const DOMAIN_LIMITS=freeze({
  maxAreaNameChars:200,maxDurationMinutes:1440,maxScheduleChars:50000,maxScheduleRows:200,
  maxTaskNameChars:300,maxTasksPerDay:100,maxUnitChars:80
});
const PRACTICE_LIMITS=freeze({
  minPracticeTargetMs:1000,maxPracticeTargetMs:4*60*60*1000,maxPracticeUnitsPerRun:20,maxPracticeUnitsPerDay:40,
  maxPracticeRunsPerDay:8,maxPracticePlanGroups:12,maxPracticeMarksPerUnit:100,maxUnitChars:80
});
const practiceDomain=freeze({
  boundedInt:(value,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={})=>{
    const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,Math.trunc(n))):fallback;
  },
  boundedNumber:(value,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={})=>{
    const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:fallback;
  },
  clampArray:(value,max)=>Array.isArray(value)?value.slice(0,max):[],
  clampText:(value,max)=>String(value??'').slice(0,Math.max(0,Number(max)||0)),
  fmtS:value=>`${Math.floor(Math.max(0,Number(value)||0))}s`
});

let providers=null;
export function realInsightsProviders(){
  if(providers)return providers;
  const registryKey=Symbol.for('studyDirector.internalModules.v1');
  if(!globalThis[registryKey]){
    for(const file of ['source/core/internal.ts','source/core/domain.ts','source/core/practice-pacer.ts']){
      vm.runInThisContext(readScript(file),{filename:file});
    }
  }
  const registry=globalThis[registryKey];
  const domain=registry.require('domain',1,DOMAIN_LIMITS);
  const practiceModule=registry.require('practice-pacer',1);
  const practice=practiceModule.createModel(freeze({ports:freeze({
    configuration:freeze({APP_LIMITS:PRACTICE_LIMITS}),
    domain:practiceDomain
  })}));
  providers=freeze({
    classifyTaskOutcome:domain.OutcomeModel.classify,
    summarizePracticeRuns:practice.summarizePracticeRunsForInsights,
    practice
  });
  return providers;
}
