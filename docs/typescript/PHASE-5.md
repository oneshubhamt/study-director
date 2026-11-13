# Phase 5 — host and features: scope and status register

**Planning baseline:** `4136ba513479f0e0e0c01e0cef2495bcf61e0a2e`, 2026-10-30. **P5.2, P5.4 and P5.5 are CLOSED — VERIFIED — TARGETED after their required audit/correction work; P5.6A is next.** This is the sole Phase 5 scope/status schedule; the [execution control record](../../TS-CONVERSION-EXECUTION.md) owns active findings and the durable working scratchpad. P5.0 mechanically extracted the host; P5.1 converts the foundations and their owned host adapters. See its evidence in the execution record.

## Purpose and sequencing

Convert first-party application runtime code to strict TypeScript while preserving current canonical behavior, startup timing, UI, persistence and recovery. Each feature pass owns its host wiring as well as its module. The final composition pass must not inherit the entire large host script.

The phase has **14 top-level steps (P5.0–P5.13)** and 17 tracked units because P5.9 and P5.11 have subdivisions. These are scope/ownership divisions, not mandatory separate sessions or review cycles. Combine related units into one coherent implementation pass when useful, retaining their completion criteria. P5.0 precedes conversion. Foundation/bootstrap work precedes feature composition; model contracts precede Insights UI/worker conversion. Some transport/model work is structurally independent, but proceed sequentially unless current scope or an explicit instruction calls for a different order. Split an unexpectedly large unit into stable child IDs **before** widening implementation; update ownership, dependency and closure evidence together. Never mark a parent complete while a child is unfinished.

## Objective register

“Required evidence” is a planned test scope, not executed QA. At pass start name exact existing tests and any necessary new regression cases in the durable worklog. A source-only/mechanical change need not invent a redundant new test.

| ID | Status | Primary scope and host responsibility | Required evidence for targeted closure |
| --- | --- | --- | --- |
| P5.0 | [VERIFIED — TARGETED](https://github.com/oneshubhamt/study-director/blob/b4e4cfd716626c55fd713f3565837ac7f9e70a95/TS-CONVERSION-EXECUTION.md#recent-closed-worklog--p50) | Mechanically extract all five inline scripts at their existing positions/scopes; manifest/build integration and shared test readers. Inventory every main-host responsibility and consumer | Executable equivalence of extraction except documented build glue; script order/scope, CSP/hash/precache consistency; build/generated syntax, startup/core-flow and affected source-reader tests; close F-001/F-002 within their stated scope |
| P5.1 | [VERIFIED — TARGETED](https://github.com/oneshubhamt/study-director/blob/de4872a88c2015bc8833e0244c0ab8ce6e6b5998/TS-CONVERSION-EXECUTION.md#latest-closed-worklog--p51) | `internal`, `interactions`, `workspace-overlay`, `notice-coordinator`, `navigation`, `audio-engine`, `backup-presentation`; shared DOM/scalar/capability helpers | Strict registry/ports and DOM/event handling; dialogs, keyboard/focus, navigation, notices, sound and overlay checks |
| P5.2 | VERIFIED — TARGETED (audit corrections) | `profiles`, `startup`, `native-capabilities`; early profile-scope script, configuration, installation identity, persistence/repository construction and activation | De novo parent reconciliation repaired stable identity, fail-closed scope/registry handling, profile writer settlement/error containment, ownership handoff and badge unknown-state behavior; startup/restore and capability boundaries re-inspected |
| P5.3 | VERIFIED — TARGETED (native DOM correction included) | `plan`; plan editor, schedule/defaults, saved-plan composition and host adapters | De novo parent reconciliation made explicit Load/Clear strictly durable with rollback, fenced Plan draft state by ownership token, and re-confirmed Saved Plans/default composition plus actual `scheduleGateway` provider assignability and native DOM/event contracts |
| P5.4 | VERIFIED — TARGETED (audit corrections) | Host live execution, timer presentation, task/session runtime state, drafts, reset and cross-tab/session handoff; consume existing typed timer/session modules | Start/pause/resume, reload/recovery, live-draft preservation, handoff/preemption and timer cues |
| P5.5 | VERIFIED — TARGETED (de novo audit corrections) | `review`; Review/Diary editors, daily-record presentation and associated saving/lifecycle wiring | Edit/save/reopen, current-record preservation and affected editor/session interactions |
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

P5.4 is split only where the runtime changes failure domain. P5.4A owns the in-memory execution machine and presentation; P5.4B adds canonical local durability/recovery on top of that stable runtime; P5.4C then owns distributed ownership/preemption and cross-device handoff. These are child passes of P5.4, not new top-level phases, and the parent closes only after source-level reconciliation across all three.

| Order / working ID | Status | Complete outcome and boundary | Targeted evidence |
| --- | --- | --- | --- |
| 1. P5.4A Live execution runtime & timer presentation | **VERIFIED — TARGETED** | Strict in-memory task/session runtime state and host composition for TimerState/TimerEngine, start/pause/resume/jump/done/skip, Timer presentation/cues/inactive gaps, Pomodoro and Practice Pacer. Consume persistence/ownership callbacks as ports; do not absorb canonical Active Session recovery or cross-device claim logic | Timer/state transition and clock invariants, inactive/sleep gap handling, cue/Pomodoro/Practice interactions, Execute controls/presentation and affected ownership pause/resume wiring |
| 2. P5.4B Canonical Active Session & local lifecycle | **VERIFIED — TARGETED** | Live-draft snapshot/save/flush, canonical Active Session persistence, reload/recovery, suspend/restore, finish/reset and local lifecycle transitions; preserve independent Plan draft | Strict durability/failure paths, reload/recovery, draft preservation, suspend/restore, finish/reset and lifecycle reconciliation |
| 3. P5.4C Ownership, preemption & session handoff | **VERIFIED — TARGETED** | Cross-tab takeover/preemption plus session claim/Continue Here/yield/stale-source/rollback behavior; consume P5.2 ownership and provider contracts without pulling P5.7/P5.8 implementation forward | Multi-tab authority, no double-running timer, failed/stale claims, compensation, late-progress preservation and cross-device handoff |

P5.3 is split along the authoring/runtime-persistence ownership boundary. These are bounded child passes of P5.3, not new top-level phases; the parent closes only after P5.3B and source-level reconciliation.

| Order / working ID | Complete outcome and current boundary | Targeted evidence |
| --- | --- | --- |
| 1. P5.3A Plan authoring/editor — **VERIFIED — TARGETED** | Strict `core/plan.ts`; PlanDraftEditor, parsing/validity, valid/invalid/incomplete projection, preview/edit/cancel/clear/Done/Apply durability and authoring board. Live execution remains behind `scheduleGateway` | `unit/app/plan-controller`, Plan durability regression checks, protected mutation/presentation/runtime-boundary contracts; fresh-build core-flow, independent draft/session and interaction journeys |
| 2. P5.3B Saved Plans/default composition — **VERIFIED — TARGETED** | Saved-plan/default persistence and UI actions, checked `PlanData` host ownership/adapters, default schedule selection/reload/recovery; parent P5.3 ownership reconciled | Saved-plan create/load/update/rename/delete/default, canonical persistence/reload/storage recovery; fresh P5.3B browser promotion remains an explicit later-certification evidence limit in the execution record |


## Complete remaining file inventory at the planning baseline

All 17 private core JS implementations at the planning baseline have an owner. P5.1 now uses `.ts` for its seven entries and adds the checked `foundation-host.ts`; the table below retains the original inventory for reconciliation:

| Owner | `source/core/` files |
| --- | --- |
| P5.1 | `internal.js`, `interactions.js`, `workspace-overlay.js`, `notice-coordinator.js`, `navigation.js`, `audio-engine.js`, `backup-presentation.js` |
| P5.2 | `native-capabilities.js`, `profiles.js`, `startup.js` |
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

## P5.5–P5.7 implementation handoff

Resume on latest `ts-exp` after the P5.2/P5.4 closure checkpoint. These groups are complete outcomes, not mandatory sessions or external approval gates. Start each with one short active worklog entry; use a temporary pad for exploration. Follow [AGENTS](../../AGENTS.md), including objective reconciliation before closure. Convert owned host behavior alongside the module; a typed interface to unchecked feature logic is unfinished. Keep shared contracts narrow and check actual providers. Preserve deferred initialization, native DOM/event types and existing canonical validation. Fix directly encountered defects with regression protection; do not hunt the backlog or expand into later features.

Every group needs strict compiler/lint, manifest/registry/readers updated, a fresh build and affected behavioral checks. Select tests from the anchors below; add cases for newly exposed failure paths rather than running every listed test each time. Browser tests run according to their isolation rules; changed browser tests need five isolated passes. Full certification stays in Phase 7. Keep an explicit remainder when splitting a group; a parent closes only when all its owned source and consumers are reconciled.

### P5.5 — Review, Diary and saved-day completion

| Group | Complete outcome / boundary | Starting evidence under `tests/` (`.mjs`) |
| --- | --- | --- |
| P5.5A — Review model, editing and presentation — **VERIFIED — TARGETED** | Convert the corresponding `core/review.js` owners (`ReviewModel`, `ReviewEditor`, `ReviewView`, shared saved-day presentation), `ReviewSubsystem` composition and owned callbacks. Type evidence/progress/quality/reflection state, bindings, rendering and report/copy controls together with actual consumers. Keep ongoing subject-note persistence in P5.6; define its checked interface now. Wire the already checked execution/session lifecycle callers without copying their algorithms | `integration/review/reflection-session-codec`, `unit/app/timer-engine-logic`, `integration/app/session-lifecycle-module`; `browser/app/core-flow`, `browser/app/session-draft-edit`; relevant rich-editor interaction cases |
| P5.5B — Durable save, Diary and date transitions — **VERIFIED — TARGETED (audit corrected)** | Finish `ReviewSaveService`, `DailyReflectionPersistence`, `DiaryEditor`, Save Today/suspended Review actions, save acknowledgement/reminders, date selection and rollover host behavior. Reconcile the entire Review module and all its host exports. Preserve the distinction between active-session reflection and canonical Saved Days; Library changes only through an acknowledged save. Historical recovery never automatically rolls over or restarts | `integration/storage/save-lane`, `integration/storage/strict-durability-boundaries`, `integration/app/session-claim-flush-safety`, `integration/app/previous-day-convergence`, `integration/app/recovery-timer-snapshot`; `browser/app/session-draft-edit`, `browser/backup/restore-session-safety`, `browser/exports/exports` |

P5.5 closure must demonstrate stale editor/date/ownership rejection, flush-before-save ordering, failed and committed-but-unverified writes without false saved indicators, preservation of richer existing records, and correct Diary-only versus study-day writes. If A cannot be coherent without a persistence segment, move that segment into A and remove it from B explicitly. Do not leave substantive Review callbacks for P5.13.

**Closure reconciliation:** the de novo P5.5 audit corrected the close/rollover checkpoint so the canonical Active Session is strictly written and read back before later session persistence is blocked; reflection-only writes now carry a date-stable concurrency baseline and separate durable commit from Library-refresh follow-up; actual Review/Saved-Day providers are compile-checked. The execution record owns the exact commits, regression cases and verification run.

### P5.6 — Library, notes and document surfaces

| Group | Complete outcome / boundary | Starting evidence under `tests/` (`.mjs`) |
| --- | --- | --- |
| P5.6A — Ongoing notes and editor bindings | Convert note workflows in `core/library.js` and host note owners: identity/Area inheritance, read/edit/save, create/rename/move/delete, conflict handling and Execute/Review note bindings. Include actual rich-editor adapter callbacks, revision/ownership fences and affected Plan area-renaming consumers. Consume the checked notes repository; keep Diary/Saved-Day writes in P5.5 | `integration/storage/note-persistence`, `integration/storage/note-text-checked-once`, `integration/attachments/attachment-library-lifecycle`; `browser/library/notes-management`, `browser/library/notes-at-limit`, affected `browser/rich-text/rich-editor-interactions` |
| P5.6B — Library navigation and record operations | Complete remaining `core/library.js` ownership: section/search/selection/pagination, Saved-Day views, preserved UI state and destructive-operation coordination, plus `core/note-links.js` and link navigation consumers. Include selection/focus behavior after asynchronous refresh and storage failure. Reuse P5.5 shared Review presentation; keep Insights analytics/worker implementation in P5.9/P5.10 | `unit/library/library-clear-planner`, `integration/library/library-clear`, `integration/storage/pending-reviews`; `browser/library/library-selection`, `browser/library/notes-management`, relevant rich-text link-context checks |
| P5.6C — Attachments, preview and export integration | Convert `core/note-export.js` and remaining host document/editor integration: attachment catalogue/pickers, image/PDF preview, native PDF fallback, retained URLs/readers, editor lifetimes, print and export. Consume existing checked attachment/export engines and first-party rich-text modules; preserve immutable `vendor/wordgard/**`. Reconcile all Library/note/editor host remainder before parent closure | `unit/exports/note-export`, `integration/attachments/pdf-reader-lifetime`, `integration/attachments/attachment-library-lifecycle`, `integration/attachments/rich-attachment-api`, `integration/rich-text/attachment-busy-lifecycle`; `browser/attachments/attachments`, `browser/attachments/attachment-editor`, `browser/exports/exports` |

P5.6 closure must cover stale or deleted bindings, concurrent note changes, cancelled/failed destructive actions, attachment reference and reader lifetime preservation, and no changes to canonical saved-day evidence from viewing/exporting. Do not duplicate rich-text codec or storage logic to make typing easier.

### P5.7 — Backup/recovery user flows and background composition

| Group | Complete outcome / boundary | Starting evidence under `tests/` (`.mjs`) |
| --- | --- | --- |
| P5.7A — Backup actions, files and protection | Convert owned host file/location controls, export/import entry points, protection/password dialogs and `BackupController`/`BackupProtection`/Device Folder composition. Type their actual Phase 4 providers and callbacks. Preserve cancellation, ownership, permission refusal, progress/notice completion and temporary-file release. Shared location presentation belongs here; Drive auth/transport internals remain P5.8 | `unit/backup/backup-recovery-host`, `integration/backup/capture-safety`, `integration/backup/file-lifetimes`, `integration/backup/encryption`, `integration/backup/folder-encryption`, `integration/backup/device-folder-storage`; affected `browser/backup/encryption`, `browser/backup/pwa-device-backup` |
| P5.7B — Reconciliation, kept versions and restore | Convert `core/reconciliation-ui.js`, kept-version/history/restore dialogs and their host actions. Check imported-data validation, safety-copy requirements, restore-journal callbacks and attachment/session/notes reconciliation consumers. Reuse checked engines and P5.4 session restoration; preserve the independent Plan draft. No historical formats, migrations or compatibility adapters | `integration/rich-text/reconciliation-ui`, `integration/rich-text/reconciliation-engine`, `integration/ui/kept-versions-c6`, `integration/backup/import-lifecycle`, `integration/backup/repository-restore`, `integration/backup/restore-assets`, `integration/backup/current-canonical-roundtrip`; `browser/backup/sync-kept-reviews`, `browser/backup/restore-session-safety` |
| P5.7C — Maintenance, integrity and readiness | Finish host composition for repository/attachment integrity, maintenance, canonical-commit notifications, storage-health/recovery status and background coordination. Type existing engine callbacks and metadata results; include readiness, suspension, foreground-preemption and recovery-resumption paths. Keep PWA update policy in P5.12 and provider transport in P5.8. Reconcile every P5.7 callback and public action | `unit/backup/repository-background`, `integration/storage/attachment-integrity-audit`, `integration/storage/attachment-reference-recovery`, `integration/backup/backup-capture-notification`, `integration/storage/managed-provider-backup-pending`, `architecture/storage/background-work-contract`, `architecture/storage/backup-recovery-ux-contract`; affected restore/recovery browser journeys |

P5.7 closure must demonstrate no success before durable verification, rollback preserving newer canonical successors, no cleanup of retained files/readers or active recovery evidence, no publication/maintenance during a blocking foreground operation, and no recursive backup scheduling from backup capture. Test failure after a side effect as well as rejection before it. Keep the retained safety/recovery behavior; “canonical-only” is not permission to delete it.
