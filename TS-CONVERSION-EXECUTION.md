# TypeScript conversion — execution record

## Current gate

**REVIEW-P5 closed. P6.0 is ready.** The independently audited runtime and test baseline is `66cffde8116fb0efb57fc95bad97958051ef4978` on `ts-exp`. Stage 2 corrected Insights collection handling, immediate Live Draft write lifetime and First Start password cancellation. Local strict/build checks, 170 fast tests, targeted Chromium, historical comparisons and all nine hosted workflows passed. Phase 7 owns device and promotion certification. [Stage 2 findings, coverage and limits](docs/typescript/REVIEW-P5-STAGE-2.md) · [P6.0 scope and executor command](docs/typescript/PHASE-6.md).

The [pinned Stage 1 handoff](https://github.com/oneshubhamt/study-director/blob/d5a53bc4/TS-CONVERSION-EXECUTION.md) retains the original per-pass objectives, last-JS anchors, historical analytical differences, failure/repair checkpoints and their verification. The [Stage 2 checkpoint before closure](https://github.com/oneshubhamt/study-director/blob/66cffde8/docs/typescript/REVIEW-P5-STAGE-2.md) preserves interim observations and environment limits.

## P6.0 · In progress

Inventory and benchmark the checked tooling, runners, contracts, tests and workflows against runtime `66cffde8`, documentation head `81efb6af` and F33 `d69f2053`. The four intervening files are documentation only. Protect existing behavior, data-safety floors, failure reporting and isolated browser contracts. End this pass with a measured baseline and a bounded P6.1 handoff.

- In a disposable archive, replacing the canonical-sort mutation with identical source let the test survive (runner exit 1). Adding an unrelated missing import to the test made the same neutral edit report KILLED (runner exit 0). P6.1 must distinguish infrastructure failure from a proven behavioral failure.
- With the production generated-case helper, seed 20261103 following 20261102 produced random draw 243 and generated device-1. Replaying 20261103 alone produced the same draw and device-0. Retention and sync consume the index; compare serialized inputs on replay.
- Corrected the restore requirement in the phase register against the actual provider branch and durable-byte assertions. Remaining work includes full file ownership/selection inventory, F33 mapping, timing and coverage/mutation baseline dispositions.

The [path inventory](docs/typescript/P6-BASELINE.tsv) assigns all 340 scoped paths to an environment, checking status, baseline selection and primary pass. Verified the four executable test directories exactly match fast discovery, the release registry and browser tiers. The 170 fast tests passed. The full risk-coverage command exited 1 because a Stage 1 change strengthened Library reference readback while its text anchor still names the old conditional; all 14 module floors passed. In a disposable copy matching the current guard restored the anchor observation. Suppressing that readback entirely still passed both library-clear and attachment-deletion behavioral suites. A separate six-file, zero-hit synthetic raw corpus was accepted by the standalone AST branch reporter (0/6036). P6.1 needs evidence provenance; P6.2 needs a controlled mismatched readback before retiring the safety anchor. The [P6.0 baseline and F33 dispositions](docs/typescript/P6-BASELINE.md) record why. All 14 unchanged mutation controls passed, but one reported kill exited 13 at an unsettled save-lane await. All three browser benchmarks completed: 49/59 passed; ten original failures are retained in the baseline pending isolated diagnosis.

## Programme obligations

- F-001: each feature owns its host callbacks/callers; P5.13 receives thin composition only.
- F-002: adapt affected source/VM readers during conversion; Phase 6 owns remaining test/tooling conversion and transitional-reader retirement.
- F-003: distinguish targeted/local evidence from whole-app, hosted and device certification. Full QA remains Phase 7.
- REVIEW-P5: independent final audit after P5.13 against `de4872a`, including semantic changes and unresolved limits. Owner-requested interim audits do not replace it.
- Keep one current canonical topology with validation/recovery intact; no historical compatibility layers. Vendored Wordgard remains unchanged.

## Recovery and provenance

Earlier uncommitted work was lost in the 2026-11-12 workspace reset and reconstructed with fresh evidence. The 2026-11-16 resume preserved source edits but lost temporary logs; only previously observed results were retained, and interrupted checks were rerun. Continue committing/pushing coherent checkpoints rather than depending on an ephemeral workspace.

[Preparation/Phase 4](docs/typescript/HISTORY-PREPARATION-PHASE-4.md), [main-intake preservation](docs/typescript/snapshots/main-intake-2026-11-08/README.md) and the pinned audit history retain prior observations without duplicating them in active context.
