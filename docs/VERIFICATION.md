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

## 7. Historical SDVB75F10 correction scope and safety objectives

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

For that historical SDVB75F10 correction pass, only targeted checks were requested. This limitation does not apply to later full Promotion QA or release certification. Source build and archive verification are separate local checks. Exact executed paths, results and mutation-control evidence belong in the accompanying external correction evidence, not in this source tree.

## 8. Backup and background-services certification (October 2026)

Check that repository checks and **full Promotion QA** both finish successfully on the exact source revision. Promotion includes hermetic tests, risk coverage, mutation certification, AST branch-edge coverage, non-browser release certification, all browser journeys and separate Insights performance samples. Repository checks are not a substitute for Promotion QA. Classify failures by original step rather than suppressing them; an unrelated Library browser failure still means the complete browser gate did not pass.

The authoritative fault-injection suites are `backup-persistence` (standalone rollback and journal phases), `pending-provider-recovery` (independent source/peer restart convergence), `repository-checkpoint` (retention, shared-object GC, long-lived background/foreground coordination, paginated Drive discovery), `repository-restore` and `restore-assets` (interrupted managed restore), `device-folder-storage` (immutable publication/replay/collision), `drive-security` (resumable acknowledgement and authorization expiry), and `automatic-provider-backup` (cadence, backoff and actual diagnostics trigger). Keep tests with existing owners. The 1,000- and 10,000-version retention timings and assembled Drive cleanup wall timings are printed by `repository-checkpoint`; these are controlled simulation benchmarks, not representative physical-device latency measurements.

**Physical-device acceptance is separate and requires an operator.** On a supported desktop Chromium installation with an authorized Device Folder, one installed Android PWA, and an iPad/iOS Safari installation where applicable, test with disposable records and a separate verified safety backup: cold start, permission persistence/regrant, suspend/resume and idle battery/heat, small and large Drive transfers, interrupted/retried restore retaining Before Restore protection, interrupted retention cleanup, offline-to-online convergence, and update with an active backup. Record record/attachment equality before and after restore. Mark unsupported native storage APIs as *unsupported*, not passed. CI cannot certify hardware-level power loss or filesystem synchronization.

**Security decision:** Drive retains a short-lived `drive.file` bearer token in origin-local `localStorage` across reloads but does not store a refresh token. See `BACKUP-ENGINE.md` for the script-exposure trade-off. Revisit persistence versus reauthorization only as an explicit product/security decision.

**Cleanup policy:** Remove only proven unreachable/dead logic with regression evidence. Label historical notes as historical; do not delete compatibility and migration code without proving the persisted-data population no longer needs it.
