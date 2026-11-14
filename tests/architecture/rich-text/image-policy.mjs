import {readHostHtml} from '../../../build/host-source.mjs';
import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PRODUCTION_LIMITS} from '../../../contracts/production-limits.mjs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';

const processing=fs.readFileSync('rich-text/image-processing.ts','utf8');
const editor=fs.readFileSync('rich-text/editor.ts','utf8');
const app=readHostHtml();
const bootstrap=readScript('source/core/data-bootstrap-host.ts');
const attachments=readScript('source/core/attachments.ts');
const codec=readScript('source/core/backup-codec.ts');
const richBundle=richTextRuntimeSource();
const imageWorker=fs.readFileSync('source/external/image-worker.js','utf8');

assert.equal(PRODUCTION_LIMITS.richAssetMaxBytes,12*1024*1024);
assert.equal(PRODUCTION_LIMITS.richAssetMaxDimensionPx,4096);
assert.equal(PRODUCTION_LIMITS.richAssetMaxPixels,12*1024*1024);
assert.equal(PRODUCTION_LIMITS.attachmentPdfAudioMaxBytes,2*1024*1024*1024);
assert.match(processing,/Math\.min\(1,limits\.richAssetMaxDimensionPx\/width,limits\.richAssetMaxDimensionPx\/height,Math\.sqrt\(limits\.richAssetMaxPixels\/\(width\*height\)\)\)/u);
assert.match(processing,/if\(scale>=1\)return \{blob:original,width,height\}/u,'Within-budget images must preserve their original stored bytes.');
assert.match(editor,/Image is too large \(12 MiB maximum\)\./u);
assert.match(app,/attachments:AttachmentsModule/u,'Host must pass the checked attachment provider into data-bootstrap configuration.');
assert.match(bootstrap,/input\.attachments\.limits\?\.maxImage!==APP_LIMITS\.richAssetMaxBytes\|\|input\.attachments\.limits\?\.maxPdfAudio!==APP_LIMITS\.attachmentPdfAudioMaxBytes/u,'Data-bootstrap owner must fail closed if attachment limits drift.');
assert.match(attachments,/MAX_IMAGE=12\*MiB,MAX_PDF_AUDIO=2\*GiB/u);
assert.match(codec,/size>backupMaxAssetBytes\(mimeType\)/u,'Portable backup descriptors must enforce media-specific file ceilings.');
for(const bundle of [richBundle,imageWorker]){
  assert.match(bundle,/richAssetMaxBytes:12582912/u);
  assert.match(bundle,/richAssetMaxDimensionPx:4096/u);
  assert.match(bundle,/richAssetMaxPixels:12582912/u);
}
console.log(JSON.stringify({status:'PASS',suite:'image-policy',imageMiB:12,maxDimensionPx:4096,maxPixels:12*1024*1024,pdfAudioGiB:2,originalsPreservedWithinBudget:true},null,2));
