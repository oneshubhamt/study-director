# TypeScript conversion — execution record

## Current handoff — P5.9 CLOSED — VERIFIED — TARGETED, 2026-11-17

- **Branch / baseline / closure source:** `ts-exp`; P5.9B began from `94e4193b0feb69964bb8bf7fd519f261df257511`. The verified source/test checkpoint is `b20f162de2ba5a497686fe8530f17dbdef138229`; P5.10 is **not started**.
- **Outcome:** P5.9a/b are complete. M8.1–M8.11 have one canonical portable owner, `source/external/insights-model.ts`; the temporary P5.9A split/symbol handoff is retired. The single emitted Insights asset remains `external/insights-model.ts → external/insights.js`.
- **Checked contracts:** M8.5 Practice Pacer, M8.6 study state, M8.7 dynamics, M8.8 coach and M8.11 engine/cache/assembly use concrete/discriminated evidence and availability types. P5.10-facing type-only contracts are exported; evidence decoration preserves concrete result types. The model has no DOM/storage/worker dependency, `any`, blanket assertion facade or TS suppression.
- **Provider/data semantics:** the host still supplies canonical outcome classification and Practice Pacer summarization; worker preparation consumes host-precomputed canonical evidence rather than reimplementing providers. Missing versus zero, thresholds/rounding, deterministic trend/forecast/calibration behavior, confidence/insufficiency states, prepared-input immutability, compact/detailed Lab evidence, 2/2 caches, context-sensitive cache keys and `releaseTransient()` behavior are preserved.
- **Targeted witness strengthening:** Insights tests now execute the real domain Outcome and Practice Pacer providers and cover 79.9/80 pace classification, malformed Pacer rejection, canonical outcome classes, one-day weak fitness evidence, 11/12-day change-point readiness, exact window/aggregate conservation, cache LRU/context separation, transient Lab rebuild parity and immutable prepared input.
- **QA corrections discovered by direct execution:** the first targeted run exposed a test runtime-reader path bug (`external/...` resolved from repository root); `tests/helpers/insights-model-runtime.mjs` now resolves manifest sources under `source/`. The next run exposed a cross-realm strict-equality artifact in the calendar-boundary witness; the assertion now materializes the VM sequence into a host array without changing expected dates.
- **Direct P5.9 evidence:** targeted workflow `P5.9 targeted Insights closure` run `44043706657` **PASS** at `b20f162...`: strict types/lint; `insights-scaling.mjs` **PASS**; `insights-memory-retention.mjs` **PASS**; fresh build; generated verification/syntax; Chromium; fresh-build `insights-populated-ui.mjs` **PASS** in worker mode on 590 saved days with zero desktop/phone overflow.
- **Companion gates at the same checkpoint:** Repository checks `44043706591` **PASS** and P5.8A regression lane `44043706451` **PASS**. The retained P5.7 workflow still fails in its pre-existing backup session-port fixture path and is unrelated to P5.9.
- **Disposition:** P5.9 is **CLOSED — VERIFIED — TARGETED**. The authorized narrow `.github/workflows/p59-targeted-insights.yml` remains as an Insights regression lane for subsequent `ts-exp` work. Full QA was **not** run; broader certification remains Phase 7.

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
