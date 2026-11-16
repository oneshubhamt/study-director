# TypeScript conversion — execution record

## Independent audit — P5.5–P5.7 CLOSED — AUDITED — TARGETED, 2026-11-16

- **Baseline / endpoint:** refreshed GitHub `ts-exp` at `28a4371`; corrections committed at `6005b1c` and `e4b7aa6` (final production endpoint). P5.8 is not started.
- **Scope reconciled:** P5.5 Review/Diary/saved-day owners and lifecycle callers; P5.6 Library/notes/editor/document/export owners and lifetimes; P5.7 backup controls/reconciliation/recovery/integrity/maintenance/readiness. Checked owners and actual-provider seams cover these responsibilities; remaining Drive transport and later feature/composition work retain their assigned phases.
- **Corrections:** obsolete lifecycle reconciliation cannot overwrite successor readiness/status; old Diary save feedback cannot update a rebound editor; attachment rollback must match the operation's inserted note identity/revision, and cleanup conditionally removes a new note only if its rollback revision still matches. Regressions first reproduced the defects and now cover invalidated/active/completed transitions, failed/committed Diary saves, attachment write/readback failures and successor edits during rollback/cleanup.
- **QA repairs:** the notes rebind browser probe establishes pending-edit state after repository flush and restores its fixtures; the file-picker notification test exercises the checked backup-controls owner instead of a removed host handler. No product assertion or gate was weakened.
- **Non-browser evidence:** 57 unique targeted files: 56 passed initially; the stale notification witness was repaired and passed, with nine affected regression files rerun successfully at `6005b1c`. At `e4b7aa6`, six affected attachment/storage files passed hermetically; strict compiler/lint passed for 217 checked files, fresh build/verification passed, generated syntax passed (174 JS files, 10 inline scripts). No full suite or Promotion certification was run.
- **Reproduce selection:** non-browser paths in `.github/workflows/qa-fast.yml` and `p57-targeted-browser.yml`, excluding generated syntax from the hermetic runner, plus `unit/exports/note-export`, `integration/attachments/rich-attachment-api`, `integration/rich-text/attachment-busy-lifecycle`, `integration/ui/notification-lifecycle` under `tests/`, all `.mjs`. Final six-file set: `integration/attachments/{document-host-lifecycle,rich-attachment-api}`, `integration/storage/{deletion-recovery,attachment-reference-recovery}`, `integration/rich-text/attachment-busy-lifecycle`, `integration/library/library-clear`.
- **Browser evidence:** `notes-management` passed 5/5 isolated after witness repair; `core-flow`, `session-draft-edit`, `restore-session-safety` passed at `6005b1c`. At `e4b7aa6`, `attachments`, `attachment-editor` and the final `notes-management` rerun pass. Results are local Chromium, not hosted/device certification. Hosted run status could not be read (GitHub Actions API returned Forbidden).
- **Strategy:** keep coherent feature passes, with risk-based checks across asynchronous completion, verification and rollback; do not add mechanical micro-passes or approval gates. Source/behavior overrides stale logs. Procedure is in AGENTS; historical repetition was consolidated below.
- **Boundaries / publication:** canonical topology and vendored Wordgard unchanged. Owner authorized delivering the audited `ts-exp` tip to `TS-Conversion`; its remote `de4872a` is an ancestor with no unique commits, so both branches receive this closure through a normal fast-forward, without rewriting history. P5.5–P5.7 are closed; P5.8 is ready and remains unstarted.

## Prior completion and evidence

Preparation/Phases 1–4 and P5.0–P5.4 retain recorded completion. P5.2/P5.4 were independently corrected at `db4587a`; P5.3 native DOM/provider corrections were included. P5.5–P5.7 implementation and follow-up audits are preserved in [the complete pre-audit record at `28a4371`](https://github.com/oneshubhamt/study-director/blob/28a4371/TS-CONVERSION-EXECUTION.md). It includes source endpoints, intentional fixes, hosted run IDs and historical browser/full-fast evidence; those historical runs are not new verification of this audit's changes. Current scope and remaining phases belong to [PHASE-5](docs/typescript/PHASE-5.md), procedure to [AGENTS](AGENTS.md).

## Programme obligations

Preparation/Phases 1–4 and P5.0/P5.1 retain their recorded completion. P5.3's native DOM/provider-contract correction is verified here. Phase 6 owns remaining tooling/test conversion and transitional source-reader retirement. Phase 7 owns whole-app reconciliation/full QA. Independent Phase 5 audit remains due after P5.13; this interim audit does not replace it.

- F-001: every remaining feature owns its host callbacks and callers; P5.13 receives thin composition only.
- F-002: adapt affected substring/VM tests within each pass; retire the remaining approach in Phase 6.
- F-003: distinguish targeted/local evidence from complete/device certification.
- REVIEW-P5: independent final audit against `de4872a`, including intentional fixes and unresolved limits.

## History and recovery provenance

The cloud workspace reset on 2026-11-12 before earlier follow-up changes were committed; that uncommitted work and its logs were lost. No recoverable Git objects existed. All closure evidence above was obtained on the reconstructed checkout; old results were not carried forward. Coherent checkpoints are now committed/pushed during execution.

[Prior detailed execution record at `6f81937`](https://github.com/oneshubhamt/study-director/blob/6f8193717e976f55f942780a72ed065215eff64c/TS-CONVERSION-EXECUTION.md) preserves earlier work/observations; its premature P5.2/P5.4 closure labels were reopened and superseded here. [Preparation/Phase 4](docs/typescript/HISTORY-PREPARATION-PHASE-4.md), [main-intake preservation](docs/typescript/snapshots/main-intake-2026-11-08/README.md) and the checkpoint history retain detail without duplicating it in active context.
