import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const editor=read('rich-text/editor.ts');
const ui=read('source/core/reconciliation-ui.js');
const backup=read('source/core/backup.js');
const app=read('source/app.html');
const styles=read('source/styles/core.css');
const manifest=read('build/module-manifest.mjs');

assert.match(editor,/RangeSet/,'Scratch diff decorations must use Wordgard RangeSet state.');
assert.match(editor,/Decoration\.Range\.wrapper\('span'/,'Differences must be editor decorations, not persisted marks.');
assert.match(editor,/setTransientRanges\(ranges:readonly MergeRange\[\]\)/,'Mounted editor must expose transient reconciliation ranges.');
assert.match(editor,/setValue\(value:string\)/,'Mounted editor must expose scratch value replacement.');
assert.match(editor,/allowAssetInsert\?:boolean/,'Scratch editor must be able to disable new attachments.');
assert.match(editor,/options\.allowAssetInsert===false\?\[\]:\[attachmentTrigger\]/,'Scratch mode must remove the attachment trigger.');
assert.match(editor,/compareRichText,mergeIncomingAdditions,appendIncomingAdditions,mergeThreeWay,mountRichTextEditor/,'CR2/three-way engine must be exposed through the rich-text runtime for reconciliation.');

for(const label of ['Keep this device’s','Smart merge','Append additions','Use the backup’s','Apply resolved note','All remaining:'])assert.ok(ui.includes(label),`Missing reconciliation action: ${label}`);
assert.match(ui,/Promise\.allSettled\(/,'Reconciliation must retain both editor mount outcomes for cleanup.');
assert.match(ui,/focusOnMount:false,allowAssetInsert:false,readOnly/,'Scratch editors must neither autofocus nor add attachments and must support a read-only imported surface.');
assert.match(ui,/mountOptions\(incomingPane\.field,manualOnly\?'Backup’s Diary Reflection':'Backup’s note',state\.incoming,incomingScratchAssets,true\)/,'Imported reconciliation editor must mount read-only for both notes and Diary conflicts.');
assert.match(ui,/manualOnly[\s\S]{0,180}mergeButton\.hidden=true;appendButton\.hidden=true/,'Diary conflict mode must disable automatic merge strategies.');
assert.ok(ui.includes("action('Custom','custom')"),'Diary conflict mode must expose explicit custom editing.');
assert.match(ui,/richText\.mergeThreeWay\(conflict\.ancestorValue,conflict\.localValue,conflict\.incomingValue\)/,'Reconciliation UI must use the hidden common ancestor when one is available.');
assert.match(ui,/richText\.compareRichText\(leftHandle\.getValue\(\),rightHandle\.getValue\(\)\)/,'UI must continuously compare scratch copies.');
assert.match(ui,/setTransientRanges\(comparison\.localRanges\)/,'Local temporary differences must be decorated.');
assert.match(ui,/setTransientRanges\(comparison\.incomingRanges\)/,'Imported temporary differences must be decorated.');
assert.doesNotMatch(ui,/\bAppData\b|IndexedDb|localStorage|importNotes|notes\.replace|dailyRecords/i,'Reconciliation modal must not have a canonical persistence port.');
assert.match(styles,/\.sd-note-reconcile-editors\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/,'Desktop reconciliation must be side-by-side.');
assert.match(styles,/@media\(max-width:800px\).*\.sd-note-reconcile-editors\{grid-template-columns:1fr/s,'Mobile reconciliation must stack the editors.');

const reconcileAt=backup.indexOf('await NoteReconciliation.resolve');
const mutationBoundaryAt=backup.indexOf("runRestoreMutation(stored,'restore-backup'",reconcileAt);
const safetyAt=backup.indexOf('captureLocalSafetyCopy(stored',mutationBoundaryAt);
assert.ok(reconcileAt>0&&mutationBoundaryAt>reconcileAt&&safetyAt>mutationBoundaryAt,'Scratch reconciliation must finish before the P4 managed mutation boundary and internal safety/journaled canonical mutation start.');
assert.match(backup,/noteDecisionMap=noteSelections\(/,'Scratch decisions must flow into ResolvedPlan rather than writing notes directly.');
assert.match(app,/ReconciliationUIModule\.createController/,'Host must compose the private reconciliation UI module explicitly.');
assert.match(manifest,/id:'reconciliation-ui'/,'Reconciliation UI must be a declared private module.');
assert.match(manifest,/backup:Object\.freeze\(\[[^\]]*'reconciliation-ui'/,'Backup runtime dependency must declare the reconciliation UI boundary.');

console.log(JSON.stringify({status:'PASS',suite:'reconciliation-ui-contract',checks:27,coverage:['resolved + read-only imported editors','hidden three-way ancestor','transient decorations','strategy actions','mobile layout','no canonical persistence port','pre-commit ordering']},null,2));
