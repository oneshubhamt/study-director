import {readScript} from '../../build/source-script.mts';
import vm from 'node:vm';
import {PRODUCTION_LIMITS} from '../../contracts/production-limits.mjs';

const freeze=Object.freeze;
const DOMAIN_LIMIT_KEYS=freeze([
  'maxAreaNameChars','maxDurationMinutes','maxScheduleChars','maxScheduleRows',
  'maxTaskNameChars','maxTasksPerDay','maxUnitChars'
]);
const DOMAIN_LIMITS=freeze(Object.fromEntries(DOMAIN_LIMIT_KEYS.map(key=>[key,PRODUCTION_LIMITS[key]])));
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
    configuration:freeze({APP_LIMITS:PRODUCTION_LIMITS}),
    domain:practiceDomain
  })}));
  providers=freeze({
    classifyTaskOutcome:domain.OutcomeModel.classify,
    summarizePracticeRuns:practice.summarizePracticeRunsForInsights,
    practice
  });
  return providers;
}
