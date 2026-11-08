# Phase 5 — host and features: scope and status register

**Planning baseline:** `4136ba513479f0e0e0c01e0cef2495bcf61e0a2e`, 2026-10-30. **P5.0 is VERIFIED — TARGETED; later objectives are NOT STARTED.** This is the sole Phase 5 scope/status schedule; the [execution control record](../../TS-CONVERSION-EXECUTION.md) owns active findings and the durable working scratchpad. P5.0 mechanically extracted the host; strict feature conversion remains unstarted. See its evidence in the execution record.

## Purpose and sequencing

Convert first-party application runtime code to strict TypeScript while preserving current canonical behavior, startup timing, UI, persistence and recovery. Each feature pass owns its host wiring as well as its module. The final composition pass must not inherit the entire large host script.

The phase has 17 bounded work units, not 17 promised sessions. P5.0 precedes conversion. Foundation/bootstrap work precedes feature composition; model contracts precede Insights UI/worker conversion. Some transport/model work is structurally independent, but proceed sequentially unless current scope or an explicit instruction calls for a different order. Split an unexpectedly large unit into stable child IDs **before** widening implementation; update ownership, dependency and closure evidence together. Never mark a parent complete while a child is unfinished.

## Objective register

“Required evidence” is a planned test scope, not executed QA. At pass start name exact existing tests and any necessary new regression cases in the durable worklog. A source-only/mechanical change need not invent a redundant new test.

| ID | Status | Primary scope and host responsibility | Required evidence for targeted closure |
| --- | --- | --- | --- |
| P5.0 | [VERIFIED — TARGETED](../../TS-CONVERSION-EXECUTION.md#recent-closed-worklog--p50) | Mechanically extract all five inline scripts at their existing positions/scopes; manifest/build integration and shared test readers. Inventory every main-host responsibility and consumer | Executable equivalence of extraction except documented build glue; script order/scope, CSP/hash/precache consistency; build/generated syntax, startup/core-flow and affected source-reader tests; close F-001/F-002 within their stated scope |
| P5.1 | NOT STARTED | `internal`, `interactions`, `workspace-overlay`, `notice-coordinator`, `navigation`, `audio-engine`, `backup-presentation`; shared DOM/scalar/capability helpers | Strict registry/ports and DOM/event handling; dialogs, keyboard/focus, navigation, notices, sound and overlay checks |
| P5.2 | NOT STARTED | `profiles`, `startup`, `native-capabilities`; early profile-scope script, configuration, installation identity, persistence/repository construction and activation | Startup/restore ordering, profile isolation/switching, storage-failure and ownership startup paths; capabilities/fallbacks remain valid |
| P5.3 | NOT STARTED | `plan`; plan editor, schedule/defaults, saved-plan composition and host adapters | Editing/applying plans, draft durability, saved-plan save/reload and relevant UI |
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

## Complete remaining file inventory at the planning baseline

All 17 private core JS implementations have an owner:

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

## Extracted host ownership — historical P5.0 baseline

Production intake `2638619` changes host line positions and adds responsibilities. The ranges below preserve the verified P5.0 accounting and must not be used as current line anchors. Feature ownership above still applies; refresh the statement/range inventory against the integration commit before P5.1 implementation. MAIN-E owns this explicit handoff, not a claim that P5.0 audited new production behavior.

Extraction baseline `8d9c525`; paths/lines below refer to the mechanically extracted bodies. These ranges are exhaustive ownership assignments, not a behavior audit or strict-type completion claim. Nested functions/closures inherit their enclosing range's owner; shared callback contracts require the adjacent owners' source reconciliation. Keep this map current when later passes move/split code. P5.13 owns only the explicitly allocated assembly, not unassigned feature code.

| Extracted script | Complete scope | Conversion owner |
| --- | --- | --- |
| `source/host/install-capture.js` | Entire early capture IIFE | P5.12 |
| `source/host/profile-scope.js` | Entire pre-storage profile IIFE | P5.2 |
| `source/host/presentation-kernel.js` | Entire pre-paint kernel IIFE | P5.11b |
| `source/host/presentation-metadata.js` | Entire metadata synchronizer | P5.11b |
| `source/host/main.js` | Entire main IIFE, allocated below | Feature owners / P5.13 assembly |

Main host: **9284 physical lines, 1005 top-level statements, 117 contiguous ranges**. AST inspection with Acorn 8.19.0 confirmed each statement lies wholly in exactly one range; all source lines including comments, whitespace and wrapper are covered. Build tokens were replaced with same-length parse placeholders for this inventory only; executed equivalence uses real rendered output. Earlier inline line anchors map to main-file lines by subtracting 1515.

| Main lines | Owner | Responsibility / anchors |
| --- | --- | --- |
| 1–17 | P5.13 | IIFE scope, directive and composition-map preface |
| 18–18 | P5.2 | Release configuration |
| 19–22 | P5.1 | Registry identity guard |
| 23–76 | P5.13 | Validated module loads; feature owners supply construction contracts |
| 77–91 | P5.11b | Presentation kernel guard and metadata |
| 92–92 | P5.6 | Note search-worker URL |
| 93–112 | P5.3 | Factory schedule and defaults configuration |
| 113–118 | P5.6 | Editor boot/attachment limits guard |
| 119–125 | P5.2 | Profile-scoped durable names |
| 126–129 | P5.3 | Factory defaults |
| 130–145 | P5.2 | Data contract/store names |
| 146–161 | P5.13 | Public capability version inventory |
| 162–186 | P5.2 | Canonical entity definitions/identity and keyed record helpers |
| 187–274 | P5.2 | Storage/capability/backup startup slots, health controller |
| 275–300 | P5.7 | App and operation diagnostics, decision clock |
| 301–337 | P5.2 | Installation identity, device/folder names and profile controller |
| 338–363 | P5.1 | Scalar/domain adapters and registry lock |
| 364–564 | P5.1 | Shared DOM adapters, route/history, notices and interactions |
| 565–608 | P5.6 | PDF workspace lifecycle |
| 609–704 | P5.1 | System notifications and audio |
| 705–709 | P5.1 | Text clamp |
| 710–731 | P5.6 | Rich editor capability/validation adapters |
| 732–768 | P5.1 | Scalar/array/data-value helpers |
| 769–774 | P5.5 | Study-quality normalization |
| 775–785 | P5.3 | Schedule model adapters |
| 786–791 | P5.6 | Task-note identities |
| 792–995 | P5.4 | Completion adapters, Execute panels, timeline, timer and session state |
| 996–998 | P5.5 | Review composition slots |
| 999–1003 | P5.6 | Rich-text lifecycle slots |
| 1004–1013 | P5.4 | Execute rendering keys and save/nudge state |
| 1014–1035 | P5.2 | Activation kinds and coordinator |
| 1036–1126 | P5.2 | Cross-tab ownership and mutation coordinator |
| 1127–1192 | P5.4 | Pomodoro, Practice Pacer and timer composition |
| 1193–1209 | P5.7 | Backup-change and flush adapters |
| 1210–1220 | P5.12 | Backup settlement before PWA update |
| 1221–1227 | P5.3 | Post-plan automatic backup notification |
| 1228–1387 | P5.4 | Session watch, current task and completion actions |
| 1388–1433 | P5.2 | Storage health data/rendering |
| 1434–1461 | P5.1 | Coordinated notices |
| 1462–1510 | P5.2 | Installation/native capability projections |
| 1511–1613 | P5.7 | File/Drive/Device backup rows, settings and actions |
| 1614–1678 | P5.2 | Storage health writes, estimate, protection and install actions |
| 1679–1683 | P5.4 | Live-draft save warning |
| 1684–1851 | P5.2 | Storage fallback, ownership UI and primary hydration |
| 1852–1887 | P5.2 | Record/session/pending-review codec construction |
| 1888–1893 | P5.5 | Daily-record presentation adapters |
| 1894–1946 | P5.4 | Pause/runtime snapshot payload |
| 1947–1972 | P5.1 | Date/hour formatting |
| 1973–2312 | P5.3 | Derived schedule and PlanScheduleGateway |
| 2313–2342 | P5.5 | Review date and saved-content revision |
| 2343–2351 | P5.1 | Status/notice adapters |
| 2352–2386 | P5.4 | Session safety and saved-day reminder |
| 2387–2418 | P5.7 | Backup reminder |
| 2419–2812 | P5.4 | Session capture/save, live drafts and runtime restore |
| 2813–2947 | P5.2 | IndexedDB, unsupported-data hold, metadata validation/gateways |
| 2948–2948 | P5.7 | Capture/reference revision slots |
| 2949–2951 | P5.12 | PWA work/input revision fences |
| 2952–3043 | P5.6 | Attachment ingest/storage/maintenance and note rendering/printing |
| 3044–3059 | P5.2 | AppMeta family/storage adapters |
| 3060–3142 | P5.7 | Reconciliation baseline and verified-recovery freshness/protection |
| 3143–3314 | P5.2 | Canonical commit subscribers, journals/repositories, capability activation |
| 3315–3534 | P5.4 | Session reset/suspend/continue/takeover/finish |
| 3535–3671 | P5.6 | Note catalogue, inherited areas and consumer/conflict updates |
| 3672–3767 | P5.7 | Background gates/owners and data maintenance |
| 3768–3975 | P5.6 | Inherited notes, editor identities/bindings and sync indicators |
| 3976–4046 | P5.11b | Protected portable preferences and appearance mirrors |
| 4047–4075 | P5.3 | Saved drafts and user defaults persistence |
| 4076–4225 | P5.4 | Runtime schedule layers, actual clock and pause evidence |
| 4226–4422 | P5.2 | Student name/defaults/profile identity UI |
| 4423–4464 | P5.8 | Drive library choice/join/bind |
| 4465–4534 | P5.2 | First-start onboarding/profile activation |
| 4535–4545 | P5.7 | Profile backup unlock adapters |
| 4546–4555 | P5.3 | Quote draft change |
| 4556–4595 | P5.4 | Clock and header presentation |
| 4596–4699 | P5.1 | Tab registry and scroll preference |
| 4700–4908 | P5.13 | Plugin-ready identity, lazy plugin loader and registration |
| 4909–4927 | P5.1 | Local-file notice and Trusted Types violation/asset adapters |
| 4928–5072 | P5.1 | Navigation scroll/focus, tab transitions and readiness |
| 5073–5269 | P5.11b | Fullscreen, theme/presentation controls and font scaling |
| 5270–5403 | P5.4 | Real-time schedule windows and Execute awareness |
| 5404–5454 | P5.13 | Shared render queue and cross-feature protected-UI reconciliation |
| 5455–5709 | P5.4 | Recovery actions, shifts/carry-forward and unfinished-note draft |
| 5710–5712 | P5.4 | Task completion adapter |
| 5713–5740 | P5.6 | Task-note editor commit |
| 5741–5832 | P5.5 | Daily reflection persistence and Library Diary editor |
| 5833–6226 | P5.6 | Rich text documents, note links/tags/import and editor runtime |
| 6227–6241 | P5.7 | Managed recovery runtime quiescence |
| 6242–6247 | P5.6 | Rich-text composition slot assignments |
| 6248–6373 | P5.3 | Plan data/runtime/controller composition |
| 6374–6388 | P5.6 | Note saving, Execute note and Library entry |
| 6389–6390 | P5.7 | Backup info popovers |
| 6391–6489 | P5.6 | Execute note display/editing |
| 6490–6688 | P5.4 | Execute controls/idle state/autostart/end prompt/session controls |
| 6689–6817 | P5.5 | Review composition, day save/rollover and presentation |
| 6818–6903 | P5.4 | Session editor lifecycle and focus metrics |
| 6904–6933 | P5.7 | Backup file/export/protection composition and unlock lifecycle |
| 6934–7039 | P5.6 | Note export, attachment references/insertion/library and clear-state helpers |
| 7040–7173 | P5.7 | Attachment/repository integrity projections, state and audits |
| 7174–7206 | P5.6 | Library clear eligibility/coordinator |
| 7207–7243 | P5.7 | Kept versions and unsupported-data projection |
| 7244–7341 | P5.6 | Library view composition |
| 7342–7359 | P5.1 | Navigation controller composition |
| 7360–7362 | P5.6 | Library/search composition slot assignments |
| 7363–7669 | P5.7 | Backup codec/runtime, lifecycle restore and semantic verification |
| 7670–7914 | P5.7 | Backup subscriptions, maintenance requests and storage-reset recovery |
| 7915–8083 | P5.7 | Device backup/recovery host composition and integrity scrub |
| 8084–8426 | P5.12 | PWA update policy, reservation/preparation/checking and event bindings |
| 8427–8541 | P5.10 | Preview runtime, Insights data source and host adapter |
| 8542–8591 | P5.7 | Data/backup diagnostic copies |
| 8592–8727 | P5.13 | Action tables; feature-owned handlers follow the allocation below |
| 8728–8943 | P5.2 | Mutation ownership requirements, blocked-action hints and UI projection |
| 8944–9001 | P5.1 | Delegated event dispatch and ownership guards |
| 9002–9026 | P5.6 | Note sync popover |
| 9027–9090 | P5.13 | Delegated/application DOM binding assembly |
| 9091–9093 | P5.12 | PWA launch routing |
| 9094–9195 | P5.2 | Startup clock slots and lifecycle construction |
| 9196–9284 | P5.13 | Plugin placeholders, public API, readiness event and final start invocations |

### Shared assembly and action ownership

P5.13 owns registry-load assembly (23–76), plugin loading/registration (4700–4908), render dispatch (5404–5454), action-table composition (8592–8727), DOM wiring (9027–9090) and the public API/start invocations (9196–9284). Feature owners must type/verify their adapters and callbacks **during their own passes**, including entries inside these shared structures. Keep lazy Guide/Insights activation with P5.11a/P5.10, Drive integration with P5.8 and presentation packs with P5.11b/c. Public export shapes are reconciled again in P5.13. This prevents deferred assembly from becoming deferred feature implementation.

All five action tables contain 119 entries (113 unique names). Repeated names inherit the same feature owner; dispatch/ownership guards remain shared P5.1/P5.2 work. A feature must preserve the binding and adjacent backup/PWA effects when converting its handler.

| Handler owner | Exact action names across CLICK/CHANGE/INPUT/BLUR/KEYDOWN |
| --- | --- |
| P5.1 | `toggle-system-alerts`, `test-sound`, `test-system-alert`, `sound-mode` |
| P5.2 | `protect-local-data`, `install-notice-action`, `dismiss-install-notice`, `dismiss-storage-warning`, `open-profile`, `close-profile`, `profile-drive`, `switch-profile`, `add-profile`, `delete-profile`, `first-start-drive`, `first-start-continue`, `first-start-skip`, `first-start-password`, `profile-name`, `first-start`, `keep-screen-awake` |
| P5.3 | `edit-plan`, `confirm-plan-edit`, `cancel-plan-edit`, `load-default`, `apply-schedule`, `clear-schedule-draft`, `quote`, `schedule-draft` |
| P5.4 | `toggle-pause`, `practice-mode`, `practice-total-toggle`, `practice-cue-toggle`, `practice-start`, `practice-next`, `practice-undo`, `practice-reset`, `practice-reset-confirm`, `practice-reset-cancel`, `practice-toggle`, `practice-finish`, `practice-setup`, `mark-done`, `skip-task`, `jump-scheduled-now`, `start-scheduled-full`, `start-remaining-window`, `shift-remaining-day`, `generate-carry-forward`, `copy-carry-forward`, `close-unfinished-note`, `toggle-pomodoro`, `restore-session`, `suspend-session`, `finish-session`, `reset-session`, `close-nudge`, `take-pomodoro-break`, `gap-focus`, `gap-break`, `gap-split`, `gap-ignore`, `gap-apply`, `unfinished-note` |
| P5.5 | `practice-delete-run`, `save-day`, `copy-review`, `toggle-copy-report-menu`, `reset-copy-report`, `change-reflection-date`, `save-reflection` |
| P5.6 | `render-library`, `open-library-day`, `clear-library`, `open-notes`, `toggle-pnote-info`, `load-more-library`, `pnote-progress` |
| P5.7 | `recheck-device-integrity`, `recheck-drive-integrity`, `connect-device-backup`, `backup-now`, `cancel-device-backup`, `toggle-backup-settings`, `disconnect-device-backup`, `open-version-history`, `cancel-drive-backup`, `disconnect-drive-backup`, `refresh-version-history`, `close-version-history`, `cancel-version-history-operation`, `recover-managed-version`, `compare-managed-note`, `remove-managed-version`, `export-backup`, `backup-protection`, `copy-backup-diagnostics`, `cancel-standalone-import`, `pick-import-file`, `toggle-backup-info`, `show-drive-sync`, `review-kept-versions`, `import-backup` |
| P5.8 | `connect-drive-backup` |
| P5.11b | `font-smaller`, `font-reset`, `font-larger`, `set-theme`, `set-presentation`, `toggle-display-tools`, `toggle-fullscreen` |
| P5.12 | `apply-pwa-update`, `check-unsupported-update` |

### Host-source consumers reconciled in P5.0

`build/host-source.mjs` is the single assembly/erasure reader, driven by `hostScripts` in the module manifest. `build/build.mjs` consumes it for source validation and runtime rendering; all five bodies participate in canonical inventory and source hashes. Built-output consumers (browser harness/instrumentation, PWA variants, generated syntax, minification, CSP and deployment checks) continue reading generated HTML; its bytes are unchanged by extraction.

All 42 pre-existing executable source readers now call `readHostHtml`; assertions/extracted-function logic is retained. The diagnostics scanner selects the composer for its HTML entry. Literal `source/app.html` fixture names/error labels are not source readers. The new `tests/architecture/build/host-source.mjs` deliberately reads the raw template to check its composition contract. Repository-wide source search found no other direct app-source consumers in build/tests/contracts at this checkpoint.

| Reader directory | Adapted executables |
| --- | --- |
| `tests/architecture/app/` | `internal-module-boundary.mjs`, `presentation-contracts.mjs`, `protected-mutation-ui-contract.mjs`, `runtime-boundaries.mjs`, `workspace-contracts.mjs` |
| `tests/architecture/backup/` | `host-export-port.mjs` |
| `tests/architecture/build/` | `production-limits.mjs` |
| `tests/architecture/pwa/` | `pwa-updater-contract.mjs` |
| `tests/architecture/rich-text/` | `image-policy.mjs`, `reconciliation-ui-contract.mjs`, `wordgard-adapter-boundary.mjs` |
| `tests/architecture/security/` | `security-policy.mjs` |
| `tests/architecture/storage/` | `attachment-aware-reconciliation.mjs`, `background-work-contract.mjs`, `backup-recovery-ux-contract.mjs`, `cleer-integration.mjs`, `data-architecture.mjs`, `diagnostics-labels.mjs`, `managed-recovery-contract.mjs`, `managed-version-history-contract.mjs`, `persistence-boundary.mjs`, `runtime-authority-contract.mjs` |
| `tests/integration/attachments/` | `pdf-reader-lifetime.mjs` |
| `tests/integration/backup/` | `backup-capture-notification.mjs`, `backup-reminder.mjs`, `capture-safety.mjs`, `no-backup-location.mjs`, `repository-checkpoint.mjs` |
| `tests/integration/pwa/` | `application-update-safety.mjs` |
| `tests/integration/storage/` | `attachment-integrity-audit.mjs`, `attachment-reference-recovery.mjs`, `background-gc-reliability.mjs`, `canonical-baseline.mjs`, `data-maintenance.mjs`, `largefile-behavior.mjs`, `managed-provider-backup-pending.mjs`, `repository-integrity-state.mjs` |
| `tests/integration/ui/` | `application-outcomes.mjs`, `background-diagnostics.mjs`, `notification-lifecycle.mjs` |
| `tests/unit/app/` | `navigation.mjs`, `presentation-defaults.mjs` |

Coverage caveat: these historical substring/VM tests still execute extracted fragments. Composition does not create a new mapping from whole-HTML offsets to authored host-file offsets. No authored-host coverage percentage is claimed in P5.0; built-runtime browser evidence is separate. Later feature conversions must route their owned fragments through strict checked sources, and Phase 6 owns complete retirement of transitional text readers. No coverage floor is changed here.

## Completion and handoff

A work unit reaches VERIFIED — TARGETED only when its owned implementation **and host wiring**, required invariants, objective reconciliation and selected checks are complete. Record exact commands, source revision, results, outstanding manual/device evidence and publication in the execution worklog; link that evidence from the status cell. Unfinished work cannot be hidden in a prose “next” note under a completed row.

No broad Phase 5 refactor, redesign, canonical schema change or vendor upgrade is implied. Useful discovered fixes must have a concrete reason, separate semantic accounting and appropriate regression evidence. Full whole-app source/behavior reconciliation and comprehensive QA remain Phase 7; Phase 6 owns the remaining first-party tooling/test conversion.
