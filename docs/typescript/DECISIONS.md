# TypeScript program — decisions and process provenance

These policies apply to `TS-Conversion`. Explicit owner instructions control intentional changes; source and QA determine whether implementation satisfies them. Earlier chat proposals and archived completion labels do not override current instructions. Do not change a policy merely to close a finding.

| ID | Authority | Decision / consequence |
| --- | --- | --- |
| D-01 | Owner, branch instructions | Work and push only on `TS-Conversion`. Read/port worthwhile main changes with provenance; do not modify main, rewrite shared history or infer permission to merge/deploy |
| D-02 | Owner, vendor boundary | `vendor/wordgard/**` stays byte-for-byte unchanged. Our editor/adapters may change; generated bundles use the build pipeline. Vendor declarations are not permission to change upstream source |
| D-03 | Owner, canonical-only preparation | The prior upgrade path existed; assume users completed it. Support the current canonical topology only. Keep runtime validation, unsupported-input rejection, journals, rollback, integrity and current recovery. Do not reintroduce historical migrations |
| D-04 | Owner, preservation goal | Preserve application behavior, data, timing, ownership, UI workflows and recovery. Useful improvements are allowed, but must have explicit rationale and regression evidence. Added capabilities do not compensate for lost behavior |
| D-05 | Owner, strict TypeScript goal | Check implementations, not just declarations or renamed files. Preserve unknown-input validation, exact capabilities and environment separation; no blanket suppressions, casual any or weakened gates |
| D-06 | Owner, toolchain request | Use the reviewed pinned toolchain: Node 26.12.1, npm 12.2.1, TS 7.0.2 at the latest recorded implementation check. They are not asserted to remain newest forever; evaluate future updates deliberately with lockfile/build evidence |
| D-07 | Latest owner QA steering | Targeted affected-surface QA during passes; add meaningful coverage where needed. The later instruction to skip full Phase 4 QA supersedes the earlier full-QA request. Whole-program certification remains Phase 7 unless the owner changes scope |
| D-08 | Owner, two-scratchpad request | Maintain one persistent repo worklog during execution and one temporary per-pass pad outside the repo. Preserve prior observations/work and material decisions without verbose transcript duplication |
| D-09 | Owner, 2026-10-30 process request | Adapt superior practices from Practice Desk and improve them for this long conversion. The selected workflow is inspect → analyze → implement → source reconciliation → targeted QA, with per-objective evidence and explicit handoff |
| D-10 | Implementation convention under D-09 | Single authoritative location per status/decision; fixed pass baselines; source ownership register; bounded subpasses; distinguish local/CI/manual evidence; re-open contradictory findings. No new approval checkpoints or compulsory sub-agents |
| D-11 | Owner, expanded 2026-10-30 scope | Clean and consolidate overall application documentation, including durable product purpose/design, current contracts, implementation guidance and history. Preserve prior evidence; correct factual descriptions against source without claiming a fresh certification |

Current canonical formats/invariants remain defined by source contracts and the [current architecture](../ARCHITECTURE.md); this register does not duplicate their version inventory. [TypeScript tooling](../TYPESCRIPT.md) owns compiler/build details. [Verification](../VERIFICATION.md) owns QA commands.

## Process provenance

Read-only reference: [Practice Desk `overhaul` at b75d85c](https://github.com/oneshubhamt/practice-desk/tree/b75d85c971d9bdf4988c993586b3155271393aed), inspected 2026-10-30. In particular:

- [Documentation map](https://github.com/oneshubhamt/practice-desk/blob/b75d85c971d9bdf4988c993586b3155271393aed/docs/README.md): current information, policies and historical evidence have distinct owners.
- [Active audit, Section G](https://github.com/oneshubhamt/practice-desk/blob/b75d85c971d9bdf4988c993586b3155271393aed/docs/audits/V11_SOURCE_AUDIT_2026-10-30.md): inspect consumers, maintain notes during execution, reconcile each objective and record actual targeted checks. Use the file's Section G if the rendered anchor differs.
- [Policy register](https://github.com/oneshubhamt/practice-desk/blob/b75d85c971d9bdf4988c993586b3155271393aed/docs/decisions/POLICY_REGISTER.md): explicit exceptions and unverified outcomes cannot disappear inside pass narratives.

Adopted: persistent operational scratchpad, source-backed findings, stable objective IDs, objective-level closure, current/history separation and honest evidence limits.

Improved for Study Director: tie evidence to a fixed source revision; preserve a separate temporary pad as requested; make every host responsibility have an owner; distinguish implemented from verified; track suspected risks separately from reproduced regressions; record invalidation after later edits; avoid duplicated pass documents and tests that merely restate code. Source reconciliation supplements runtime tests and cannot establish device behavior by itself.

Not transferred: Practice Desk's product architecture, data/backup formats, v11 parity requirements, branch names, release conditions or pass count. Its read-only reference was not modified. A documentation review cannot establish the effectiveness of its implementation or certify this application.

## Changing a decision

Record the superseding instruction or new evidence, affected objectives and consequences before changing implementation. Routine choices within these policies do not need repeated owner confirmation. Keep policy exceptions traceable; preserve the original decision in history when superseded.
