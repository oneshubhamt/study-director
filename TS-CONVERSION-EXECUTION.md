# TypeScript conversion — execution record

## Current handoff — P5.10C CLOSED — TARGETED VERIFIED, 2026-11-17

- **Baseline and checkpoint:** P5.10C started from `e2c2fd32c4b5647618a1d5f37043a43ceefd4cde`; targeted-verified source/test checkpoint is `1fde45580d20f99e363fe4ef463ec03be543916c`. P5.10A/B remain intact, so the P5.10 parent outcome is now source-closed and targeted-verified.
- **Runtime ownership:** M8.10 Analytics Lab, M8.12 retained view and M8.13 Insights plugin runtime now live once in checked `source/external/insights-runtime.ts`. `source/external/insights.js` is an inert tracked shell because deletion needs separate repository authorization. The emitted Insights URL remains one ordered asset: model → protocol → worker → compute → renderer → retained runtime → inert shell.
- **Lifecycle/fencing:** retained refresh keeps the last usable report on failure with truthful in-place Retry/busy state; stale render errors, prefetch results and prefetch errors are identity/generation fenced; tab leave releases worker/transient Lab state; window preference, scroll restoration, progressive rendering and lazy Lab evidence remain intact.
- **Host adapters:** `insights-host.ts` owns bounded window device state, Insights preload scheduling and the public preview adapter; `main.js` is thin composition. Shared generic `PluginRuntime` remains intentionally open for P5.13. Registration still fails closed on missing capabilities and preserves immediate-or-`studydirector:ready` startup order.
- **Demo/source correctness:** real-browser empty → 28-day demo → back-to-saved switching exposed and fixed two host/sample defects: the public one-object `preview.useSample` adapter had been wired to the internal two-argument function, and preview records were being strict-codec materialized twice, silently producing a zero-record demo. Preview records are now materialized once and source/revision fencing remains authoritative.
- **Guide dependency fix only:** the still-unconverted P5.11a Guide sample producer was minimally repaired to emit current-canonical nested DailyResult evidence (canonical UTC pause timestamps, omitted false optional flags and omitted empty `pauseEvents`). `guide-preview-canonical` now validates all 28 records through the real checked DailyRecord/Practice Pacer codecs. This does not close or pull forward Guide conversion.
- **Targeted QA:** workflow `44121240178` at `1fde455` passed main job `134172854701` and isolated performance job `134173685194`. Strict TypeScript + typed lint covered **228 TS files** with zero unchecked TS; direct model/transport/Lab/render/prefetch/Guide witnesses, affected architecture, fresh build, generated verification and syntax all passed.
- **Real browser evidence:** populated/lazy-Lab/retained journey passed **5/5** with empty saved data, 28-day demo, return to saved data, one-day insufficient evidence, 590-day populated evidence, lazy Lab construction, retained re-entry, narrow layout and the real worker path; dense runs transferred all 590 records.
- **Performance evidence:** `insights-performance` passed **5/5 in isolation** on the 590-day fixture with unchanged budgets (settled complete ≤1000 ms, shell ≤100 ms, DOM chunk ≤100 ms, computed open ≤2000 ms). Representative final-pass medians were settled 45.9 ms, rebuild 351.6 ms, cold 350.2 ms and fallback 294.8 ms; worker/fallback parity, zero-resend window switching, worker-constructor fallback, fresh-session worker recovery and no-worker prefetch suppression all passed.
- **Closure audit:** checked retained runtime has zero explicit `any`/TS suppressions; worker exit precedes renderer/DOM construction; each M8.10/M8.12/M8.13 owner appears once; legacy shell has no executable runtime; old host preload function and performance `CompatibilityCodecs` are absent. Capacity/chunk limits were unchanged, so `insights-maximum-import` remains broader certification.
- **Open by canonical ownership:** P5.11a Guide conversion and P5.13 shared plugin-loader mechanics remain open. Final independent Phase 5 audit is still due after P5.13. Full QA was **not** run; Phase 7 owns it.
- **Disposition:** no known P5.10C or P5.10 parent source/targeted-evidence gap remains.

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
