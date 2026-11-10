# Phase 5 — host and features: scope and status register

**Planning baseline:** `4136ba513479f0e0e0c01e0cef2495bcf61e0a2e`, 2026-10-30. **P5.0–P5.2 are VERIFIED — TARGETED; P5.3 is ACTIVE with P5.3A VERIFIED — TARGETED and P5.3B ACTIVE; later objectives are NOT STARTED.** This is the sole Phase 5 scope/status schedule; the [execution control record](../../TS-CONVERSION-EXECUTION.md) owns active findings and the durable working scratchpad. P5.0 mechanically extracted the host; P5.1 converts the foundations and their owned host adapters. See its evidence in the execution record.

## Purpose and sequencing

Convert first-party application runtime code to strict TypeScript while preserving current canonical behavior, startup timing, UI, persistence and recovery. Each feature pass owns its host wiring as well as its module. The final composition pass must not inherit the entire large host script.

The phase has **14 top-level steps (P5.0–P5.13)** and 17 tracked units because P5.9 and P5.11 have subdivisions. These are scope/ownership divisions, not mandatory separate sessions or review cycles. Combine related units into one coherent implementation pass when useful, retaining their completion criteria. P5.0 precedes conversion. Foundation/bootstrap work precedes feature composition; model contracts precede Insights UI/worker conversion. Some transport/model work is structurally independent, but proceed sequentially unless current scope or an explicit instruction calls for a different order. Split an unexpectedly large unit into stable child IDs **before** widening implementation; update ownership, dependency and closure evidence together. Never mark a parent complete while a child is unfinished.

## Objective register

“Required evidence” is a planned test scope, not executed QA. At pass start name exact existing tests and any necessary new regression cases in the durable worklog. A source-only/mechanical change need not invent a redundant new test.

| ID | Status | Primary scope and host responsibility | Required evidence for targeted closure |
| --- | --- | --- | --- |
| P5.0 | [VERIFIED — TARGETED](https://github.com/oneshubhamt/study-director/blob/b4e4cfd716626c55fd713f3565837ac7f9e70a95/TS-CONVERSION-EXECUTION.md#recent-closed-worklog--p50) | Mechanically extract all five inline scripts at their existing positions/scopes; manifest/build integration and shared test readers. Inventory every main-host responsibility and consumer | Executable equivalence of extraction except documented build glue; script order/scope, CSP/hash/precache consistency; build/generated syntax, startup/core-flow and affected source-reader tests; close F-001/F-002 within their stated scope |
| P5.1 | [VERIFIED — TARGETED](https://github.com/oneshubhamt/study-director/blob/de4872a88c2015bc8833e0244c0ab8ce6e6b5998/TS-CONVERSION-EXECUTION.md#latest-closed-worklog--p51) | `internal`, `interactions`, `workspace-overlay`, `notice-coordinator`, `navigation`, `audio-engine`, `backup-presentation`; shared DOM/scalar/capability helpers | Strict registry/ports and DOM/event handling; dialogs, keyboard/focus, navigation, notices, sound and overlay checks |
| P5.2 | VERIFIED — TARGETED | `profiles`, `startup`, `native-capabilities`; early profile-scope script, configuration, installation identity, persistence/repository construction and activation | Startup/restore ordering, profile isolation/switching, storage-failure and ownership startup paths; capabilities/fallbacks remain valid |
| P5.3 | ACTIVE — P5.3A VERIFIED — TARGETED; P5.3B ACTIVE | `plan`; plan editor, schedule/defaults, saved-plan composition and host adapters | Editing/applying plans, draft durability, saved-plan save/reload and relevant UI |
| P5.4 | NOT STARTED | Host live execution, timer presentation, task/session runtime state, drafts, reset and cross-tab/session handoff; consume existing typed timer/session modules | Start/pause/resume, reload/recovery, live-draft preservation, handoff/preemption and timer cues |
| P5.5 | NOT STARTED | `review`; Review/Diary editors, daily-record presentation and associated saving/lifecycle wiring | Edit/save/reopen, current-record preservation and affected editor/session interactions |
| P5.6 | NOT STARTED | `library`, `note-links`, `note-export`; Library sections, note/editor integration, attachments/preview/printing and host adapters | Notes/list selection, links/export, attachment/editor lifecycle, references and adjacent persistence |
| P5.7 | NOT STARTED | `reconciliation-ui`; file/location controls, protection dialogs, pending review/history and host composition for Phase 4 backup/recovery/integrity/maintenance services | Export/cancel, encryption, restore choices, safety/recovery notices and blocked/failed operation states |
| P5.8 | NOT STARTED | Authored `external/drive.js`; Drive public adapter, connection lifecycle and typed transport to Phase 4 provider contracts | Auth/disconnect, malformed/failing transport, publication/cancellation, profile isolation and simulated multi-device sync; no live-user data |
| P5.9a | NOT STARTED | `insights-model` foundations: configuration/primitives, records/windows and core analytics (existing M8.1–M8.4 anchors) | Canonical input boundaries, deterministic numerical fixtures, empty/missing/malformed records; explicit interfaces consumed by P5.9b |
| P5.9b | NOT STARTED | Remaining `insights-model`: practice evidence, current state, dynamics, coach and engine assembly (M8.5–M8.8/M8.11) | Findings and aggregation semantics, boundary cases and existing/new independent numerical expectations. Together 5.9a/b must cover the entire model |
| P5.10 | NOT STARTED | Authored `external/insights.js`; UI, worker protocol/entry, fallback/cancellation and host integration | Worker/fallback output parity, populated rendering, cancellation/stale responses and focused responsiveness; preserve portable/worker/DOM separation |
| P5.11a | NOT STARTED | Authored `external/guide.js` and its host entry/navigation | Guide content access, opening/closing, navigation and related accessibility behavior |
| P5.11b | NOT STARTED | Authored `external/glass.js`, early presentation kernel/metadata scripts, theme/preference host adapters | Saved preference before first paint, theme/metadata synchronization, responsive/display controls and affected accessibility |
| P5.11c | NOT STARTED | Authored `external/aurora.js`; its independent presentation registration | Saved Aurora startup and switching; no unintended coupling to Glass; affected display checks |
| P5.12 | NOT STARTED | `pwa-lifecycle`, `platform/sw.js`, install-capture script and PWA host wiring; remaining worker integration audit | Offline reload, update activation, cache identity, install capture and relevant multi-tab lifecycle; generated workers checked through authored entry points |
| P5.13 | NOT STARTED | Remaining shell/public capability/event/startup bindings and cross-feature composition; reconcile completed owner scopes | No unexplained authored runtime JS/unchecked host sections or permissive bridges; strict gates/build, selected cross-feature journeys and explicit handoff to Phase 6/7 |

P5.9a may require a mechanical model split before one portion can be admitted to strict checks; preserve loading/export behavior, document the split, and keep the unconverted portion explicitly owned by P5.9b. Never claim the entire model checked based on a declaration facade. Similar dependencies discovered elsewhere must be made explicit rather than bypassed with suppression or `any`.

## Execution boundaries on ts-exp

The implementor chooses subsequent bounded passes from this register without a planning-assistant review between them; [AGENTS](../../AGENTS.md) owns that discipline. Use the following starting groups for bootstrap-heavy P5.2. They are execution scopes within the existing parent, not four new programme phases or a mandatory session count. Track the active group and remaining groups in the existing worklog; P5.2 closes only when its entire row is complete. Refine groups from current dependencies rather than predicting every later pass now.

| Order / working ID | Complete outcome and initial source anchors | Starting targeted evidence; extend for changed callers |
| --- | --- | --- |
| 1. P5.2-capabilities — **VERIFIED — TARGETED** | Strict `core/native-capabilities.js`, scheduler and native browser ports; its `host/main.js` construction, `renderInstallationProjection`, `renderNativeCapabilities`, storage-permission inspection, wake/badge/install actions and relevant assembly callbacks. Keep deferred capability access and supported/unsupported fallbacks | `integration/pwa/native-capabilities`, `architecture/pwa/pwa-updater-contract`; fresh-build `browser/app/core-flow`, `browser/ui/interactions`, and affected install/storage/wake behavior |
| 2. P5.2-profiles — **VERIFIED — TARGETED** | Strict `core/profiles.js`, `host/profile-scope.js`, profile identity/registry and create/switch/remove/first-start host flows; preserve scope-before-storage initialization, per-profile data and device-wide keys | `unit/storage/profiles`, `integration/storage/capacity-profiles`, `integration/backup/drive-profile-binding`; relevant profile panel and sync/profile browser journeys |
| 3. P5.2-data-bootstrap — **VERIFIED — TARGETED** | Typed host configuration, durable-name derivation, `InstallationIdentity`, `IndexedDb`, `AppData` and persistence/repository construction/validation adapters still owned by P5.2. Consume existing checked modules; retain current-data validation and recovery safeguards | Affected persistence/repository contracts, `integration/storage/canonical-baseline`; fresh-start, existing-data reload and storage-failure browser checks |
| 4. P5.2-startup — **VERIFIED — TARGETED** | Strict `core/startup.js` (registry ID `startup-lifecycle`), owned `StartupLifecycle`, `AppActivation` and ownership startup/hydration callbacks; integrate prior groups and reconcile the full P5.2 scope | `integration/app/startup-lifecycle-module`, `integration/app/ownership-hydration-fail-closed`, `integration/app/session-lifecycle-module`; affected startup/reload/multi-tab/recovery journeys |

Paths in the evidence column are under `tests/` with `.mjs`; they are starting selections, not results or permission to omit other affected checks. Final event/public assembly belongs to P5.13, but behavior inside a P5.2-owned callback must be checked now. Preserve initialization timing when moving closures into factories. Keep other feature behavior under its existing owner; do not leave an unowned remainder in a shared host block.

For the first group, close only when the implementation and owned adapters are checked (not declaration-only), registry/manifest/readers are adapted, positive and unavailable/rejected browser-API paths still work, and targeted type/build/runtime/browser checks pass. A missing physical-device/browser capability is an explicit evidence limit, not a reason to remove the fallback or claim it verified. At Phase 5 end, prepare the independent-audit handoff specified in AGENTS; do not turn every group into an external approval gate.

P5.3 is split along the authoring/runtime-persistence ownership boundary. These are bounded child passes of P5.3, not new top-level phases; the parent closes only after P5.3B and source-level reconciliation.

| Order / working ID | Complete outcome and current boundary | Targeted evidence |
| --- | --- | --- |
| 1. P5.3A Plan authoring/editor — **VERIFIED — TARGETED** | Strict `core/plan.ts`; PlanDraftEditor, parsing/validity, valid/invalid/incomplete projection, preview/edit/cancel/clear/Done/Apply durability and authoring board. Live execution remains behind `scheduleGateway` | `unit/app/plan-controller`, Plan durability regression checks, protected mutation/presentation/runtime-boundary contracts; fresh-build core-flow, independent draft/session and interaction journeys |
| 2. P5.3B Saved Plans/default composition — **ACTIVE** | Saved-plan/default persistence and UI actions, `PlanData` host ownership/adapters, default schedule selection/reload/recovery; then reconcile complete P5.3 ownership | Saved-plan create/load/update/rename/delete/default, canonical persistence/reload/storage recovery and affected browser UI |


## Complete remaining file inventory at the planning baseline

All 17 private core JS implementations at the planning baseline have an owner. P5.1 now uses `.ts` for its seven entries and adds the checked `foundation-host.ts`; the table below retains the original inventory for reconciliation:

| Owner | `source/core/` files |
| --- | --- |
| P5.1 | `internal.js`, `interactions.js`, `workspace-overlay.js`, `notice-coordinator.js`, `navigation.js`, `audio-engine.js`, `backup-presentation.js` |
| P5.2 | `profiles.js`, `startup.js`, `native-capabilities.js` |
| P5.3 | `plan.js` |
| P5.5 | `review.js` |
| P5.6 | `library.js`, `note-links.js`, `note-export.js` |
| P5.7 | `reconciliation-ui.js` |
| P5.12 | `pwa-lifecycle.js` |

The six authored external JS sources are `drive.js` (P5.8), `insights-model.js` (P5.9a/b), `insights.js` (P5.10), `guide.js` (P5.11a), `glass.js` (P5.11b), `aurora.js` (P5.11c). `source/platform/sw.js` belongs to P5.12. These 24 files total 20,739 physical lines at the baseline; line count measures scope, not effort or defects.

`source/external/{wordgard,rich-text,search-worker,image-worker,attachment-worker,export-worker}.js` are generated outputs, not six more authored conversion tasks. Existing authored editor/portable workers are already checked; adapt their integration only where required. Wordgard's vendored implementation remains immutable. Build/test/contracts JS belongs to Phase 6; shipping generated JS is expected and is not a failure of the TypeScript program.

## Host ownership overview

The five authored scripts in `source/host/`, inserted inline into `source/app.html`, are install capture (P5.12), early profile scope (P5.2), presentation kernel (P5.11b), presentation metadata synchronization (P5.11b), and the main host (distributed below). P5.0 mechanically extracted them; their owning passes perform strict conversion. Keep execution order, synchronous first-paint behavior, lexical scope, event registration and global capability identities intact.

| Main-host responsibility / existing composition-map anchor | Primary owner | Adjacent consumers to inspect |
| --- | --- | --- |
| Configuration, durable names, installation/profile identity, persistence/repository construction | P5.2 | Every data/worker/profile consumer |
| Private registry/capabilities, DOM/scalar helpers, interactions/navigation/overlays/notices | P5.1 | All feature controllers; final public boundary P5.13 |
| Schedule, saved plans, editing/defaults | P5.3 | Live execution P5.4; review P5.5 |
| Runtime/task evidence, live drafts, timers, session reset/recovery and handoff | P5.4 | Ownership/startup P5.2; backup P5.7; plan/review |
| Review/Diary rendering, editing and day presentation | P5.5 | Library P5.6; saved-record storage |
| Ongoing notes, editor lifecycle, attachment viewers, Library rendering/selection | P5.6 | Backup P5.7; overlay infrastructure P5.1 |
| Backup status/protection, journals/history, integrity, maintenance and safety controls | P5.7 | Drive P5.8; startup P5.2; PWA P5.12 |
| External integration entry points and feature-facing callbacks | P5.8–P5.11c, by feature | Public capability boundary P5.13 |
| Install/update/offline handlers and service-worker communication | P5.12 | Background backup, storage and session settlement |
| Final cross-feature assembly, public exports, top-level bindings and start invocation | P5.13 | All completed feature contracts |

## Host integration rule

Feature passes own their adapters, callbacks and action handlers inside shared assembly as well as their named modules. P5.13 owns final composition, not unfinished feature wiring. Refresh anchors for the assigned scope against current source before converting it; record newly discovered ownership where needed. Preserve startup order, scope and public capability identities.

The [P5.0 statement/action/reader inventory](https://github.com/oneshubhamt/study-director/blob/b4e4cfd716626c55fd713f3565837ac7f9e70a95/docs/typescript/PHASE-5.md#extracted-host-ownership--historical-p50-baseline) is historical evidence, not a current line map. `build/host-source.mjs` remains the composition/erasure reader; affected tests must continue to use it. Substring/VM readers do not establish whole-host coverage; Phase 6 owns their retirement.

## Completion and handoff

A work unit reaches VERIFIED — TARGETED only when its owned implementation **and host wiring**, required invariants, objective reconciliation and selected checks are complete. Record exact commands, source revision, results, outstanding manual/device evidence and publication in the execution worklog; link that evidence from the status cell. Unfinished work cannot be hidden in a prose “next” note under a completed row.

No broad Phase 5 refactor, redesign, canonical schema change or vendor upgrade is implied. Useful discovered fixes must have a concrete reason, separate semantic accounting and appropriate regression evidence. Full whole-app source/behavior reconciliation and comprehensive QA remain Phase 7; Phase 6 owns the remaining first-party tooling/test conversion.
