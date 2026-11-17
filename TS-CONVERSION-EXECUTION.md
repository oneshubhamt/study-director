# TypeScript conversion — execution record

## Current handoff — P5.9A ACTIVE, 2026-11-17

- **Branch / baseline:** `ts-exp` at `742e448408b48706b2a005f29c2e7e006e250c2a`. P5.8 is already implemented/reconciled and remains untouched except for legitimate checked consumer seams.
- **Outcome:** strictly convert M8.1 configuration, M8.2 primitives, M8.3 records/windows and M8.4 core analytics from the classic Insights model into portable TypeScript, preserving one assembled Insights runtime and leaving M8.5+ explicitly owned by P5.9B.
- **Invariants:** reuse canonical record/task/outcome/Practice Pacer types; represent only real derived analytical fields separately; preserve missing-vs-zero, calendar/window boundaries, ordering, normalization/deduplication, denominators, rounding and thresholds; no DOM/storage/worker APIs in the model.
- **Topology plan:** extract the existing M8.1–M8.4 factories at their dependency seam, expose one checked foundations contract to the unchanged P5.9B remainder, and update manifest/build/source readers so mixed TS/JS runtime sources use the production erasure path in source order. No declaration facade for unchecked algorithms.
- **Targeted evidence:** strict types/lint; `tests/integration/insights/insights-scaling.mjs`; relevant foundation/cache portions of `insights-memory-retention.mjs`; focused hand-computable edge/conservation witnesses added in the existing Insights suite where needed; fresh source build, generated verification and generated syntax. Full QA is not in scope.
- **Closure rule:** reconcile every P5.9A export and remaining-model consumer against the resulting source. Keep any required unfinished work explicitly open; do not mark P5.9A complete on a renamed-only or partially wired split.

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
