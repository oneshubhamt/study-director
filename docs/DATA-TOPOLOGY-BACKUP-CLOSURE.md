# Data topology, durability, backup and recovery — consolidated closure

> **State: CLOSED AT THE SOURCE/AUTOMATED-QA LEVEL (31 October 2026).** This is a current navigation and disposition summary, not a replacement for the immutable A–F audit/implementation history. Physical-device/real-provider acceptance remains **NOT TESTED** under the A–F certification. No claim of deployed/released behavior.

## Authoritative document map

| Question | Read this | Authority |
|---|---|---|
| How does the backup system work now? | [BACKUP-ENGINE.md](BACKUP-ENGINE.md), [ARCHITECTURE.md](ARCHITECTURE.md) | Current architecture (subject to source) |
| What was audited, fixed, retained, and actually tested? | [DATA-TOPOLOGY-BACKUP-REMEDIATION.md](DATA-TOPOLOGY-BACKUP-REMEDIATION.md) | Complete A–F source audit, F1–F20 tracker, append-only implementation log; Entry 013 is final certification |
| What was the branch-level consolidation? | [CURRENT-FIXES-SUMMARY.md](CURRENT-FIXES-SUMMARY.md) | Dated earlier branch closure; **not** the later A–F certification |
| How do background services coordinate with these boundaries? | [BACKGROUND-OPERATIONS.md](BACKGROUND-OPERATIONS.md) | Current coordination contract |
| What is the new, independent open programme? | [BACKGROUND-SERVICES-REMEDIATION.md](BACKGROUND-SERVICES-REMEDIATION.md) | Active background-services ledger, starting at Phase 0; P0 not started |
| How should checks be run? | [VERIFICATION.md](VERIFICATION.md) | Governed QA and environment limits |

## A–F final outcome, without erasing prior records

| Pass | Finding IDs | Disposition at final certification |
|---|---|---|
| A — restore journal atomicity and protected scratch lifetime | F1, F3, F6, F7 | VERIFIED CLOSED; previously missing journal suite executed in full Promotion |
| B — trustworthy freshness, completeness and receipts | F4, F5, F8 | VERIFIED CLOSED |
| C — browser reset, Notes rescue, profile deletion, Session durability | F2, F9, F12, F13 | VERIFIED CLOSED; retained 1 MiB emergency Notes rescue policy and lightweight ordinary snapshots |
| D — binary verification, reuse, Device Folder digest safety | F10, F11, F14 | VERIFIED CLOSED; preserve selective full hashes and verified-object reuse |
| E — Drive resumable upload/replay safety | F15 | VERIFIED CLOSED; exact remote identity replay checks |
| F — evidence-based cleanup | F20 in scoped review | VERIFIED CLOSED as a bounded **pass**; F20's size-only splitting proposal remains intentionally deferred |
| Policy dispositions | F16, F17, F18 | CLOSED BY OWNER-ACCEPTED POLICY (retention format preference; short-lived origin-local Drive authorization; browser-only availability) |
| Deferred questions | F19, F20 | DEFERRED, NOT ACTIVE DEFECTS; reopen solely on new concrete safety/performance or duplication evidence |

**Reconciliation:** F1–F15 have verified source/test closures; F16–F18 are accepted decisions; F19–F20 remain deferred. This is **not 20 confirmed bugs**. Older per-pass statements such as 'QA pending' remain historically accurate at their respective dates; Entry 013 supersedes their *current* status without rewriting them.

## Exact certification evidence

- A–F application/test revision **`1299d97a142c8a010d45d8815f5ed3a227c172b4`**; original final Pass F runtime baseline **`5874b06667f42e0798b5b534620105a3e8b82f89`**.
- Full Promotion QA **[run 41205367918](https://github.com/oneshubhamt/study-director/actions/runs/41205367918): SUCCESS** (five jobs; no failed/skipped steps reported in Entry 013).
- Hermetic correctness **149 PASS**: 23 unit, 95 integration, 31 architecture. Separate journal, portable backup, profile, and Device Folder adapter tests logged PASS.
- Critical mutation certification **8/8 killed**; risk coverage and AST branch-edge checks PASS; non-browser release certification PASS.
- Chromium built-runtime/browser certification **46 journeys PASS**; **three separate Insights performance samples PASS** and aggregate performance gate PASS.
- The A–F certification log says changes for the final QA phase were scoped to tests/fixtures, architecture assertions and a QA request; no product source/format/schema/provider behavior was modified in that certification phase.

## What remains true (and what is not promised)

- Canonical local persistence is distinct from a verified backup destination and distinct from background job execution. No guarantee of a backup while all app windows are closed.
- Device Folder and Drive are **independent** repository destinations. Drive additionally supports shared cross-device catch-up; neither provider copies/checkpoints/backfills the other's history.
- Immutable object → verified manifest → commit-marker publication; conservative reachability GC; strict restore journal and protected recovery; no cached absence authorizes deletion.
- Normal attachment reads and service-worker cached asset fetches are **not** blanket full-hash operations. Preserve their documented verification envelopes and performance/security trade-offs.
- No speculative global size cap, no new backend, no module splitting based solely on file length and no forced compatibility retirement.

## Manual-only acceptance outstanding — NOT EXECUTED by A–F

Real Drive uploads/auth/interruptions, granted/revoked Device Folder permission, mobile PWA suspension/kill/resume, iPad/iOS fallback, physical storage/eviction, long-session heat and power, and hardware-level durability require a separate operator-run matrix using disposable data and an independently verified safety backup. These are **not open A–F source findings merely because CI cannot run them**.

## Change control / programme boundary

Any later background-services correction touching backup paths must consume the **current production source** and retain these certified contracts. The new BS01–BS21 register is **a new audit**, not evidence that F1–F15 have regressed. Reopen A–F only when a precisely traced new counterexample warrants it. The original detailed A–F ledger and Entries 000–013 are preserved, not deleted or compacted into untraceable claims.

**Documentation-only consolidation:** no runtime, schemas, storage, test expectations, workflows, QA thresholds, release or deployment changes were part of this closure index.
