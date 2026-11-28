# TypeScript conversion — execution record

## Current gate

**P6.1 complete with an independent replay correction. P6.2 is ready.** Application/test baseline `66cffde8116fb0efb57fc95bad97958051ef4978`, P6.1 start `6805687e5f20b9b88a0c9d67b254a9b54ccdacb3`, executor-verified code `a3d6ae2251e45eec387a658ecdb7f0acb8bef3c9`, corrected runner `b05419ea`. [Measured baseline and F33 reconciliation](docs/typescript/P6-BASELINE.md) · [340-path inventory](docs/typescript/P6-BASELINE.tsv) · [P6.2 executor handoff](docs/typescript/PHASE-6.md#p62-executor-handoff).

## P6.1 · Closed

- All 80 P6.1-assigned paths were reconciled against the frozen P6.0 inventory. Each of the 61 JavaScript implementation entries has a strictly checked TypeScript owner; stable `.mjs` entry names and the CJS worker preload remain forwarding boundaries. Native launchers, Python and declarative configuration remain native.
- Test discovery/execution is hermetic and mixed JS/TS capable before dependency installation, with isolated temporary state, failure propagation, repository-clean checks and preserved selection/bail semantics. Ordinary test IDs were preserved; two focused regression tests were added.
- Mutation evidence now requires passing controls and attributes kills to the intended assertion. The hosted calibration distinguishes survive, intended kill, unrelated assertion, setup failure, timeout and unsettled await; all 14 permanent mutations are killed by their intended witnesses.
- Generated cases retain stable family/seed/index identity and bounded input traces. Hosted replay reproduced exact traces for sync merge rules 20261103, retention rules 20261006, timer rules 20261104 and restored focus 20261105.
- Coverage receipts bind run ID, source/runtime identity, exact discovered tests and artifact hashes. Full risk coverage passes all 14 numeric floors and ten critical paths; targeted receipts and deliberately missing artifacts are rejected. The full 139-test raw receipt is reused by the AST branch reporter instead of rerunning the same instrumented suite.
- Promotion keeps the independent uninstrumented correctness gate and its existing trigger/admission policy. Only duplicate branch-coverage execution was removed by reusing same-run provenance-checked evidence.
- The final compression failure was a stale contract, not a P6.1 graph regression. The pre-P6.1 application baseline `66cffde8` built the lean rich-text bundle at 78 modules / 116,788 Brotli bytes in generated-runtime run 45951587460; verified P6.1 code builds the identical 78 / 116,788 boundary. The stale 77 / 116,500 assertions were corrected to those exact zero-headroom baseline ceilings rather than granting new growth.
- [P6.1 tooling evidence 46044461815](https://github.com/oneshubhamt/study-director/actions/runs/46044461815) is fully green on `a3d6ae22`: strict type/lint, four exact replay comparisons, mixed dependency-free execution, mutation calibration/cleanup, 14 permanent mutations, full risk coverage, all 172 uninstrumented fast tests, full receipt reuse plus targeted/missing-artifact rejection, complete `npm run test:release`, generated artifact stability, build/verify and PWA smoke. [Repository checks 46044461809](https://github.com/oneshubhamt/study-director/actions/runs/46044461809) also pass on the same SHA.
- P6.0's seven reproduced browser failures and three intermittent observations remain assigned to P6.2–P6.4; none was waived or converted into a P6.1 success claim. Phase 7 still owns full application/device/promotion certification; Phase 8 retains F33 convergence and SDVC1.
- Independent review at `b4b4cf51` reproduced a passing timer run with both generated counts zero under a mistyped family, and a successful replay aimed at a file without generated scenarios. Correction `b05419ea` rejects both and rejects filters on broad suite commands. The targeted runner accepts a mixed file selection when a matching case runs. On Node 26.12.1 locally: eight positive/negative replay controls, all six mutation calibrations, strict types/typed lint (316 files), and all 172 fast files passed (two jobs, 81.1 seconds under shared load). Full original P6.1 evidence above belongs to the executor SHA. [Correction CI](https://github.com/oneshubhamt/study-director/actions/runs/46087084181).
- Reproduce on pinned Node 26.12.1/npm 12.2.1 with `npm run check:types`, `npm run test:fast` before `npm ci`, `npm run test:mutation -- --probe`, `npm run test:mutation`, `npm run test:coverage -- --keep-raw <fresh-dir>`, `npm run test:coverage:branches -- --from <same-dir>`, `npm run test:release`, and `npm run test:browser -- pwa`. Exact replay commands remain in the P6.1 diagnostic workflow.

## Programme obligations

- F-001: each feature owns its host callbacks/callers; P5.13 receives thin composition only.
- F-002: adapt affected source/VM readers during conversion; Phase 6 owns remaining test/tooling conversion and transitional-reader retirement.
- F-003: distinguish targeted/local evidence from whole-app, hosted and device certification. Full QA remains Phase 7.
- REVIEW-P5: independent final audit after P5.13 against `de4872a`, including semantic changes and unresolved limits. Owner-requested interim audits do not replace it.
- Keep one current canonical topology with validation/recovery intact; no historical compatibility layers. Vendored Wordgard remains unchanged.

## Recovery and provenance

Earlier uncommitted work was lost in the 2026-11-12 workspace reset and reconstructed with fresh evidence. The 2026-11-16 resume preserved source edits but lost temporary logs; only previously observed results were retained, and interrupted checks were rerun. Continue committing/pushing coherent checkpoints rather than depending on an ephemeral workspace.

[Preparation/Phase 4](docs/typescript/HISTORY-PREPARATION-PHASE-4.md), [main-intake preservation](docs/typescript/snapshots/main-intake-2026-11-08/README.md) and the pinned audit history retain prior observations without duplicating them in active context.
