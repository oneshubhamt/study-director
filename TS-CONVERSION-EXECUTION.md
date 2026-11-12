# TypeScript conversion — execution record

**Branch: `ts-exp`. P5.2 and P5.4 reopened; do not start P5.5 yet.** Main intake remains `2638619`. Preserve main, `TS-Conversion` and vendored Wordgard. See [procedure](AGENTS.md), [scope and next plans](docs/typescript/PHASE-5.md), [decisions](docs/typescript/DECISIONS.md) and [verification](docs/VERIFICATION.md).

## Current work — close P5.2/P5.4

- Owner authorizes this independent audit, corrections and full closure, followed by P5.5–P5.7 planning (no implementation of those phases). Audit baseline: `6f81937`; conversion comparison: `de4872a`.
- Typed modules still delegate substantial owned behavior to unchecked host callbacks. Remaining P5.2: profile name/panel/writer settlement, startup stages/ownership presentation/hydration. Remaining P5.4: schedule apply/progress preservation, timer restore/presentation/recovery, previous-session handling, session actions and lifecycle adapters. P5.13 owns thin composition only.
- Audit defects: unsupported profile registry silently accepts name changes; suspended activation can commit and then fail read-back without rollback; Yield duplicates suspension without its compensation; Plan's invented universal element/event types hide invalid DOM access. Reproduce and repair with regression checks.
- Earlier local follow-up extracted those owners and adapted tests. **The cloud workspace reset on 2026-11-12 before any checkpoint was committed. Those changes and temporary logs were lost.** GitHub remains `6f81937`; no recoverable local Git objects found. Reconstruct from retained audit findings and reverify; earlier local results do not verify the current checkout.
- Earlier diagnostic evidence: `core-flow` reload failure also reproduced on untouched `6f81937`. It writes a hidden textarea behind a mounted rich editor, whose flush overwrites the fixture. Editing through the actual browser editor passed. Profile-panel viewports must use separate persistent profiles to avoid a legitimate extra recovery notice from the preceding name edit.
- Extended `session-handoff-journeys` previously failed at “closed: A settles”; diagnosis and a passing rerun remain required. Do not raise timeouts or weaken assertions to close it.
- Required targeted evidence: compiler/lint and negative gates; affected profile/startup/Plan/timer/session/persistence/architecture tests; fresh build, syntax/release verification; core-flow, profile panel, Saved Plans, independent session draft, multi-tab, restore safety and handoff journeys. Changed browser tests require five consecutive isolated passes. Full certification remains Phase 7.
- **Restored checkpoint 1:** unsupported-registry changes reject explicitly; suspended restore compensates failed verification while preserving successors; Yield delegates to the compensated suspension owner. Strict compiler/lint (175 files) and profile/session/handoff targeted regressions pass on the restored workspace.
- Persist coherent checkpoints to `ts-exp` at bounded outcomes. Temporary scratchpad: `/tmp/study-director-P5.2-P5.4-audit.md`. Record current results here before closure; never carry a green status over missing implementation or a reset environment.

## Programme and obligations

Preparation/Phases 1–4 and P5.0/P5.1 retain their recorded completion; P5.3 requires the identified DOM correction. Phase 6 owns tooling/tests and transitional source-reader retirement. Phase 7 owns whole-app reconciliation and full QA. The independent Phase 5 audit remains due after P5.13, without mandatory per-pass reviewer gates.

- F-001: checked feature ownership includes host callbacks and callers.
- F-002: adapt affected substring/VM tests now; retire the approach in Phase 6.
- F-003: targeted evidence is not whole-app or physical-device certification.
- REVIEW-P5: final independent audit against `de4872a`, including intentional fixes and remaining limits.

## Prior detail

[Complete prior execution record at `6f81937`](https://github.com/oneshubhamt/study-director/blob/6f8193717e976f55f942780a72ed065215eff64c/TS-CONVERSION-EXECUTION.md) preserves implementation history, previous observations and evidence. Its P5.2/P5.4 closure claims are superseded by this audit. [Preparation/Phase 4](docs/typescript/HISTORY-PREPARATION-PHASE-4.md) and [main-intake preservation](docs/typescript/snapshots/main-intake-2026-11-08/README.md) remain historical references, not routine context.
