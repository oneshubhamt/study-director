# TypeScript conversion — execution record

## Current handoff — P5.10C ACTIVE, 2026-11-17

- **Baseline:** `e2c2fd32c4b5647618a1d5f37043a43ceefd4cde` on remote `ts-exp`; P5.10A/B remain targeted-verified.
- **Outcome:** convert M8.10 Analytics Lab, M8.12 retained view and M8.13 Insights plugin runtime end to end, including lazy Lab computation, retained render/prefetch lifecycle, tab leave/re-entry, refresh/window/demo switching, observers/timers, worker inactivity release and Insights-owned registration/preload callbacks.
- **Ownership:** keep P5.10A compute/data and P5.10B renderer unchanged except justified defects. Shared generic optional-plugin loading stays with P5.13; Insights-specific boot/registration and the host preload scheduler belong here.
- **Design:** extract checked `insights-analytics-lab.ts` and `insights-retained-view.ts`, add a final checked `insights-runtime.ts` composition/boot owner, and reduce `insights.js` to non-executable historical source text because repository deletion requires separate authorization. Extend `insights-host.ts` only for the Insights preload scheduler/window capability where needed; host remains thin composition.
- **Lifecycle invariants:** stale render/prefetch/error cannot alter newer DOM/status/focus/cache; refresh failure retains the last usable view with truthful retry/busy state; lazy Lab evidence remains released/rebuilt correctly; scroll/window preference and demo/source revision remain fenced; worker is released when inactive; registration preserves capability negotiation/startup order.
- **Evidence:** strict TS/lint; `render-lifecycle`, `guide-preview-canonical`, `insights-memory-retention`; repaired canonical `insights-performance` plus `insights-populated-ui`. Run performance alone and preserve budgets. Fresh build + generated verification/syntax. Stabilized new/changed browser witnesses are run five times in isolation before closure.
- **Open outside this pass:** P5.11a Guide producer conversion, P5.13 shared plugin-loader mechanics and Phase 7 full QA. `insights-maximum-import` remains broader capacity certification unless this pass changes record/chunk/capacity boundaries.

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
