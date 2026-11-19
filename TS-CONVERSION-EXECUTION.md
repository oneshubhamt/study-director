# TypeScript conversion — execution record

## Current handoff — P5.9/P5.10 OWNER-AUDIT CORRECTION IN PROGRESS, 2026-11-19

- **Baseline:** owner-authorized corrective pass from `ef246ad12f8f2aaeb680b728b7883e7874a84206` on `ts-exp`, following the de-novo P5.9/P5.10 audit. No other branch is in scope.
- **Objectives:** (1) make the documented **80%+ strong-day** boundary exact throughout model counting and workload/forecast labels; (2) add independent numerical witnesses for hierarchical posterior shrinkage, Current Study State filtering, adjusted sequence/hazard modelling, forecast calibration/model selection and interaction stability; (3) release detailed Lab evidence even when its history entry has already fallen out of the two-entry LRU; (4) rerun the retained P5.9/P5.10 targeted/architecture/build gate plus populated UI **5×** and isolated performance **5×**.
- **Invariants:** preserve canonical Saved Days, worker/fallback parity, cache keys/limits, model methods and UI behavior except the proven threshold correction; no compatibility layer, capacity change, workflow change or broader redesign.
- **Design:** keep the history cache at two entries. The model engine will remember at most one evicted entry whose detailed Lab audit is still materialized, because only the prior retained view can legitimately need an evicted audit; a newer audited eviction supersedes and clears the older orphan. `releaseTransient()` clears both the live LRU and that retained orphan.
- **Planned evidence:** extend the existing `insights-scaling` and `insights-memory-retention` owners rather than creating algorithm-specific files; retain the current P5.10C hosted workflow for strict types/lint, direct lifecycle/model witnesses, affected architecture, fresh build/generated verification/syntax, populated Chromium 5× and performance 5×.
- **Status:** implementation and hosted evidence pending. Full QA / maximum-import / device certification remain outside this corrective pass.

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
