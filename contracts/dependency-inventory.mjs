import {WORDGARD_METADATA} from '../build/wordgard-metadata.mjs';
const dependency=(name,version,use,direct,license)=>Object.freeze({name,version,use,direct,license,shipped:use==='bundled-runtime'});

export const DEPENDENCY_INVENTORY=Object.freeze([
  dependency('@jridgewell/gen-mapping','0.3.13','build-only',false,'MIT'),
  dependency('@jridgewell/resolve-uri','3.1.2','build-only',false,'MIT'),
  dependency('@jridgewell/source-map','0.3.11','build-only',false,'MIT'),
  dependency('@jridgewell/sourcemap-codec','1.6.0','build-only',false,'MIT'),
  dependency('@jridgewell/trace-mapping','0.3.31','build-only',false,'MIT'),
  dependency('@marijn/find-cluster-break','1.0.4','bundled-runtime',true,'MIT'),
  dependency('acorn','8.18.0','build-only',true,'MIT'),
  dependency('axe-core','4.13.0','test-only',true,'MPL-2.0'),
  dependency('buffer-from','1.1.2','build-only',false,'MIT'),
  dependency('commander','2.20.3','build-only',false,'MIT'),
  dependency('esbuild-wasm','0.28.2','build-only',true,'MIT'),
  dependency('source-map','0.6.1','build-only',false,'BSD-3-Clause'),
  dependency('source-map-support','0.5.21','build-only',false,'MIT'),
  dependency('style-mod','4.1.3','bundled-runtime',true,'MIT'),
  dependency('terser','5.51.2','build-only',true,'BSD-2-Clause'),
  dependency('@oxlint-tsgolint/darwin-arm64','7.0.2005','build-only',false,'MIT'),
  dependency('@oxlint-tsgolint/darwin-x64','7.0.2005','build-only',false,'MIT'),
  dependency('@oxlint-tsgolint/linux-arm64','7.0.2005','build-only',false,'MIT'),
  dependency('@oxlint-tsgolint/linux-x64','7.0.2005','build-only',false,'MIT'),
  dependency('@oxlint-tsgolint/win32-arm64','7.0.2005','build-only',false,'MIT'),
  dependency('@oxlint-tsgolint/win32-x64','7.0.2005','build-only',false,'MIT'),
  dependency('@oxlint/binding-android-arm-eabi','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-android-arm64','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-darwin-arm64','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-darwin-x64','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-freebsd-x64','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-linux-arm-gnueabihf','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-linux-arm-musleabihf','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-linux-arm64-gnu','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-linux-arm64-musl','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-linux-ppc64-gnu','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-linux-riscv64-gnu','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-linux-riscv64-musl','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-linux-s390x-gnu','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-linux-x64-gnu','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-linux-x64-musl','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-openharmony-arm64','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-win32-arm64-msvc','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-win32-ia32-msvc','1.89.0','build-only',false,'MIT'),
  dependency('@oxlint/binding-win32-x64-msvc','1.89.0','build-only',false,'MIT'),
  dependency('@types/node','22.20.5','build-only',true,'MIT'),
  dependency('@typescript/typescript-aix-ppc64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-darwin-arm64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-darwin-x64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-freebsd-arm64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-freebsd-x64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-linux-arm','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-linux-arm64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-linux-loong64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-linux-mips64el','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-linux-ppc64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-linux-riscv64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-linux-s390x','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-linux-x64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-netbsd-arm64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-netbsd-x64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-openbsd-arm64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-openbsd-x64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-sunos-x64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-win32-arm64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('@typescript/typescript-win32-x64','7.0.2','build-only',false,'Apache-2.0'),
  dependency('oxlint','1.89.0','build-only',true,'MIT'),
  dependency('oxlint-tsgolint','7.0.2005','build-only',true,'MIT'),
  dependency('typescript','7.0.2','build-only',true,'Apache-2.0'),
  dependency('undici-types','6.21.0','build-only',false,'MIT')
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
