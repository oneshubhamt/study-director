import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSearchWorkerBundle,buildLeanRichText} from '../../../build/wordgard-bundle.mjs';

const buildSource=fs.readFileSync('build/wordgard-bundle.mjs','utf8');
const bundle=await buildLeanRichText();
const searchWorker=await buildSearchWorkerBundle();

// Retain editor semantics while admitting the reviewed CR2/CR3 reconciliation engine module and
// the adapter's cut handling, which replaced a rewrite of upstream input.ts.
// Wordgard 0.6 moved position sets into their own package (6 modules) and its
// key bindings carry descriptions from its phrase table.
assert.ok(bundle.inputs.length<=77,`Wordgard/reconciliation boundary unexpectedly widened the reviewed graph: ${bundle.inputs.length} modules.`);
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
// extension instead of an upstream rewrite about 0.2 KB more. The 108,400 B ceiling had fallen
// behind (Wordgard 0.5.2 built to 112,189 B); Wordgard 0.6.2 adds about 3.6 KB (its position-set
// package and English phrase table). Keep a tight 116,500 B Brotli ceiling around the reviewed
// baseline so future growth requires explicit review. This is the lean deployment build.
assert.ok(bundle.metrics.brotli<=116500,`Rich-text Brotli bundle exceeded the reviewed reconciliation ceiling: ${bundle.metrics.brotli} bytes.`);

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
