# TypeScript program — decisions and process provenance

These policies apply to `ts-exp`, continuing from the P5.1 baseline on `TS-Conversion`. Explicit owner instructions control intentional changes; source and QA determine whether implementation satisfies them. Earlier chat proposals and archived completion labels do not override current instructions. Do not change a policy merely to close a finding.

| ID | Authority | Decision / consequence |
| --- | --- | --- |
| D-01 | Owner, branch instructions | Work and push only on `ts-exp`; preserve `TS-Conversion` as the P5.1 baseline. Read/port worthwhile main changes with provenance; do not modify main, rewrite shared history or infer permission to merge/deploy |
| D-02 | Owner, vendor boundary | `vendor/wordgard/**` stays byte-for-byte unchanged. Our editor/adapters may change; generated bundles use the build pipeline. Vendor declarations are not permission to change upstream source |
| D-03 | Owner, canonical-only preparation | The prior upgrade path existed; assume users completed it. Support the current canonical topology only. Keep runtime validation, unsupported-input rejection, journals, rollback, integrity and current recovery. Do not reintroduce historical migrations |
| D-04 | Owner, preservation goal | Preserve application behavior, data, timing, ownership, UI workflows and recovery. Useful improvements are allowed, but must have explicit rationale and regression evidence. Added capabilities do not compensate for lost behavior |
| D-05 | Owner, strict TypeScript goal | Check implementations, not just declarations or renamed files. Preserve unknown-input validation, exact capabilities and environment separation; no blanket suppressions, casual any or weakened gates |
| D-06 | Owner, toolchain request | Use the reviewed pinned toolchain: Node 26.12.1, npm 12.2.1, TS 7.0.2 at the latest recorded implementation check. They are not asserted to remain newest forever; evaluate future updates deliberately with lockfile/build evidence |
| D-07 | Latest owner QA steering | Targeted affected-surface QA during passes; add meaningful coverage where needed. The later instruction to skip full Phase 4 QA supersedes the earlier full-QA request. Whole-program certification remains Phase 7 unless the owner changes scope |
| D-08 | Owner, two-scratchpad request | Maintain one persistent repo worklog during execution and one temporary per-pass pad outside the repo. Preserve prior observations/work and material decisions without verbose transcript duplication |
| D-09 | Owner, 2026-10-30 process request | Adapt superior practices from Practice Desk and improve them for this long conversion. The five-step workflow and lean recording rules now live only in AGENTS; latest owner refinement is D-13 |
| D-10 | Implementation convention under D-09 | Single authoritative location per status/decision; fixed pass baselines; source ownership register; bounded subpasses; distinguish local/CI/manual evidence; re-open contradictory findings. No new approval checkpoints or compulsory sub-agents |
| D-11 | Owner, expanded 2026-10-30 scope | Clean and consolidate overall application documentation, including durable product purpose/design, current contracts, implementation guidance and history. Preserve prior evidence; correct factual descriptions against source without claiming a fresh certification |
| D-12 | Owner, 2026-11-09 main intake | Preserve the TS programme documentation separately, including an exact pre-intake snapshot; incorporate worthwhile production product docs, tests, journeys and scripts. Current application behavior must retain production parity while converted implementations retain strict checks |
| D-13 | Owner, 2026-11-09 discipline refinement | Primary: complete strict TS conversion. Secondary: fix evident bugs and improve affected code where justified. Tertiary: additional test improvements; required validation remains part of completion. Keep docs lean, use Git history instead of duplicating old logs, and do not investigate backlog bugs unless encountered incidentally during a conversion pass |
| D-14 | Owner, 2026-11-10 delegation | GPT 5.6 Sol High is the sole implementor on `ts-exp`; the planning assistant supports design/process and independently audits after Phase 5 overall. Owner-requested interim audits may include authorized corrections, as for P5.2–P5.4. No automatic per-pass external review gate. [AGENTS](../../AGENTS.md) owns the operating procedure |

Current canonical formats/invariants remain defined by source contracts and the [current architecture](../ARCHITECTURE.md); this register does not duplicate their version inventory. [TypeScript tooling](../TYPESCRIPT.md) owns compiler/build details. [Verification](../VERIFICATION.md) owns QA commands.

## Process provenance

The original [Practice Desk comparison and adopted safeguards](https://github.com/oneshubhamt/study-director/blob/b4e4cfd716626c55fd713f3565837ac7f9e70a95/docs/typescript/DECISIONS.md#process-provenance) remain in Git history. The latest owner instruction replaces verbose process replication with the single five-step procedure in [AGENTS](../../AGENTS.md). Read provenance only when resolving a policy question.

## Changing a decision

Record the superseding instruction or new evidence, affected objectives and consequences before changing implementation. Routine choices within these policies do not need repeated owner confirmation. Keep policy exceptions traceable; preserve the original decision in history when superseded.
