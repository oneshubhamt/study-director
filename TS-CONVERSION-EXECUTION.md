# TypeScript conversion — execution record

## Current handoff — P5.8B IMPLEMENTED — AUDITED — TARGETED QA BLOCKED, 2026-11-16

- **Branch / baseline:** `ts-exp`; P5.8B started from `b137fb779466acb48529ebd98a1544db4f842abe` (P5.8A closed). P5.9a has not started.
- **Source outcome complete:** Drive connection and shared sync-status host behavior now has one checked owner, `source/core/sync-status-host.ts`, with real `BackupProviders`, `BackupPresentation`, Device Backup, protection, kept-version, profile/session, storage, PWA and action ports. `main.js` retains only deferred composition/wrappers; the old inline status/card state and rendering owner is gone.
- **Preserved boundaries:** user-gesture Drive authorization remains synchronous at the provider call; deferred startup redraws are replayed after composition; baseline presentation subscription/network/visibility cadence is preserved; Device Folder status fields consumed by presentation are preserved; update policy remains delegated rather than re-owned here.
- **Async/profile hardening:** Drive connects have request + profile generations; an abandoned completion retires only its own generation; profile switches retire/hide the stale card; completed-card hide timers are fenced by card identity + profile. A late completion/timer cannot mutate a successor request/profile.
- **Readers/harnesses:** the background-work architecture witness follows the checked online-wake owner. The obsolete browser-only `syncStatusInput` exposure was removed; its sole failure-diagnostic consumer now reads canonical provider/device/storage/UI state instead of reopening a private host seam.
- **Targeted green evidence:** repository checks `43902904815` at source checkpoint `c64227997ca6890ecaa138ac395966acf92dffbd` passed strict types/lint, targeted repository contracts, source build, generated verification and syntax. P5.8A regression lane `43902904401` passed. The changed-browser five-isolated-pass lane `43902904656` passed.
- **P5.8B witnesses:** `sync-status.mjs`, `notification-lifecycle.mjs`, `storage-reset-connect-recovery.mjs`, build, `cold-start-drive-recovery.mjs` and `sync-and-profiles.mjs` pass in the P5.8B targeted lane. The required `sync-journeys.mjs` anchor remains **OPEN**.
- **Open blocker is pre-existing, not P5.8B-owned:** differential run `43904994203` ran `sync-journeys.mjs` on the pinned P5.8A baseline and the P5.8B candidate in separate clean Chromium runners; both fail at the same `mid-upload: A settles` point with the same pending Review/session catch-up failure and convergence wait. P5.8B does not own that review/session/ownership path, so this pass did not weaken the witness or change unrelated engines.
- **Closure status:** P5.8B implementation/reconciliation is complete, but parent P5.8 remains open until the required browser anchor is green or its baseline debt is explicitly dispositioned. The temporary P5.8B closure/differential workflows were removed after collecting evidence so `ts-exp` is not left with a permanently red lane.
- **QA scope:** full QA was **not** run.

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
