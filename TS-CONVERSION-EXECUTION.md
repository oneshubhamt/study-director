# TypeScript conversion — current execution record

**Working branch: `ts-exp`. P5.0–P5.1 VERIFIED — TARGETED; P5.2 ACTIVE with P5.2-capabilities VERIFIED — TARGETED. Next: P5.2-profiles.** P5.2 implementation baseline is `d3f69c4`; capability implementation endpoint is `0271ea4`. Preserve `TS-Conversion` and main. Follow the sole-implementor and end-of-Phase-5 audit arrangement in [AGENTS](AGENTS.md). Main intake endpoint remains `2638619`.

Read [AGENTS](AGENTS.md) and the assigned rows of [Phase 5](docs/typescript/PHASE-5.md), then inspect current source. Consult [decisions](docs/typescript/DECISIONS.md), [tooling](docs/TYPESCRIPT.md), [verification commands](docs/VERIFICATION.md) and [product docs](docs/README.md) as needed. Do not reload historical logs for routine passes.

## Programme state

| Stage | State / next action |
| --- | --- |
| Preparation, Phases 1–4 | Complete within recorded scope at `4136ba5`: 34 Phase 4 modules, 126 strict files, zero unchecked existing TS at last check. [Evidence](docs/typescript/HISTORY-PREPARATION-PHASE-4.md) |
| Phase 5 — host/features | P5.0–P5.1 verified; P5.2 active: capabilities verified, profiles next, then data bootstrap and startup. Later steps unstarted. [Scope/status register](docs/typescript/PHASE-5.md) |
| Phase 6 — tooling/tests | Not started; convert remaining tooling/tests and retire transitional readers |
| Phase 7 — certification | Not started; whole-app reconciliation and full correctness, coverage, mutation, browser, release and performance QA |

## Open obligations

| ID | Owner / remaining work |
| --- | --- |
| F-001 | Each Phase 5 pass: refresh its host/function anchors against current source; old P5.0 line ranges are historical. Include its callers, action handlers and shared assembly callbacks. P5.13 reconciles total remaining ownership |
| F-002 | Phase 6: retire transitional substring/VM readers and reconcile authored coverage; P5 conversions must keep their readers working meanwhile |
| F-003 | Phase 7: full certification, with unavailable manual/device evidence stated separately |
| REVIEW-P5 | Independent planning-assistant audit after all Phase 5 outcomes, including P5.13 reconciliation. Compare against `de4872a`; retain inherited limitations and intentional changes. No external review gate between implementation passes |

## Latest closed worklog — P5.2-capabilities

- **Baseline / scope:** `d3f69c4` on `ts-exp`; refreshed current capability/module/host/test anchors before editing. Owned scope: `native-capabilities`, scheduler/browser ports, capability presentation/storage/install/wake/badge host wiring. Parent P5.2 remains open.
- **Implemented:** renamed the runtime to strict `source/core/native-capabilities.ts`; added typed browser/native ports and closed registry/compiler fixtures. Added checked `capabilities-host.ts` factories for UI projection, storage inspection/protection, installation actions, controller construction and active-session badge wiring; removed the corresponding duplicate/untyped host logic. Manifest, registry and explicit TS admission now use the TS implementations.
- **Behavior / fixes:** preserved deferred controller access, storage persistence request/retry, wake-lock lifecycle/reacquisition, install guidance, badge best effort and unsupported fallbacks. Malformed install-prompt events without a callable `prompt()` are now ignored instead of being retained as usable prompts. Rejected persistence, related-app, badge, wake-lock and install-prompt APIs remain contained and diagnosed.
- **Objective reconciliation:** baseline→`0271ea4` changes only the capability module/adapter, owned host composition, typed contracts/fixture, manifest/registry admission and capability regression test. Git recognizes `native-capabilities.js`→`.ts` as a rename; old host rendering/storage-estimate implementations no longer remain in `main.js`.
- **Pinned toolchain / hosted QA PASS:** Repository checks run **1357** at `0271ea4` used Node 26.12.1/npm 12.2.1. `npm run check:types` PASS — 146 checked files, zero unchecked TS; typed lint 0 warnings/errors. Targeted repository safety contracts PASS; source build, `verify-build` and generated-syntax verification PASS.
- **Runtime QA PASS:** capability-specific runtime harness covered scheduler postTask/yield/fallback/cancellation/budget, storage success/denial, wake lifecycle, install positive/malformed/rejected paths, badge best effort, rejected APIs and checked UI projection. Supplemental local runtime was Node 22 and is not substituted for the pinned compiler/build evidence.
- **Browser QA PASS / limit:** Chromium 144 capability harness passed actual DOM projection, supported/unsupported storage/wake presentation, persistence success/rejection, malformed install handling and projection de-duplication with no browser exceptions. The named full-app `browser/app/core-flow` and `browser/ui/interactions` journeys could not be run here because this runtime had no materialized repository/dist and localhost navigation is administrator-blocked; no claim is made for those two journeys or physical-device install/wake APIs. Phase 7 retains full browser/device certification.
- **Failures repaired:** initial run 1355 exposed one unsafe-any lint narrowing and was fixed without weakening validation. Run 1356 then passed strict types/lint but an unrelated existing backup checkpoint stress assertion missed its timing target; no out-of-scope backup change was made. Current-head run 1357 passed the same repository checks.
- **Next:** P5.2-profiles. P5.2 does not close until profiles, data bootstrap and startup/integration are verified.

## Recording subsequent passes

Replace the active entry with a short baseline, complete objectives, material findings/decisions, changes, actual commands/results and next action. Use existing objective IDs. Keep unresolved obligations above until closed. Update scope/status only in the phase register; link to evidence rather than duplicating tables. Save detailed history through a pinned commit when replacing an entry.

Statuses: NOT STARTED → ACTIVE → IMPLEMENTED — QA PENDING → VERIFIED — TARGETED. BLOCKED names the obstacle and unfinished objectives. Verification requires source/objective reconciliation and passing required checks. Reopen a claim if current evidence contradicts it; never hide incomplete work under a completed parent.

## Historical evidence — read only when relevant

- [P5.1 implementation and verification at `de4872a`](https://github.com/oneshubhamt/study-director/blob/de4872a88c2015bc8833e0244c0ab8ce6e6b5998/TS-CONVERSION-EXECUTION.md#latest-closed-worklog--p51): seven strict core modules plus foundation host adapters; 141 checked files, 102 targeted tests and 28 valid browser runs. Includes repaired failures, stale-build evidence correction and remaining certification limits.
- [Documentation consolidation, P5.0, main intake and merge verification at `b4e4cfd`](https://github.com/oneshubhamt/study-director/blob/b4e4cfd716626c55fd713f3565837ac7f9e70a95/TS-CONVERSION-EXECUTION.md): complete observations, commands, failures/corrections and publication evidence.
- [Historical P5.0 host/reader inventory](https://github.com/oneshubhamt/study-director/blob/b4e4cfd716626c55fd713f3565837ac7f9e70a95/docs/typescript/PHASE-5.md#extracted-host-ownership--historical-p50-baseline): original 117 ranges / 1,005 statements and 42 readers; not current anchors.
- [Preparation / Phases 1–4](docs/typescript/HISTORY-PREPARATION-PHASE-4.md) and [protected pre-intake snapshot](docs/typescript/snapshots/main-intake-2026-11-08/README.md).
