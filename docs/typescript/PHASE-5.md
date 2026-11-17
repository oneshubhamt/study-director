# Phase 5 — scope, status and implementation handoff

**Scope reference baseline:** `28c8c1d5a9b9850079a59acf1d11818d17e513ec`, 2026-11-16, verified against GitHub `ts-exp` and `TS-Conversion`. P5.0–P5.10 have since reached targeted implementation closure; P5.5–P5.7 and P5.10 received owner-requested interim audits/corrections. The source map and implementation objectives below preserve the pre-conversion scope for reconciliation, not the present file topology. Work on `ts-exp`; [execution record](../../TS-CONVERSION-EXECUTION.md) owns live evidence and remaining checks, and [AGENTS](../../AGENTS.md) owns procedure.

## Roadmap and ownership

The programme retains 14 top-level steps, P5.0–P5.13. Child IDs identify coherent outcomes, not mandatory sessions or recurring external reviews. Continue an open outcome through ordinary fixes and targeted verification; checkpoint useful progress without marking incomplete parents closed. Combine or revise boundaries when source dependencies justify it, recording the reason and the remaining owner.

| ID | Status | Owned outcome |
| --- | --- | --- |
| P5.0 | VERIFIED — TARGETED | Five host scripts extracted mechanically; manifest/build/source-reader integration |
| P5.1 | VERIFIED — TARGETED | Registry, interaction/navigation/overlay/notice/audio foundations and shared host helpers |
| P5.2 | VERIFIED — TARGETED, audit corrected | Profiles, startup, native capabilities, bootstrap, identity and ownership integration |
| P5.3 | VERIFIED — TARGETED, audit corrected | Plan authoring, saved/default plans, durability and actual schedule-provider contracts |
| P5.4 | VERIFIED — TARGETED, audit corrected | Execution, timers, Active Session persistence, restoration, handoff and presentation |
| P5.5 | CLOSED — AUDITED — TARGETED | Review/Diary, saved-day presentation/completion, editor and lifecycle wiring |
| P5.6 | CLOSED — AUDITED — TARGETED | Library/notes/link/export behavior, editor/document/attachment lifetimes |
| P5.7 | CLOSED — AUDITED — TARGETED | Backup controls, reconciliation/recovery/history, maintenance/integrity/readiness |
| P5.8 | CLOSED — TARGETED | Drive adapter plus connection, sync-status and profile-facing host behavior; A/B below |
| P5.9a | CLOSED — TARGETED | Insights model foundations, records/windows and core analytics |
| P5.9b | CLOSED — TARGETED | Practice, study state/dynamics, coach and complete model engine |
| P5.10 | CLOSED — TARGETED; INTERIM AUDIT CORRECTED, HOSTED RECHECK OPEN | Insights compute boundary, presentation and retained UI/host integration; A/B/C below |
| P5.11a | NOT STARTED | Guide content/runtime, preview producer and owned navigation/accessibility behavior |
| P5.11b | NOT STARTED | Glass, early presentation kernel/metadata, theme/preferences and first-paint contracts |
| P5.11c | NOT STARTED | Aurora runtime/registration and saved-skin switching |
| P5.12 | NOT STARTED | PWA lifecycle, install capture, service worker, update/offline/multi-tab behavior |
| P5.13 | NOT STARTED | Final shell/public capability/event/startup assembly; reconcile all authored runtime ownership and hand off to Phases 6/7 |

P5.13 receives thin composition, not unfinished feature algorithms or callbacks. Shared plugin loading/registration mechanics remain there; P5.8/P5.10 own their actual feature descriptors, consumed APIs, readiness behavior and callbacks. Reuse checked P5.2 profile and P5.7 recovery/provider engines rather than copying them.

Completed detailed contracts, older inventories and evidence remain in the [register at `28c8c1d`](https://github.com/oneshubhamt/study-director/blob/28c8c1d/docs/typescript/PHASE-5.md) and [audited execution record](https://github.com/oneshubhamt/study-director/blob/28c8c1d/TS-CONVERSION-EXECUTION.md). Consult these when a changed caller crosses a completed boundary, not on every continuation.

## Current source map

| Owner | Authored anchors at this baseline | Integration boundary |
| --- | --- | --- |
| P5.8 | `source/external/drive.js` (1,238 lines); `source/host/main.js` sync indicator/actions and Drive Connect card | `types/backup-provider.ts`, checked provider/backup/profile owners, actual plugin API |
| P5.9a/b | `source/external/insights-model.js` (4,168 lines), existing M8 component factories | Canonical materialized records, outcome classification and Practice Pacer evidence; browser and worker share this model |
| P5.10 | `source/external/insights.js` (4,354 lines), worker entry, M8.9/M8.10/M8.12/M8.13 and `InsightsWorkerModel`; host `PreviewRuntime`, `InsightsDataSource`, `AppInsights`, preload and preference adapters | Read-only canonical data, typed model, native DOM, worker messages and feature registration |
| P5.11/P5.12 | `source/external/{guide,glass,aurora}.js`, `source/core/pwa-lifecycle.js`, `source/platform/sw.js`; `source/host/{presentation-kernel,presentation-metadata,install-capture}.js` | Their feature-owned host behavior and checked earlier consumers |

Line counts locate scope; they are not effort estimates or a reason to split every helper. Generated external Wordgard/rich-text/processing-worker bundles are not authored conversion tasks. Wordgard remains immutable. First-party build/test conversion belongs to Phase 6, but every runtime pass must adapt the build/readers/contracts it affects.

## Implementation rhythm for P5.8–P5.10

Seven outcomes below are the starting boundaries. P5.9b and P5.10B are substantial: use internal checkpoints at existing component seams, keeping a named remainder. Do not convert only interfaces around unchecked behavior, rename a whole file and suppress errors, or silently move difficult work into P5.13.

At each start, record baseline, outcome, invariants and exact targeted tests in one compact active worklog entry. Read that entry, this outcome, and affected source/callers; use the temporary pad for exploration. Closure needs source owners and consumers reconciled, meaningful failure-path evidence, compiler/lint and build results, plus any unresolved limits. Update the existing entry instead of appending repeated audits. No additional reports or external sign-off between groups.

Prioritize complete strict conversion, then evident local fixes, then useful test expansion. The audit's lesson is to verify ownership **after awaits and during rollback/cleanup**, not merely on entry. Test a real owner/provider seam; a consumer port tested only against a mock of itself is insufficient. Distinguish behavior-preserving typing from intentional corrections, with independent expected results for corrections.

### P5.8A — Complete Drive transport and authorization

**Outcome:** convert the complete authored Drive adapter, including setup/registration and actual `ProviderConfig`/repository assignability. Own GIS loading/authorization/revocation, token expiry/storage-event handling, folder/profile binding and deletion markers, operation contexts, pagination, metadata validation, upload/download/delete, publication/maintenance leases, session claims and cleanup. Host connection presentation is B; the checked provider engines remain their existing owners.

- Model untrusted Google/OAuth responses as `unknown`, narrow their required fields, and preserve validation before using IDs, parents, markers, URLs, sizes/digests or resumable offsets. Use native Fetch/Abort/stream types and narrow GIS declarations; do not type arbitrary responses as trusted repository objects.
- Preserve operation/profile/folder generations across awaits, authorization expiry, timeout/cancellation, bounded retries and ambiguous successful mutations. Late authorization, renew/delete or upload recovery must not act on a successor operation/profile. Capture/restore safety remains in the existing engines.
- Resolve the raw `@@SD_EXTERNAL_REPOSITORY_IDENTITIES@@` expression before admitting authored TS: use a checked configuration seam and test real token expansion/erasure. Keep OAuth scope, storage names, capability/version checks and startup registration behavior. No live Drive account/data is required.
- Adapt `tests/helpers/drive-harness.mjs` and other affected raw-source readers to the production erasure path; verify the actual registration receives the typed adapter, not a separately declared lookalike.

**Evidence:** `tests/integration/backup/{drive-security,drive-profile-binding,drive-repository-scale}.mjs`; targeted provider/publication cases in `tests/unit/backup/repository-background.mjs` and `tests/integration/backup/repository-checkpoint.mjs` when their seam changes. Include late response/profile switch, malformed response, cancellation and post-side-effect failure cases where existing tests lack them. Listing scale is relevant to pagination, not a request for full capacity QA.

### P5.8B — Connection and sync-status host completion

**Outcome:** move the remaining substantive Drive-facing host behavior behind checked ownership. Cover `connectDriveForProfile`, Connect-card state/timers/progress/actions, `syncStatusInput` and associated ring/panel rendering/scheduling/actions. The status model observes multiple providers: retain Device Folder, kept-version, password, ownership/session and PWA actions through real checked callbacks. Do not leave this shared behavior ownerless because its presentation is not exclusively Drive.

Reuse `ProfileDriveBinding`, `ProfileDeletion`, `BackupActions`, `BackupPresentation` and provider runtime. Preserve user-gesture authorization, deferred initialization, status subscriptions, reconnect/cancel/expiry, cold-start recovery and profile isolation. Old connection completions and hide timers must not overwrite a reopened card or a new profile. P5.12 still owns update policy; B owns only the status action's typed delegation.

**Evidence:** `tests/unit/backup/sync-status.mjs`, `tests/integration/ui/notification-lifecycle.mjs`, `tests/integration/app/storage-reset-connect-recovery.mjs`; simulated Chromium `tests/browser/backup/{cold-start-drive-recovery,sync-and-profiles,sync-journeys}.mjs`. Add `session-handoff-journeys` or `session-plan-sync` only if those callbacks change. **Close P5.8 only after A/B and every Drive-owned host remainder are reconciled.**

### P5.9a — Portable model foundations and core analytics

**Outcome:** strictly check M8.1 configuration, M8.2 primitives, M8.3 records/windows and M8.4 core analytics, including their real exports consumed by the remaining model. Reuse canonical record/view, task/outcome and Practice Pacer types; define a distinct prepared analytical record only for the derived evidence it actually adds. Missing/unknown measurements must remain distinct from measured zero.

The current model is one classic-script closure. Prefer extracting existing component factories along their dependency seams so this outcome can compile independently; preserve a single assembled model contract and runtime order. Keep the unconverted remainder explicitly in P5.9b, with real checked foundation exports. No declaration facade may represent the entire model as checked. A different split is acceptable if it has a simpler verified build and preserves these ownership boundaries.

Admit pure computation to the portable environment without DOM/storage/worker APIs. Preserve window/calendar rules, study-date boundaries, ordering, record normalization, evidence denominators, rounding and thresholds. Do not add historical-format conversion or redesign analytical methods during typing.

**Evidence:** `tests/integration/insights/insights-scaling.mjs` and relevant `insights-memory-retention.mjs` cases. Strengthen the existing model test with small hand-computable expectations for empty/one-day data, missing versus zero evidence, calendar/window edges and aggregate conservation as needed. At the mechanical split, compare unchanged public results against the pinned baseline on canonical fixtures; equivalence alone cannot prove an intentional bug fix correct.

### P5.9b — Evidence, dynamics, coach and model engine

**Outcome:** strictly check M8.5 Practice Pacer evidence, M8.6 current study state, M8.7 dynamics, M8.8 coach and M8.11 engine/assembly. Type derived results and discriminated evidence/availability states precisely enough that P5.10 can consume them without generic record bags or assertions at every use.

Preserve sample/support thresholds, deterministic trends, forecasting/calibration, confidence/insufficiency semantics, compact versus detailed Lab evidence, cache keys/limits and transient release. Check actual outcome-classifier and Practice Pacer providers, not simplified test substitutes. Cached values must respect dataset revision, study date and summary context; shared prepared input must not be mutated by a consumer.

**Evidence:** both `tests/integration/insights/{insights-scaling,insights-memory-retention}.mjs`. For changed numerical paths, cover threshold-adjacent/degenerate inputs and independently known answers, retaining existing tolerances and caps. Add tests within the relevant model suite rather than creating one file per algorithm. Use a fresh-build `tests/browser/insights/insights-populated-ui.mjs` run to establish that the unchanged UI/worker still consume the converted model. **P5.9 closes only when the entire model and its real assembly are checked.**

### P5.10A — Compute transport and read-only host data

**Outcome:** check the worker entry, `InsightsWorkerModel`, protocol and browser/fallback bridge, plus host `PreviewRuntime`, `InsightsDataSource`, `AppInsights` and their actual repository/classifier/Pacer adapters. The sample-data producer remains in Guide/P5.11a; the preview consumer and its typed registration seam belong here. Shared plugin-loader mechanics remain P5.13.

- Define portable discriminated `SD_INSIGHTS_RECORDS/BUILD/RESULT/ERROR` messages and the structured-cloneable data model. Validate unknown messages at the boundary, including revision, part order/count, indices and request identity. Keep the local lazy `getLabEvidence` function out of wire payloads; do not invent a second computation implementation.
- Preserve chunked transfer, same-revision reuse, worker termination/idle retirement, cancellation, worker failure fallback and bounded retained records. Fence late results **and errors** by request/worker identity; an old worker failure must not terminate or reject its successor.
- Keep browser DOM and worker entry declarations separate. Today the same generated Insights URL executes in both contexts and the worker returns before constructing rendering components. Preserve that behavior through checked environment-specific factories/entry points; do not enable both DOM/WebWorker libraries globally to make errors disappear.
- Keep canonical Saved Days read-only, Diary-only filtering, preview provenance/revision and study date. Preview switching or late sample loading must not replace a newer source; avoid stale cache reuse or writing sample records into canonical storage.

**Evidence:** `tests/integration/insights/{guide-preview-canonical,insights-memory-retention}.mjs`; add a focused worker-lifecycle test if existing tests do not directly execute the real message/transport owners. Exercise malformed/incomplete messages, stale result/error, cancellation during transfer, startup/runtime failure and worker/fallback result parity using the same canonical fixture. Use the actual worker path in the populated Insights browser journey, not only a mocked Worker constructor.

### P5.10B — Dashboard rendering and interaction

**Outcome:** convert M8.9 rendering, charts/SVG, cards, disclosures, tables/tooltips and their interaction/render callbacks with native DOM/event types and the P5.9 model. Keep unavailable/insufficient evidence visibly distinct from a zero result. Preserve ordering, copy, accessible labels/keyboard/focus, responsive geometry, bounded chart data and reduced-motion behavior.

This is the largest UI group. Checkpoint existing renderer sections internally, retaining one complete rendering outcome and a narrow typed contract for C. Factory definitions may be shared in the bundle, but browser-only construction must remain after the worker exit. Do not replace the UI with a simpler presentation to reduce typing work.

**Evidence:** `tests/browser/insights/insights-populated-ui.mjs`, plus relevant renderer/retained checks in `tests/integration/insights/render-lifecycle.mjs`. Cover populated and empty/insufficient states, narrow viewport and keyboard interactions on changed controls. Use independent numeric fixtures when a displayed value or denominator changes; do not bless altered model outputs through updated snapshots alone.

### P5.10C — Lab, retained view and feature completion

**Outcome:** convert M8.10 Analytics Lab, M8.12 retained view and M8.13 plugin runtime, including load/render/prefetch coordination, tab leave/re-entry, refresh/window preference, demo switching, observers/timers, progressive rendering and feature-owned preload/registration callbacks in the host. Reconcile the whole `insights.js` owner and every Insights host callback.

Use A's compute/data boundary and B's renderer. Preserve lazy Lab computation, bounded memory, cancellation and disposal; an old render/prefetch/error may not change the newer DOM, status, focus or caches. Preserve the last usable view on refresh failure, truthful retry/busy states, window selection/scroll restoration, and worker release on inactivity. Registration must retain capability negotiation and startup order.

**Evidence:** `tests/integration/insights/{render-lifecycle,guide-preview-canonical,insights-memory-retention}.mjs`, `tests/browser/insights/{insights-populated-ui,insights-performance}.mjs`. Run the performance journey alone at parent closure because scheduling/retention is owned here; preserve its existing budgets. `insights-maximum-import` remains broader capacity certification unless this work changes record/chunk/capacity boundaries. **P5.10 closes only after A/B/C, real browser/worker assembly and all owned host adapters are checked.**

## Build, QA and closure rules specific to this handoff

Use [TypeScript tooling](../TYPESCRIPT.md) and [QA rules](../../tests/README.md). Each completed outcome needs strict types/lint, a fresh build and generated verification/syntax, plus affected behavioral checks. The anchors above are existing `.mjs` paths, not proof they passed or a requirement to rerun every earlier group's tests. Run new/changed browser witnesses five times in isolation once they stabilize; thereafter rerun only evidence invalidated by later changes. Full QA remains Phase 7.

Update `build/module-manifest.mjs`, explicit tsconfig admission, runtime registration, source readers and coverage ownership together. `build/build.mjs` currently hardcodes a two-source Insights model/view bundle and checks model purity. If source splitting changes that list, replace the filename-count assumption with equally strong ordered-model-before-view, portability and page/worker startup checks. Keep one emitted Insights runtime URL unless a separately justified design requires otherwise; preserve CSP/trusted URLs, plugin identities, lazy loading and generated hashes.

Known baseline QA debt: `tests/browser/insights/insights-performance.mjs` still exposes the removed `CompatibilityCodecs` and seeds old-format fixtures. Repair this when preparing P5.10 evidence using current canonical fixtures/validation (the populated UI journey provides an example); retain dataset size, numerical meaning, worker/fallback assertions and performance budgets. Do not restore a compatibility adapter to satisfy the test. This is a source finding, not a newly executed test result.

Raw readers include `tests/helpers/drive-harness.mjs` and the Insights memory test; other tests slice runtime source. Adapt them to current owners and production erasure/composition while retaining the actual invariant. Coverage thresholds/provenance must follow new source owners; renaming/splitting must not drop high-risk computation from the inventory or imply coverage of code a test never executes.

At each parent closure reconcile source ownership, real provider contracts, semantic deltas and targeted evidence in the execution record. No required work may remain under an unrelated future phase. Final independent Phase 5 audit remains due after P5.13; this handoff adds no automatic interim review gate.
