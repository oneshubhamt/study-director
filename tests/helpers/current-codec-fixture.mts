import type {DomainModule} from '../../types/domain.ts';
import type {RecordCodecsModule} from '../../source/core/record-codecs.ts';
import type {BoundedOptions,PracticeRun} from '../../types/record-models.ts';
import type {PilotRegistry} from '../../types/pilot.ts';
import {readScript} from '../../build/source-script.mts';
import {PRODUCTION_LIMITS} from '../../contracts/production-limits.mts';
import {RUNTIME_DATA_CONTRACT} from '../../contracts/canonical-identities.mts';
import vm from 'node:vm';

for(const file of ['source/core/internal.ts','source/core/domain.ts','source/core/record-codecs.ts','source/core/backup-codec.ts','source/core/attachments.ts','source/core/persistence.ts'])vm.runInThisContext(readScript(file),{filename:file});
// The real registry validates the factory inputs. Keep the VM boundary typed with
// the checked production module contract rather than a local permissive facade.
const registry=Reflect.get(globalThis,Symbol.for('studyDirector.internalModules.v1')) as PilotRegistry & {require(name:'record-codecs',version:1):Readonly<RecordCodecsModule>};
const Domain:Readonly<DomainModule>=registry.require('domain',1,Object.freeze({maxAreaNameChars:200,maxDurationMinutes:1440,maxScheduleChars:50000,maxScheduleRows:200,maxTaskNameChars:300,maxTasksPerDay:100,maxUnitChars:80}));
const RecordCodecs=registry.require('record-codecs',1);
const freeze=Object.freeze;
type Bounds={min?:number;max?:number;fallback?:number|null;integer?:boolean};
function boundedNumber<F extends number|null>(value:unknown,options:BoundedOptions<F>):number|F;
function boundedNumber(value:unknown,options?:Bounds):number|null;
function boundedNumber(value:unknown,{min=-Infinity,max=Infinity,fallback=null}:Bounds={}):number|null{const number=Number(value);return Number.isFinite(number)&&number>=min&&number<=max?number:fallback;}
function boundedInt<F extends number|null>(value:unknown,options:BoundedOptions<F>):number|F;
function boundedInt(value:unknown,options?:Bounds):number|null;
function boundedInt(value:unknown,options:Bounds={}):number|null{const number=boundedNumber(value,options);return number!==null&&Number.isInteger(number)?number:(options.fallback??null);}
const clampText=(value:unknown,max=1000000)=>String(value??'').slice(0,max);
const optionalText=(value:unknown,max:number)=>typeof value==='string'&&value.length<=max?value:null;
const optionalBoundedNumber=(value:unknown,options:Bounds={})=>{const number=boundedNumber(value,{...options,fallback:null});return options.integer&&number!==null&&!Number.isInteger(number)?null:number;};
function normalizeTimestamp(value:unknown,fallback:string):string;
function normalizeTimestamp(value:unknown,fallback?:null):string|null;
function normalizeTimestamp(value:unknown,fallback:string|null=null){const parsed=Date.parse(String(value||''));return Number.isFinite(parsed)?new Date(parsed).toISOString():fallback;}
function normalizeImportedEpochMillis(value:unknown,fallback:number):number;
function normalizeImportedEpochMillis(value:unknown,fallback?:null):number|null;
function normalizeImportedEpochMillis(value:unknown,fallback:number|null=null){return Number.isFinite(Number(value))?Number(value):fallback;}
const timestamps=freeze({normalizeTimestamp,normalizeImportedTimestamp:normalizeTimestamp,normalizeImportedEpochMillis});
const sameDataValue=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const helpers=freeze({
  boundedInt,boundedNumber,clampText,clampEditorContent:clampText,editorContentWithinLimits:()=>true,optionalBoundedNumber,optionalText,
  safeBoolean:(value:unknown)=>!!value,sameDataValue,normalizeStudyQuality:(value:unknown)=>value===null?null:(Number.isInteger(Number(value))&&Number(value)>=1&&Number(value)<=5?Number(value):null),
  todayISO:()=> '2026-09-17',dateInsightsMeta:()=>freeze({dayOfWeek:4,dayName:'Thursday'}),sanitizePracticeRun:(value:unknown)=>value&&typeof value==='object'?structuredClone(value) as PracticeRun:null
});
const limits=PRODUCTION_LIMITS,dataContract=RUNTIME_DATA_CONTRACT;
const dailyRecordCodec=RecordCodecs.createDailyRecordCodec(freeze({
  limits,dataContract,domain:Domain,keyedRecord:freeze({create:<T>():Record<string,T>=>Object.create(null)}),helpers,
  timestamps,
  timer:freeze({modes:freeze({PAUSED:'paused',RUNNING:'running'}),defaultBreakSeconds:()=>300})
}));


// Practice-run sanitization above deliberately retains the original permissive
// fixture port; the record codec, not a replacement practice codec, is under test.
export {timestamps,registry,Domain,RecordCodecs,freeze,boundedNumber,boundedInt,clampText,optionalText,optionalBoundedNumber,normalizeTimestamp,sameDataValue,helpers,limits,dataContract,dailyRecordCodec};
