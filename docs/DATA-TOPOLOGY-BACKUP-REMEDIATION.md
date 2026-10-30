# Data Topology, Durability, Backup and Recovery — Source Audit & Remediation Ledger

> **Working engineering scratchpad / source of truth for passes A–F.**  
> **Established:** 2026-10-30. **Branch:** current-fixes. **Audit baseline:** 53c968b7f876280f0d5e57528eeb5400a1783b29.  
> **Status at creation:** AUDIT RECORDED — ALL PASSES NOT STARTED. **Source:** fresh de novo reading of application source. No fixtures or previous QA results were used to establish these findings.  
> **Scope:** data topology, persistence, durability, recovery, attachments, portable backup, Device Folder, Google Drive, reconciliation, synchronization, retention, profile isolation, data cleanup and background coordination.
>
> **Priority rule:** Current source wins over this document's historical interpretation. At the start of **every pass**, inspect this ledger, then re-audit the relevant current code. Where that audit contradicts an item here, record the evidence, revise the classification and objectives, and do not implement an unnecessary fix.
>
> This ledger is **not** a certification, proof of user-data loss, or instruction to rewrite functioning subsystems. Historical docs/HANDOFF.md and prior audits describe earlier work as closed; **this new audit creates a separate, open remediation programme**. Preserve both histories without silently conflating them.

## 0. Non-negotiable execution protocol

### 0.1 Five-step engineering cycle, with mandatory preliminary stage

**Preliminary — Ledger orientation (before the five steps)**
1. Read this entire document, especially §§1–6, the relevant pass card in §7 and the implementation journal (§9).
2. Establish the exact current branch and commit SHA. Confirm the prior pass's status and changes; record any drift in source, requirements or scope.
3. Name the selected pass, affected findings, dependencies, intended files and remaining acceptance criteria. **Do not drift to unrelated work**.
4. If the previous pass left unresolved defects, explicitly decide whether they block the present pass. Do not assume closure from a status label.

**Step 1 — Audit:** Read **current production source directly**, following complete call chains and ownership/transaction boundaries. Validate each candidate issue, nearby defenses, and potential unintended effects. Do not infer that an old line number still applies. Separate defects, weaknesses, deliberate trade-offs and unproven hypotheses.

**Step 2 — Analyze and plan:** Write the specific correction, invariant, acceptance criteria, affected source files, migration/compatibility implications, performance cost and failure cases. Prefer reuse of existing infrastructure. Record plan/objectives **before edits**.

**Step 3 — Implement:** Make minimal, coherent, robust source changes. Use one owner for each responsibility; eliminate demonstrable duplication or dead code, but not protective behavior. No generated build edits, unrelated refactors, new backup engine, threshold relaxation or unauthorized deployment.

**Step 4 — Verify objectives:** Reinspect changed and adjacent production source, compare every objective and invariant against actual implementation, and record met/not-met/partially-met with evidence. Where necessary, correct and recheck before declaring completion.

**Step 5 — Targeted QA:** Run or otherwise execute **only focused checks** for affected code, integrations, edge cases and regressions. These may use tests/fixtures **after** the source-level audit and implementation; they are not the basis for the original source audit. Note exact commands, outcomes, remaining gaps, and what was not executed. **No automatic full QA per pass.** Reserve comprehensive QA for a later explicit milestone after substantial A–F work or on the owner's instruction.

**After step 5:** Append a dated immutable pass journal entry under §9 with branch/commit, audit evidence, decisions, changes, objective-by-objective verdict, targeted QA and carry-forward work. Update §6 matrix and §7 pass card. Never mark a finding closed merely because code was edited; the acceptance criteria must be met.

### 0.2 CLEER constraints and safety invariants

- **Clean, Lean, Efficient, Elegant, Robust, Reliable (CLEER).** Prefer bounded operations, explicit authority, simple state machines and one canonical path.
- Never lose or overwrite a pending **before-restore rollback record**; never discard recoverable data merely to clear an error.
- Never claim a backup is **fresh** or **fully recoverable** on missing/ambiguous evidence; distinguish successful publication from end-to-end historical-object integrity.
- Keep local state authoritative for local edits; each provider has its **own verified destination** and retry state. Drive catch-up is not an implicit copy from Device Folder.
- Preserve source-version and generation fencing; no backup of partly reconciled or half-restored state.
- Keep immutable-object → verified manifest → commit-marker publication contract and conservative reachability-based deletion.
- Keep newer/unreadable data intact; migration/compatibility reads historical formats only in allowed pathways; do not write newer data with an older codec.
- Preserve Note conflict copies, dirty-save rescue, Saved-Day deletion ledger, Active Session owner claims, attachment reachability, rollback journal and post-restore verification.
- Do not trust an origin-local cache as stronger evidence than committed canonical storage or a verified external receipt.
- No secrets, personal data, backup payloads, production releases or generated files in documentation/commits.
- Work only on current-fixes unless owner changes the branch. Do not merge, publish, deploy or alter CI workflow settings.
- Maintain portability and existing capabilities across browser storage, PWA, Device Folder and Drive; do not add excessive synchronous hashing or background load.
- **Policy-level items (F5, F16, F17, F18)** require an explicit documented choice; some can be resolved with documentation/status semantics rather than code. Do not assume every finding mandates implementation.

## 1. Audit scope, architecture and preliminary conclusion

### 1.1 Verdict and evidentiary limits

The source architecture is fundamentally coherent and already includes substantial protections: canonical transactional storage; selective strict IndexedDB durability; ownership and durable mutation fencing; Note rescue/conflict handling; OPFS attachment content verification; independent portable, Device Folder and Drive backup routes; structured backup integrity proofs; immutable repository objects; manifest and commit publication; local rollback snapshots; post-restore verification; and conservative maintenance.

The principal source-level risks are **failure-boundary correctness, backup completeness semantics, recovery coordination, freshness truthfulness and storage cleanup**. The original review identified **20 issues/decision points, not 20 demonstrated bugs**. It found two obvious source defects (F1/F2), further clear correctness defects (especially F3/F4) and bounded design/operational questions. Runtime incidence, actual data loss, throughput and browser-specific behavior were **not measured**.

This document faithfully records the 2026-10-30 source audit. **Baseline paths and line ranges are pointers, not proof that current code remains unchanged.** Revalidate each source chain when beginning its pass.

### 1.2 Canonical topology

| Layer | Owner/location | Authoritative content or role |
|---|---|---|
| IndexedDB / dailyRecords | repositories | Saved Days; canonical full study records |
| IndexedDB / dailySummaries | repositories | Derived Saved-Day summaries / indices |
| IndexedDB / notes | notes repository | Note documents / permanent note IDs |
| IndexedDB / activeSessions | repositories | Canonical current Active Session |
| IndexedDB / appMeta | typed metadata gateway | Personal drafts/settings, deletion history, journal pairs, coordination, reconciliation ancestry, mutation epoch |
| IndexedDB / assets | attachment storage | Logical attachment catalogue / OPFS metadata |
| OPFS | attachment/processing files | Attachment bytes; temporary processing and protected rollback files |
| localStorage / browser support | scoped keys and coordinator | Emergency Note/Saved-Day/Session rescue; health/last save clocks; ownership/profile coordination |
| Standalone portable | backup codec | User-exported complete or explicitly incomplete rescue snapshot |
| Device Folder | common managed repository + local filesystem transport | Independent immutable-object repository with permissions, read-back verification, checkpoint history |
| Google Drive | common managed repository + Drive transport | Independent immutable-object repository, OAuth, resumable transfer, server digest, cross-device sync |

**Publication:** canonical capture → object preparation / reuse → upload and verify objects → upload/verify manifest → upload/verify commit marker → verified receipt → retention/maintenance. Commit is the visibility boundary.

**Restore:** inspect and verify candidate → reconcile choice/plan → quiesce writes and automatic providers → protected safety capture → durable rollback journal → staged canonical writes → verify restored domains → mark verified → retire journal → resume/queue provider convergence. Restore and provider synchronization are not interchangeable.

**Concurrency:** browser ownership, mutation coordinator, strict IndexedDB transaction, provider publication/maintenance leases, attachment retention locks and Active Session cross-device claims protect different layers.

**Key source map (not exhaustive):** contracts/data-architecture.mjs, contracts/production-limits.mjs, source/core/persistence.js, repositories.js, repositories-notes.js, repository-journals.js, backup-capture.js, backup-codec.js, backup.js, managed-repository.js, backup-provider.js, backup-recovery-host.js, device-backup.js, device-folder-storage.js, asset-storage.js, asset-maintenance.js, mutation-coordinator.js, ownership.js, reconciliation.js, reconciliation-baseline.js, profiles.js, source/external/drive.js, source/app.html.

### 1.3 Strengths to preserve

| Subsystem | Existing safeguard that corrections must retain |
|---|---|
| Canonical records | Atomic writes across full Saved Days, summaries and metadata |
| Unsupported schemas | Hold newer/unknown records; prevent destructive downlevel conversion |
| Notes | Revision-aware save lane; copy-on-conflict; rescue and visible failures |
| Cross-tab control | Ownership plus separately durable mutation lease |
| Attachments | OPFS staging, content identity, ingest checks, reference-aware conservative GC |
| Portable files | Bounded parsing, structured completion proof, SHA-256 asset verification |
| Managed providers | Immutable object + manifest + verified commit; independent destination histories |
| Device Folder | Read-back checks and guarded deletes |
| Drive | Server SHA-256, resumable transfer and authorization/retry handling |
| Restore | Safety snapshot, journal, domain read-back, rollback and fail-closed recovery |
| Reconciliation | Shared resolution model and retained competing versions |
| Background work | Priority/preemption, bounded work, durable retry/maintenance intent |
| Retention/GC | Reachability, grace periods, strict uncertainty blocking |
| Compatibility | Explicit versioned migration and later retirement gates |

## 2. Complete findings register — F1–F20

Each item below records **baseline observation → risk → required investigation / target resolution → closure proof**. Status remains OPEN until a later pass records a verified disposition. Classification may change on re-audit.

### F1 — New restore-journal preparation can overwrite a pending journal
- **Classification:** Confirmed source-level defensive defect. **Severity:** High. **Pass:** A.
- **Evidence:** source/core/repository-journals.js around 86–87: prepareRestoreJournal writes restoreJournalState and restoreJournalPayload in a strict transaction without reading/rejecting a prior pair. In contrast, library-clear journal preparation checks an existing journal.
- **Risk:** An interrupted rollback record's sole durable pointer/payload may be replaced if a second preparation reaches this operation; normal startup and mutation fencing reduce exposure but do not establish the invariant at the journal layer.
- **Target:** Under the **same strict transaction**, reject preparation when either prior state or payload is present, including mismatched/corrupt entries. Do not auto-clean; preserve recovery evidence.
- **Closure:** No second preparation can replace an unretired complete, partial or corrupt journal. Legitimate first preparation succeeds. No unsafely destructive cleanup.

### F2 — Storage-reset recovery waits on absent deviceReady
- **Classification:** Confirmed source-level defect. **Severity:** Medium. **Pass:** C.
- **Evidence:** source/app.html around 9647–9690: beginStorageResetHold creates a hold without deviceReady; handleBrowserStorageReset awaits hold.deviceReady at approx. 9688. No assignment was found in the baseline source.
- **Risk:** Awaiting undefined does not wait for Device Folder readiness or permission refresh before attempting best-effort recovery.
- **Target:** Establish a real readiness contract/promise with bounded failure handling, or explicitly synchronize eligibility in the recovery path. No fabricated readiness property.
- **Closure:** Recovery waits only on real required dependencies and correctly handles unavailable, denied, delayed, changed and disconnected backup locations without endless waiting.

### F3 — Post-journal-clear file-release failure can misclassify a verified restore as failed
- **Classification:** Confirmed control-flow correctness defect; impact requires re-trace. **Severity:** High. **Pass:** A.
- **Evidence:** source/app.html around 9377: restoreJournalClear reads journal, clears appMeta pair, then releases protected file; source/core/backup.js around 1693–1740 and 1913–1930 processes journal-clear failures inside restore/rollback handling.
- **Risk:** If file release throws **after successful journal deletion**, a verified restore may be routed into error/rollback against a journal that no longer exists, yielding false failure or recovery fault.
- **Target:** Separate durable restore commit and journal retirement from best-effort scratch-file GC. Preserve error diagnostic for leftovers, never turn verified restoration into an invalid rollback because of post-commit disposal.
- **Closure:** Failure injection at each cleanup boundary leaves correct final restore status; recoverable leftovers are safely reclaimable; no missing-journal rollback.

### F4 — Unknown local save timestamp counts as a fresh verified backup
- **Classification:** Confirmed logical proof defect. **Severity:** High. **Pass:** B.
- **Evidence:** source/app.html around 4752–4756: verifyFreshCurrentBackup accepts a candidate if currentSave is not finite OR candidate.sourceRevision >= currentSave.
- **Risk:** Missing/invalid current save clock bypasses proof of freshness.
- **Target:** Reconcile the canonical mutation epoch/change clock, fail closed to **unknown/unverified** if unavailable, and use only comparable authoritative revisions. Inspect and preserve the consumer's contract.
- **Closure:** No invalid/missing/stale clock can certify a fresh backup; known current state still certifies genuine fully verified copies.

### F5 — Logical backup completeness does not imply recoverable attachment bytes
- **Classification:** Source-supported semantic gap / deliberate product-policy candidate. **Severity:** High. **Pass:** B.
- **Evidence:** source/core/backup-capture.js around 164–247 computes completeness from canonical day/note/session/deletion sources; missing referenced catalogue identities can become descriptor {missing:true}. source/core/backup-codec.js and managed-repository.js support missing descriptors.
- **Risk:** A checkpoint can be logically valid but not restore every referenced image/PDF/audio asset; a generic “complete” label might mislead.
- **Target:** Specify and propagate distinct states: **all referenced bytes verified; verifiable partial with enumerated missing assets; incomplete/unverified rescue**. Determine appropriate publication policy: preserve usable partial rescue and never silently discard other data.
- **Closure:** Inspection, publication, restore preview and success copy communicate truthful recoverability; no partial checkpoint masquerades as fully recoverable; existing-format compatibility considered.

### F6 — Restore journal reads state and payload in different transactions
- **Classification:** Source-level atomicity weakness. **Severity:** Medium. **Pass:** A.
- **Evidence:** source/core/repository-journals.js around 91: Promise.all(Meta.read(state), Meta.read(payload)).
- **Risk:** Pair can be observed at different transaction snapshots if another operation changes it between reads; mutation fencing reduces but does not eliminate the reason to enforce the invariant locally.
- **Target:** Read both records in one readonly transaction, validate identity and pair presence before returning.
- **Closure:** Reader sees one consistent pair/absence; detects partial/corrupt pair and fails closed.

### F7 — Orphaned protected rollback file on journal preparation failure
- **Classification:** Source-level cleanup weakness. **Severity:** Medium. **Pass:** A.
- **Evidence:** source/app.html around 9374: persist temporary file, then prepare durable journal; no apparent cleanup if preparation rejects.
- **Risk:** OPFS scratch space leaked; attempted “cleanup” must not delete the only reachable rollback file in an ambiguous-commit case.
- **Target:** Distinguish known-not-committed from ambiguous journal outcome. Remove unreferenced temporary bytes only after proving no journal references them; retain ambiguous cases for recovery.
- **Closure:** No orphan growth in repeatable failed preparations; never delete bytes referenced by pending recovery.

### F8 — Verified recovery record updates memory before durable write
- **Classification:** Source-level receipt consistency weakness. **Severity:** Medium. **Pass:** B.
- **Evidence:** source/app.html around 4705–4735: optimistic verifiedRecoveryState update, then async metadata write; write error is diagnostic only.
- **Risk:** UI/convergence may temporarily think a receipt persisted when restart loses it; external backup may still be valid.
- **Target:** Explicit pending/unconfirmed vs durable receipt states; narrow async decision-window; propagate persistence failure to appropriate caller while not falsely invalidating genuine provider publication.
- **Closure:** A failed local receipt write cannot be represented as durable; retry/reconciliation after reload can recover truth without copying stale state.

### F9 — Allowed Note exceeds emergency Note-rescue allowance
- **Classification:** Capacity/design asymmetry. **Severity:** Medium. **Pass:** C.
- **Evidence:** contracts/production-limits.mjs permits up to approx. 2 MiB rich-text bytes per Note, while noteRescueBytes is 1 MiB; repositories-notes.js around 214–239 drops over-capacity rescue candidates and reports shortfall.
- **Risk:** A near-limit Note in memory may not survive total failure of canonical persistence/local emergency copy.
- **Target:** Decide explicit protection model: bounded chunked fallback or transparent warning/unsaved-block policy, not automatic oversizing localStorage or synchronous costly copies.
- **Closure:** Maximum permitted Note failure mode is truthful, bounded, recoverable where promised, and never silently lost.

### F10 — Everyday attachment reads check size but not always full hash
- **Classification:** Performance/integrity trade-off. **Severity:** Medium. **Pass:** D.
- **Evidence:** source/core/asset-storage.js get verifies metadata/size; managed-repository.js around 954–969 independently hashes when recovering from local reuse or backup.
- **Risk:** Same-size later corruption might be detected only at explicit verification/backup time.
- **Target:** Keep ordinary reads fast; specify verification-on-ingest, verification-on-backup, targeted integrity audits and quarantine/reporting, rather than hashing every read.
- **Closure:** No unsupported promise of always-on hash verification; detected corruption cannot silently pass critical recovery/publish boundaries.

### F11 — Reused remote objects are not all freshly rehashed for each checkpoint
- **Classification:** Sound incremental design with recoverability semantics to refine. **Severity:** Medium. **Pass:** D.
- **Evidence:** source/core/managed-repository.js around 593–710 reuses objects via fingerprint/repository evidence; source/core/backup-provider.js has scrubbing/quarantine mechanisms.
- **Risk:** Previously valid remote bytes can later become damaged; latest publication alone is not complete historical-object audit.
- **Target:** Preserve reuse (no blanket redownload); review integrity-scrub scheduling, quarantine semantics, repair/republication path and honest receipt wording.
- **Closure:** Reused data has a stated verification age/level, is periodically or on-demand verifiable, and known corruption blocks false completeness claims.

### F12 — Deleted-profile cleanup removes rescue/local keys before database/directories
- **Classification:** Source-level destructive-ordering weakness. **Severity:** Medium. **Pass:** C.
- **Evidence:** source/core/profiles.js around 132–145: per-profile local keys removed, then deleteDatabase and OPFS directory removal; deletion can fail partway.
- **Risk:** Stalled profile deletion can strand canonical data without supplementary rescue/coordination state.
- **Target:** Audit cross-tab quiescence, retry semantics and profile registry lifecycle. Prefer safe order and idempotent finalization with no cross-profile deletion.
- **Closure:** Interrupted deletion remains recoverable/finishable and cannot erase live or wrong-profile data.

### F13 — Active Session write durability is less strict than some other canonical transactions
- **Classification:** Selective-durability policy question. **Severity:** Low–Medium. **Pass:** C.
- **Evidence:** source/core/repositories.js Active Session put uses ordinary transaction; persistence.js around 307–324 supports requested strict durability and browser fallback.
- **Risk:** Frequent updates have different flush guarantees; making every timer mutation strict can hurt responsiveness and battery.
- **Target:** Classify critical Session transitions (start/pause/finish/restore) vs frequent ticks; strengthen only where justified.
- **Closure:** Written durability policy and code match the criticality of transitions; no excessive high-frequency forced persistence.

### F14 — Device Folder digest cache keyed by timestamp/size metadata
- **Classification:** Cache-identity trade-off, lower risk. **Severity:** Low. **Pass:** D/E.
- **Evidence:** source/core/device-folder-storage.js around 100–125 caches digest keyed by repository scope, filename, lastModified, size. Direct checksum check exists before guarded deletion.
- **Risk:** Metadata-key aliasing possible when file contents change without detectable modification metadata changes.
- **Target:** Audit every use of cached digest in safety-critical decisions; bypass or invalidate cache at destructive/commit/recovery-proof boundaries where needed.
- **Closure:** Cache never alone authorizes destructive action or externally verified restore; performance remains bounded.

### F15 — Drive resumable-upload sessions do not survive page termination
- **Classification:** Restart-efficiency limitation. **Severity:** Low–Medium. **Pass:** E.
- **Evidence:** source/external/drive.js repositoryUploads in-memory map and resumable continuation/recovery.
- **Risk:** Page restart loses upload URL and offset; operation may need repeat upload. Not itself evidence of lost canonical data.
- **Target:** Audit orphan-upload safety, known-absent optimization and retry cost. Add durable resumability **only if** security, expiration, complexity and actual benefit justify it.
- **Closure:** Interrupted upload cannot create false commit/identity collision; retry is safe and behavior documented.

### F16 — Current-format checkpoint presence retires old ordinary-format history
- **Classification:** Historical-retention **product policy decision**, not proof of defect. **Severity:** Policy. **Pass:** E.
- **Evidence:** source/core/managed-repository.js around 293–350 selects current format for normal retention when any current-format checkpoint exists.
- **Risk:** Old checkpoint may preserve historical content deleted from current state; retirement can reduce long-term historical reach.
- **Target:** Explicitly choose/record compatibility retirement policy and exceptions, respecting user intent to retire unsupported formats only when safe.
- **Closure:** Decision is documented; deletion never occurs while unreadable/uncertain/protected state requires retention.

### F17 — Drive authorization persistence has a security/convenience trade-off
- **Classification:** Security product decision. **Severity:** Policy. **Pass:** E.
- **Evidence pointer:** source/external/drive.js token/session path and browser-storage policy; revalidate exact lifetime and key ownership before changing.
- **Risk:** Browser script exposure vs fewer sign-ins and better backup continuity.
- **Target:** Examine actual storage lifetime/scope and CSP/permission model; favor least privilege, short lifetime, no logging or backup of credentials. Do not accidentally break reconnection.
- **Closure:** Explicit threat/UX decision, no secrets in portable or managed backup, no unjustified persistent exposure.

### F18 — Automatic backup depends on actual execution opportunities and provider eligibility
- **Classification:** Browser/PWA operational limitation. **Severity:** Operational. **Pass:** E.
- **Evidence:** source/core/backup-provider.js around 950–1010 relies on connected providers, automatic cadence, foreground flush and background scheduling.
- **Risk:** “Connected” is not “continuously backed up”, especially after process termination or expired Drive authentication.
- **Target:** Define accurately surfaced statuses: up-to-date, changes waiting, in progress, action required, failed, unknown/offline.
- **Closure:** No promise of guaranteed periodic execution while closed; settings/status report latest verified backup independently for each destination.

### F19 — Potential large aggregate binary payload and storage pressure
- **Classification:** Capacity/operational boundary. **Severity:** Capacity. **Pass:** E.
- **Evidence:** contracts/production-limits.mjs backupMaxFileBytes is MAX_SAFE_INTEGER; bounded compressed metadata and individual assets. source/core/backup-codec.js v10 container.
- **Risk:** Huge aggregate payload, temporary copies, local quota and limited-memory devices.
- **Target:** Inspect actual streamed/protected processing and storage estimate/headroom; apply practical bounded per-operation budgets or preflight warnings without blocking valid large libraries arbitrarily.
- **Closure:** Fail safely before destructive work when space is insufficient, or report a recoverable capacity error; no unbounded in-memory concatenation introduced.

### F20 — Orchestration complexity concentrated in a few large modules
- **Classification:** Maintainability/architectural hotspot, **not** an independent functional defect. **Severity:** Architectural. **Pass:** F.
- **Evidence:** source/core/backup-provider.js, backup.js and source/app.html contain much orchestration and UI/application wiring.
- **Risk:** Broad changes are harder to verify; accidental duplicated policy or partially aligned paths.
- **Target:** After A–E, source-audit duplicate rules, unreachable paths and unsafe coupling; consolidate only proven duplicates into their existing clear owner, without speculative extraction.
- **Closure:** Measurable simplification, no duplicated algorithm or contract mismatch, no feature/compatibility regression.

## 3. Cross-cutting source questions to answer during passes

1. **Journal lifetime:** How do prepare/read/mark/clear, OPFS file.persist/read/release, and startup recovery behave after every single interrupted await or ambiguous IndexedDB commit?
2. **Authority:** Which operations are fenced by ownership tokens, durable mutation leases, provider publication leases and attached abort signals? Are reads made consistent with that authority?
3. **Exactness:** Which restore modes merge, preserve extra data, replace entirely, or keep conflicting versions? Are post-restore verifiers exact for every selected domain and negative/deletion assertion?
4. **Attachments:** How are references collected from Saved Days, Notes, Active Session and versions kept for review? How do missing metadata, missing OPFS file, same-size corruption and deduplicated physical bytes differ?
5. **Provenance:** What does a verified checkpoint prove—capture completeness, remote object validity at upload, reused-object history, local read-back, current freshness, or eventual cross-provider convergence?
6. **Recovery feedback:** Which success states survive page restart? Which warnings remain until user action? Are optional cleanup failures distinguishable from durable commit failures?
7. **Retention:** Can a temporarily unreadable version, stale manifest index, active publication, newer-format marker, collision or ambiguous object inventory authorize deletion? The default answer must be no.
8. **Storage reset:** Are site-data erasure, same-tab recoverability, profile identity, Device Folder permission and connected Drive availability reconciled without assuming background execution?
9. **Performance:** Is all extra verification bounded, incremental and preemptible? Avoid bulk hashing on every note keystroke, timer tick or normal attachment render.
10. **Compatibility:** Which formats were actually released vs merely written on current-fixes? Do not preserve speculative branch-only schema migrations.

## 4. Severity, classification and remediation rules

- **Confirmed defect:** The exact current source violates a clear invariant and a plausible call chain reaches it; record what was traced.
- **Source-level risk:** A missing local guard or inconsistent boundary is demonstrated, but surrounding system protections/runtime prerequisites may limit impact.
- **Deliberate trade-off:** Both cost and benefit are real; fix only when warranted by an agreed guarantee.
- **Policy decision:** Record owner intent, current behavior, safety implications and accepted outcome; closure may be “retain, document, make transparent”.
- **Operational limitation:** Browser, permission or provider external constraints; do not promise background execution the platform cannot supply.
- For every correction, inspect **the entire neighboring code pathway**. No one-line patch without precondition and postcondition review.
- **No hallucinated status:** OPEN, REVALIDATING, IN PROGRESS, IMPLEMENTED–PENDING QA, VERIFIED CLOSED, RETAINED BY POLICY, or SUPERSEDED WITH EVIDENCE.

## 5. Source-to-finding map and dependencies

| File / boundary | IDs | Key dependency |
|---|---|---|
| repository-journals.js; app.html journal adapter; backup.js | F1, F3, F6, F7 | Pass A must precede any risky restore edits |
| app.html freshness/receipt; backup-capture.js; backup-codec.js | F4, F5, F8 | Pass B follows A; preserve old-format readers |
| app.html reset; repositories-notes.js; profiles.js; repositories.js | F2, F9, F12, F13 | Pass C; retain rescue and ownership semantics |
| asset-storage.js; managed-repository.js; backup-provider.js; device-folder-storage.js | F10, F11, F14 | Pass D; avoid blanket remote rehash |
| source/external/drive.js; managed-repository.js; backup-provider.js; production-limits.mjs | F15–F19 | Pass E; record explicit product/security choices |
| backup-provider.js; backup.js; app.html; relevant helper modules | F20, any remaining duplications | Pass F only after behavior stabilizes |

**Baseline must not be treated as current after a new commit.** Recheck exact line numbers at each start.

## 6. Master issue tracker

| Finding | Class | Pass | Baseline state | Latest result / evidence |
|---|---|---|---|---|
| F1 | Confirmed defect | A | OPEN | Initial source trace; not implemented |
| F2 | Confirmed defect | C | OPEN | Initial source trace; not implemented |
| F3 | Confirmed control-flow defect | A | OPEN | Initial source trace; not implemented |
| F4 | Confirmed proof defect | B | OPEN | Initial source trace; not implemented |
| F5 | Semantic / policy gap | B | OPEN | Initial source trace; policy to decide |
| F6 | Atomicity risk | A | OPEN | Initial source trace |
| F7 | Orphan cleanup risk | A | OPEN | Initial source trace |
| F8 | Receipt consistency risk | B | OPEN | Initial source trace |
| F9 | Capacity asymmetry | C | OPEN | Initial source trace |
| F10 | Integrity trade-off | D | OPEN | Initial source trace |
| F11 | Reuse trade-off | D | OPEN | Initial source trace |
| F12 | Destructive ordering risk | C | OPEN | Initial source trace |
| F13 | Durability policy | C | OPEN | Initial source trace |
| F14 | Cache-key risk | D | OPEN | Initial source trace |
| F15 | Restart limitation | E | OPEN | Initial source trace |
| F16 | Retention policy | E | OPEN | Initial source trace |
| F17 | Token security policy | E | OPEN | Initial source trace |
| F18 | PWA operational limits | E | OPEN | Initial source trace |
| F19 | Capacity envelope | E | OPEN | Initial source trace |
| F20 | Architecture cleanup | F | OPEN | Initial source trace |

**Total:** 20 open items, including non-defect choices. Do not report “20 bugs fixed” when this tracker is complete.

## 7. Implementation programme — pass cards

### Pass A — Recovery journal correctness and atomicity
**Status:** NOT STARTED. **IDs:** F1, F3, F6, F7.  
**Preliminary:** Read §§0–6, current source and §9; identify existing journal lifecycle and rollback file ownership.  
**Audit:** Full prepare→persist→mark→read→clear→recovery call chains including ambiguous transaction success.  
**Plan:** Enforce no-overwrite, same-snapshot reads, safe temporary-file disposal, post-commit success independence. Consider shared internal journal helpers only if they reduce rather than obscure logic.  
**Implementation:** Minimal precise edits in existing journal/backup boundaries.  
**Objective verification:** (A1) old journal never overwritten; (A2) pair read is atomic; (A3) post-commit cleanup failure cannot reverse verified result; (A4) orphan disposal cannot delete pending recovery bytes; (A5) restart recovery remains fail-closed.  
**Targeted QA:** Single-/partial-pair, invalid-state, failed persist, commit ambiguity, read/clear/release failures, interrupted restore, real protected-file lifetime.  
**Gate for closure:** A1–A5 verified with relevant source and targeted outcomes.

### Pass B — Backup completeness, freshness and truthful receipts
**Status:** NOT STARTED. **IDs:** F4, F5, F8. **Depends:** A.  
**Audit:** Source revision clock and mutation epoch, backup capture/fence, manifest descriptor semantics, provider/file receipts, inspection/restore presentation and all consumers of freshness.  
**Plan:** Define “canonical complete”, “all bytes recoverable”, “verified partial” and “fresh relative to known revision” as distinct evidence classes. Preserve recoverable rescue export.  
**Objective verification:** (B1) unknown clock never proves fresh; (B2) asset missing/corruption cannot be labeled fully recoverable; (B3) local receipt durability accurately represented; (B4) ordinary successful backups remain efficient; (B5) compatibility and preview semantics intact.  
**Targeted QA:** Missing clock, malformed epoch, stale receipt, metadata write fault, missing attachment, unchanged valid complete backup, user-facing status.

### Pass C — Browser-reset, Notes rescue, profile deletion and Session durability
**Status:** NOT STARTED. **IDs:** F2, F9, F12, F13. **Depends:** A/B where shared restore state applies.  
**Audit:** Storage-reset hold/readiness, permissions/connectivity, rescue quotas, Notes save/error behavior, profile deletion and cross-tab quiescence, Session transaction criticality.  
**Plan:** Fix undefined readiness; make capacity behavior explicit and safely bounded; make profile destructive cleanup resumable; apply strict durability selectively only when warranted.  
**Objective verification:** (C1) real ready/failed gate; (C2) no false rescue guarantee at max Note size; (C3) interrupted profile deletion cannot damage another/live profile; (C4) critical Session writes follow documented durability; (C5) no costly normal editing/timer regression.  
**Targeted QA:** Delayed/revoked folder, reset and reload, failed save at cap, interrupted profile removal, critical Session transitions.

### Pass D — Binary verification, reuse and Device Folder caching
**Status:** NOT STARTED. **IDs:** F10, F11, F14. **Depends:** B semantics.  
**Audit:** Ingest metadata/bytes, OPFS reads, asset reference GC, remote object reuse, scrub/quarantine, Device Folder cache usage and destructive checks.  
**Plan:** Preserve deduplication and incremental performance; refine integrity exposure, targeted rechecks, scrub scheduling and cache invalidation only where safety demands.  
**Objective verification:** (D1) detected corrupt bytes cannot be silently restored/published as complete; (D2) cache never alone proves a destructive action safe; (D3) reused object verification guarantees are explicit; (D4) no unnecessary full re-download/hash.  
**Targeted QA:** Missing file, wrong size, same-size modified bytes, stale digest key, quarantine/recovery and reused objects.

### Pass E — Provider resilience, retention policy, security and capacity
**Status:** NOT STARTED. **IDs:** F15–F19. **Depends:** B and D where applicable.  
**Audit:** Drive upload continuity/collisions; device-specific transport differences; current/legacy retention; auth token storage and CSP; background eligibility; binary streaming/memory/quota.  
**Plan:** Choose policies explicitly and do not implement complexity without value. Show per-provider pending/current/permission/failure states truthfully.  
**Objective verification:** (E1) stopped uploads cannot yield false verified commit; (E2) history policy is justified and safe; (E3) token lifetime and exposure understood; (E4) no false closed-PWA scheduling promises; (E5) large datasets fail safely without destroying canonical data; (E6) two providers remain independent.  
**Targeted QA:** Interrupted Drive upload/restart, identity collisions, old-version retirement, permission expiry, offline/resume, simulated low quota and capacity bounds.

### Pass F — Consolidation, dead-code cleanup and source-level re-audit
**Status:** NOT STARTED. **IDs:** F20 and leftovers. **Depends:** A–E.  
**Audit:** Re-examine source and the completed ledger de novo; map actual duplicated policies/branches, contracts and call chains; compare post-A–E architecture with invariants.  
**Plan:** Remove only proven redundancy, preserve compatibility guards still required by shipped data, avoid feature drift.  
**Objective verification:** (F1-obj) all F1–F20 have evidenced dispositions; (F2-obj) no drift from backup/recovery invariant set; (F3-obj) no new parallel systems or dead adapters; (F4-obj) simpler/equivalent behavior; (F5-obj) targeted QA of all F changes.  
**Targeted QA:** Focused source/contract, backup/restore, sync, ownership and affected UI workflows. Discuss **separate final comprehensive QA** after programme completion, rather than running it silently on each pass.

## 8. Completion rules

A pass is **closed** only when:
1. Preliminary orientation and source audit are documented, including corrections to mistaken earlier findings.
2. Each in-scope finding has a disposition and a specific acceptance criterion.
3. Implementation is committed on current-fixes (or explicitly not needed, with policy/evidence recorded).
4. Objective-by-objective reinspection is recorded and every blocker is resolved or accurately carried forward.
5. Targeted QA is recorded, including failures/not-run checks and their implications.
6. §6 and §7 statuses match the implementation journal entry.
7. No unrequested full QA, source rewrite, release, branch merge or unrelated modification occurred.

Final A–F completion requires **all 20 findings accounted for**, not necessarily 20 code changes; any outstanding safety issue remains visibly OPEN/BLOCKED.

## 9. Append-only implementation journal / scratchpad

> Maintain this **below the original audit and plan**. Do not replace earlier entries with retrospective claims. Add one entry per pass or significant corrective iteration. Include any changed assumptions and source citations.

### Entry 000 — Audit capture and remediation-ledger creation
- **Date:** 2026-10-30.
- **Branch/source baseline:** current-fixes @ 53c968b7f876280f0d5e57528eeb5400a1783b29.
- **Preliminary stage:** Historical audit mapped to a new dedicated remediation programme. Previous documentation remains intact; previous claims of closure are not treated as evidence for this new programme.
- **Audit:** Documented earlier source-only findings F1–F20, storage topology, strengths, caveats and A–F priorities. No new functional root-cause investigation in this entry.
- **Analysis:** A precedes B–E because restore-journal invariants protect any later changes. B sets semantic truth for D/E. C addresses local rescue, reset and deletion. F consolidates after behavior stabilizes. Policy items cannot be forcibly classified as defects.
- **Implementation:** **Documentation only** — this ledger. No app source, test, workflow, configuration or runtime behavior changed.
- **Objectives check:** Document preserves complete issue register; preserves known strengths and uncertainty labels; defines the preliminary-plus-five-step process, per-pass objectives, dependencies, closure rules and journal; does not claim passes completed.
- **QA:** **None executed** for this documentation-only setup. At most, verify the committed document exists on correct branch with its content intact.
- **Next action:** Pass A — start with this ledger (§0 and Pass A), read current source, update findings/plan, implement, verify objectives, run targeted QA, append journal entry.

### Template — copy for the next pass
#### Entry NNN — Pass [A–F], [short description]
- **Date / branch / head before:**
- **Ledger orientation:** Previous state, open IDs, source drift, dependencies:
- **Step 1 — Audit:** Paths/functions/line evidence; original finding confirmed/qualified/refuted; nearby safeguards:
- **Step 2 — Analysis and objectives:** Root cause, chosen minimal design, alternate options rejected, constraints, explicit numbered gates:
- **Step 3 — Implementation:** Modified files, commit SHA(s), exact behavior, deletions/consolidation, data/format impact:
- **Step 4 — Objectives rechecked:** Each gate MET / NOT MET / PARTIAL, evidence and remaining caveats:
- **Step 5 — Targeted QA:** Commands/checks, observed pass/fail, covered edge cases, not run:
- **Registry changes:** F# status/disposition, pass card status:
- **Regressions / unresolved risks:**
- **Next action and read-first pointers:**

---
**Ledger contract:** Inspect first; audit current source; analyze; implement; verify every objective; run targeted QA; append evidence; then close the pass. Preserve this record as a practical engineering scratchpad, not a ceremonial checklist.
