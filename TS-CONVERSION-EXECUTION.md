# TypeScript conversion — execution record

## Current handoff — P5.10A CLOSED — TARGETED VERIFIED, 2026-11-17

- **Audit basis:** reread `AGENTS.md`, `docs/typescript/PHASE-5.md`, `docs/TYPESCRIPT.md` and the current P5.9 handoff, then traced the live Insights worker, host data, repository, classifier/Pacer, preview, cache, build and test seams from `ts-exp`. Verified source checkpoint: `c2095db383cf4e00a083def4f15e3e9611182228`.
- **Checked transport owner:** `insights-protocol.ts`, `insights-worker.ts` and `insights-compute.ts` now own discriminated RECORDS/BUILD/RESULT/ERROR transport, unknown-message validation, revision/request/part/index identity, 150-record chunks, 50,000-record retention bound and structured-clone wire data. The model remains single-source; local lazy `getLabEvidence()` never crosses the worker wire.
- **Lifecycle preserved and fenced:** same-revision worker-held data reuse, cancellation, worker replacement, 120 s idle retirement and worker-start/runtime failure fallback remain explicit. Result/error handling is fenced by request + revision + worker identity, so late events from a retired worker cannot reject or terminate its successor.
- **Environment topology preserved:** the generated Insights asset remains one URL ordered model → portable protocol → worker entry → browser compute bridge → view. DOM and WebWorker declarations stay in separate TS projects; the worker returns before rendering/view construction.
- **Read-only host boundary:** checked `insights-host.ts` now owns `PreviewRuntime`, `InsightsDataSource`, `AppInsights` and the typed preview-provider seam. `main.js` composes the real Saved Days repository plus canonical classifier/Pacer adapters. Saved data is read-only, Diary records are excluded, study date/provenance/revision are explicit, and pending Guide sample loads are generation-fenced against newer source choices.
- **Stale-cache protection:** retained-view loading now requires a stable source identity + dataset revision before preparing/caching/rendering evidence; source switches retry only within a bounded loop and otherwise abandon the stale load.
- **Regression ownership updated:** `guide-preview-canonical.mjs`, `insights-memory-retention.mjs` and new `insights-transport-lifecycle.mjs` cover canonical sample data, malformed/incomplete transport, cancellation during chunk transfer, stale result/error, startup/runtime failure, worker/fallback parity, same-revision reuse, idle retirement, preview races/provenance and Diary exclusion. Old runtime-resilience extraction was retired; security/runtime-source and coverage ownership now follow the checked split.
- **Targeted QA:** existing Insights workflow run `44080822215` at `c2095db` passed strict TypeScript + typed lint (226 checked TS files), scaling/memory/Guide/transport witnesses, fresh source build, generated build verification, generated syntax, Chromium discovery and the populated 590-day Insights browser journey. The browser journey used actual worker mode and transferred all 590 records.
- **Open by canonical ownership:** P5.10B native DOM renderer conversion and P5.10C retained-view/Lab conversion remain open; Guide sample production remains P5.11a and shared plugin-loader mechanics remain P5.13. Full QA was **not** run and remains Phase 7.
- **Disposition:** no known P5.10A source or targeted-evidence gap remains. P5.10A is closed without pulling later renderer/Lab/plugin-loader work forward.

## Last verified application checkpoint

`28c8c1d` is published on both `ts-exp` and `TS-Conversion`; P5.5–P5.7 are **CLOSED — AUDITED — TARGETED**. Production corrections at `6005b1c` and `e4b7aa6` protect lifecycle/Diary successors and attachment rollback/cleanup. Strict types/lint/build and targeted module/browser checks passed; full QA and hosted/device certification were not claimed. The [complete audit record](https://github.com/oneshubhamt/study-director/blob/28c8c1d/TS-CONVERSION-EXECUTION.md) owns exact selections, endpoints, five-run notes evidence, limitations and earlier history. Preparation/Phases 1–4 and P5.0–P5.4 retain their recorded completion, including prior audit corrections.

## Programme obligations

- F-001: each feature owns its host callbacks/callers; P5.13 receives thin composition only.
- F-002: adapt affected source/VM readers during conversion; Phase 6 owns remaining test/tooling conversion and transitional-reader retirement.
- F-003: distinguish targeted/local evidence from whole-app, hosted and device certification. Full QA remains Phase 7.
- REVIEW-P5: independent final audit after P5.13 against `de4872a`, including semantic changes and unresolved limits. Owner-requested interim audits do not replace it.
- Keep one current canonical topology with validation/recovery intact; no historical compatibility layers. Vendored Wordgard remains unchanged.

## Recovery and provenance

Earlier uncommitted work was lost in the 2026-11-12 workspace reset and reconstructed with fresh evidence. The 2026-11-16 resume preserved source edits but lost temporary logs; only previously observed results were retained, and interrupted checks were rerun. Continue committing/pushing coherent checkpoints rather than depending on an ephemeral workspace.

[Preparation/Phase 4](docs/typescript/HISTORY-PREPARATION-PHASE-4.md), [main-intake preservation](docs/typescript/snapshots/main-intake-2026-11-08/README.md) and the pinned audit history retain prior observations without duplicating them in active context.
