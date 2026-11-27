# TypeScript conversion — execution record

## Current gate

**P6.0 inventory complete. Proceed to P6.1 only.** Application/test baseline `66cffde8116fb0efb57fc95bad97958051ef4978`, REVIEW-P5 handoff `81efb6af`, F33 `d69f2053`. P6.0 changed programme documentation. [Measured baseline and F33 reconciliation](docs/typescript/P6-BASELINE.md) · [340-path inventory](docs/typescript/P6-BASELINE.tsv) · [P6.1 executor instructions](docs/typescript/PHASE-6.md#p61-executor-handoff).

- All 170 fast tests passed. Whole-suite risk coverage failed on a stale Library verification snippet despite all 14 numeric floors passing. A disposable removal of the stronger whole-record readback guard survived both relevant behavioral suites. P6.1 owns truthful coverage reporting; P6.2 owns the missing behavioral witness.
- The mutation runner labeled a missing import a successful kill, and one of the 14 stock kills was an unsettled await. Replaying a non-first generated seed changed case identity. The branch reporter accepted six zero-hit files. These are the first P6.1 runner acceptance cases.
- All 59 browser scenarios ran. Forty-nine passed in their original tiers. Three of ten failures passed unchanged on isolated retry; seven reproduced. The baseline assigns each failure to an owner and distinguishes observations from proposed corrections. Preserve these failures when converting the tools. Capacity restore remains a priority for P6.2.
- Phase 7 retains device and promotion certification. Phase 8 retains F33 convergence and SDVC1. [Independent Phase 5 decision](docs/typescript/REVIEW-P5-STAGE-2.md) · [Pinned Stage 1 history](https://github.com/oneshubhamt/study-director/blob/d5a53bc4/TS-CONVERSION-EXECUTION.md).

## Programme obligations

- F-001: each feature owns its host callbacks/callers; P5.13 receives thin composition only.
- F-002: adapt affected source/VM readers during conversion; Phase 6 owns remaining test/tooling conversion and transitional-reader retirement.
- F-003: distinguish targeted/local evidence from whole-app, hosted and device certification. Full QA remains Phase 7.
- REVIEW-P5: independent final audit after P5.13 against `de4872a`, including semantic changes and unresolved limits. Owner-requested interim audits do not replace it.
- Keep one current canonical topology with validation/recovery intact; no historical compatibility layers. Vendored Wordgard remains unchanged.

## Recovery and provenance

Earlier uncommitted work was lost in the 2026-11-12 workspace reset and reconstructed with fresh evidence. The 2026-11-16 resume preserved source edits but lost temporary logs; only previously observed results were retained, and interrupted checks were rerun. Continue committing/pushing coherent checkpoints rather than depending on an ephemeral workspace.

[Preparation/Phase 4](docs/typescript/HISTORY-PREPARATION-PHASE-4.md), [main-intake preservation](docs/typescript/snapshots/main-intake-2026-11-08/README.md) and the pinned audit history retain prior observations without duplicating them in active context.
