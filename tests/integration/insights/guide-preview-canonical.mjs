import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

let descriptor=null;
const context=vm.createContext({
  console,
  Date,
  Math,
  Object,
  Promise,
  String,
  Number,
  Array,
  Set,
  Map,
  window:{
    StudyDirector:{registerPlugin(value){descriptor=value;return true;}},
    addEventListener(){}
  }
});
vm.runInContext(fs.readFileSync('source/external/guide.js','utf8'),context,{filename:'source/external/guide.js'});
assert.ok(descriptor,'Guide plugin should register.');
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
}
console.log(JSON.stringify({status:'PASS',suite:'guide-preview-canonical',records:records.length,schema:16},null,2));
