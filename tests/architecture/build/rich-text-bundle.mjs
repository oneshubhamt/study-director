import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildAttachmentWorkerBundle,buildExportWorkerBundle,buildImageWorkerBundle,buildSearchWorkerBundle,buildWordgardBundle} from '../../../build/wordgard-bundle.mjs';
import releaseConfig from '../../../release.config.mjs';

const root=process.cwd();
const committed=fs.readFileSync(path.join(root,'source/external/rich-text.js'),'utf8');
const generated=await buildWordgardBundle();
const [generatedExportWorker,generatedImageWorker,generatedAttachmentWorker]=await Promise.all([buildExportWorkerBundle(),buildImageWorkerBundle(),buildAttachmentWorkerBundle()]);
assert.equal(generatedExportWorker.source,fs.readFileSync('source/external/export-worker.js','utf8'),'Portable worker must reproduce from its shared sources.');
assert.equal(generatedImageWorker.source,fs.readFileSync('source/external/image-worker.js','utf8'),'Image worker must reproduce from its shared source.');
assert.equal(generatedAttachmentWorker.source,fs.readFileSync('source/external/attachment-worker.js','utf8'),'Attachment ingest worker must reproduce from its shared source.');
assert.ok(!generatedExportWorker.inputs.some(name=>/vendor\/wordgard|node_modules/.test(name)),'Export worker must not include editor or dependencies.');
assert.ok(!generatedImageWorker.inputs.some(name=>/vendor\/wordgard|node_modules/.test(name)),'Image worker must not include editor or npm dependencies.');
assert.ok(!generatedAttachmentWorker.inputs.some(name=>/vendor\/wordgard|node_modules/.test(name)),'Attachment worker must not include editor or npm dependencies.');
const committedSearchWorker=fs.readFileSync(path.join(root,'source/external/search-worker.js'),'utf8');
const generatedSearchWorker=await buildSearchWorkerBundle();
assert.equal(generated.source,committed,'Committed Wordgard rich-text runtime is not reproducible from the declared build pipeline.');
assert.equal(generatedSearchWorker.source,committedSearchWorker,'Committed Ongoing Notes search worker is not reproducible from the declared build pipeline.');
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
