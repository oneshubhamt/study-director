# Engineering programmes — current source-of-truth map

> **Branch:** `current-fixes`. **As of 31 October 2026.** The source and exact revision override any narrative. This index distinguishes historical, fully verified work from new open investigation and prevents agents from reopening closed findings or skipping the implementation playbook.

| Programme | Status | Read first | Next action |
|---|---|---|---|
| Data topology, backup and recovery (A–F) | **CERTIFIED CLOSED** at source/automated-QA level | [Consolidated closure](DATA-TOPOLOGY-BACKUP-CLOSURE.md), [complete historical A–F ledger](DATA-TOPOLOGY-BACKUP-REMEDIATION.md), [backup engine](BACKUP-ENGINE.md) | No pass pending. Physical-device/real Drive acceptance is separate and NOT TESTED under that certification. |
| Background services (P0–P6) | **PHASE 0 DOCUMENTATION PREPARED**; **P0 NOT STARTED** | [Active remediation ledger](BACKGROUND-SERVICES-REMEDIATION.md), [background behavior](BACKGROUND-OPERATIONS.md) | On next explicit instruction, undertake **P0: independent baseline/reclassification**, not P1 code changes. |
| Historical earlier background reviews | Closed snapshots of old architecture; not active P programme | [2026-10-25 audit](AUDIT-BACKGROUND-SERVICES.md), [2026-10-04 record](BACKGROUND-AUDIT.md), [HANDOFF.md](HANDOFF.md) | Historical cross-check only. |

## Priority and evidence hierarchy

1. Current production source and exact branch SHA.
2. Exact observed runtime traces, deterministic fault-injection and measured benchmarks (where actually run).
3. Current architecture contracts and test-verification documents.
4. Active, append-only remediation ledger and pass-specific objective check.
5. Previous audit/handoff snapshots for intent and regression context only; **passing fixtures do not substitute for production-source audit**.

## Required per-pass playbook

**Preliminary orientation:** Read the whole relevant ledger, prior journal, current branch SHA and dependencies. Then **(1) audit source, (2) analyze and plan before edits, (3) implement minimally, (4) recheck each objective, (5) targeted QA**; update tracker and append an immutable evidence journal. No full QA for every small pass; consider the full Promotion + real-device matrix only after substantial cumulative change and separate authorization.

## Constraints

Clean, Lean, Efficient, Elegant, Robust, Reliable. No duplicative owner/scheduler, speculative compatibility/format changes, unverified deletion, weakening of restore safety, false 'always-on background' claims or unapproved merge/deploy/workflow changes. Do not put app data, tokens, backups, personal content or generated outputs in documentation.

**Naming:** Phase 0 is today's documentation pass. P0 is the **next**, not-yet-executed evidence-baselining pass. P1–P6 are later code/measurement/policy passes. Do not confuse them with A–F (certified backup programme) or the old background audit's B0–B6 labels.
