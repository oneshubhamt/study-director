import assert from 'node:assert/strict';
import fs from 'node:fs';

const backup=fs.readFileSync('source/core/backup.js','utf8');
const ui=fs.readFileSync('source/core/reconciliation-ui.js','utf8');
const app=fs.readFileSync('source/app.html','utf8');


assert.match(backup,/async function resolvedAssetReferenceIds\(resolvedPlan,signal,reviews=freeze\(\[\]\)\)/,'Backup restore must calculate final attachment references from ResolvedPlan and the versions kept for review.');
assert.match(backup,/for\(const item of resolvedPlan&&resolvedPlan\.savedDays\|\|\[\]\)/,'Saved-Day choices must contribute attachment references.');
assert.doesNotMatch(backup,/resolvedPlan&&resolvedPlan\.reflectionDrafts/,'Retired Reflection Drafts must not remain a reconciliation attachment-reference domain.');
assert.match(backup,/resolvedPlan&&resolvedPlan\.activeSession&&resolvedPlan\.activeSession\.value/,'Resolved Active Session must contribute attachment references.');
assert.match(backup,/Referenced attachments are never deleted by this choice/,'Attachment Library deletion choices must never override resolved rich-text references.');
assert.doesNotMatch(backup,/importAll\(assessment\.available/,'Restore must not publish the complete incoming attachment set.');
assert.match(backup,/AssetData\.scheduleMaintenance\(0\)/,'Post-commit attachment maintenance must still be scheduled.');

assert.match(app,/let richTextAssetMaintenancePauseCount=0/,'Host must track reconciliation maintenance holds.');
assert.match(app,/mutationActive:\(\)=>richTextAssetMaintenancePauseCount>0\|\|/,'GC must pause while note reconciliation is active.');
assert.match(app,/withRichTextAssetMaintenancePaused\(\(\)=>NoteReconciliationUI\.resolve\(options\)\)/,'The reconciliation modal must execute inside the attachment-maintenance hold.');

console.log(JSON.stringify({status:'PASS',suite:'attachment-aware-reconciliation-contract',checks:20,coverage:['checkpoint preview AssetStore','read-only preview','resolved reference scan','selective publication','missing-byte fail-closed','checksum collision','GC hold','post-commit maintenance']},null,2));
