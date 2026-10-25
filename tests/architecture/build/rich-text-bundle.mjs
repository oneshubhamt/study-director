import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildAttachmentWorkerBundle,buildExportWorkerBundle,buildImageWorkerBundle,buildSearchWorkerBundle,buildWordgardModule,buildRichTextModule,buildLeanRichText,WORDGARD_GLOBAL} from '../../../build/wordgard-bundle.mjs';
import releaseConfig from '../../../release.config.mjs';

const root=process.cwd();
const committed=fs.readFileSync(path.join(root,'source/external/rich-text.js'),'utf8');
const committedWordgard=fs.readFileSync(path.join(root,'source/external/wordgard.js'),'utf8');
// Wordgard ships as its own readable module; Study Director's editor reads it
// from a global. The minified deployment ships the lean build (generated)
// in place of both: the editor and only the Wordgard code it reaches.
const [wordgardModule,editorModule,generated]=await Promise.all([buildWordgardModule(),buildRichTextModule(),buildLeanRichText()]);
assert.equal(wordgardModule.source,committedWordgard,'Committed Wordgard module is not reproducible from vendor/wordgard.');
assert.equal(editorModule.source,committed,'Committed rich-text editor is not reproducible from its sources.');
assert.ok(!editorModule.inputs.some(name=>/vendor\/wordgard|node_modules\/style-mod/.test(name)),'The editor module must not include Wordgard; it reads the Wordgard module.');
assert.ok(wordgardModule.inputs.some(name=>/vendor\/wordgard\/src\/editor\/editor\.ts$/.test(name)));
assert.ok(!wordgardModule.inputs.some(name=>/rich-text\/(?:editor|typography|reconciliation)\.ts$/.test(name)),'The Wordgard module must hold Wordgard only.');
assert.match(wordgardModule.source,new RegExp(`^var ${WORDGARD_GLOBAL} = \\(\\(\\) => \\{`,'mu'),'The Wordgard module sets one global.');
assert.ok(wordgardModule.source.split('\n').length>1000,'The Wordgard module stays readable (not minified).');
assert.equal((wordgardModule.source.match(/createPolicy\(/gu)||[]).length,1,'One Trusted Types policy for HTML parsing, in the Wordgard module.');
assert.doesNotMatch(committed,/createPolicy\(/u,'The editor module reuses the Wordgard module\'s HTML parser.');
for(const suffix of ['table/cellselection.ts','table/correct.ts','table/tablepaste.ts'])
  assert.ok(wordgardModule.inputs.some(name=>name.endsWith(`vendor/wordgard/src/${suffix}`)),`Canonical table support missing from the Wordgard module: ${suffix}`);
for(const unused of ['editor/dialog.ts','editor/menubar.ts','editor/panel.ts','editor/tooltip.ts','editor/dropcursor.ts'])
  assert.ok(!wordgardModule.inputs.some(name=>name.endsWith(`vendor/wordgard/src/${unused}`)),`Unused Wordgard UI module entered the Wordgard module: ${unused}`);
const [generatedExportWorker,generatedImageWorker,generatedAttachmentWorker]=await Promise.all([buildExportWorkerBundle(),buildImageWorkerBundle(),buildAttachmentWorkerBundle()]);
assert.equal(generatedExportWorker.source,fs.readFileSync('source/external/export-worker.js','utf8'),'Portable worker must reproduce from its shared sources.');
assert.equal(generatedImageWorker.source,fs.readFileSync('source/external/image-worker.js','utf8'),'Image worker must reproduce from its shared source.');
assert.equal(generatedAttachmentWorker.source,fs.readFileSync('source/external/attachment-worker.js','utf8'),'Attachment ingest worker must reproduce from its shared source.');
assert.ok(!generatedExportWorker.inputs.some(name=>/vendor\/wordgard|node_modules/.test(name)),'Export worker must not include editor or dependencies.');
assert.ok(!generatedImageWorker.inputs.some(name=>/vendor\/wordgard|node_modules/.test(name)),'Image worker must not include editor or npm dependencies.');
assert.ok(!generatedAttachmentWorker.inputs.some(name=>/vendor\/wordgard|node_modules/.test(name)),'Attachment worker must not include editor or npm dependencies.');
const committedSearchWorker=fs.readFileSync(path.join(root,'source/external/search-worker.js'),'utf8');
const generatedSearchWorker=await buildSearchWorkerBundle();
assert.equal(generatedSearchWorker.source,committedSearchWorker,'Committed notes search worker is not reproducible from the declared build pipeline.');
assert.ok(generated.inputs.some(name=>/vendor\/wordgard\/src\/editor\/editor\.ts$/.test(name)));
for(const suffix of ['table/cellselection.ts','table/correct.ts','table/tablepaste.ts'])
  assert.ok(generated.inputs.some(name=>name.endsWith(`vendor/wordgard/src/${suffix}`)),`Canonical table support missing: ${suffix}`);
assert.ok(generated.inputs.some(name=>/rich-text\/wordgard-source\/editor\.ts$/.test(name)));
assert.ok(generated.inputs.some(name=>/rich-text\/reconciliation\.ts$/.test(name)),'CR3 runtime must include the CR2 comparison engine.');
for(const unused of ['editor/dialog.ts','editor/menubar.ts','editor/panel.ts','editor/tooltip.ts','editor/dropcursor.ts'])
  assert.ok(!generated.inputs.some(name=>name.endsWith(`vendor/wordgard/src/${unused}`)),`Unused Wordgard UI module entered the production bundle: ${unused}`);
assert.ok(!generated.inputs.some(name=>/vendor\/wordgard\/dist\//.test(name)),'Rich runtime fell back to flattened Wordgard dist modules.');
assert.ok(generated.inputs.some(name=>/node_modules\/style-mod\//.test(name)));
assert.doesNotMatch(generated.source,/SDRTE1:|study-director-rich-text-v1/);
assert.doesNotMatch(generated.source,/data:image|readAsDataURL|toDataURL|FileReader|indexedDB/i);
assert.doesNotMatch(generated.source,/\bexport\s*\{/);
assert.ok(generatedSearchWorker.inputs.some(name=>/rich-text\/wg1-codec\.ts$/.test(name)));
assert.doesNotMatch(generatedSearchWorker.source,/GardState|Wordgard|indexedDB|localStorage|querySelector|createElement|window\./i);
console.log(JSON.stringify({status:'PASS',release:releaseConfig.release,engine:'wordgard',inputs:generated.inputs.length,...generated.metrics,exportWorker:{inputs:generatedExportWorker.inputs.length,...generatedExportWorker.metrics},imageWorker:{inputs:generatedImageWorker.inputs.length,...generatedImageWorker.metrics},attachmentWorker:{inputs:generatedAttachmentWorker.inputs.length,...generatedAttachmentWorker.metrics},searchWorker:{inputs:generatedSearchWorker.inputs.length,...generatedSearchWorker.metrics}},null,2));
