# TypeScript conversion — execution record

## Current handoff — P5.8B OPEN — AUDITED, 2026-11-16

- **Branch / baseline:** `ts-exp` at `b137fb779466acb48529ebd98a1544db4f842abe`; P5.8A remains closed. P5.8B only; later groups are out of scope.
- **Outcome:** move Drive connection and shared sync-status host behavior behind one checked owner: `connectDriveForProfile`, Connect-card lifecycle, status aggregation, ring/panel/card rendering, scheduling/subscriptions and typed action delegation.
- **Invariants:** user-gesture authorization stays synchronous at the call boundary; deferred startup remains intact; Device Folder, password, kept-version, ownership/session and PWA actions delegate to their real owners; provider/profile/recovery contracts are reused rather than copied.
- **Audit finding / correction required:** current late Drive-connect completion is not request/profile fenced and can clear connecting state or mutate a successor card. Connect-card hide must also be profile/generation bound so an old completion/timer cannot overwrite a reopened card or new profile.
- **Targeted evidence planned:** strict types/lint/build/generated verification; `sync-status.mjs`, `notification-lifecycle.mjs`, `storage-reset-connect-recovery.mjs`; isolated Chromium `cold-start-drive-recovery`, `sync-and-profiles`, `sync-journeys` when the available targeted runner permits.
- **Open:** implementation, objective reconciliation and targeted QA remain in progress. Full QA is explicitly not part of this pass.

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
