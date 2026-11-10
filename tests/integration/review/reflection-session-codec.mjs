import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
const read=relative=>readScript(path.join(ROOT,relative));
for(const file of ['source/core/internal.ts','source/core/domain.ts','source/core/timer-state.ts','source/core/record-codecs.ts'])vm.runInThisContext(read(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const Domain=registry.require('domain',1,Object.freeze({maxAreaNameChars:200,maxDurationMinutes:1440,maxScheduleChars:50000,maxScheduleRows:200,maxTaskNameChars:300,maxTasksPerDay:100,maxUnitChars:80}));
const TimerStateModule=registry.require('timer-state',1);
const RecordCodecs=registry.require('record-codecs',1);

const timer=TimerStateModule.createStateController(Object.freeze({
  helpers:Object.freeze({makeTaskId:(task,index)=>String(task.id||`task-${index+1}`)}),
  diagnostics:Object.freeze({capture:()=>false}),effects:Object.freeze({modeChanged:()=>false})
}));
timer.loadSchedule([{id:'task-a',name:'A'}],{studyDate:'2026-08-05'});timer.contentRevision=4;timer.savedRevision=3;
const review=Object.freeze({reflection:'Atomic diary',studyQuality:4});
const snapshot=timer.projectSessionSnapshot(Object.freeze({
  version:6,date:'2026-08-05',fingerprint:'fp',taskState:Object.freeze({}),timerRuntime:null,
  latestCarryForward:'',review,updatedAt:'2026-08-05T08:01:00.000Z'
}));
assert.equal(snapshot.review.reflection,'Atomic diary');
assert.equal(snapshot.review.studyQuality,4);
assert.ok(Object.isFrozen(snapshot));assert.ok(Object.isFrozen(snapshot.review));

const clampText=(value,max=100000)=>String(value??'').slice(0,max);
const boundedNumber=(value,{min=-Infinity,max=Infinity,fallback=null}={})=>{const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:fallback;};
const boundedInt=(value,options={})=>{const n=boundedNumber(value,options);return n!==null&&Number.isInteger(n)?n:(options.fallback??null);};
const isValidIsoDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
const normalizeTimestamp=(value,fallback=null)=>{const parsed=Date.parse(String(value||''));return Number.isFinite(parsed)?new Date(parsed).toISOString():fallback;};
const helpers=Object.freeze({
  boundedInt,boundedNumber,clampText,clampEditorContent:clampText,editorContentWithinLimits:()=>true,
  cleanDayRevision:value=>Math.max(0,Math.round(Number(value)||0)),sameDataValue:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
  activeSessionScheduleFingerprint:()=> 'fp',isCanonicalScheduleText:value=>!!String(value||'').trim(),isValidIsoDate,
  normalizeStudyQuality:value=>Number.isInteger(Number(value))&&Number(value)>=1&&Number(value)<=5?Number(value):null,
  parseProgressNumber:value=>{const n=Number(value);return Number.isFinite(n)?n:null;},sanitizePracticeState:()=>Object.freeze({active:false,runs:Object.freeze([])})
});
const limits=Object.freeze({
  maxReflectionChars:5000,maxScheduleChars:50000,maxTasksPerDay:100,maxDurationMinutes:1440,maxCarryForwardChars:5000,maxLiveSessionsPerTask:100,
  maxTaskNameChars:300,maxAreaNameChars:200,maxUnitChars:80,maxPracticeRunsPerDay:100,maxPracticeUnitsPerDay:1000,maxPracticeUnitsPerRun:100,minPracticeTargetMs:1000,maxPracticeTargetMs:86400000,maxStudentNameChars:100,maxQuoteChars:1000
});
const dataContract=Object.freeze({schemas:Object.freeze({
  SessionSnapshot:Object.freeze({version:6}),ActiveSession:Object.freeze({version:10,key:'current'}),DailyRecord:Object.freeze({version:15}),Note:Object.freeze({version:2}),LocalRecoveryEnvelope:Object.freeze({version:1})
})});
const keyedRecord=Object.freeze({create:()=>Object.create(null)});
const dailyRecordCodec=Object.freeze({
  compactPauseEvents:events=>Array.isArray(events)?events:[],sanitizeTimerRuntimePayload:value=>value&&typeof value==='object'?value:null,
  isSupportedSavedDate:isValidIsoDate,normalizeDailyResultEntry:value=>value,compactRealTimeSnapshot:value=>value,sanitizeCurrentDailyRecord:value=>value,sanitizeCurrentNote:value=>value
});
const codec=RecordCodecs.createActiveSessionCodec(Object.freeze({
  limits,dataContract,activeSessionId:'current',domain:Domain,keyedRecord,helpers,
  timestamps:Object.freeze({normalizeTimestamp,normalizeImportedTimestamp:normalizeTimestamp,normalizeImportedEpochMillis:(value,fallback=null)=>Number.isFinite(Number(value))?Number(value):fallback}),dailyRecordCodec
}));
const optionalText=(value,max)=>typeof value==='string'&&value.length<=max?value:null;
const optionalBoundedNumber=(value,options={})=>{const n=boundedNumber(value,{...options,fallback:null});return options.integer&&n!==null&&!Number.isInteger(n)?null:n;};
const session={
  id:'current',type:'activeSession',version:10,revision:12,date:'2026-08-05',status:'active',runningOn:'inst_review_other_device',
  scheduleText:'07:00 | 60 | A | Study | Area | pages | 10',snapshot,suspendedAt:null,updatedAt:'2026-08-05T08:01:00.000Z'
};
const canonical=codec.canonicalize(session);
assert.ok(canonical);assert.deepEqual(canonical.snapshot.review,{reflection:'Atomic diary',studyQuality:4});

const legacySnapshot=structuredClone(snapshot);legacySnapshot.version=5;delete legacySnapshot.review;
legacySnapshot.reflectionDraft={version:1,date:'2026-08-05',reflection:'Legacy diary',studyQuality:3,revision:6,sessionRevision:12,updatedAt:'2026-08-05T08:00:00.000Z'};
const {runningOn:_runner,...sessionWithoutRunner}=session,legacyV8={...structuredClone(sessionWithoutRunner),version:8,snapshot:legacySnapshot,entityType:'activeSession',entityId:'current',schemaVersion:1,deviceId:'dev_r10',createdAt:'2026-08-05T07:00:00.000Z',deleted:false,syncStatus:'pending'};
assert.equal(codec.sanitizeCurrent(legacyV8),null,'ordinary codec must reject the retired ActiveSession schema');
const invalid=structuredClone(session);delete invalid.snapshot.review;
assert.equal(codec.canonicalize(invalid),null,'current ActiveSession requires one canonical Review snapshot');
const extra=structuredClone(session);extra.snapshot.review.revision=1;
assert.equal(codec.canonicalize(extra),null,'retired ReflectionDraft lineage fields must not survive inside Review state');

console.log(JSON.stringify({status:'PASS',suite:'review-active-session-codec',reviewInActiveSession:true,currentRequiresReview:true,retiredDraftLineageRejected:true},null,2));
