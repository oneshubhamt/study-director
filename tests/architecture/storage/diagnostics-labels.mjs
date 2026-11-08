import {readHostHtml} from '../../../build/host-source.mjs';
import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Copy diagnostics shows only labels on its allow-lists, so no user content can
// reach it. Every label the code can hand it must therefore be on a list, or it
// shows as "unclassified" / "Error". This scan keeps the lists complete.
const diagnostics=readScript('source/core/backup-operation-diagnostics.ts');
const allowed=name=>new Set(JSON.parse(diagnostics.match(new RegExp(`const ${name}=new Set\\((\\[[^\\]]*\\])\\)`,'u'))[1]));
const lists={reasons:allowed('SAFE_REASONS'),phases:allowed('SAFE_PHASES'),codes:allowed('SAFE_CODES')};
const files=['source/app.html','source/external/drive.js',...fs.readdirSync('source/core').map(file=>'source/core/'+file),...fs.readdirSync('portable').filter(file=>file.endsWith('.js')).map(file=>'portable/'+file)];
const patterns={
  phases:[/\b(?:OperationDiagnostics\.mark|diagnostics\.mark|diagMark)\(\s*'([a-z0-9-]+)'/gu],
  codes:[/\bcode\s*[:=]\s*'([A-Z][A-Z0-9_]{2,})'/gu],
  reasons:[
    /\b(?:reason|trigger|errorReason)\s*:\s*'([a-z][a-z0-9-]*)'/gu,
    /\b(?:wake|wakeBackground|wakeBackgroundOperations|suspend|suspendBackground)\(\s*'([a-z][a-z0-9-]*)'/gu,
    /\bschedule\w*\(\s*[^,()'"]+,\s*'([a-z][a-z0-9-]*)'/gu
  ]
};
// Retry provenance is user-safe diagnostics vocabulary, never arbitrary text.
for(const reason of ["ancestry-incomplete","background-preempted","pending-retry","publication-failure","retry-failure","shared-behind","sync-turn"])assert.ok(lists.reasons.has(reason),`Convergence trigger ${reason} must be visible in safe diagnostics.`);
for(const retired of ["backfill","copy-skipped","spine"])assert.equal(lists.reasons.has(retired),false,`Retired cross-provider reason ${retired} must stay out of current diagnostics.`);
assert.equal(lists.codes.has("REPOSITORY_COPY_UNAVAILABLE"),false,"Retired provider-copy failure code must stay out of current diagnostics.");
const counts={};
for(const [kind,expressions] of Object.entries(patterns)){
  const missing=new Map();let seen=0;
  for(const file of files){const text=(file==='source/app.html'?readHostHtml():fs.readFileSync(file,'utf8'));for(const expression of expressions)for(const match of text.matchAll(expression)){seen++;if(!lists[kind].has(match[1])&&!missing.has(match[1]))missing.set(match[1],file);}}
  assert.deepEqual([...missing].map(([label,file])=>`${label} (${file})`),[],`every diagnostics ${kind.slice(0,-1)} the code uses is on its allow-list`);
  counts[kind]=seen;
}
console.log(JSON.stringify({status:'PASS',suite:'diagnostics-labels',...counts}));
