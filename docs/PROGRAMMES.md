# Engineering programmes — current source-of-truth map

> **Branch:** `current-fixes`. **Updated 1 November 2026.** The source and exact revision override any narrative. This index distinguishes historical, fully verified work from new open investigation and prevents agents from reopening closed findings or skipping the implementation playbook.

| Programme | Status | Read first | Next action |
|---|---|---|---|
| Data topology, backup and recovery (A–F) | **CERTIFIED CLOSED** at source/automated-QA level | [Consolidated closure](DATA-TOPOLOGY-BACKUP-CLOSURE.md), [complete historical A–F ledger](DATA-TOPOLOGY-BACKUP-REMEDIATION.md), [backup engine](BACKUP-ENGINE.md) | No pass pending. Physical-device/real Drive acceptance is separate and NOT TESTED under that certification. |
| Background services (P0–P6) | **P0–P6 IMPLEMENTED AND VERIFIED AT DOCUMENTED TARGETED LEVELS**; full Promotion/device acceptance NOT RUN | [Active remediation ledger](BACKGROUND-SERVICES-REMEDIATION.md), [background behavior](BACKGROUND-OPERATIONS.md) | P6 completed BS15 permission generation/handle fencing and narrowed sanitized diagnostic export; BS19 SW hash policy and BS21 closed-PWA scheduling limits retained explicitly. [P6 evidence](BACKGROUND-SERVICES-REMEDIATION.md#entry-017--p6-implementation-independent-objective-recheck-and-targeted-qa-2026-11-01). **Next milestone only with explicit authorization:** full Promotion QA at exact SHA plus separate Chromium/Android/iPad/Drive operator acceptance. Standalone diagnostic test files not executed. |
| Sync and background status indicator | **Phases 1–4 implemented and verified at targeted level** (Entries 024–027; 025 also fixes a sync that could hand a continued session back) | [Plan and contract](STATUS-SYSTEM.md), [Entry 024](BACKGROUND-SERVICES-REMEDIATION.md#entry-024--one-sync-and-background-status-indicator-phase-1-2026-11-01), [Entry 025](BACKGROUND-SERVICES-REMEDIATION.md#entry-025--continue-here-instant-feedback-and-a-sync-that-handed-the-session-back-2026-11-01), [Entry 026](BACKGROUND-SERVICES-REMEDIATION.md#entry-026--connect-google-drive-a-progress-card-on-every-tab-2026-11-02), [Entry 027](BACKGROUND-SERVICES-REMEDIATION.md#entry-027--status-phase-4-hand-off-row-progress-counts-pop-up-rules-2026-11-02) | None planned; real devices, other skins and a screen reader not yet checked. |
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

**Naming:** Phase 0 is documentation; P0 source evidence/triage; P1 Active Session safety; P2 notification/PDF lifetime; P3 priority/clock fairness; P4 bounded reference inventory and fail-closed GC; P5 provider-aware PWA/claim watcher admission; **P6 concluded at selected CI/isolated V8 verification level**; full Promotion and hardware acceptance are separate. A–F remains separate and certified at its earlier QA level; hardware/browser acceptance is not implied.
