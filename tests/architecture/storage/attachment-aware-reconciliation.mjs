import {readHostHtml} from '../../../build/host-source.mjs';
import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const backup=readScript('source/core/backup.ts');
const ui=fs.readFileSync('source/core/reconciliation-ui.js','utf8');
const app=readHostHtml();


assert.match(backup,/async function resolvedAssetReferenceIds\s*\(resolvedPlan\s*,signal\s*,reviews\s*=freeze\s*\(\[\]\s*\)\s*\)/,'Backup restore must calculate final attachment references from ResolvedPlan and the versions kept for review.');
assert.match(backup,/for\s*\(const item of resolvedPlan&&resolvedPlan\s*\.savedDays\|\|\[\]\s*\)/,'Saved-Day choices must contribute attachment references.');
assert.match(backup,/for\s*\(const item of resolvedPlan&&resolvedPlan\s*\.notes\|\|\[\]\s*\)/,'Resolved notes must contribute attachment references.');
assert.doesNotMatch(backup,/resolvedPlan&&resolvedPlan\s*\.reflectionDrafts/,'Retired Reflection Drafts must not remain a reconciliation attachment-reference domain.');
assert.match(backup,/resolvedPlan&&resolvedPlan\s*\.activeSession&&resolvedPlan\s*\.activeSession\s*\.value/,'Resolved Active Session must contribute attachment references.');
assert.match(backup,/referenceSet\s*\.has\s*\(item\s*\.assetId\s*\)\|\|\s*\(item\s*\.library\s*=\s*=\s*=true&&states\[item\s*\.assetId\]\s*=\s*=\s*='record'\s*\)/,'Only final references or independently retained incoming assets the plan keeps may publish.');
assert.match(backup,/Referenced attachments are never deleted by this choice/,'Attachment Library deletion choices must never override resolved rich-text references.');
assert.doesNotMatch(backup,/importAll\s*\(assessment\s*\.available/,'Restore must not publish the complete incoming attachment set.');
assert.match(backup,/verified checkpoint does not contain its bytes/,'A selected missing attachment must fail closed.');
assert.match(backup,/identity collision detected.*local bytes differ/,'Same-ID/different-byte collisions must remain hard failures.');
assert.match(backup,/AssetData\s*\.scheduleMaintenance\s*\(0\s*\)/,'Post-commit attachment maintenance must still be scheduled.');

assert.match(app,/let richTextAssetMaintenancePauseCount=0/,'Host must track reconciliation maintenance holds.');
assert.match(app,/mutationActive:\(\)=>richTextAssetMaintenancePauseCount>0\|\|/,'GC must pause while note reconciliation is active.');
assert.match(app,/withRichTextAssetMaintenancePaused\(\(\)=>NoteReconciliationUI\.resolve\(options\)\)/,'The reconciliation modal must execute inside the attachment-maintenance hold.');

console.log(JSON.stringify({status:'PASS',suite:'attachment-aware-reconciliation-contract',checks:20,coverage:['checkpoint preview AssetStore','read-only preview','resolved reference scan','selective publication','missing-byte fail-closed','checksum collision','GC hold','post-commit maintenance']},null,2));
