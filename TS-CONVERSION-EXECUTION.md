# TypeScript conversion — current execution record

**Working branch: `ts-exp`. P5.0–P5.1 VERIFIED — TARGETED; P5.2 ACTIVE with P5.2-capabilities and P5.2-profiles VERIFIED — TARGETED. Next: P5.2-data-bootstrap.** P5.2 implementation baseline is `d3f69c4`; the profiles pass baseline is `e9b3894` and targeted-QA endpoint is `29688ca`. Preserve `TS-Conversion` and main. Follow the sole-implementor and end-of-Phase-5 audit arrangement in [AGENTS](AGENTS.md). Main intake endpoint remains `2638619`.

Read [AGENTS](AGENTS.md) and the assigned rows of [Phase 5](docs/typescript/PHASE-5.md), then inspect current source. Consult [decisions](docs/typescript/DECISIONS.md), [tooling](docs/TYPESCRIPT.md), [verification commands](docs/VERIFICATION.md) and [product docs](docs/README.md) as needed. Do not reload historical logs for routine passes.

## Programme state

| Stage | State / next action |
| --- | --- |
| Preparation, Phases 1–4 | Complete within recorded scope at `4136ba5`: 34 Phase 4 modules, 126 strict files, zero unchecked existing TS at last check. [Evidence](docs/typescript/HISTORY-PREPARATION-PHASE-4.md) |
| Phase 5 — host/features | P5.0–P5.1 verified; P5.2 active: capabilities and profiles verified, data bootstrap next, then startup. Later steps unstarted. [Scope/status register](docs/typescript/PHASE-5.md) |
| Phase 6 — tooling/tests | Not started; convert remaining tooling/tests and retire transitional readers |
| Phase 7 — certification | Not started; whole-app reconciliation and full correctness, coverage, mutation, browser, release and performance QA |

## Open obligations

| ID | Owner / remaining work |
| --- | --- |
| F-001 | Each Phase 5 pass: refresh its host/function anchors against current source; old P5.0 line ranges are historical. Include its callers, action handlers and shared assembly callbacks. P5.13 reconciles total remaining ownership |
| F-002 | Phase 6: retire transitional substring/VM readers and reconcile authored coverage; P5 conversions must keep their readers working meanwhile |
| F-003 | Phase 7: full certification, with unavailable manual/device evidence stated separately |
| REVIEW-P5 | Independent planning-assistant audit after all Phase 5 outcomes, including P5.13 reconciliation. Compare against `de4872a`; retain inherited limitations and intentional changes. No external review gate between implementation passes |

## Latest closed worklog — P5.2-profiles

- **Baseline / scope:** `e9b3894` on `ts-exp`; refreshed current `profiles`, pre-storage profile-scope, first-start, create/switch/remove, Drive binding, action maps, startup callers and targeted tests before editing. Parent P5.2 remains open.
- **Implemented:** converted `source/core/profiles.js` to strict `profiles.ts` and `source/host/profile-scope.js` to strict `profile-scope.ts`; added checked profile contracts/negative type fixtures and `profiles-host.ts`. The host adapter now owns profile-controller construction, rename/dialog actions, first-start, add/switch/start selection, Drive-library profile binding and local/everywhere deletion. Sync-status/profile-list rendering and the Drive Connect-card presentation remain with their existing presentation/status owners and cross the profile boundary only through narrow callbacks.
- **Preserved invariants:** profile scope is still resolved before profile-owned storage opens; the device registry remains unscoped; first-profile plain names and later `~<scope>` names are unchanged; unsupported/newer registries remain read-only; per-profile storage/Drive identity, fresh-profile rename/adoption, durable removal intent, IDB→OPFS→local cleanup ordering, site-data-clear list restoration and cross-tab reload behavior are retained.
- **Reader/build integration:** manifest and closed browser registry now admit the TS modules; explicit browser TS admission covers the implementation and contracts; direct profile-source readers use the shared type-erasing runtime reader. Added a focused profile-scope regression for active scope, newer registry fallback, malformed/absent registry and preinstalled identity preservation.
- **Objective reconciliation:** the old profile registry/scope JS implementations and duplicated first-start/switch/add/delete/Drive-binding host flows are gone. The temporary CI expansion used only to collect this pass's targeted evidence is restored at closure; routine repository CI is not permanently widened.
- **Pinned QA PASS:** run **1363** at `29688ca` used the documented Node 26.12.1/npm 12.2.1 toolchain. Strict typecheck and typed lint passed **152 checked files, zero unchecked TS, zero warnings/errors**; repository safety checks, source build, generated-build verification and generated syntax all passed.
- **Profile-specific tests PASS:** `unit/storage/profiles`, new `unit/storage/profile-scope`, `integration/storage/capacity-profiles`, `integration/backup/drive-profile-binding`, and the affected capture-safety reader all passed.
- **Fresh-build browser QA PASS:** `browser/app/core-flow` passed clean startup, canonical timer/review/save flow and no runtime errors; `browser/ui/profile-panel` passed laptop/phone panel, recent-item and in-place rename behavior; `browser/backup/sync-and-profiles` passed the two-browser simulated Drive journey including profile isolation, add/switch, note preservation and removal/database cleanup (**1 commit, 130 requests**).
- **Failures repaired:** run 1359 exposed one profile-scope TS parse error; run 1360 then exposed strict index-signature/PromiseLike issues; both were mechanically corrected without weakening gates. Targeted run 1362 found a real startup TDZ because a formerly hoisted `closeProfilePanel` function had become a late `const` alias; thin hoisted wrappers restored the original initialization semantics. The identical targeted browser batch then passed in run 1363.
- **Next:** P5.2-data-bootstrap. P5.2 remains ACTIVE until data bootstrap and startup/integration are verified.

## Recording subsequent passes

Replace the active entry with a short baseline, complete objectives, material findings/decisions, changes, actual commands/results and next action. Use existing objective IDs. Keep unresolved obligations above until closed. Update scope/status only in the phase register; link to evidence rather than duplicating tables. Save detailed history through a pinned commit when replacing an entry.

Statuses: NOT STARTED → ACTIVE → IMPLEMENTED — QA PENDING → VERIFIED — TARGETED. BLOCKED names the obstacle and unfinished objectives. Verification requires source/objective reconciliation and passing required checks. Reopen a claim if current evidence contradicts it; never hide incomplete work under a completed parent.

## Historical evidence — read only when relevant

- [P5.2-capabilities closure at `e9b3894`](https://github.com/oneshubhamt/study-director/blob/e9b3894a5b7e50c48b4bfef80de1bb932e182684/TS-CONVERSION-EXECUTION.md#latest-closed-worklog--p52-capabilities): strict native-capability engine plus checked host adapters; pinned type/build evidence and capability-specific runtime/browser QA.
- [P5.1 implementation and verification at `de4872a`](https://github.com/oneshubhamt/study-director/blob/de4872a88c2015bc8833e0244c0ab8ce6e6b5998/TS-CONVERSION-EXECUTION.md#latest-closed-worklog--p51): seven strict core modules plus foundation host adapters; 141 checked files, 102 targeted tests and 28 valid browser runs. Includes repaired failures, stale-build evidence correction and remaining certification limits.
- [Documentation consolidation, P5.0, main intake and merge verification at `b4e4cfd`](https://github.com/oneshubhamt/study-director/blob/b4e4cfd716626c55fd713f3565837ac7f9e70a95/TS-CONVERSION-EXECUTION.md): complete observations, commands, failures/corrections and publication evidence.
- [Historical P5.0 host/reader inventory](https://github.com/oneshubhamt/study-director/blob/b4e4cfd716626c55fd713f3565837ac7f9e70a95/docs/typescript/PHASE-5.md#extracted-host-ownership--historical-p50-baseline): original 117 ranges / 1,005 statements and 42 readers; not current anchors.
- [Preparation / Phases 1–4](docs/typescript/HISTORY-PREPARATION-PHASE-4.md) and [protected pre-intake snapshot](docs/typescript/snapshots/main-intake-2026-11-08/README.md).
