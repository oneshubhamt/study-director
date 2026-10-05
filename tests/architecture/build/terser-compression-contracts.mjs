import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSearchWorkerBundle,buildWordgardBundle} from '../../../build/wordgard-bundle.mjs';

const buildSource=fs.readFileSync('build/wordgard-bundle.mjs','utf8');
const bundle=await buildWordgardBundle();
const searchWorker=await buildSearchWorkerBundle();

// Retain editor semantics while admitting the reviewed CR2/CR3 reconciliation engine module and
// the adapter's cut handling, which replaced a rewrite of upstream input.ts.
assert.ok(bundle.inputs.length<=66,`Wordgard/reconciliation boundary unexpectedly widened the reviewed graph: ${bundle.inputs.length} modules.`);
for(const retained of [
  'vendor/wordgard/src/table/cellselection.ts',
  'vendor/wordgard/src/table/correct.ts',
  'vendor/wordgard/src/table/tablepaste.ts',
  'vendor/wordgard/src/history/history.ts',
  'rich-text/wordgard-patches/cut.ts'
]) assert.ok(bundle.inputs.some(name=>name.endsWith(retained)),`Pass E lost retained editor semantics: ${retained}`);

// Conservative Terser compression: safe defaults, two passes, function arity preserved.
assert.match(buildSource,/compress:\{passes:2,unsafe:false,keep_fargs:true\}/u);
assert.match(buildSource,/mangle:true/u);
assert.doesNotMatch(buildSource,/mangle\s*:\s*\{[^}]*properties/u,'Pass E must not property-mangle public/runtime object keys.');
assert.doesNotMatch(buildSource,/\b(?:unsafe_arrows|unsafe_comps|unsafe_Function|unsafe_math|unsafe_methods|unsafe_proto|unsafe_regexp|unsafe_symbols|unsafe_undefined)\s*:\s*true\b/u);
assert.doesNotMatch(buildSource,/\btoplevel\s*:\s*true\b/u,'Pass E must not introduce top-level mangling/compression.');

// The reviewed graph remains bounded. CR3 intentionally loads the pure CR2 reconciliation engine
// into the editor runtime for scratch-note comparison while Wordgard upstream remains unchanged.
// Ancestor-aware three-way reconciliation and the read-only imported editor define the current graph;
// grouped publishing for large documents added about 0.2 KB, and cut handling as an adapter
// extension instead of an upstream rewrite about 0.2 KB more. Keep a tight 108,400 B Brotli ceiling
// around the reviewed baseline so future growth requires explicit review.
assert.ok(bundle.metrics.brotli<=108400,`Rich-text Brotli bundle exceeded the reviewed reconciliation ceiling: ${bundle.metrics.brotli} bytes.`);

console.log(JSON.stringify({
  status:'PASS',
  suite:'terser-compression-contracts',
  pass:'E',
  strategy:'two-pass conservative Terser compression',
  modules:bundle.inputs.length,
  ...bundle.metrics,
  searchWorker:{modules:searchWorker.inputs.length,...searchWorker.metrics},
  safety:['unsafe=false','keep_fargs=true','no property mangling','no top-level mangling']
},null,2));
