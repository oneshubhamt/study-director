# TypeScript conversion — execution record

## Current handoff — P5.9B ACTIVE, 2026-11-17

- **Branch / baseline:** `ts-exp` at `94e4193b0feb69964bb8bf7fd519f261df257511`. P5.9A source is implemented; its two direct Insights behavioral witnesses remain open and are naturally included in P5.9B evidence.
- **Outcome:** strictly convert M8.5 Practice Pacer evidence, M8.6 current study state, M8.7 dynamics, M8.8 coach and M8.11 engine/assembly, preserving the single portable model consumed unchanged by P5.10.
- **Invariants:** reuse the checked P5.9A foundations and real canonical outcome/Practice Pacer providers; preserve thresholds, deterministic trend/forecast/calibration semantics, confidence/insufficiency states, compact-vs-detailed Lab evidence, cache keys/limits and transient release; prepared inputs remain immutable across consumers.
- **Design boundary:** remove the classic-script model remainder as an algorithm owner by converting the existing M8.5–M8.8/M8.11 factories into checked portable TypeScript at their current dependency seams. Keep one final `StudyDirectorInsightsModel` contract and one emitted Insights runtime; no generic record-bag facade or duplicate compute implementation.
- **Targeted evidence:** direct `tests/integration/insights/insights-scaling.mjs` and `insights-memory-retention.mjs`; threshold-adjacent/degenerate numerical witnesses where gaps are found; fresh-build `tests/browser/insights/insights-populated-ui.mjs`; strict types/lint, source build, generated verification and syntax. Browser evidence will be run on a fresh build; full QA is excluded.
- **Closure rule:** reconcile every M8.5–M8.8/M8.11 export, provider and P5.10 consumer against resulting source. P5.9 closes only when the entire model and real assembly are checked and required targeted evidence passes; otherwise keep the concrete blocker open.

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
