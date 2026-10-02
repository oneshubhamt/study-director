# Study Director — Verification and Release Procedure

This document records the current QA and release discipline. It is intentionally short and current-state focused.

## 1. Development cycle

For each meaningful change:

1. audit the affected implementation and contracts;
2. state objective, scope and invariants;
3. implement the smallest coherent change;
4. verify that the objectives were actually met;
5. run targeted QA for every affected surface and boundary;
6. run broader/full QA after substantial cumulative or architectural change.

Do not treat a failing test as something to silence. Determine whether source or test is stale first, then correct the appropriate side.

## 2. Targeted QA

Choose tests according to changed behavior rather than file count. Examples:

- persistence/codec changes → repository, migration, recovery and import tests;
- backup/provider changes → backup, Drive/Device transport, managed repository, maintenance and recovery tests;
- Active Session/Timer changes → session lifecycle, timer state/engine, restore and mutation-protection tests;
- Plan/Review/Library changes → their unit/integration tests plus affected persistence or protection contracts;
- UI/responsive changes → presentation architecture tests and browser/device checks when the environment permits them;
- build/module changes → syntax, architecture, generated syntax, build verification and deployment contract.

## 3. Core governed commands

```bash
npm run test:unit
npm run test:integration
npm run test:architecture
```

For release/build boundaries:

```bash
npm run test:release:syntax
npm run build
npm run test:release:generated-syntax
npm run verify
npm run stage:firebase:minified
npm run test:release:minified
npm run test:release:budgets
npm run test:release:compression
npm run test:release:deployment
```

Coverage/mutation/browser suites are additional gates when the change or release policy requires them and the environment supports them.

## 4. Environment honesty

Do not report browser smoke as passed when browser navigation is unavailable. Do not report external/network dependency assurance as passed when network access is unavailable. Local lockfile/inventory/provenance checks may be run separately when useful, but should be described accurately.

## 5. Build outputs

`npm run build` generates canonical build output under `dist/`.

`npm run stage:firebase:minified` generates a self-contained Firebase project and minified deployment directory under `dist/`. These are generated artifacts and must not be committed back into the source package.

The Firebase staging process verifies that the public inventory exactly matches the deployment build and that Firebase project configuration stays outside the public directory.

## 6. Packaging checks

Before distributing source:

- release identity matches `release.config.mjs`;
- no `node_modules/`;
- no generated `dist/`;
- no temporary QA/coverage output;
- no historical per-pass closure/plan artifacts;
- current README/architecture/verification docs are present;
- archive contents are inspected after packaging.

Before distributing deployment:

- generate it from the same source package;
- run build/generated-syntax/build-verification/deployment-contract checks;
- package the generated deployment directory as-is;
- do not hand-edit minified public files.

## 7. Current correction scope and safety objectives

SDVB75F10 changes background data safety at three boundaries: attachment reachability, Library-clear rollback and backup deletion reconciliation. It retains the existing bounded cleanup, retry and foreground-preemption architecture. PWA behaviour is outside this correction pass.

The acceptance invariants are:

1. Attachment removal requires a complete, current reference inventory. An unavailable source, even with usable older rescue data, authorizes no removal and retains retry intent.
2. Library mutation requires a complete durable rollback image before deletion. Its recovery journal retires only after strict read-back verifies restoration. Unknown state must preserve the journal and block further destructive work.
3. A canonical backup requires successful deletion reconciliation and readable canonical ledgers. False, missing and thrown settlement results forbid canonical publication. A deliberate rescue export must report uncertain deletion state. Earlier settlement is not a substitute for proof at capture time.
4. Known-empty data remains valid. After a transient failure clears, cleanup, rollback and backup capture must succeed with exact intended data and no lost pending intent.

Integration tests group fault matrices by these contracts, using actual repository readers, cleanup storage, reference scanners and recovery journals. Collector safety and reliability share one suite; capture safety lives in the backup integration category. Existing transaction-phase, bounded-work, ownership and source-fencing tests remain complementary.

Run explicit affected files through the existing hermetic runner:

```bash
npm run test:targeted -- tests/integration/storage/background-gc-reliability.mjs tests/integration/library/library-clear.mjs tests/integration/backup/capture-safety.mjs
```

The same runner accepts selected unit and architecture files, validates each path, isolates each test and checks that execution does not modify the source tree. No default command was changed to run fewer tests.

For this pass, run targeted checks only. Browser smoke, device/provider acceptance, complete regression, dependency rebuilding and production minification are intentionally outside the scope. Source build and archive verification are separate local checks. Exact executed paths, results and mutation-control evidence belong in the accompanying external correction evidence, not in this source tree.
