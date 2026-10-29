import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const processing=read('portable/processing.ts');
const attachments=read('source/core/attachments.ts');
const exportsModule=read('source/core/exports.ts');

assert.doesNotMatch(processing,/attachment\.hash/,'Portable export processing must not expose an ingestion-sounding attachment.hash operation.');
assert.match(processing,/"file\.hash":async/,'Portable processing must expose file.hash for portable attachment-archive verification.');
assert.doesNotMatch(attachments,/processing\.run\('attachment\.hash'/,'Attachment archive export must not call the obsolete attachment.hash operation.');
assert.match(attachments,/processing\.run\('file\.hash'/,'Attachment archive export/verification must use file.hash.');
assert.doesNotMatch(exportsModule,/type==='attachment\.hash'/,'Export coordinator timeout policy must not reference the obsolete attachment.hash operation.');
assert.match(exportsModule,/const progressBound=type==='file\.hash'\|\|type==='equalFiles'/,'File hashing must use the progress-watchdog path rather than a fixed total timeout.');
assert.match(exportsModule,/stallTimeoutMs=progressBound\?30000:120000/,'File hashing must retain a bounded stall watchdog while allowing total duration to scale with progress.');

console.log(JSON.stringify({status:'PASS',suite:'export-hash-boundary',pass:'export hash responsibility boundary'},null,2));
