# TypeScript conversion — execution record

## Current handoff — P5.9/P5.10 OWNER-AUDIT CORRECTION CLOSED — TARGETED, 2026-11-19

- **Baseline and code/test head:** owner-authorized correction started from `ef246ad12f8f2aaeb680b728b7883e7874a84206`; production/test closure is `2088b43bddea3034eb938e5f503bbd717b9a36b8` on `ts-exp`. Production correction is `53f4c9689c34d39b7bc5db62916ff20f6a1fb96a`; `2088b43` only made the forecast witness capability-aware after hosted QA exposed an over-strong test assumption.
- **Strong-day semantics:** one checked `isStrongCompletion(value) => finite && value >= 80` now owns the documented **80%+** boundary for cascade, overall strong-day counting and workload/forecast labels. The prior rounded classifications are gone. Real-engine witnesses cover **79.49, 79.5, 79.9 and 80.0**, proving only 80.0 qualifies.
- **Independent P5.9 numerical evidence:** `insights-scaling` now verifies independently calculated weak-prior hierarchical shrinkage, a one-observation Current Study State posterior/uncertainty update and missing-day widening, hand-counted adjusted sequence/hazard direction and events, four-cell difference-in-differences with early/late stability, and rolling forecast/model-selection MAE, naive benchmark, base-rate Brier and calibration-bin arithmetic. Existing real-provider, horizon, conservation and worker-reuse evidence remains intact.
- **Lab transient ownership:** the history LRU remains **2 entries**. The engine retains at most one evicted entry only when its detailed Lab audit is materialized by the prior retained dashboard; a newer audited evictee clears the older orphan. `releaseTransient()` clears both live-LRU audits and that bounded evictee. The new regression proves an evicted retained model rebuilds equivalent Lab evidence after release.
- **Hosted Insights evidence:** run `44508466897` on `2088b43bddea3034eb938e5f503bbd717b9a36b8` passed strict TypeScript/lint (**228 checked / 0 unchecked**), all direct model/transport/render/prefetch/Lab/Guide witnesses, affected runtime architecture, fresh build, generated verification/syntax (**178 generated JS**), populated/lazy-Lab/retained Chromium **5/5**, and isolated performance **5/5** on the 590-day fixture. All five performance passes retained worker/fallback parity and zero-resend window switching; existing performance budgets passed.
- **Repository evidence:** run `44508466908` passed strict types/lint, targeted safety/repository contracts, source build, generated verification and generated syntax. No workflow, capacity limit, canonical data topology, worker/render architecture or compatibility layer changed.
- **Objective reconciliation:** all four owner-requested corrections/evidence objectives are closed. P5.9a/b are now **CLOSED — AUDITED — TARGETED**; P5.10 remains **CLOSED — AUDITED — TARGETED**. P5.11a remains the next programme outcome.
- **Limits:** this is targeted hosted closure, not whole-app/device certification. `insights-maximum-import`, full QA and Phase 7 certification remain intentionally open.

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
