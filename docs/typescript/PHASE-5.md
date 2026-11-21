# Phase 5 — scope, status and implementation handoff

The remaining source map is pinned to `6b16c82a` on `ts-exp`, following the P5.8–P5.10 audit. The [execution record](../../TS-CONVERSION-EXECUTION.md) owns current evidence. The [earlier handoff](https://github.com/oneshubhamt/study-director/blob/6b16c82a/docs/typescript/PHASE-5.md) preserves the detailed P5.8–P5.10 objectives and the [prior register](https://github.com/oneshubhamt/study-director/blob/28c8c1d/docs/typescript/PHASE-5.md) preserves earlier outcomes.

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
| P5.8 | CLOSED — AUDITED — TARGETED | Drive adapter plus connection, sync-status and profile-facing host behavior |
| P5.9a | CLOSED — AUDITED — TARGETED | Insights model foundations, records/windows and core analytics |
| P5.9b | CLOSED — AUDITED — TARGETED | Practice, study state/dynamics, coach and complete model engine |
| P5.10 | CLOSED — AUDITED — TARGETED | Insights compute boundary, presentation and retained UI/host integration |
| P5.11a | NOT STARTED | Guide content/runtime, preview producer and owned navigation/accessibility behavior |
| P5.11b | NOT STARTED | Glass, early presentation kernel/metadata, theme/preferences and first-paint contracts |
| P5.11c | NOT STARTED | Aurora runtime/registration and saved-skin switching |
| P5.12 | NOT STARTED | PWA lifecycle, install capture, service worker, update/offline/multi-tab behavior |
| P5.13 | NOT STARTED | Final shell/public capability/event/startup assembly; reconcile all authored runtime ownership and hand off to Phases 6/7 |

## Executor handoff

Start at P5.11a. Work from the current `ts-exp` source and its last verified behavior. Use the five-step procedure in [AGENTS](../../AGENTS.md) and the [branch decision](DECISIONS.md#branch-lifecycle-and-f30-parity). F30 parity is a later assignment. Development data creates no migration obligation. Preserve the current codecs, write ownership, failure recovery and rejection of unsupported data.

For each outcome, trace a real user action from the shipped entry point through its implementation and back to its observable result. Record the starting commit, affected callers, expected behavior and relevant failure cases before editing. Move feature logic and its callers together. Check the actual object passed to the host, registry or browser API, keep optional globals behind capability checks, and use separate DOM, portable and worker projects. When a defect surfaces, reproduce it against the old owner, preserve the better behavior and verify the correction through the same entry point. Recheck whether a delayed success, failure or cleanup can affect a newer operation.

### P5.11a — Guide, navigation and the Insights sample producer

**Owners.** Convert `source/external/guide.js`, including its plugin descriptor, handbook, template actions, Legal Center, install card and `SampleDataEngine.records`. Follow registration through the optional Guide tab in `source/host/main.js` and the checked preview consumer in `source/core/insights-host.ts`. Generic script loading stays with P5.13, install/update policy with P5.12.

**Acceptance.** Open Guide through normal navigation. Exercise keyboard selection, a template accepted and a template cancelled, and the 28-day sample opening in Insights and returning to saved data. Check the sample against the real record codec and verify that preview leaves canonical Saved Days untouched. Exercise legal-document navigation, Back/close and focus restoration. Delay a document read across a switch or close and verify which document and trigger retain ownership. Preserve the legal-document allowlist, sanitization and Trusted Types handling. Cover a registration retry so listeners and actions fire once.

**Starting evidence.** Adapt the raw Guide source reader in `tests/integration/insights/guide-preview-canonical.mjs` to the actual compiled source. Use `tests/browser/ui/interactions.mjs` for the Guide install UI and `tests/browser/insights/insights-populated-ui.mjs` for the preview round trip. Add the narrow missing assertion where a journey does not exercise the changed behavior.

### P5.11b — Glass, early presentation and preferences

**Owners.** Convert `source/host/presentation-kernel.js`, `source/host/presentation-metadata.js`, `source/external/glass.js` and the appearance controls and preference callbacks in `source/host/main.js`. Preserve inline placement after profile scope, the kernel symbol and registration contract, CSS tokens and metadata synchronization. Trace user changes through the existing protected-preference owner and its profile-scoped first-paint mirrors.

**Acceptance.** Check the document before main-app startup and again after preferences load. A new profile gets Glass without a preference write. A saved theme and skin survive registration and reload. Unknown values use the declared fallback. Switch profiles and verify the right mirror, metadata, controls and focus. Exercise light/dark, font scaling, reduced motion and the overlay coordinator through the built page. Check a failed or delayed preference save against the existing persistence semantics.

**Starting evidence.** Use `tests/unit/app/presentation-defaults.mjs`, `tests/architecture/app/presentation-contracts.mjs` and the affected cases in `tests/browser/ui/populated-accessibility.mjs`. Static CSS checks complement a real control-driven switch and reload.

### P5.11c — Aurora as an independent presentation

**Owners.** Convert `source/external/aurora.js` against the kernel from P5.11b. Preserve its public ID, style element, presentation axes and observer-driven overlay priorities. Check the real pack registration and its ready-event retry.

**Acceptance.** Start with saved Aurora and observe it before its pack registers. Load Glass, then switch Aurora → Glass → Aurora with an overlay open. Verify the selected skin, stylesheet and coordinator counts, cleared suppression attributes, display-tools availability and saved choice after reload. Repeated registration must leave one effective coordinator per pack. Extend the P5.11b presentation checks where existing tests use a stand-in descriptor or only set a DOM attribute. Close P5.11 when all three shipped paths have been exercised.

### P5.12 — Install capture, update safety and the service worker

**Owners.** Convert `source/host/install-capture.js` at its early inline position, `source/core/pwa-lifecycle.js`, the update reservation, UI and scheduling callbacks in `source/host/main.js`, and `source/platform/sw.js`. Preserve the capture bridge to native install capabilities. Type the actual page/worker messages and browser events in their respective projects. Admit the authored worker to `tsconfig.service-worker.json`, which currently contains a contract check only.

**Template change.** The unquoted `@@SD_CACHE_STORAGE_IDENTITIES@@` expression parses only after substitution. Use the quoted, safely encoded JSON pattern in `source/external/drive.ts` and `build/build.mjs` for this object. Decode to `unknown`, validate the required `shellPrefix` and `clientState` strings and keep the existing cache names. Retain the current precache manifest and verify its asset fields at the consumption boundary. Wire the platform build to erase types and emit classic `sw.js`. Check the real replacement, release/build/asset identities, worker-inclusive hash, integrity manifest and locally staged minified output. A raw-source compiler check and a generated-worker install exercise different failures.

**Acceptance.** Cover install-prompt capture before host startup and consumption through the existing UI. Exercise offline cold reload, a waiting update and a second tab still using the old shell. Check dirty editor/timer or backup work defers activation, a cancelled reservation releases its own guards, and a late controller event cannot reload the wrong page. Verify the intended activated controller before reload and confirm boot through the matching page/worker identity afterward. Exercise incomplete cache installation and retention for live clients. Retain the current reload-marker writer/reader contract and handle malformed markers without inventing a development-data upgrade path.

**Starting evidence.** Use `tests/integration/pwa/{native-capabilities,pwa-lifecycle,application-update-safety,service-worker-lifecycle,build-identity}.mjs`, `tests/architecture/pwa/pwa-updater-contract.mjs` and `tests/browser/pwa/{pwa-offline,pwa-update}.mjs`. Run the update journey in isolation as registered. Adapt build/VM readers and variant generators that depend on the original template. Verify both development and deployment output and the worker-manifest rewrite in `build/minify-release.py`.

### P5.13 — Final host assembly and Phase 5 handoff

**Owners.** Trace every remaining executable section of `source/host/main.js` and the inline markers in `source/app.html`. Finish optional plugin loading and retry, public `window.StudyDirector` capabilities, action dispatch and startup wiring. Assign any remaining feature algorithm to its checked feature owner. Replace the host’s bare build-token expressions with TypeScript-readable inputs using the authoritative contracts. Keep inline script order and check the real descriptors, callbacks and providers where they are composed.

**Acceptance.** Cold-start the built app with a new profile and reopen a populated profile. Verify public API publication and the ready event in relation to plugin registration, startup and PWA installation. Open an optional tab while it is loading, exercise failure and retry, and verify one registration and the correct active tab. Trace representative cross-feature actions through their real handlers. Compare the shipping manifest, host composition, service/processing worker entries and compiler project file lists. Account for every shipped JavaScript artifact by its checked authored source, generated output, immutable vendor or inert shell. Resolve any executable first-party runtime left outside strict checking.

**Starting evidence and exit.** Use `tests/architecture/app/{internal-module-boundary,runtime-boundaries}.mjs`, `tests/browser/security/runtime-boundary.mjs`, `tests/browser/app/core-flow.mjs` and affected startup/plugin journeys. Reconcile P5.0–P5.13 against the overall review baseline `de4872a`. Record the final implementation commit, intentional behavior changes, ownership inventory, actual checks and remaining certification work in the execution record. Hand Phase 5 to the owner for independent audit before Phase 6. Phase 6 covers the remaining first-party tooling/tests and Phase 7 covers full certification.

### Verification and handoff for each pass

Use the pinned toolchain. Run `npm run check:types`, a fresh `npm run build`, `npm run verify`, `npm run test:release:generated-syntax` and the affected behavioral checks above. Exercise type-gate and build-pipeline checks when changing project admission or erasure. Adapt source readers, coverage ownership and any affected minification checks in the same pass. Keep behavior assertions and performance budgets intact. For new or changed browser witnesses, run five isolated passes once stable under the existing QA rules.

In the execution record, name the feature entry point exercised, fixes and regression evidence, commands or hosted runs with their exact code commit, unresolved limits and the next outcome. Keep partial checkpoints distinct from targeted closure. Continue between passes under the existing delegation.
