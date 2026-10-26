import {WORDGARD_METADATA} from '../build/wordgard-metadata.mjs';
const dependency=(name,version,use,direct,license)=>Object.freeze({name,version,use,direct,license,shipped:use==='bundled-runtime'});

export const DEPENDENCY_INVENTORY=Object.freeze([
  dependency('@jridgewell/gen-mapping','0.3.13','build-only',false,'MIT'),
  dependency('@jridgewell/resolve-uri','3.1.2','build-only',false,'MIT'),
  dependency('@jridgewell/source-map','0.3.11','build-only',false,'MIT'),
  dependency('@jridgewell/sourcemap-codec','1.6.0','build-only',false,'MIT'),
  dependency('@jridgewell/trace-mapping','0.3.31','build-only',false,'MIT'),
  dependency('@marijn/find-cluster-break','1.0.4','bundled-runtime',true,'MIT'),
  dependency('acorn','8.19.0','build-only',true,'MIT'),
  dependency('axe-core','4.14.0','test-only',true,'MPL-2.0'),
  dependency('buffer-from','1.1.2','build-only',false,'MIT'),
  dependency('commander','2.20.3','build-only',false,'MIT'),
  dependency('esbuild-wasm','0.28.2','build-only',true,'MIT'),
  dependency('source-map','0.6.1','build-only',false,'BSD-3-Clause'),
  dependency('source-map-support','0.5.21','build-only',false,'MIT'),
  dependency('style-mod','4.1.4','bundled-runtime',true,'MIT'),
  dependency('terser','5.51.2','build-only',true,'BSD-2-Clause')
]);

export const VENDORED_DEPENDENCIES=Object.freeze([
  Object.freeze({
    name:'wordgard-source',version:WORDGARD_METADATA.version,use:'bundled-runtime',license:'MIT',
    path:'vendor/wordgard',notice:'source/assets/licenses/Wordgard-MIT.txt',
    packages:Object.freeze(['wordgard'])
  })
]);

export const DEPENDENCY_AUDIT_POLICY=Object.freeze({
  failSeverities:Object.freeze(['high','critical']),
  waiverSeverities:Object.freeze(['moderate']),
  moderateWaivers:Object.freeze([])
});
