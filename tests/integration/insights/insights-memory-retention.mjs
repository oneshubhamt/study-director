import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sourcePath='source/external/insights-model.js';
const source=fs.readFileSync(sourcePath,'utf8');
const context=vm.createContext({console});
vm.runInContext(source,context,{filename:sourcePath});
const {ModelEngine}=context.StudyDirectorInsightsModel;

const classifyTaskOutcome=task=>task.completion>=100?'full':task.completion>0?'partial':'zero-output';
const summarizePracticeRuns=rawRuns=>({runSummaries:(rawRuns||[]).map(run=>({run,plannedUnits:run.unitMs.length,unitRows:run.unitMs.map(actualMs=>({actualMs,targetMs:run.targetMs})),segmentRows:[]})),audit:{rejectedRawIndexes:[]}});
const engine=ModelEngine.createInsightsEngine({classifyTaskOutcome,summarizePracticeRuns});
const records=[{date:'2026-08-10',studyQuality:4,tasks:[{id:'a',name:'Study',area:'GS2',kind:'work',dur:60,completion:80,completionSource:'manual',actualSeconds:3000}],practiceRuns:[]}];

const first=engine.prepare(records,'revision-a');
const second=engine.prepare(records,'revision-b');
const third=engine.prepare(records,'revision-c');
assert.strictEqual(engine.prepare(records,'revision-b'),second,'Previous prepared revision should remain cached');
assert.strictEqual(engine.prepare(records,'revision-c'),third,'Current prepared revision should remain cached');
assert.notStrictEqual(engine.prepare(records,'revision-a'),first,'Third-old prepared revision should be evicted');

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

const prepared=engine.prepare(records,'lab-revision');
const windowInfo=engine.filterPreparedWindow(prepared,'all','2026-08-10');
const model=engine.buildPrepared(windowInfo.records,prepared,{windowKey:'all',windowLabel:'All records',allRecordCount:1,currentStudyDate:'2026-08-10'});
const firstAudit=model.getLabEvidence();
assert.strictEqual(model.getLabEvidence(),firstAudit,'Lab evidence should be reused while Insights remains active');
engine.releaseTransient();
const rebuiltAudit=model.getLabEvidence();
assert.notStrictEqual(rebuiltAudit,firstAudit,'Lab evidence should be released and rebuilt after transient release');
assert.deepEqual(JSON.parse(JSON.stringify(rebuiltAudit)),JSON.parse(JSON.stringify(firstAudit)),'Rebuilt Lab evidence must be functionally identical');


console.log(JSON.stringify({status:'PASS',preparedCache:'current + previous LRU',historyCache:'current + previous LRU',labEvidence:'released and parity-rebuilt',historyContext:'not retained'},null,2));
