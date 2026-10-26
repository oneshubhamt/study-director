import {readScript} from '../../build/source-script.mts';
import {PRODUCTION_LIMITS} from '../../contracts/production-limits.mjs';
import {RUNTIME_DATA_CONTRACT} from '../../contracts/canonical-identities.mjs';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['source/core/internal.js','source/core/domain.ts','source/core/record-codecs.js','source/core/backup-codec.js','source/core/attachments.js','source/core/persistence.js'])vm.runInThisContext(readScript(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const Domain=registry.require('domain',1,Object.freeze({maxAreaNameChars:200,maxDurationMinutes:1440,maxScheduleChars:50000,maxScheduleRows:200,maxTaskNameChars:300,maxTasksPerDay:100,maxUnitChars:80}));
const RecordCodecs=registry.require('record-codecs',1);
const freeze=Object.freeze;
const boundedNumber=(value,{min=-Infinity,max=Infinity,fallback=null}={})=>{const number=Number(value);return Number.isFinite(number)&&number>=min&&number<=max?number:fallback;};
const boundedInt=(value,options={})=>{const number=boundedNumber(value,options);return number!==null&&Number.isInteger(number)?number:(options.fallback??null);};
const clampText=(value,max=1000000)=>String(value??'').slice(0,max);
const optionalText=(value,max)=>typeof value==='string'&&value.length<=max?value:null;
const optionalBoundedNumber=(value,options={})=>{const number=boundedNumber(value,{...options,fallback:null});return options.integer&&number!==null&&!Number.isInteger(number)?null:number;};
const normalizeTimestamp=(value,fallback=null)=>{const parsed=Date.parse(String(value||''));return Number.isFinite(parsed)?new Date(parsed).toISOString():fallback;};
const sameDataValue=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const helpers=freeze({
  boundedInt,boundedNumber,clampText,clampEditorContent:clampText,editorContentWithinLimits:()=>true,optionalBoundedNumber,optionalText,
  safeBoolean:value=>!!value,sameDataValue,normalizeStudyQuality:value=>value===null?null:(Number.isInteger(Number(value))&&Number(value)>=1&&Number(value)<=5?Number(value):null),
  todayISO:()=> '2026-09-17',dateInsightsMeta:()=>freeze({dayOfWeek:4,dayName:'Thursday'}),sanitizePracticeRun:value=>value&&typeof value==='object'?structuredClone(value):null
});
const limits=PRODUCTION_LIMITS,dataContract=RUNTIME_DATA_CONTRACT;
const dailyRecordCodec=RecordCodecs.createDailyRecordCodec(freeze({
  limits,dataContract,domain:Domain,keyedRecord:freeze({create:()=>Object.create(null)}),helpers,
  timestamps:freeze({normalizeTimestamp:normalizeTimestamp,normalizeImportedTimestamp:normalizeTimestamp,normalizeImportedEpochMillis:(value,fallback=null)=>Number.isFinite(Number(value))?Number(value):fallback}),
  timer:freeze({modes:freeze({PAUSED:'paused',RUNNING:'running'}),defaultBreakSeconds:()=>300})
}));


export {registry,Domain,RecordCodecs,freeze,boundedNumber,boundedInt,clampText,optionalText,optionalBoundedNumber,normalizeTimestamp,sameDataValue,helpers,limits,dataContract,dailyRecordCodec};
