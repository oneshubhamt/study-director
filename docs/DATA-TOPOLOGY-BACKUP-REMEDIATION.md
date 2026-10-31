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
| source/external/drive.js; backup-provider.js | F15 | Focused Pass E: Drive upload restart and retry safety |
| managed-repository.js; backup-provider.js; production-limits.mjs | F16–F19 | Policy entries accepted/deferred in Entry 001; no code task without new evidence |
| backup-provider.js; backup.js; app.html; relevant helper modules | F20 | Deferred: no module splitting by size alone; only proven necessary cleanup within other passes |

**Baseline must not be treated as current after a new commit.** Recheck exact line numbers at each start.

## 6. Master issue tracker

| Finding | Class | Pass | Baseline state | Latest result / evidence |
|---|---|---|---|---|
| F1 | Confirmed defect | A | IMPLEMENTED — QA PENDING | Strict atomic journal preparation guards both prior records |
| F2 | Confirmed defect | C | VERIFIED CLOSED — TARGETED QA PASS | Shared bounded Device Folder initialization/permission readiness gate; fallback on denial/timeout |
| F3 | Confirmed control-flow defect | A | IMPLEMENTED — QA PENDING | Post-clear scratch disposal cannot override verified restoration |
| F4 | Confirmed proof defect | B | VERIFIED CLOSED — TARGETED QA PASS | Canonical mutation-epoch comparison; unknown/invalid/failed reads return unverified |
| F5 | Semantic / policy gap | B | VERIFIED CLOSED — TARGETED QA PASS | Separate binary recoverability status; missing asset IDs and warnings; partial backups retained but exact replacement disallowed |
| F6 | Atomicity risk | A | IMPLEMENTED — QA PENDING | Pair is read in one readonly metadata transaction |
| F7 | Orphan cleanup risk | A | IMPLEMENTED — QA PENDING | Journal-aware scratch lease release and protected finally |
| F8 | Receipt consistency risk | B | VERIFIED CLOSED — TARGETED QA PASS | Durable commit precedes in-memory receipt; failed writes reported and do not claim durable recovery |
| F9 | Capacity asymmetry | C | VERIFIED CLOSED — POLICY + TARGETED QA | 1 MiB rescue cap intentionally retained; oversized unsaved Notes named and warned before failed IDB save |
| F10 | Integrity trade-off | D | OPEN | Initial source trace |
| F11 | Reuse trade-off | D | OPEN | Initial source trace |
| F12 | Destructive ordering risk | C | VERIFIED CLOSED — TARGETED QA PASS | Persist rescue/local state until IndexedDB and OPFS deletion succeed; retry marker, blocked-tab notification |
| F13 | Durability policy | C | VERIFIED CLOSED — TARGETED QA PASS | Strict critical Session updates, suspension/finish/restore/transfer; lightweight default timer snapshots |
| F14 | Cache-key risk | D | OPEN | Initial source trace |
| F15 | Restart limitation | E | OPEN | Initial source trace |
| F16 | Retention policy | None | VERIFIED CLOSED — intentional | User confirmed current-format preference, 2026-10-30 |
| F17 | Token security policy | None | VERIFIED CLOSED — accepted | Serverless short-lived Drive token storage accepted, 2026-10-30 |
| F18 | PWA operational limits | None | VERIFIED CLOSED — accepted | No server; PWA execution restrictions understood, 2026-10-30 |
| F19 | Capacity envelope | Deferred | DEFERRED — do not add arbitrary global size cap | Revisit only a proven space/memory defect |
| F20 | Architecture cleanup | Deferred | DEFERRED — no size-only modularization | Refactor only for demonstrated correctness or duplication |

**Total: 15 active findings (F1–F15); 3 accepted/closed by policy (F16–F18); 2 deferred (F19–F20).** These are not 20 bugs.

## 7. Implementation programme — pass cards

### Pass A — Recovery journal correctness and atomicity
**Status:** IMPLEMENTED — TARGETED RUNTIME QA PENDING. **IDs:** F1, F3, F6, F7.  
**Preliminary:** Read §§0–6, current source and §9; identify existing journal lifecycle and rollback file ownership.  
**Audit:** Full prepare→persist→mark→read→clear→recovery call chains including ambiguous transaction success.  
**Plan:** Enforce no-overwrite, same-snapshot reads, safe temporary-file disposal, post-commit success independence. Consider shared internal journal helpers only if they reduce rather than obscure logic.  
**Implementation:** Minimal precise edits in existing journal/backup boundaries.  
**Objective verification:** (A1) old journal never overwritten; (A2) pair read is atomic; (A3) post-commit cleanup failure cannot reverse verified result; (A4) orphan disposal cannot delete pending recovery bytes; (A5) restart recovery remains fail-closed.  
**Targeted QA:** Single-/partial-pair, invalid-state, failed persist, commit ambiguity, read/clear/release failures, interrupted restore, real protected-file lifetime.  
**Gate for closure:** A1–A5 verified with relevant source and targeted outcomes.

### Pass B — Backup completeness, freshness and truthful receipts
**Status:** VERIFIED CLOSED — TARGETED QA PASS (2026-10-31). **IDs:** F4, F5, F8. **Depends:** Pass A source implementation, whose own journal-specific runtime QA remains separately outstanding.  
**Audit:** Source revision clock and mutation epoch, backup capture/fence, manifest descriptor semantics, provider/file receipts, inspection/restore presentation and all consumers of freshness.  
**Plan:** Define “canonical complete”, “all bytes recoverable”, “verified partial” and “fresh relative to known revision” as distinct evidence classes. Preserve recoverable rescue export.  
**Objective verification:** (B1) unknown clock never proves fresh; (B2) asset missing/corruption cannot be labeled fully recoverable; (B3) local receipt durability accurately represented; (B4) ordinary successful backups remain efficient; (B5) compatibility and preview semantics intact.  
**Targeted QA:** Missing clock, malformed epoch, stale receipt, metadata write fault, missing attachment, unchanged valid complete backup, user-facing status.

### Pass C — Browser-reset, Notes rescue, profile deletion and Session durability
**Status:** VERIFIED CLOSED — TARGETED QA PASS (2026-10-31). **IDs:** F2, F9, F12, F13. **Depends:** A/B where shared restore state applies.  
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

### Pass E — Focused Drive upload continuity (F15 only)
**Status:** NOT STARTED. **Active ID: F15.** F16–F18 resolved by policy; F19 deferred. **Depends:** B and D.  
**Audit:** Trace Drive multipart/resumable publication, in-memory upload sessions, interruption, expiring uploads, remote identity checks, retry and commit-marker verification. Compare only relevant Device Folder transport contracts.  
**Plan:** Preserve existing safe retry and server checksum verification. Implement durable upload-session persistence only if a concrete benefit clearly exceeds added security/complexity risk. Do not reopen F16–F19.  
**Objective verification:** (E1) interrupted/restarted upload cannot produce a false commit; (E2) identical/replayed content resolves safely; (E3) conflicting identity is rejected; (E4) remote errors preserve canonical source and retry eligibility; (E5) no unnecessary auth or data rereads; (E6) independent Device Folder behavior remains unchanged.  
**Targeted QA:** Interrupted/resumed uploads, process restart, expired resumable session, ambiguous completion, identity collisions, provider checksums and cancellation.

### Pass F — Deferred architecture cleanup (not automatically scheduled)
**Status:** DEFERRED. **F20 is not an authorized module-splitting pass.** Only reopen for a proven issue and user approval.  
**No code work authorized for this pass now.** If a later specific duplication or unsafe ownership boundary is demonstrated, propose a scoped change within the affected active pass; otherwise leave these modules intact. At the end of F1–F15, review the ledger and decide separately whether a broad source audit or comprehensive QA is warranted. Nothing here authorizes splitting modules by size.

## 8. Completion rules

A pass is **closed** only when:
1. Preliminary orientation and source audit are documented, including corrections to mistaken earlier findings.
2. Each in-scope finding has a disposition and a specific acceptance criterion.
3. Implementation is committed on current-fixes (or explicitly not needed, with policy/evidence recorded).
4. Objective-by-objective reinspection is recorded and every blocker is resolved or accurately carried forward.
5. Targeted QA is recorded, including failures/not-run checks and their implications.
6. §6 and §7 statuses match the implementation journal entry.
7. No unrequested full QA, source rewrite, release, branch merge or unrelated modification occurred.

Active completion means F1–F15 have evidenced outcomes. F16–F18 are accepted; F19–F20 deferred. Never misreport a remaining safety issue as closed.

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

### Entry 001 — Owner decisions on F16–F20 (2026-10-30)
- **Source of decision:** Owner explicitly retained current-format history preference (F16), accepted browser-only Google Drive token and PWA restrictions (F17–F18), requested no arbitrary capacity changes (F19), and deferred architectural splitting (F20). Implement F1–F15 including F14–F15.
- **F16: VERIFIED CLOSED, intentional.** Current-format ordinary checkpoints should supersede old-format ordinary checkpoints according to existing retention rules. Preserve safety exceptions for protected/unreadable/uncertain history.
- **F17: VERIFIED CLOSED, accepted trade-off.** Keep GIS token-model authorization and origin-local localStorage reuse for a short-lived access token. Source: source/external/drive.js; it requests only https://www.googleapis.com/auth/drive.file, validates scopes and expires/removes tokens. No refresh token is held; without a backend, expired tokens need user-driven reauthorization. Retain strict CSP, minimized script surface, no token logging and explicit revoke. Moving to sessionStorage or memory would impair reload/cross-tab reuse; browser-only encryption with an accessible key is not meaningful protection against script compromise. Google docs: https://developers.google.com/identity/oauth2/web/guides/use-token-model and https://developers.google.com/identity/oauth2/web/guides/migration-to-gis .
- **F18: VERIFIED CLOSED, accepted platform limit.** No server. PWA automatic backups run only when browser execution, connectivity and provider authorization allow. Do not simulate unavailable always-on background sync. Recheck any concrete incorrect UI claim if found incidentally.
- **F19: DEFERRED.** Do not impose global aggregate size cap. Existing per-asset and metadata limits, Blob composition and restore storage preflight warrant preserving large-library support. Reopen only for a specific demonstrated unsafe allocation, quota or retry failure; correct that narrow problem.
- **F20: DEFERRED.** No module split based solely on file length. Keep existing ownership boundaries, clean up proven duplication only while fixing F1–F15; no standalone refactor phase.
- **Plan:** Pass A → B → C → D (includes F14) → focused Pass E (F15); Pass F not scheduled. These policy closures are not code fixes. All F1–F15 remain unimplemented.
- **Implementation:** Ledger-only edit; no application code changed. **Targeted QA:** Not applicable to this documentation decision; verify ledger read-back and diff.

### Entry 002 — Pass A: restore journal correctness and scratch-file lifetime (2026-10-31)

- **Branch/start:** current-fixes at 6de3068c6f959a0dc4bcb3ba7c7b4b5d908c9d82. **Application/test head:** e553c5c92c86b8042b3faee6a5f985d4b1abf7a5. **Scope:** F1/F3/F6/F7 only. F16–F18 accepted, F19–F20 deferred.
- **Preliminary:** Read this ledger, previous owner decisions, current source and repository conventions before editing.
- **Step 1 — Audit:** repository-journals.js prepared a pair without checking existing state/payload, read them in independent transactions and cleared an incomplete/mismatched pair; app.html persisted a scratch file before journal prepare without failure cleanup and propagated file disposal errors after removing the durable journal; backup.js read rollback deletion state outside restore try/finally and propagated cleanup exceptions. Verified the typed metadata gateway, strict IndexedDB transaction and OPFS file-store retention/GC source directly.
- **Step 2 — Analysis:** Keep journal schema and backup formats unchanged; use existing strict transactions and OPFS retention. A1: reject any existing prior pair or half; A2: paired readonly snapshot; A3: disposal after verified restore/rollback cannot cause false failure; A4: cleanup orphan producer only if journal read proves no corresponding durable file reference, retaining ambiguity; A5: fail closed on partial/mismatched or absent named journal.
- **Step 3 — Implementation:** In repository-journals.js, preparation atomically reads both records before strict writes, read uses a single readonly transaction, clear checks both records and expected ID, including missing named journal. In app.html, failed file-backed preparation probes the durable journal before producer release; post-journal-clear disposal exceptions become warnings only. In backup.js, both restore paths now protect pre-journal deletion/schedule reads with try/finally; shared releaseRestoreScratch catches/logs file cleanup faults, including startup recovery. Expanded the existing tests/integration/storage/repository-journals.mjs with duplicate, competing, orphaned, mismatched, missing named and state-only scenarios.
- **Source commits:** 01e78f7d77b61d49492c0d57a22942e5e33fe6a2; d087fded68a1ee3ea5930b472787eda0be194985; 7ad1b3a04591a0e21887eacf012205f82e30acf9; 1c9efddddbabfbca2dd33fdd6774fc4fc4b50aa0; a528b7e72b3df6b6083520d73e5536faa1524a89; e553c5c92c86b8042b3faee6a5f985d4b1abf7a5.
- **Step 4 — Verify objectives:** A1 MET, A2 MET, A3 MET, A4 MET, A5 MET by fresh source reinspection. GitHub compare showed exactly four changed files: repository-journals.js, app.html, backup.js, repository-journals.mjs test. No provider, compatibility, backup-format, workflow or generated build changes.
- **Step 5 — Targeted QA:** Executed six programmatic checks against the current source (A1–A5 plus presence of regression scenarios): **6/6 passed**. Authored focused behavioral tests but **execution NOT verified** because no authenticated local checkout is available here. The automatic Repository checks workflow was queued and does not directly run the journal-specific test in its hardcoded targeted list. Suggested targeted command: node tests/helpers/run-category.mjs targeted tests/integration/storage/repository-journals.mjs tests/integration/backup/file-lifetimes.mjs tests/integration/backup/capture-safety.mjs tests/integration/library/library-clear.mjs. Full QA intentionally omitted. No claim of executed runtime tests.
- **Status:** IMPLEMENTED; ALL SOURCE OBJECTIVES MET; TARGETED RUNTIME QA PENDING. Reopen and append a corrective entry for any runtime failure. Do not declare Pass A fully CLOSED until focused tests actually run and pass.
- **Next:** Finish targeted runtime verification when feasible; then Pass B (F4/F5/F8), beginning with current source and this ledger.

### Entry 003 — Pass B: truthful backup freshness, attachment recoverability and durable receipts

- **Date:** 2026-10-31. **Branch:** current-fixes. **Starting HEAD:** c8299c0fc02eefe36983baeb4a6643b8fd44a750. **Implementation HEAD:** 9b6ff61c4d1e3d329d1b73374dd31ab1a491a53f.
- **Preliminary:** Read §§0–7 and Entries 001–002, established source HEAD and checked Pass A's status. Pass A implementation and its repository checks passed; note that Pass A's directly targeted repository-journals.mjs runtime test is still marked pending in its separate entry. Limited scope to F4/F5/F8 and affected source/preview/managed publication boundaries.
- **Step 1 — Fresh source audit:**
  - F4: app.html verifyFreshCurrentBackup accepted any current-format receipt when readStorageHealth().lastLocalSaveAt was absent; mutationEpoch.latestChangeAt already reconciles the canonical IndexedDB epoch and the fast local copy.
  - F8: app.html updateVerifiedRecoveryState set an optimistic in-memory receipt before awaiting the typed appMeta write, logged but swallowed a write error, and readVerifiedRecoveryState silently substituted memory after a read failure. backupCompleted did not await the receipt update, so local metadata failure must remain separate from actual external publication. Reminder/startup consumers of reads required explicit failure handling.
  - F5: backup-capture.js logical completeness covers canonical records, notes, active session and deletion history, not binary coverage; portable backup-codec.js and managed-repository.js already cryptographically represent missing descriptors alongside intact data. Existing manifest.warning and provider/result messaging support a format-preserving warning; backup.js and backup-recovery-host.js replacement options otherwise permitted known binary-incomplete backup copies.
- **Step 2 — Plan and acceptance criteria:**
  - B1: Require an authoritative, parseable canonical current revision; missing/invalid/failed clock or receipt read means no fresh proof, stale copies fail.
  - B2: Derive separate attachment coverage from the existing verified asset descriptor list. Keep logical canonical completeness distinct, allow inspectable partial rescue checkpoints, clearly communicate missing IDs/count, and fail closed on exact replacement from missing bytes.
  - B3: Do not publish an in-memory **durable** local receipt before the appMeta write commits; propagate/log failed writes without invalidating an actually committed external checkpoint; protect startup/reminder readers against rejected promises.
  - B4: No re-hashing/re-uploading unchanged attachments merely for status; keep managed incremental reuse and standalone Blob framing.
  - B5: No backup-format/schema migration or destructive changes to earlier-version readers; preserve Combine and Add only what is missing.
- **Step 3 — Implementation:**
  1. app.html: verifyFreshCurrentBackup now uses AppData.mutationEpoch.latestChangeAt(currentBackupSourceRevision()), fails closed on unknown, invalid, stale or unreadable proofs. Local receipt writer now serially reads, writes and only then updates verifiedRecoveryState; errors reject and are logged by the backupCompleted callback. A partial-attachment copy stores a null current-format freshness marker, while its actual source revision and last-backup history remain visible. Startup and reminder read failures become logged, nonfatal status uncertainty.
  2. backup-codec.js: pure derived attachmentCoverage and missingAttachmentWarning on existing signed asset descriptors; no new persisted completion fields.
  3. backup-capture.js: portable canonical completeness now includes an independent transient binary coverage verdict and explicit warning, while preserving the original canonical-complete vs rescue-partial proof.
  4. managed-repository.js / backup-provider.js: manifest warning carries partial binary recoverability and sample missing IDs. Committed/unchanged provider versions surface warnings. Provider's local receipt signals attachmentsComplete from the verified manifest; full coverage remains eligible as proof, missing assets do not.
  5. backup.js / backup-recovery-host.js: restore preview reports coverage and exact replacement preflight rejects missing attachment bytes; both portable and managed UI suppress exact replace when known partial. Combine/Add still work. Even if UI misses a warning, the engine rejects unsafe exact replacement.
  6. tests/integration/backup/capture-safety.mjs: deterministic tests of canonical text with missing binary, missing/stale epoch, failed/stalled metadata writes, in-memory receipt visibility, partial receipt eligibility, and failure logging by executing extracted actual host code. tests/integration/backup/repository-checkpoint.mjs: updated real module harness codec port. tests/integration/backup/portable-backup.mjs: added direct actual-codec partial descriptor assertions. **Earlier failing CI runs were traced to incomplete test mocks and an overridden fixture assetIds function; both were corrected, not ignored.**
- **Step 4 — Objectives verified:** B1 MET (canonical epoch / parseability / no unknown-fresh branch), B2 MET (partial warnings, identities, source-level exact-restore guard), B3 MET (IDB write before state update, explicit failure handling), B4 MET (derived descriptor-only coverage without extra provider binary I/O), B5 MET (no on-disk schema/format changes; existing import and combine preserved). Seven separate focused source reinspection checks passed; diff reviewed for scope.
- **Step 5 — Targeted QA results:** **PASS** — GitHub Actions Repository checks, run **41159578102**, commit **9b6ff61c4d1e3d329d1b73374dd31ab1a491a53f**. All steps passed: targeted safety/repository contracts (including the enhanced capture-safety.mjs and repository-checkpoint.mjs), deployment contract, source build, generated build verification and generated syntax verification. Earlier run **41159448381** also passed full repository checks for the substantial F5 / restore changes. Failed interim runs were inspected and fixed. The additional direct portable-backup.mjs assertions were written but **that specific test is not part of the hardcoded workflow targeted set and has not been independently executed**; they remain for a future separate targeted run. No full QA was performed. No browser/manual device restore test was run.
- **Disposition:** **Pass B COMPLETE for implemented objectives and executed targeted safety checks**, with the explicit additional portable-backup test execution gap recorded rather than disguised. F4, F5 and F8 may be marked verified closed; if separate portable test later exposes a bug, reopen promptly. Pass A's outstanding specialized journal-runtime execution is not silently closed by Pass B.
- **Next:** Pass C (F2/F9/F12/F13), starting by reading §§0–7 and this entry; audit storage-reset readiness, Note capacity, profile deletion sequencing and selected Active Session durability.

### Entry 004 — Pass C: storage-reset readiness, bounded Notes rescue, profile deletion and Session durability

- **Date/branch:** 2026-10-31, current-fixes. **Baseline:** 9b3810cf17574dafe0cff15c4ad696916ba083f7; **implementation HEAD:** f205b6cad56758d5f3e0602e8a673a3d1a4664fe.
- **Preliminary:** Read sections 0–7 and previous append-only entries. Reconfirmed scope: only F2/F9/F12/F13; F16–F18 remain accepted, F19–F20 deferred. Confirmed Pass B Repository Checks success before beginning. Kept no format migrations or backend dependencies.
- **Step 1 — fresh source audit:** F2 source/app.html created storage-reset hold without deviceReady, so awaiting it was ineffective; startup DeviceBackup.install raced an overlapping reset call. F9 source/core/repositories-notes.js already enforced 1 MiB rescue, prioritized newest unsaved Notes and named rescueShortfall in canonical save-failure feedback; but a page-exit rescue overflow before an IDB failure could leave uncovered Notes without immediate warning. F12 source/core/profiles.js removed browser rescue keys before trying to delete IndexedDB/OPFS; an interruption left potentially recoverable content without its rescue and registry intent unresolved. Browser deleteDatabase lacked onblocked feedback. F13 source/core/repositories.js used default durability for all Active Session upserts; page-exit flush, suspend, transfer, restore and rollback deserve stronger durability while frequent timer snapshots should remain efficient.
- **Step 2 — precise objectives:** C1 explicit shared, bounded Device Folder initialization plus permission refresh; no permanent wait on denied/unsupported/revoked folders. C2 keep bounded rescue footprint, distinguish unprotected unsaved Note bytes from successful/failed canonical save, name the exposure immediately. C3 retain rescue and pending profile deletion marker until database and OPFS are gone; verify target remains removed before each destructive step; retry after blocked operations without touching live profile. C4 strict write only for critical session transitions, strong recovery reconciliation before retiring local rescue. C5 no high-frequency timer/editor IO or gratuitous schema change.
- **Step 3 — implementation:** app.html now reuses one ensureDeviceBackupInstalled promise across startup and reset recovery; beginStorageResetHold creates a real deviceReady promise with refreshed permission and 8-second diagnostic timeout; existing Drive/manual fallback still works, and blocked indexedDB.deleteDatabase reports other open tabs instead of hanging indefinitely. profiles.js now deletes IndexedDB, then OPFS, then per-profile local recovery keys, and finally retires the registry marker; checks pending/ownership before operations and rejects incomplete local removal. repositories-notes.js tracks rescueShortfall notice changes and explicitly identifies unsaved Notes beyond the existing cap; repositories.js routes typed rescue-capacity warnings without falsely stating the canonical save already failed. Active Session IndexedDB put selects strict transaction for emergency flushes, suspended Session state or explicit strictDurability, including reconciliation of local recovery; app.html labels finish, transfer, restore and rollback critical. Ordinary timer writes retain default durability.
- **Step 3 — tests:** Existing targeted tests/integration/backup/capture-safety.mjs includes delayed/failed/timed-out readiness, blocked-DB/failed-OPFS/local-key profile cleanup and retry. Existing targeted tests/integration/storage/deletion-recovery.mjs includes max-budget Notes rescue warning while canonical save is still pending and strict vs default session write counters for ordinary/emergency/suspended/explicit critical cases. Additional focused coverage in tests/integration/backup/device-backup.mjs and tests/unit/storage/profiles.mjs exercises relevant provider and profile cases. Architecture assertion in tests/architecture/storage/background-work-contract.mjs was adapted to the shared startup function, preserving the prerequisite that the canonical change clock is reconciled before Device Folder installation.
- **Step 4 — objective verification:** C1 MET; C2 MET with explicit accepted 1 MiB rescue limitation; C3 MET including blocked deletion retries; C4 MET under simulated durability counters; C5 MET by call-site/source audit (default timer path unchanged, no new rescue allocation limit, profile registry/backup formats unchanged). Six independent source checks passed when read back from current branch. Source diff is limited to app.html, profiles.js, repositories-notes.js, repositories.js and their targeted test/architecture contracts.
- **Step 5 — targeted QA:** Repository Checks run 41161613206 at 7591bf35a96b65a4ef297ac048829bd6c371fc68 **PASS**, including targeted safety/repository tests, PWA deployment contract, source build, generated build and syntax verification. A later single-line blocked IndexedDB handler amendment at f205b6cad56758d5f3e0602e8a673a3d1a4664fe also passed targeted safety/repository tests, deployment, build and build verification; its final workflow conclusion will be checked explicitly. Earlier intermediate CI failure at 5b58cb0add55ad7ef244dd515c3c800a3aa16a9 was a brittle background-work source assertion expecting the previous inline installation, corrected to validate the new shared change-clock gate; intermediate canceled runs are not reported as passing. Full QA and manual real-browser failure injection NOT performed, as agreed.
- **Disposition:** F2/F9/F12/F13 implementation and relevant targeted tests verified, subject to final completed state of the latest post-adjustment workflow. The rescue ceiling is an explicit constrained-PWA design choice, not a claim that browser localStorage can guarantee preservation of a 2 MiB Note. Pass A's journal-specific test remains separately outstanding; this entry does not change its status.
- **Next:** Pass D (F10/F11/F14), starting with this ledger; audit attachment hash integrity, remote object reuse and Device Folder digest-cache proof boundaries, preserving incremental performance.

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
