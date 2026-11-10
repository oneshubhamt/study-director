# TypeScript conversion — current execution record

**Working branch: `ts-exp`. P5.0–P5.2 VERIFIED — TARGETED; P5.3 ACTIVE with P5.3A VERIFIED — TARGETED and P5.3B ACTIVE.** P5.3 baseline is `8753895`; P5.3A targeted-QA endpoint is `1f6dd8f`; P5.3B implementation baseline is `0e8714f`. Preserve `TS-Conversion` and main. Follow the sole-implementor and end-of-Phase-5 audit arrangement in [AGENTS](AGENTS.md). Main intake endpoint remains `2638619`.

Read [AGENTS](AGENTS.md) and the assigned rows of [Phase 5](docs/typescript/PHASE-5.md), then inspect current source. Consult [decisions](docs/typescript/DECISIONS.md), [tooling](docs/TYPESCRIPT.md), [verification commands](docs/VERIFICATION.md) and [product docs](docs/README.md) as needed. Do not reload historical logs for routine passes.

## Programme state

| Stage | State / next action |
| --- | --- |
| Preparation, Phases 1–4 | Complete within recorded scope at `4136ba5`: 34 Phase 4 modules, 126 strict files, zero unchecked existing TS at last check. [Evidence](docs/typescript/HISTORY-PREPARATION-PHASE-4.md) |
| Phase 5 — host/features | P5.0–P5.2 verified; P5.3 active with P5.3A Plan authoring/editor verified and P5.3B saved-plan/default composition in progress. Later steps unstarted. [Scope/status register](docs/typescript/PHASE-5.md) |
| Phase 6 — tooling/tests | Not started; convert remaining tooling/tests and retire transitional readers |
| Phase 7 — certification | Not started; whole-app reconciliation and full correctness, coverage, mutation, browser, release and performance QA |

## Open obligations

| ID | Owner / remaining work |
| --- | --- |
| F-001 | Each Phase 5 pass: refresh its host/function anchors against current source; old P5.0 line ranges are historical. Include its callers, action handlers and shared assembly callbacks. P5.13 reconciles total remaining ownership |
| F-002 | Phase 6: retire transitional substring/VM readers and reconcile authored coverage; P5 conversions must keep their readers working meanwhile |
| F-003 | Phase 7: full certification, with unavailable manual/device evidence stated separately |
| REVIEW-P5 | Independent planning-assistant audit after all Phase 5 outcomes, including P5.13 reconciliation. Compare against `de4872a`; retain inherited limitations and intentional changes. No external review gate between implementation passes |

## Active worklog — P5.3B Saved Plans/default composition

- **Baseline / audit:** began at `0e8714f` on `ts-exp`. Refreshed the current strict SavedPlans controller, all `PlanData` host consumers, default selection, startup/takeover hydration, portable import/export/verification, app-update settlement, browser-data-clear write-back and existing Plan/storage tests before editing.
- **Ownership decision:** keep saved-plan UI/actions in strict `plan.ts`; move the untyped `PlanData` cache/persistence/default composition and Plan-controller host assembly behind a checked Plan host module. Do not absorb live session/timer state; P5.4 remains behind `scheduleGateway`.
- **Durability finding:** canonical saved-plan library writes are already strict in the repository, but browser-data-clear recovery currently rewrites library and draft as two operations and the draft rewrite is not explicitly strict. P5.3B will use the repository's existing strict atomic Plan-document replacement for this recovery path.
- **Default finding:** `getActiveDefaults()` still contains a dead `saved.scheduleText` fallback even though `readUserDefaults()` exposes no schedule. Default schedule composition will become one checked rule: selected saved-plan default, otherwise factory schedule; student name remains the protected preference/factory fallback.
- **Implementation objectives:** check Plan host contracts/adapters; preserve library/draft separation and 1 MiB codec enforcement; preserve create/load/update/rename/delete/default behavior and ownership fencing; preserve null-draft/default display semantics; retain portable import/export/reload behavior; make Plan storage-reset write-back atomic; adapt manifest/registry/type fixtures/readers without compatibility shims; then reconcile all P5.3 ownership.
- **Targeted QA selected:** strict typecheck + typed lint; source build + generated-build/syntax verification; `unit/app/plan-controller`; strengthened `integration/plans/saved-plans-logic`; Plan host data/default/recovery regression coverage; `architecture/app/runtime-boundaries` plus affected mutation/presentation/security contracts; fresh-build `browser/app/core-flow`, `browser/storage/site-data-clear`, `browser/ui/interactions`, and independent draft/session journeys where host changes can affect them.
- **Next:** implement the checked host boundary and regressions, verify the above objectives against source, then run targeted QA and repair any in-scope failures before closing parent P5.3.

## Recording subsequent passes

Replace the active entry with a short baseline, complete objectives, material findings/decisions, changes, actual commands/results and next action. Use existing objective IDs. Keep unresolved obligations above until closed. Update scope/status only in the phase register; link to evidence rather than duplicating tables. Save detailed history through a pinned commit when replacing an entry.

Statuses: NOT STARTED → ACTIVE → IMPLEMENTED — QA PENDING → VERIFIED — TARGETED. BLOCKED names the obstacle and unfinished objectives. Verification requires source/objective reconciliation and passing required checks. Reopen a claim if current evidence contradicts it; never hide incomplete work under a completed parent.

## Historical evidence — read only when relevant

- [P5.3A Plan authoring/editor closure at `0e8714f`](https://github.com/oneshubhamt/study-director/blob/0e8714f3a2268015d16505365b01beea7a0f7144/TS-CONVERSION-EXECUTION.md#latest-closed-worklog--p53a-plan-authoringeditor): strict Plan authoring/editor, validation and runtime-port boundary with targeted browser evidence.
- [P5.2-startup and parent closure at `8753895`](https://github.com/oneshubhamt/study-director/blob/8753895af3116adfe749d42e09ef0fb1edbd1f17/TS-CONVERSION-EXECUTION.md#latest-closed-worklog--p52-startup-and-parent-p52-closure): strict startup/activation/ownership composition and full P5.2 reconciliation.
- [P5.2-data-bootstrap closure at `c843c67`](https://github.com/oneshubhamt/study-director/blob/c843c6713fab31f988b4ab8933b3ece82cc80677/TS-CONVERSION-EXECUTION.md#latest-closed-worklog--p52-data-bootstrap): typed canonical configuration/persistence/repository construction with storage-failure and newer-data browser evidence.
- [P5.2-profiles closure at `6a46b71`](https://github.com/oneshubhamt/study-director/blob/6a46b711126a25a1e19de6e4f08397471aadcf69/TS-CONVERSION-EXECUTION.md#latest-closed-worklog--p52-profiles): strict profile registry/scope plus checked first-start, Drive binding and profile lifecycle host adapters; targeted profile and two-browser sync QA.
- [P5.2-capabilities closure at `e9b3894`](https://github.com/oneshubhamt/study-director/blob/e9b3894a5b7e50c48b4bfef80de1bb932e182684/TS-CONVERSION-EXECUTION.md#latest-closed-worklog--p52-capabilities): strict native-capability engine plus checked host adapters; pinned type/build evidence and capability-specific runtime/browser QA.
- [P5.1 implementation and verification at `de4872a`](https://github.com/oneshubhamt/study-director/blob/de4872a88c2015bc8833e0244c0ab8ce6e6b5998/TS-CONVERSION-EXECUTION.md#latest-closed-worklog--p51): seven strict core modules plus foundation host adapters; 141 checked files, 102 targeted tests and 28 valid browser runs. Includes repaired failures, stale-build evidence correction and remaining certification limits.
- [Documentation consolidation, P5.0, main intake and merge verification at `b4e4cfd`](https://github.com/oneshubhamt/study-director/blob/b4e4cfd716626c55fd713f3565837ac7f9e70a95/TS-CONVERSION-EXECUTION.md): complete observations, commands, failures/corrections and publication evidence.
- [Historical P5.0 host/reader inventory](https://github.com/oneshubhamt/study-director/blob/b4e4cfd716626c55fd713f3565837ac7f9e70a95/docs/typescript/PHASE-5.md#extracted-host-ownership--historical-p50-baseline): original 117 ranges / 1,005 statements and 42 readers; not current anchors.
- [Preparation / Phases 1–4](docs/typescript/HISTORY-PREPARATION-PHASE-4.md) and [protected pre-intake snapshot](docs/typescript/snapshots/main-intake-2026-11-08/README.md).
