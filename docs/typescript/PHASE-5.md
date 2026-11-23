# Phase 5 — scope, status and implementation handoff

The remaining source map is pinned to `6b16c82a` on `ts-exp`, following the P5.8–P5.10 audit. The [execution record](../../TS-CONVERSION-EXECUTION.md) owns current evidence. The [earlier handoff](https://github.com/oneshubhamt/study-director/blob/6b16c82a/docs/typescript/PHASE-5.md) preserves the detailed P5.8–P5.10 objectives and the [prior register](https://github.com/oneshubhamt/study-director/blob/28c8c1d/docs/typescript/PHASE-5.md) preserves earlier outcomes.

## Roadmap and ownership

The programme retains 14 top-level steps, P5.0–P5.13. Child IDs identify coherent outcomes, not mandatory sessions or recurring external reviews. Continue an open outcome through ordinary fixes and targeted verification; checkpoint useful progress without marking incomplete parents closed. Combine or revise boundaries when source dependencies justify it, recording the reason and the remaining owner.

| ID | Status | Owned outcome |
| --- | --- | --- |
| P5.0 | VERIFIED — TARGETED | Five host scripts extracted mechanically; manifest/build/source-reader integration |
| P5.1 | VERIFIED — TARGETED | Registry, interaction/navigation/overlay/notice/audio foundations and shared host helpers |
| P5.2 | CLOSED — AUDITED — TARGETED | Profiles, startup, native capabilities, bootstrap, identity and ownership integration |
| P5.3 | VERIFIED — TARGETED, audit corrected | Plan authoring, saved/default plans, durability and actual schedule-provider contracts |
| P5.4 | VERIFIED — TARGETED, audit corrected | Execution, timers, Active Session persistence, restoration, handoff and presentation |
| P5.5 | CLOSED — AUDITED — TARGETED | Review/Diary, saved-day presentation/completion, editor and lifecycle wiring |
| P5.6 | CLOSED — AUDITED — TARGETED | Library/notes/link/export behavior, editor/document/attachment lifetimes |
| P5.7 | CLOSED — AUDITED — TARGETED | Backup controls, reconciliation/recovery/history, maintenance/integrity/readiness |
| P5.8 | CLOSED — AUDITED — TARGETED | Drive adapter plus connection, sync-status and profile-facing host behavior |
| P5.9a | CLOSED — AUDITED — TARGETED | Insights model foundations, records/windows and core analytics |
| P5.9b | CLOSED — AUDITED — TARGETED | Practice, study state/dynamics, coach and complete model engine |
| P5.10 | CLOSED — AUDITED — TARGETED | Insights compute boundary, presentation and retained UI/host integration |
| P5.11a | CLOSED — AUDITED — TARGETED | Guide content/runtime, preview producer and owned navigation/accessibility behavior |
| P5.11b | CLOSED — AUDITED — TARGETED | All three presentations from first paint through selection and reload, including both external packs |
| P5.12 | CLOSED — AUDITED — TARGETED | Install and safe update from the page through the emitted worker, including offline and multi-tab behavior |
| P5.13 | CLOSED — AUDITED — TARGETED | Public plugin contract, final host assembly and reconciliation of all shipped runtime sources |

## Executor handoff

P5.13 is closed at the implementor-targeted level after the third de novo whole-programme audit and exact-head hosted rerun; the execution record carries the exact source/evidence heads, corrections and remaining certification boundary. P5.11a/b and P5.12 retain their prior targeted closure. Pause before Phase 6 for the independent overall Phase-5 audit required by [AGENTS](../../AGENTS.md). Work from the current `ts-exp` source and its last verified behavior. The [branch decision](DECISIONS.md#branch-lifecycle-and-f30-parity) still applies; F30 parity is a later assignment. Development data creates no migration obligation. Preserve the current codecs, write ownership, failure recovery and rejection of unsupported data.

For each outcome, trace a real user action from the shipped entry point through its implementation and back to its observable result. Record the starting commit, affected callers, expected behavior and relevant failure cases before editing. Move feature logic and its callers together. Check the actual object passed to the host, registry or browser API, keep optional globals behind capability checks, and use separate DOM, portable and worker projects. When a defect surfaces, reproduce it against the old owner, preserve the better behavior and verify the correction through the same entry point. Recheck whether a delayed success, failure or cleanup can affect a newer operation.

### P5.11a — Guide, navigation and the Insights sample producer

**Owners.** Convert `source/external/guide.js`, including its plugin descriptor, handbook, template actions, Legal Center, install card and `SampleDataEngine.records`. Follow registration through the optional Guide tab in `source/host/main.js` and the checked preview consumer in `source/core/insights-host.ts`. Generic script loading stays with P5.13, install/update policy with P5.12.

**Acceptance.** Open Guide through normal navigation. Exercise keyboard selection, a template accepted and a template cancelled, and the 28-day sample opening in Insights and returning to saved data. Check the sample against the real record codec and verify that preview leaves canonical Saved Days untouched. Exercise legal-document navigation, Back/close and focus restoration. Delay a document read across a switch or close and verify which document and trigger retain ownership. Preserve the legal-document allowlist, sanitization and Trusted Types handling. Cover a registration retry so listeners and actions fire once.

**Starting evidence.** Adapt the raw Guide source reader in `tests/integration/insights/guide-preview-canonical.mjs` to the actual compiled source. Use `tests/browser/ui/interactions.mjs` for the Guide install UI and `tests/browser/insights/insights-populated-ui.mjs` for the preview round trip. Add the narrow missing assertion where a journey does not exercise the changed behavior.

### P5.11b — Director, Glass and Aurora from first paint through reload

**Owners.** Convert `source/host/presentation-kernel.js`, `source/host/presentation-metadata.js`, both startup packs in `source/external/{glass,aurora}.js` and the appearance controls and preference callbacks in `source/host/main.js`. Director (`director-current`) is built into the kernel and styled by `source/styles/core.css`. The kernel also knows the Glass and Aurora profiles before either pack loads. The packs currently use matching CSS and installer logic under their own presentation names. Convert them together and retain both shipped assets, saved IDs, stylesheets and overlay state. This absorbs the former P5.11c.

**Acceptance.** Observe the built document after profile scope and the inline kernel run, then after pack registration and preference loading. A fresh profile selects Glass without writing a preference. A saved Director, Glass or Aurora appears before registration and remains selected afterward. A well-formed unregistered ID falls back to Director. Use the appearance controls to switch among all three in light and dark themes and reload a saved choice. Switch profiles and check the correct first-paint mirror, metadata, controls and focus. Preserve font scaling, reduced motion and the existing behavior of failed or delayed protected-preference writes.

With an overlay open, switch Aurora → Glass → Director → Aurora. Check overlay priority, cleanup of the previous pack’s suppression state, and availability of display tools. Repeat pack registration and exercise the ready-event retry. Each pack should leave one stylesheet and one effective observer.

**Starting evidence.** Use `tests/unit/app/presentation-defaults.mjs`, `tests/architecture/app/presentation-contracts.mjs` and the affected cases in `tests/browser/ui/populated-accessibility.mjs`. Exercise the shipped assets and a control-driven switch and reload wherever existing checks use a stand-in descriptor or set a DOM attribute directly.

### P5.12 — Install capture, update safety and the service worker

Work through the two ends of one installed-app update. Each checkpoint has a runnable result. The executor can complete both in one pass and record shared release evidence once.

**Page checkpoint (P5.12a).** Convert the early inline `source/host/install-capture.js`, `source/core/pwa-lifecycle.js` and the update reservation, UI and scheduling callbacks in `source/host/main.js`. Type the page’s actual messages and native events. Exercise the converted page with the current generated worker. Capture an install prompt before host startup and consume it through the Guide UI. With a waiting update, verify dirty editor, timer or backup work defers activation, a cancelled reservation releases its own guards, and a stale controller event cannot reload the page. Check the controller identity before reload and preserve the reload marker’s writer, reader and malformed-input handling. Start with `tests/integration/pwa/{native-capabilities,pwa-lifecycle,application-update-safety}.mjs` and the affected install/update UI paths.

**Worker and integration checkpoint (P5.12b).** Convert `source/platform/sw.js` in `tsconfig.service-worker.json` and check the receiving and replying sides of the same protocol. The authored worker currently contains a bare `@@SD_CACHE_STORAGE_IDENTITIES@@` expression. Use the safely encoded, quoted JSON pattern in `source/external/drive.ts` and `build/build.mjs`. Decode to `unknown`, validate the required `shellPrefix` and `clientState` strings, and retain their cache names. Keep the precache manifest and validate its asset fields at consumption. Wire type erasure into the platform build so the output remains a classic `sw.js`. Verify release/build/asset identities, the worker-inclusive hash, integrity manifest and the worker-manifest rewrite in `build/minify-release.py` against actual build output.

Exercise incomplete cache installation, offline cold reload and cache retention while an older tab is open. Drive a waiting update through activation and reload and confirm that the booted page and controller agree on identity. Use `tests/integration/pwa/{service-worker-lifecycle,build-identity}.mjs`, `tests/architecture/pwa/pwa-updater-contract.mjs` and `tests/browser/pwa/{pwa-offline,pwa-update}.mjs`. Run the update journey in isolation as registered. Adapt build/VM readers and variant generators to the converted source. Check development and locally staged minified deployment output.

### P5.13 — Final host assembly and Phase 5 handoff

At entry, map the remaining executable sections in `source/host/main.js` and the inline markers in `source/app.html` to their owners. Use that map through the following checkpoints. A remaining feature algorithm belongs with its checked feature owner.

**Public API and optional plugin checkpoint (P5.13a).** Convert the generic loader, tab registration and retry, and the construction of the frozen `window.StudyDirector` capability object. Type-check the actual providers at composition. Keep public API publication and the ready event at their existing positions in the running shell. Open a shipped optional tab through normal navigation, exercise a failed load and retry, and switch tabs while a load is pending. Check active-tab ownership, capability checks and single registration through the real public API. Start with `tests/architecture/app/{internal-module-boundary,runtime-boundaries}.mjs`, `tests/browser/security/runtime-boundary.mjs` and the affected optional-tab journey.

**Host startup and closure checkpoint (P5.13b).** Finish strict checking of the host entry point, remaining action dispatch, DOM event binding and startup composition. Replace bare host build-token expressions with TypeScript-readable inputs backed by their authoritative contracts. Preserve inline script order, deferred callbacks, public API publication and ready notification before startup and PWA installation. Cold-start the built app with a new profile, reopen a populated profile and exercise representative cross-feature actions through their real handlers, including an ownership-protected action in a secondary tab. Use `tests/integration/app/startup-lifecycle-module.mjs`, `tests/browser/app/core-flow.mjs` and the affected action journeys.

To close P5.13, reconcile the shipping manifest, host composition, service/processing worker entries and compiler project file lists. Trace each shipped JavaScript artifact to checked authored source, generated output with a known producer, immutable vendor or inert shell. Resolve every executable first-party runtime left outside strict checking. Reconcile P5.0–P5.13 against `de4872a`. Record the final implementation commit, intentional behavior changes, source inventory, actual checks and remaining certification work. Hand Phase 5 to the owner for independent audit before Phase 6. Phase 6 covers the remaining first-party tooling/tests and Phase 7 covers full certification.

### Verification and handoff for each pass

Use the pinned toolchain. Run `npm run check:types`, a fresh `npm run build`, `npm run verify`, `npm run test:release:generated-syntax` and the affected behavioral checks above. Exercise type-gate and build-pipeline checks when changing project admission or erasure. Adapt source readers, coverage ownership and any affected minification checks in the same pass. Keep behavior assertions and performance budgets intact. For new or changed browser witnesses, run five isolated passes once stable under the existing QA rules.

In the execution record, name the feature entry point exercised, fixes and regression evidence, commands or hosted runs with their exact code commit, unresolved limits and the next outcome. Keep partial checkpoints distinct from targeted closure. Continue between passes under the existing delegation.
