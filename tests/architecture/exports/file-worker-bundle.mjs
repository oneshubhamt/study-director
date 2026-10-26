import assert from 'node:assert/strict';
import fs from 'node:fs';

// The file worker is one build: integrity checks share its checksum and
// encryption code instead of carrying a second copy.
const worker=fs.readFileSync('source/external/export-worker.js','utf8'),entry=fs.readFileSync('portable/worker.ts','utf8');
assert.equal((worker.match(/1116352408|0x428a2f98/gu)||[]).length,1,'the file worker carries one copy of SHA-256');
assert.doesNotMatch(worker,/companion/u,'no second bundle is appended to the file worker');
assert.match(entry,/startsWith\('integrity\.'\)[\s\S]*integrityRequest\(type,data\)[\s\S]*integritySegment\(request.type,request.data\)/u,'the worker entry routes integrity checks itself');
assert.equal(fs.existsSync('build/integrity-worker-companion.mjs'),false,'the companion generator is gone');
console.log(JSON.stringify({status:'PASS',suite:'file-worker-bundle',bytes:worker.length}));
