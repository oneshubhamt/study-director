# Instructions for AI agents

Study Director is a local-first study planning PWA. The owner's current instructions override repository guidance. Continue this programme only on `ts-exp`; preserve `TS-Conversion` and main.

## Delegated implementation

The owner selected **GPT 5.6 Sol High as the sole implementor**. Do not delegate implementation to other models or coding subagents. The planning assistant supports design/process and performs an independent audit **after Phase 5 overall**, not automatically after individual passes. The owner may request an interim audit and authorize corrections, as for P5.2–P5.4 here. The implementor owns local planning, objective reconciliation, targeted QA and corrections; no planner sign-off is needed between passes.

Use one coherent, end-to-end outcome per bounded pass, including owned callers and host wiring. The phase register is a roadmap, not a fixed session count. Set the next pass's scope in the existing worklog before editing; adjust boundaries when dependencies justify it. Avoid both whole-host rewrites and tiny file-only passes. On “continue”, finish the open pass; if it is closed, take the next bounded outcome. Complete ordinary fixes and checks without asking for permission again. Ask only when missing information or a genuinely consequential scope/design choice cannot be resolved from the instructions and source.

After P5.13, reconcile all Phase 5 objectives and leave a concise audit handoff in the execution record: baseline and final commit, intentional behavior changes, verification and unresolved limits. Pause before Phase 6 for the owner's independent-audit request. `VERIFIED — TARGETED` means implementor verification, not independent audit or full certification.

## Priorities and boundaries

1. **Complete strict TypeScript conversion**, including callers and host wiring. Code must be clear, lean, efficient and reliable. Prefer simple explicit designs; no renamed-only implementations, permissive facades, casual `any`, blanket casts/suppressions or weakened gates.
2. **Fix evident bugs and make justified local improvements** encountered in converted surfaces. Explain intentional behavior changes and preserve other behavior. Do not turn conversion into an unrelated redesign or bug hunt. Defects preventing the objective working correctly belong in the pass.
3. **Strengthen relevant tests** where useful, especially for fixes. Necessary verification is part of completion; optional test expansion must not displace conversion.

Use native DOM/event types and actual provider assignability checks. Preserve initialization order when extracting closures: providers declared later must remain deferred. A typed port calling unchecked feature behavior does not complete conversion; only thin composition belongs to P5.13. Test critical transitions with failed writes and committed writes whose verification fails, preserving newer successors.

Keep one current canonical topology with validation, integrity and recovery intact; no historical migration/compatibility code. `vendor/wordgard/**` is immutable; our editor/adapters may change.

## Five-step procedure

1. **Audit:** confirm branch, HEAD, remote and local edits; read the [current record](TS-CONVERSION-EXECUTION.md), assigned [objectives](docs/typescript/PHASE-5.md), affected source, callers and tests. Consult other docs as needed. Name the complete outcome and invariants before editing.
2. **Analyze:** choose the simplest sound design and coherent scope, including integration and failure paths. Tracked units are not mandatory separate sessions; combine related units when that reduces overhead without obscuring completion.
3. **Implement:** finish the agreed scope end to end, including necessary fixes. Distinguish typing from intentional behavior changes. Continue through ordinary failures; do not stop because a useful subset works.
4. **Verify objectives:** compare resulting source and consumers against every outcome. Repair missing wiring, unconverted behavior and unsafe shortcuts. Do not silently narrow objectives or defer required work to mark them complete.
5. **Targeted QA:** run checks appropriate to changed surfaces, add meaningful regression protection and repair failures. Rerun only invalidated checks. Close only when all outcomes and required checks pass; otherwise identify the concrete blocker and remaining work. Full certification belongs to Phase 7.

## Lean working memory

Use two pads: one compact active entry in the execution record and one temporary checklist/log index outside the repo. Persist the baseline, objectives, material findings/decisions, actual checks and next action at meaningful changes and before interruption. Commit and push coherent checkpoints on the authorized branch rather than relying on an ephemeral workspace; distinguish checkpoints from verified closure. Aim for under about 40 lines, without omitting necessary evidence.

One owner per fact: this file owns procedure; execution record owns current state; phase register owns scope; [decisions](docs/typescript/DECISIONS.md) owns policy rationale; product docs own contracts. Link instead of repeating. Replace stale notes and use pinned Git history for detail. No routine extra plans/reports/transcripts or loading entire archives, snapshots, backlog and unrelated source. Update product docs when contracts change.

[Backlog](docs/backlog.md) is incidental-fix context, not assigned investigation. Fix an item if the current pass exposes a supported solution; otherwise leave it parked. Never hide an unresolved obligation when pruning notes.

## Repository safeguards

- Preserve unexplained user edits. Never commit/push to main, rewrite shared history, delete existing branches/tags, or open/merge PRs without authorization. Commit/push this branch within existing authorization and verify publication.
- Ask before changes outside authorized scope to tracked-file deletion, repository settings, workflows, secrets, deployment configuration, release identity or publication/deployment. Do not add approval stops for work already authorized.
- Never commit secrets, personal data/backups, dependencies, generated QA output or `dist`. Never upload private app data.
- Edit authored runtime in `source`, `portable`, `rich-text`; use build scripts for generated bundles. Tooling/tests/contracts have their own source directories. `release.config.mjs` owns release identity; `LICENSE` must match `source/legal/LICENSE.txt`.
- Follow [CONTRIBUTING](CONTRIBUTING.md) for commands and [tests/README](tests/README.md) for runner rules. Run browser tests marked `alone` in isolation; diagnose concurrency failures alone before changing code. Bug fixes need regression protection; data/storage changes need affected-layer checks.
- Report actual evidence and limitations: local is not hosted CI, targeted is not whole-app/device certification. Do not claim skipped or failed checks passed.
