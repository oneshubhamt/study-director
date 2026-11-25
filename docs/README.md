# Documentation map

Read only what the task needs. Current source and executed checks establish behavior; historical plans do not establish current completion.

| Need | Read |
| --- | --- |
| Implementation discipline and constraints | [AGENTS](../AGENTS.md) |
| Current work, unresolved obligations and resume action | [Execution record](../TS-CONVERSION-EXECUTION.md) |
| Programme policy and compiler boundaries | [Decisions](typescript/DECISIONS.md), [TypeScript tooling](TYPESCRIPT.md) |
| Product purpose / architecture / data authority | [Product](PRODUCT.md), [architecture](ARCHITECTURE.md), [data contracts](DATA-CONTRACTS.md) and executable `contracts/` |
| Feature contracts | [Notes](NOTES.md), [backup](BACKUP-ENGINE.md), [background operations](BACKGROUND-OPERATIONS.md), [notifications](NOTIFICATIONS.md) |
| Focused product references | [Storage](areas/data-and-storage.md), [sessions](areas/study-session.md), [status indicator](areas/status-indicator.md), [updates](areas/app-updates.md), [UI](areas/ui.md) |
| Build and QA | [README](../README.md), [contributing](../CONTRIBUTING.md), [verification](VERIFICATION.md), [test guide](../tests/README.md) |
| F33 backlog, phase assignments and work after SDVC1 | [Backlog](backlog.md) |
| Served product policies | [Privacy](../source/legal/privacy.html), [security](../source/legal/security.html), [terms](../source/legal/terms.html) |

## TypeScript programme

| Phase | Executor handoff |
| --- | --- |
| 5 · Convert and review the application | [Ownership, pass criteria and review](typescript/PHASE-5.md) |
| 6 · Convert tooling and overhaul the test suite | [QA design, baseline measurements and implementation passes](typescript/PHASE-6.md) |
| 7 · Certify the converted application | [Candidate, device checks and certification handoff](typescript/PHASE-7.md) |
| 8 · Reconcile F33 and build SDVC1 | [Execution and release criteria](typescript/PHASE-8.md) · [Source comparison and commit inventory](typescript/PHASE-8-INTAKE.md) |

## Assigning one executor outcome

Name the branch, exact pass (or Phase 7 activity), intended outcome and stop point. The execution record supplies the current checkpoint. The linked phase plan supplies the criteria and appropriate QA. The [backlog](backlog.md) supplies related reports. When assigning a child pass, name it explicitly so the executor can finish its dependencies and stop before its sibling.

> Carry out [pass or activity] only on `ts-exp`. Read AGENTS.md, TS-CONVERSION-EXECUTION.md and the corresponding phase plan above. Resume from the verified checkpoint. Complete the named outcome through its real callers, exercise the applicable checks, record evidence and open items, commit/push and verify the remote SHA. Stop at the named boundary.

| Assignment | Specify in the command |
| --- | --- |
| REVIEW-P5 Stage 1 / Stage 2 | The assigned implementor resumes the current audit, fixes defects and leaves the gate open. Astra Extra High independently reviews the final SHA against the original JavaScript and decides whether Phase 6 may begin. |
| P6.0, then P6.1–P6.6 individually | Inventory first. For implementation passes name the test/tool owner, the behavior or failure to prove and the evidence to preserve. |
| Phase 7 | Use the plan's named activities, starting with **Establish the candidate**. Certification ends with an exact artifact and recorded gate decision. |
| P8.0, then P8.1–P8.6 individually | Pin F33 and the certified Phase 7 SHA, then reconcile the backlog and both source inventories. P8.6 includes SDVC1 packaging and certification. Deployment requires a separate decision. |

## Maintaining the docs

Use one authoritative location per fact. Update current contracts when implementation changes; keep active notes concise and replace stale entries. Link to pinned Git history for detailed prior work instead of creating another report or archive. Never silently discard an unresolved obligation.

Historical references, read on demand: [preparation/Phases 1–4](typescript/HISTORY-PREPARATION-PHASE-4.md), [product-development history](history/PRODUCT-DEVELOPMENT.md), [production history](history/PRODUCTION-MAIN-HISTORY.md), [production test programme](history/PRODUCTION-TEST-PROGRAMME.md), and the owner's [protected pre-intake snapshots](typescript/snapshots/main-intake-2026-11-08/README.md). Their embedded links and statements retain their original context; they do not override current instructions.
