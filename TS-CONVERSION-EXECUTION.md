# TypeScript conversion — current execution record

**Working branch: `ts-exp`. P5.0–P5.1 VERIFIED — TARGETED; P5.2 ACTIVE with P5.2-capabilities, P5.2-profiles and P5.2-data-bootstrap VERIFIED — TARGETED. Next: P5.2-startup.** P5.2 implementation baseline is `d3f69c4`; the data-bootstrap pass baseline is `6a46b71` and targeted-QA endpoint is `2debb6c`. Preserve `TS-Conversion` and main. Follow the sole-implementor and end-of-Phase-5 audit arrangement in [AGENTS](AGENTS.md). Main intake endpoint remains `2638619`.

Read [AGENTS](AGENTS.md) and the assigned rows of [Phase 5](docs/typescript/PHASE-5.md), then inspect current source. Consult [decisions](docs/typescript/DECISIONS.md), [tooling](docs/TYPESCRIPT.md), [verification commands](docs/VERIFICATION.md) and [product docs](docs/README.md) as needed. Do not reload historical logs for routine passes.

## Programme state

| Stage | State / next action |
| --- | --- |
| Preparation, Phases 1–4 | Complete within recorded scope at `4136ba5`: 34 Phase 4 modules, 126 strict files, zero unchecked existing TS at last check. [Evidence](docs/typescript/HISTORY-PREPARATION-PHASE-4.md) |
| Phase 5 — host/features | P5.0–P5.1 verified; P5.2 active: capabilities, profiles and data bootstrap verified; startup next. Later steps unstarted. [Scope/status register](docs/typescript/PHASE-5.md) |
| Phase 6 — tooling/tests | Not started; convert remaining tooling/tests and retire transitional readers |
| Phase 7 — certification | Not started; whole-app reconciliation and full correctness, coverage, mutation, browser, release and performance QA |

## Open obligations

| ID | Owner / remaining work |
| --- | --- |
| F-001 | Each Phase 5 pass: refresh its host/function anchors against current source; old P5.0 line ranges are historical. Include its callers, action handlers and shared assembly callbacks. P5.13 reconciles total remaining ownership |
| F-002 | Phase 6: retire transitional substring/VM readers and reconcile authored coverage; P5 conversions must keep their readers working meanwhile |
| F-003 | Phase 7: full certification, with unavailable manual/device evidence stated separately |
| REVIEW-P5 | Independent planning-assistant audit after all Phase 5 outcomes, including P5.13 reconciliation. Compare against `de4872a`; retain inherited limitations and intentional changes. No external review gate between implementation passes |

## Latest closed worklog — P5.2-data-bootstrap

- **Baseline / scope:** `6a46b71` on `ts-exp`; refreshed current build-injected configuration, profile-scoped durable identities, installation identity, IndexedDB/AppData construction, typed appMeta ownership, unsupported-current-data census and their architecture/integration/browser consumers before editing. Parent P5.2 remains open.
- **Implemented:** added strict `source/core/data-bootstrap-host.ts` with checked contracts/negative fixtures and admitted it through the manifest/browser registry. The boundary now owns build-injected runtime configuration validation and freezing, non-device-wide localStorage scoping, database/store/schema derivation, production-limit parity, `InstallationIdentity`, device/backup naming, IndexedDB construction, appMeta gateway/validator-owner binding, RepositoryJournals/AppData composition and the unsupported-data census/notice controller. Existing checked persistence, repository, codec and journal engines were consumed unchanged rather than reimplemented.
- **Preserved invariants:** device-wide localStorage names remain unscoped while all profile-owned names follow `ProfileScope`; the first profile keeps canonical plain names; the local-recovery schema key follows the scoped recovery key; IndexedDB name/version/stores and attachment/backup identities still derive from canonical build contracts; installation identity and site-data-clear restoration remain owned by the existing persistence engine; current-data validation, newer/unknown-data hold semantics, summary/day coupling, storage-health callbacks and repository recovery hooks are unchanged.
- **Host/readers cleanup:** the duplicated raw construction blocks were removed from `host/main.js`; only the build-token injection seam remains there. `canonical-baseline` now exercises the checked unsupported-data factory directly, while the data-architecture contract verifies canonical tokens enter the typed boundary and are frozen/scoped there. No old direct `createInstallationIdentity`, `createIndexedDb`, appMeta, journal, AppData or unsupported-data composition remains in the host.
- **Pinned targeted QA PASS:** repository run **1371, attempt 2** at `2debb6c` used Node 26.12.1/npm 12.2.1. Strict typecheck and typed lint passed **155 checked files, zero unchecked TS, zero warnings/errors**; repository safety contracts, source build, generated-build verification and generated syntax all passed.
- **Bootstrap-specific tests PASS:** `integration/storage/canonical-baseline` (including canonical census), `installation-identity`, `appmeta-contract`, `indexeddb-topology-retirement`, `unit/storage/indexeddb-durability`, and the `data-architecture`, `persistence-boundary` and `runtime-authority-contract` architecture checks all passed.
- **Fresh-build browser QA PASS:** `browser/app/core-flow` passed clean startup, IndexedDB plan/timer/review/save flow and no runtime errors; `canonical-storage` preserved current topology and a note across reload; `storage-failure-recovery` passed localStorage read/write/quota failures, IndexedDB absent/malformed/throwing/blocked/timeout paths, draft/session fallback and recovery; `site-data-clear` passed write-back, backup pause/restore/reload and fresh-install behavior; `unsupported-data` passed seven newer/unknown database, record, setting and profile-list cases without mutating held data.
- **Failures repaired:** run 1365 exposed only new type-contract mistakes and they were corrected without suppressions. Run 1366 then passed strict types/lint but hit the pre-existing `repository-checkpoint` timing assertion. Run 1367 found mechanical duplicate splice markers in generated syntax; source cleanup removed them and run 1369 passed the unchanged normal gate on retry. Targeted run 1370 then found a real startup contract bug: the new adapter froze the appMeta IndexedDB port but not the outer exact input object. Freezing that outer contract fixed startup. Run 1371 attempt 1 again hit only the unrelated checkpoint timing assertion; the unchanged attempt 2 passed the entire targeted suite.
- **Next:** P5.2-startup. P5.2 remains ACTIVE until strict startup lifecycle and its owned activation/ownership/hydration composition are verified.

## Recording subsequent passes

Replace the active entry with a short baseline, complete objectives, material findings/decisions, changes, actual commands/results and next action. Use existing objective IDs. Keep unresolved obligations above until closed. Update scope/status only in the phase register; link to evidence rather than duplicating tables. Save detailed history through a pinned commit when replacing an entry.

Statuses: NOT STARTED → ACTIVE → IMPLEMENTED — QA PENDING → VERIFIED — TARGETED. BLOCKED names the obstacle and unfinished objectives. Verification requires source/objective reconciliation and passing required checks. Reopen a claim if current evidence contradicts it; never hide incomplete work under a completed parent.

## Historical evidence — read only when relevant

- [P5.2-profiles closure at `6a46b71`](https://github.com/oneshubhamt/study-director/blob/6a46b711126a25a1e19de6e4f08397471aadcf69/TS-CONVERSION-EXECUTION.md#latest-closed-worklog--p52-profiles): strict profile registry/scope plus checked first-start, Drive binding and profile lifecycle host adapters; targeted profile and two-browser sync QA.
- [P5.2-capabilities closure at `e9b3894`](https://github.com/oneshubhamt/study-director/blob/e9b3894a5b7e50c48b4bfef80de1bb932e182684/TS-CONVERSION-EXECUTION.md#latest-closed-worklog--p52-capabilities): strict native-capability engine plus checked host adapters; pinned type/build evidence and capability-specific runtime/browser QA.
- [P5.1 implementation and verification at `de4872a`](https://github.com/oneshubhamt/study-director/blob/de4872a88c2015bc8833e0244c0ab8ce6e6b5998/TS-CONVERSION-EXECUTION.md#latest-closed-worklog--p51): seven strict core modules plus foundation host adapters; 141 checked files, 102 targeted tests and 28 valid browser runs. Includes repaired failures, stale-build evidence correction and remaining certification limits.
- [Documentation consolidation, P5.0, main intake and merge verification at `b4e4cfd`](https://github.com/oneshubhamt/study-director/blob/b4e4cfd716626c55fd713f3565837ac7f9e70a95/TS-CONVERSION-EXECUTION.md): complete observations, commands, failures/corrections and publication evidence.
- [Historical P5.0 host/reader inventory](https://github.com/oneshubhamt/study-director/blob/b4e4cfd716626c55fd713f3565837ac7f9e70a95/docs/typescript/PHASE-5.md#extracted-host-ownership--historical-p50-baseline): original 117 ranges / 1,005 statements and 42 readers; not current anchors.
- [Preparation / Phases 1–4](docs/typescript/HISTORY-PREPARATION-PHASE-4.md) and [protected pre-intake snapshot](docs/typescript/snapshots/main-intake-2026-11-08/README.md).
