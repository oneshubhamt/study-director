# Study Director documentation map

Start with [the product guide](PRODUCT.md) for what the app is and [architecture](ARCHITECTURE.md) for how it works. For current implementation on `TS-Conversion`, use [the execution control record](../TS-CONVERSION-EXECUTION.md). Current source and executed checks determine what exists; dated history is not new certification.

| Need | Authoritative location |
| --- | --- |
| Product purpose, workflows and long-term design principles | [Product guide](PRODUCT.md) |
| Current program state, findings, active durable scratchpad and resume action | [Execution control record](../TS-CONVERSION-EXECUTION.md) |
| Binding conversion decisions and adopted process | [Decision register](typescript/DECISIONS.md) |
| Phase 5 objective ownership, dependencies and status | [Phase 5 register](typescript/PHASE-5.md) |
| Earlier product plans, audits, observations and technical snapshots | [Product-development archive](history/PRODUCT-DEVELOPMENT.md) |
| All earlier conversion observations, work and QA | [Preparation / Phases 1–4 archive](typescript/HISTORY-PREPARATION-PHASE-4.md) |
| Actual application structure and lifecycle | [Architecture](ARCHITECTURE.md) |
| Data authority, schemas, profiles, preservation and backup security | [Data contracts](DATA-CONTRACTS.md) and executable `contracts/` |
| Notes, Areas, editor and save/history behavior | [Notes](NOTES.md) |
| Compiler admission, environment boundaries, erasure and typed QA | [TypeScript tooling](TYPESCRIPT.md) |
| Backup / background / notifications | [Backup engine](BACKUP-ENGINE.md), [background operations](BACKGROUND-OPERATIONS.md), [notifications](NOTIFICATIONS.md) |
| Test selection and QA procedure | [Verification](VERIFICATION.md), [test guide](../tests/README.md) |
| Build, contribution and repository constraints | [README](../README.md), [CONTRIBUTING](../CONTRIBUTING.md), [AGENTS](../AGENTS.md) |

The owner-requested [protected pre-intake programme snapshot](typescript/snapshots/main-intake-2026-11-08/README.md) preserves the original execution record, phase plan, decisions and tooling documentation exactly. It does not replace the active versions.

## Additional feature references

[Storage operations](areas/data-and-storage.md), [study sessions](areas/study-session.md), [status indicator](areas/status-indicator.md), [updates](areas/app-updates.md), and [UI](areas/ui.md) give current feature detail. [Production history](history/PRODUCTION-MAIN-HISTORY.md), [the earlier production test programme](history/PRODUCTION-TEST-PROGRAMME.md), and [backlog context](backlog.md) preserve imported observations without changing programme status.

## Current versus historical documents

[HANDOFF](HANDOFF.md) is a short resume pointer. Current feature guides describe implemented contracts, while [product history](history/PRODUCT-DEVELOPMENT.md) preserves the original handoff, notes plan, five old audits and earlier technical snapshots at `4136ba5`. The previous loose audit files were consolidated there without discarding their contents. TypeScript history is [separate](typescript/HISTORY-PREPARATION-PHASE-4.md). Old relative links inside preserved text refer to its original tree, linked from each archive's inventory.

Product guides are not a second implementation schedule. Historical “done” labels, migration plans, timing measurements and test counts do not establish current correctness. Source review performed for this documentation cleanup is limited to the cited contracts/owners and concrete inconsistencies; no fresh whole-app runtime, legal or security certification is claimed. Served [privacy](../source/legal/privacy.html), [security](../source/legal/security.html) and [terms](../source/legal/terms.html) stay factual about the implemented product; licence and notice texts retain their own authority.

## Maintenance

- One owner per status, invariant or decision; link instead of cloning checklists into many pass documents.
- Update the active durable scratchpad during work, and keep a separate temporary per-pass pad outside the repo. Archive closed logs intact at natural phase boundaries.
- Distinguish planning, implementation, targeted verification and full certification. Identify source revisions and checks actually run; label unverified assertions and suspected risks.
- Update architecture/data-contract descriptions only for implemented changes. Preserve explicit owner decisions and intentional differences with IDs.
- Preserve earlier observations when correcting them. New evidence can reopen a completed objective; an old green check cannot overrule a current defect.
- No duplicate per-pass acceptance reports, fabricated CI results or copied private data. Raw QA artifacts stay outside the repository.
