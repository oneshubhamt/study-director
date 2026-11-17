# TypeScript conversion — execution record

## Current handoff — P5.9A IMPLEMENTED — TARGETED BEHAVIORAL QA OPEN, 2026-11-17

- **Branch / actual baseline:** `ts-exp`; P5.9A began from `bbc6c0afe726c8f2f6ed521efdc3b36998921ad3` (the immediately preceding P5.8A documentation-only revalidation). P5.8 source was not reopened or rewritten.
- **Implemented outcome:** M8.1 configuration, M8.2 primitives, M8.3 records/windows and M8.4 core analytics now have the checked portable owner `source/external/insights-foundations.ts`. It reuses canonical task/outcome/completion and record-model types, carries explicit analytical evidence types, and has no DOM/storage/worker dependencies. M8.5+ remains visibly unchecked in `source/external/insights-model.js` for P5.9B.
- **Real assembly:** the typed foundations publish one versioned in-runtime foundation contract consumed by the P5.9B remainder before the existing final `StudyDirectorInsightsModel` assembly. `build/module-manifest.mjs` preserves one `sd.insights` runtime in ordered `foundations.ts → model remainder.js → view.js` form; `build/build.mjs` now applies production token rendering/type erasure per mixed source rather than relying on a joined filename suffix.
- **Semantics/invariants:** window and study-date rules, ordering/deduplication, denominators, rounding, thresholds and analytical formulas remain the extracted implementation. Strict typing now distinguishes nullable evidence from measured zero, types numeric/index/Map invariants explicitly and removes unchecked collection bags; no historical-format adapter was introduced.
- **Readers/tests/coverage:** `tests/helpers/insights-model-runtime.mjs` makes Insights source readers follow the manifest and production erasure path. Scaling and memory-retention tests now consume that real split; scaling adds hand-computable witnesses for empty evidence, missing-vs-zero, exact 30-day boundaries and planned/completed aggregate conservation. Coverage ownership moves M8.1–M8.4 to the TS owner while the JS remainder is explicitly P5.9B.
- **Source/build evidence at `6d045d40a70b4bc3628d683dfc4d94d4af5dc74c`:** Repository checks run `44031470445` passed strict TypeScript + typed lint, targeted safety/repository contracts, fresh source build, generated-build verification and generated syntax. P5.8A lane `44031470528` also passed on the same source, providing a secondary mixed-build/provider regression check.
- **Unrelated retained workflow:** P5.7 browser run `44031470516` fails before build in the pre-existing backup session-port fixture path; baseline run `44029159937` fails the same repository-restore/restore-assets contract before P5.9A. It is not P5.9A evidence and was not modified here.
- **OPEN evidence obligation:** the required direct executions of `tests/integration/insights/insights-scaling.mjs` and the relevant `insights-memory-retention.mjs` cases have **not** been run on this source. The retained push workflows do not invoke them; the only existing generic promotion workflow is broad/full non-browser QA, which this pass must not run, and repository workflow changes require separate authorization. The witnesses were strengthened but are not claimed green.
- **Disposition:** source implementation and objective reconciliation are complete, but P5.9A remains **OPEN — TARGETED BEHAVIORAL QA REQUIRED** until those two direct Insights witnesses are executed and pass. P5.9B has not started. Full QA was **not** run.

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
