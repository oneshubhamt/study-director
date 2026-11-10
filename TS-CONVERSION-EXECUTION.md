# TypeScript conversion — current execution record

**Working branch: `ts-exp`. P5.0–P5.1 VERIFIED — TARGETED; P5.2/P5.3 REOPENED — SOURCE RECONCILIATION.** Reconciliation baseline is `134ad02`; do not begin P5.4 until both parents are re-closed from source. Preserve `TS-Conversion` and main. Follow the sole-implementor and end-of-Phase-5 audit arrangement in [AGENTS](AGENTS.md). Main intake endpoint remains `2638619`.

Read [AGENTS](AGENTS.md) and the assigned rows of [Phase 5](docs/typescript/PHASE-5.md), then inspect current source. Consult [decisions](docs/typescript/DECISIONS.md), [tooling](docs/TYPESCRIPT.md), [verification commands](docs/VERIFICATION.md) and [product docs](docs/README.md) as needed. Do not reload historical logs for routine passes.

## Programme state

| Stage | State / next action |
| --- | --- |
| Preparation, Phases 1–4 | Complete within recorded scope at `4136ba5`: 34 Phase 4 modules, 126 strict files, zero unchecked existing TS at last check. [Evidence](docs/typescript/HISTORY-PREPARATION-PHASE-4.md) |
| Phase 5 — host/features | P5.2/P5.3 source reconciliation active after de novo parent audit found in-scope defects despite prior targeted verification. P5.4 remains blocked on re-closure. [Scope/status register](docs/typescript/PHASE-5.md) |
| Phase 6 — tooling/tests | Not started; convert remaining tooling/tests and retire transitional readers |
| Phase 7 — certification | Not started; whole-app reconciliation and full correctness, coverage, mutation, browser, release and performance QA |

## Open obligations

| ID | Owner / remaining work |
| --- | --- |
| F-001 | Each Phase 5 pass: refresh its host/function anchors against current source; old P5.0 line ranges are historical. Include its callers, action handlers and shared assembly callbacks. P5.13 reconciles total remaining ownership |
| F-002 | Phase 6: retire transitional substring/VM readers and reconcile authored coverage; P5 conversions must keep their readers working meanwhile |
| F-003 | Phase 7: full certification, with unavailable manual/device evidence stated separately |
| REVIEW-P5 | Independent planning-assistant audit after all Phase 5 outcomes, including P5.13 reconciliation. Compare against `de4872a`; retain inherited limitations and intentional changes. No external review gate between implementation passes |

## Active worklog — de novo P5.2/P5.3 parent reconciliation

- **Baseline / method:** reopened at `134ad02` by owner request. Re-read AGENTS, Phase 5, decisions, architecture, product/data/storage/session contracts, then audited owned P5.2/P5.3 source and host consumers directly before relying on fixtures.
- **P5.2 source contradictions found:** ordinary fresh-profile rename changes the profile ID although the current product/data contract says identity is created once and survives rename; profile mutations ignore failed registry writes and can report success/reload without a committed device-wide registry; successful profile deletion can retain its background-publication hold; switch/add starts a preference flush but reload can race it; lifecycle flush starts promise-returning writers without observing asynchronous rejection.
- **P5.3 source findings:** Plan/editor/runtime ownership remains correctly separated through `scheduleGateway`; checked `PlanData` composition/default/recovery remains structurally sound. Explicit Load/Clear draft actions still use ordinary durability while Apply/Done/Cancel use strict durability, so user-triggered draft replacement/clear will be made consistent.
- **Objectives:** restore stable profile identity; make every registry mutation fail closed on an uncommitted registry; release deletion holds on all exits; settle current-profile writes before deliberate profile reload; make lifecycle best-effort flushing observe async failures; make explicit Plan load/clear strict; preserve adoption/remote-deletion identity changes, startup ordering, unsupported-data fail-closed behavior, Plan draft/live separation and P5.4 boundary.
- **QA / reconciliation:** strengthen profile and Plan regressions for each defect; rerun pinned strict type/lint + build/generated checks; run focused profile/Plan/startup tests where executable; inspect final source/host consumers again and re-close each parent only if no owned source contradiction remains. Browser/manual evidence limits remain explicit.

## Latest closed worklog — P5.3B Saved Plans/default composition and parent P5.3 reconciliation

- **Scope / source:** baseline `0e8714f`; verified implementation endpoint `e6ab717`. Refreshed Saved Plans, every `PlanData` host consumer, defaults, startup/takeover hydration, portable import/export/verification, app-update settlement, storage-clear recovery and affected tests.
- **Ownership result:** Saved Plans UI/actions remain in strict `plan.ts`; new checked `plan-host.ts` owns PlanData cache/persistence/default composition and Plan-controller host assembly. Live session/timer mutation remains behind `scheduleGateway` for P5.4.
- **Implementation:** added strict Plan host contracts/checks plus registry/manifest/typecheck admission; removed the untyped PlanData IIFE and dead `saved.scheduleText` fallback; retained canonical codec/repository enforcement rather than duplicating size/schema rules; default composition is selected saved plan → factory schedule, with protected student-name fallback.
- **Durability / recovery:** saved-plan library persistence still uses canonical strict repository writes. Storage-clear recovery now settles queued Plan writes before snapshotting and restores draft + library with one canonical atomic `planData.replace`, avoiding the previous split/non-strict rewrite seam.
- **Behavior fixes:** “Update from Draft” can no longer erase a saved plan with a blank draft. Rename/update/delete re-read the current library after modal confirmation so an unrelated completed library change is not overwritten; update also rejects a draft changed while confirmation was open.
- **Objective reconciliation:** create/load/update/rename/delete/default, draft/library separation, null-draft/default projection, portable import/export/reload, ownership fencing, default schedule selection and recovery remain owned and wired. Source inspection confirms no legacy PlanData IIFE, no duplicate library-byte policy, no dead preference schedule fallback, and no P5.4 timer/session ownership in the new host.
- **Canonical QA:** GitHub Repository checks at `e6ab717` run `42789661949` on Node 26.12.1/npm 12.2.1 passed strict typecheck and typed lint with **166 checked files / zero unchecked TypeScript**, standing safety/repository contracts, source build, generated-build verification and generated syntax. The intermediate host-contract commit correctly failed the admission gate until `plan-host.ts` was added to the checked browser project; subsequent runs are green.
- **Focused regression evidence:** exact current `plan-host.ts` was exercised for default composition, detached reads, saved-default/draft persistence, atomic reset recovery including queued-write ordering, failed-write rollback and portable import/verification. Saved-plan action behavior was exercised for blank-update rejection, update, fresh-library-preserving rename/delete and default selection. Strengthened repository regressions record the same cases.
- **Evidence limit:** no fresh P5.3B browser-promotion run is claimed. The available GitHub connector exposes the push Repository checks but not workflow dispatch, and repository policy requires approval before altering workflows merely to create a runner. P5.3A’s browser baseline remains green for unchanged authoring journeys; P5.3B browser recertification remains explicit later certification evidence rather than a hidden pass claim.
- **Status / next:** **P5.3A + P5.3B and parent P5.3 VERIFIED — TARGETED.** Next bounded objective is P5.4 live execution/session runtime.

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
