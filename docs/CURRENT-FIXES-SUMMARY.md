# current-fixes branch summary

**Closed:** 2026-10-30  
**Baseline:** `refactor/background-coordination` at `9afbda7d1e18310d5e847662504cf057f363fb65`  
**Certified branch head:** `7709612cbe214990f6d832bcd66e92c0ab7b97d8`  
**Latest runtime-source change before certification:** `85f6df16913fa7961df5bd923189a856f2834a09`  
**Full Promotion QA:** run 41056576508 — passed  
**Repository Checks:** run 41056576556 — passed

## What this branch was for

`current-fixes` was a corrective and consolidation programme on top of the background-coordination work. Its purpose was not to add another backup architecture, but to make the existing local-first Study Director architecture safer, more coherent and easier to reason about under real interruption, multi-location backup and multi-device use.

At the certification point the branch was 246 commits ahead of the baseline, but the net runtime change was concentrated in 15 source files (about +1,097 / -527 lines). Much of the commit count was tests, diagnostics, certification requests and iterative regression work rather than additional runtime machinery.

## Net changes to the app

### 1. Backup locations became independent, symmetric destinations

The earlier same-history/spine idea was retired. Device Folder and Google Drive now:

- publish the same verified canonical local state through the same managed-repository engine;
- use the same checkpoint, retention, integrity and maintenance rules;
- keep independent histories;
- never wait for, backfill, or copy checkpoints from one another.

Google Drive remains the shared multi-device synchronization repository because that is a transport capability; Device Folder remains an independent local external backup destination.

### 2. One convergence owner now governs automatic provider work

Automatic publication, Drive catch-up and provider retry timing are coordinated by the existing repository background/convergence owner rather than parallel schedulers.

The corrective work hardened:

- foreground/background pre-emption and settlement;
- exact retry-trigger provenance;
- revision-aware backoff;
- preservation of newer or still-unspent automatic/urgent deadlines;
- durable pending intent after restore/recovery;
- restart/reconnect behavior;
- suspension behavior during user file work, restores, updates and managed recovery.

The final Promotion cycle exposed and closed a subtle timing seam: a sync prerequisite could fail before an already-pending automatic deadline and incorrectly replace that unspent opportunity with failure backoff. Backoff is now bound to the scheduler opportunity actually attempted.

### 3. Automatic Drive catch-up no longer cancels itself

Two independent self-cancellation paths were found and fixed:

- managed recovery suspension could abort the same automatic sync that initiated it;
- automatic Drive sync was temporarily represented as a normal file import, causing the file-work hold to suspend that sync.

Automatic synchronization is now explicitly suspension-aware. User-started file imports/backups retain their stronger foreground hold and cancellation UI; automatic provider catch-up does not impersonate them.

### 4. Managed recovery became durable across every configured destination

After a verified restore/combine, the resulting canonical state records durable retry intent for each configured automatic destination that still owes that state, including a temporarily unavailable configured Device Folder.

Recovery does not report convergence complete if a required destination's intent could not be persisted. Explicit disconnect/forget retires that destination's obligation.

### 5. Startup freshness and failure behavior were hardened

Backup source revision uses the freshest valid canonical mutation projection rather than allowing a stale localStorage mirror to win over newer in-memory state.

Startup reconciles the authoritative mutation clock before automatic background owners and Device Folder installation begin. An unavailable authoritative clock fails closed instead of silently opening automatic backup with uncertain freshness.

### 6. Cross-device Active Session ownership was fenced

Drive now carries a small durable ownership claim used only to fence cross-device ownership of today's Active Session.

This does not create a second session store. Canonical Active Session data remains the authority; the claim prevents two devices from simultaneously behaving as owner while synchronization catches up, supports takeover/release, and rejects stale ownership publication.

### 7. Restore/reconciliation paths were made more explicit and verifiable

Restore and combine still use one canonical reconciliation engine. The branch strengthened staged mutation, rollback/verification boundaries, changed-domain verification, safety publication behavior and managed-recovery lifecycle handling without introducing a second conflict engine.

Immutable publication and retention cleanup remain conservative: ambiguous publication failures are not “cleaned up” speculatively, and destructive repository maintenance revalidates before deletion.

### 8. Background and diagnostics contracts were consolidated

The background coordinator remains the owner of priorities, suspension, pre-emption and settlement. Provider orchestration remains in `backup-provider.js`; restore mutation remains in `backup.js`; immutable repository semantics remain in `managed-repository.js`.

Temporary certification workflow machinery was removed after use. Retired spine/backfill/provider-copy diagnostic vocabulary was removed, and the older audit describing that design is explicitly marked historical.

### 9. Insights and PWA runtime received bounded performance refinements

The branch also includes independent performance work in the changed runtime set:

- Insights uses prepared/atomic repository snapshots and cooperative normalization to reduce duplicated work;
- the service worker reuses verified immutable assets and bounds precache work;
- related browser/performance certification was added.

These changes are separate from backup correctness but were included in the final Promotion gate.

## Architectural result

The final architecture is intentionally asymmetric only where the transports differ:

- **shared:** canonical capture, managed repository, retention, integrity, maintenance, recovery and convergence model;
- **Device Folder specific:** browser file-system handle/permission behavior;
- **Drive specific:** authorization, network/shared-history behavior and cross-device session ownership.

There is no surviving runtime spine/backfill engine, second provider scheduler, second reconciliation engine, or provider-to-provider checkpoint-copy system.

The main complexity concentration is `source/core/backup-provider.js`. It is coherent at closure, but should be treated as a complexity ceiling: future unrelated state machines should not simply be appended there without a concrete requirement.

## Certification and closure

Final full Promotion QA passed on `7709612cbe214990f6d832bcd66e92c0ab7b97d8`:

- hermetic correctness gate;
- risk coverage;
- critical mutation certification;
- AST branch-edge coverage;
- non-browser release certification;
- complete browser certification and built-runtime coverage;
- three Insights performance samples and the aggregate performance gate.

Repository Checks also passed on the same head.

This closes the source-level corrective programme. Future changes should be driven by a demonstrated bug, measured performance problem or concrete product requirement rather than continued speculative hardening.

## What remains outside this branch's certification

CI cannot replace real-device acceptance. Physical-device checks remain separate, especially:

- real Google Drive pagination/network interruption and long-transfer cancellation;
- Device Folder permission loss/regrant;
- mobile suspend/resume and iOS/iPadOS fallback behavior;
- storage pressure/origin eviction using disposable test data;
- long-session CPU/battery/resource behavior.

Those are deployment/acceptance checks, not unfinished architecture work.
