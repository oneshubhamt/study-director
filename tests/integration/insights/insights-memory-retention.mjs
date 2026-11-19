import assert from 'node:assert/strict';
import vm from 'node:vm';
import {insightsModelSources,readInsightsModelRuntimeSource} from '../../helpers/insights-model-runtime.mjs';
import {realInsightsProviders} from '../../helpers/insights-providers.mjs';

const sourcePath=insightsModelSources.join('+');
const source=readInsightsModelRuntimeSource();
const context=vm.createContext({console});
vm.runInContext(source,context,{filename:sourcePath});
const {ModelEngine}=context.StudyDirectorInsightsModel;
const {classifyTaskOutcome,summarizePracticeRuns}=realInsightsProviders();
const engine=ModelEngine.createInsightsEngine({classifyTaskOutcome,summarizePracticeRuns});
const records=[{date:'2026-08-10',studyQuality:4,tasks:[{id:'a',name:'Study',area:'GS2',kind:'work',dur:60,completion:80,completionSource:'manual',actualSeconds:3000}],practiceRuns:[]}];

const first=engine.prepare(records,'revision-a');
const second=engine.prepare(records,'revision-b');
const third=engine.prepare(records,'revision-c');
assert.strictEqual(engine.prepare(records,'revision-b'),second,'Previous prepared revision should remain cached');
assert.strictEqual(engine.prepare(records,'revision-c'),third,'Current prepared revision should remain cached');
assert.notStrictEqual(engine.prepare(records,'revision-a'),first,'Third-old prepared revision should be evicted');

const guardedEngine=ModelEngine.createInsightsEngine({classifyTaskOutcome,summarizePracticeRuns});
let guardedBeforeCommitCalls=0;
const guardedStale=[{...records[0],tasks:[{...records[0].tasks[0],name:'Guarded stale'}]}];
await assert.rejects(
  guardedEngine.prepareAsync(guardedStale,'guarded-revision',()=>Promise.resolve(),()=>{
    guardedBeforeCommitCalls+=1;
    const error=new Error('prepared source superseded');error.name='AbortError';throw error;
  }),
  error=>error?.name==='AbortError'
);
assert.equal(guardedBeforeCommitCalls,1,'fresh asynchronous preparation must validate exactly once immediately before cache commit');
const guardedReplacement=[{...records[0],tasks:[{...records[0].tasks[0],name:'Guarded replacement'}]}];
const guardedPrepared=guardedEngine.prepare(guardedReplacement,'guarded-revision');
assert.equal(guardedPrepared.records[0].tasks[0].name,'Guarded replacement','a rejected asynchronous preparation must never populate the prepared-revision cache');
let guardedCacheHitChecks=0;
await assert.rejects(
  guardedEngine.prepareAsync(guardedReplacement,'guarded-revision',null,()=>{
    guardedCacheHitChecks+=1;
    const error=new Error('cached source superseded');error.name='AbortError';throw error;
  }),
  error=>error?.name==='AbortError'
);
assert.equal(guardedCacheHitChecks,1,'cached asynchronous preparation must validate before reuse or LRU promotion');

const internalEngine=ModelEngine.createInsightsEngine({classifyTaskOutcome,summarizePracticeRuns});
const variant=label=>[{...records[0],tasks:[{...records[0].tasks[0],name:label}]}];
const internalA=internalEngine.prepare(variant('Internal A'));
const internalB=internalEngine.prepare(variant('Internal B'));
assert.strictEqual(internalEngine.prepare(variant('Internal A')),internalA,'An internally derived cache hit should promote the current revision');
internalEngine.prepare(variant('Internal C'));
assert.strictEqual(internalEngine.prepare(variant('Internal A')),internalA,'The revisited internal revision should survive the next insertion');
assert.notStrictEqual(internalEngine.prepare(variant('Internal B')),internalB,'The true least-recent internal revision should be evicted');

const historyEngine=ModelEngine.createInsightsEngine({classifyTaskOutcome,summarizePracticeRuns});
const historyModel=revision=>{
  const item=historyEngine.prepare(records,revision);
  return historyEngine.buildPrepared(item.records,item,{windowKey:'all',windowLabel:'All records',allRecordCount:1,currentStudyDate:'2026-08-10'});
};
const historyA=historyModel('history-a').getLabEvidence();
historyModel('history-b');
assert.strictEqual(historyModel('history-a').getLabEvidence(),historyA,'A history-cache hit should reuse and promote the current entry');
historyModel('history-c');
assert.strictEqual(historyModel('history-a').getLabEvidence(),historyA,'The revisited history entry should survive the next insertion');

// Detailed Lab evidence may outlive the two-entry LRU only because the
// currently retained dashboard still owns that model. releaseTransient() must
// therefore clear the one audited evictee as well as entries still in the LRU.
const evictedAuditEngine=ModelEngine.createInsightsEngine({classifyTaskOutcome,summarizePracticeRuns});
const evictedAuditModel=revision=>{
  const item=evictedAuditEngine.prepare(records,revision);
  return evictedAuditEngine.buildPrepared(item.records,item,{windowKey:'all',windowLabel:'All records',allRecordCount:1,currentStudyDate:'2026-08-10'});
};
const retainedModelA=evictedAuditModel('evicted-a');
const retainedAuditA=retainedModelA.getLabEvidence();
evictedAuditModel('evicted-b');
evictedAuditModel('evicted-c');
evictedAuditEngine.releaseTransient();
const rebuiltRetainedAuditA=retainedModelA.getLabEvidence();
assert.notStrictEqual(rebuiltRetainedAuditA,retainedAuditA,'transient release must clear detailed Lab evidence even after its history entry was evicted from the LRU');
assert.deepEqual(JSON.parse(JSON.stringify(rebuiltRetainedAuditA)),JSON.parse(JSON.stringify(retainedAuditA)),'evicted detailed Lab evidence must rebuild with identical semantics after release');

// History cache identity must include study date and summary context; neither
// context may alias a prior Lab result for the same dataset revision.
const contextPrepared=historyEngine.prepare(records,'context-revision');
const dateAuditA=historyEngine.getLabEvidence(contextPrepared,{currentStudyDate:'2026-08-10'});
const dateAuditB=historyEngine.getLabEvidence(contextPrepared,{currentStudyDate:'2026-08-11'});
assert.notStrictEqual(dateAuditB,dateAuditA,'history cache must include the current study date');

const summaryA=[{date:'2026-08-10',completedMinutes:48,actualTrackedMinutes:50,areaSummary:{GS2:{planned:60,completed:48,actual:50,activityBlocks:1}}}];
const summaryB=[{date:'2026-08-10',completedMinutes:48,actualTrackedMinutes:50,areaSummary:{GS3:{planned:60,completed:48,actual:50,activityBlocks:1}}}];
const summaryAuditA=historyEngine.getLabEvidence(contextPrepared,{currentStudyDate:'2026-08-10',subjectReferenceSummaries:summaryA});
const summaryAuditB=historyEngine.getLabEvidence(contextPrepared,{currentStudyDate:'2026-08-10',subjectReferenceSummaries:summaryB});
assert.notStrictEqual(summaryAuditB,summaryAuditA,'history cache must include the subject-summary context');

const prepared=engine.prepare(records,'lab-revision');
const windowInfo=engine.filterPreparedWindow(prepared,'all','2026-08-10');
const model=engine.buildPrepared(windowInfo.records,prepared,{windowKey:'all',windowLabel:'All records',allRecordCount:1,currentStudyDate:'2026-08-10'});
const preparedBeforeBuild=JSON.stringify(prepared.records);
const firstAudit=model.getLabEvidence();
assert.strictEqual(model.getLabEvidence(),firstAudit,'Lab evidence should be reused while Insights remains active');
engine.releaseTransient();
const rebuiltAudit=model.getLabEvidence();
assert.notStrictEqual(rebuiltAudit,firstAudit,'Lab evidence should be released and rebuilt after transient release');
assert.deepEqual(JSON.parse(JSON.stringify(rebuiltAudit)),JSON.parse(JSON.stringify(firstAudit)),'Rebuilt Lab evidence must be functionally identical');
assert.equal(JSON.stringify(prepared.records),preparedBeforeBuild,'model/Lab consumers must not mutate shared prepared input');


console.log(JSON.stringify({status:'PASS',preparedCache:'current + previous LRU',guardedAsyncPreparation:'fresh + cached pre-return validated',historyCache:'current + previous LRU',labEvidence:'released and parity-rebuilt, including audited LRU evictee',historyContext:'date + summary keyed; not retained',preparedInput:'immutable across model/Lab consumers'},null,2));
await import('./guide-preview-canonical.mjs');
await import('./insights-transport-lifecycle.mjs');
