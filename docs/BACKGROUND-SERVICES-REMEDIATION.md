# Background services — source audit, implementation strategy and working remediation ledger

> **Programme:** Background Services P0–P6. **Established:** 2026-10-31 on `current-fixes` at `05cf0d8c925f91a6f90b26b61d326cf2941b75e9`. **Current state:** **P0 SOURCE BASELINE + P1 ACTIVE SESSION PASS COMPLETE** (Entry 005; 2026-11-01); P2–P6 NOT STARTED. BS01 closed at source/targeted fault-injection + ordinary Repository Checks level; **real-browser/mobile/Drive acceptance not run**. Other 20 candidates retain their P0 dispositions. P0 adjudications: [P0-EVIDENCE.md](BACKGROUND-SERVICES-P0-EVIDENCE.md). Earlier A–F backup/data certification remains closed, subject to new evidence.

> **Current source wins.** This document is a working implementation scratchpad; the source links in §3 are frozen observations. Before **every** later pass, re-read the exact current production code, adjacent safeguards and this ledger. Never implement a speculative 'fix' based solely on the frozen audit or a passing/failing QA fixture.

## 0. Execution playbook — copied in substance from A–F

### 0.1 Mandatory preliminary orientation BEFORE the five steps

1. Read [PROGRAMMES.md](PROGRAMMES.md), the whole of this ledger (§§0–7 and latest §8 journal), [DATA-TOPOLOGY-BACKUP-CLOSURE.md](DATA-TOPOLOGY-BACKUP-CLOSURE.md), [BACKGROUND-OPERATIONS.md](BACKGROUND-OPERATIONS.md), [VERIFICATION.md](VERIFICATION.md) and relevant current architecture/contract pages.
2. Fetch the **exact current** `current-fixes` branch HEAD. Record SHA and changes since the frozen audit and preceding pass. Do not trust historical source line references or stale 'done' headings.
3. Name pass number, in-scope BS IDs, dependencies, affected source and acceptance boundaries. Record whether the previous pass left blockers; do not silently leap over them.
4. Confirm that this pass is authorized. Phase 0 is documentation only. **P0 is a separate future action**; no implementation begins until requested.

### 0.2 The required five-step CLEER cycle — in this order

**Step 1 — Audit:** Trace *current production source* across end-to-end calls, async await boundaries, ownership, lifecycle and failure/recovery paths. Read nearby defenses and relevant historical documents without treating their status as proof. Separate confirmed control defects, source-level risks, measurable optimization hypotheses, policy/accepted platform constraints, and false positives.

**Step 2 — Analyze and plan BEFORE edits:** Record root cause/counterexample, desired invariant, candidate solutions and rejected alternatives, minimal file boundaries, compatibility/persistence impact, cost/security/CPU budget, numbered objective and expected edge cases. Prioritize safe reuse of the existing lifecycle and owner; avoid new abstractions merely to standardize naming.

**Step 3 — Implement:** Minimal coherent source changes *only after Step 2*. Do not hand-edit generated output, change schemas/retention/encryption/backups or broaden the pass without separately documented evidence. Remove only genuinely dead or duplicate logic with proof; do not remove defensive branches because fixtures passed.

**Step 4 — Check objectives against current code:** Independently re-read changed/neighboring modules, trace the same failure paths, and mark **MET / PARTIAL / NOT MET**, objective by objective. Correct failures and recheck before closure.

**Step 5 — Targeted QA:** Execute focused unit/integration/architecture/browser checks *for affected surfaces*, including failure/cancel/restart/slow-IO/multi-tab/suspend boundaries. Report exact tests, failures, reruns and skipped environments; do not claim tests run unless logs verified. **No automatic full QA after each pass.** Following substantial changes, separately authorize full Promotion QA as a milestone.

**After each pass:** Update §4 status, §6 pass card, append immutable dated §8 entry (do not overwrite prior evidence), record branch/SHAs and remaining risks. Do not say 'closed' merely because a patch was committed.

### 0.3 CLEER / architecture invariants

- **Clean, Lean, Efficient, Elegant, Robust, Reliable.** Single owner per responsibility; bounded work and observable settlement; no busy-loop polling or duplicate scheduler.
- Canonical local data, Note rescue and Active Session progress have greater authority than a transient timer, notification, cache or provider timestamp.
- A lost/timed-out job never implies underlying native I/O stopped; actual settlement, leases and durable cursors remain mandatory.
- Foreground mutation, restore, clearing and update application take priority; unknown references, unreadable schemas and disconnected providers never authorize destructive cleanup.
- Strict attachment reachability and journal/restore scratch pins; Device Folder and Drive independent destinations; Drive shared catch-up never overwrites a newer verified head.
- Preserve install-time SW hash verification and existing low-latency user experience; hash every ordinary file read only if a new explicit reliability contract justifies it.
- PWA background work is opportunistic while executable, not a guaranteed OS service when closed. No new server/native scheduler presumed.
- No owner data, Note text, URLs, account details, tokens, raw backup objects or unbounded diagnostic traces in repo, logs or QA.
- No push to `main`, merge, deployment, release, workflow/settings edit, format migration or broad refactor without separate authorization.

## 1. Scope, baseline and evidence standard

The independent 2026-10-31 de novo audit checked production job owners and important leaf call chains: startup/tab control; generic and repository scheduling; Notes/canonical maintenance; asset GC and shallow verification; OPFS scratch; Device Folder; Drive shared convergence/retention/scrub; session ownership; PWA/SW cache/update; notifications; PDF/worker/power; profiles; diagnostics. It did **not** test a real physical Device Folder, real Google Drive account, hardware battery drain, iOS suspension or every source file in the repository.

**Revalidation categories:** (a) CONFIRMED DEFECT — demonstrated reachable invariant violation; (b) SOURCE RISK — logic suggests a failure but surrounding contract may prevent it; (c) MEASUREMENT NEEDED — optimization hypothesis; (d) RETAINED POLICY — conscious and documented trade-off; (e) OPERATIONAL LIMIT — cannot be repaired by local JavaScript; (f) REFUTED — disproved, with evidence. Provisional priorities P1/P2/P3 are severities, **not pass numbers**.

**Baseline proof references:** original source SHA `05cf0d8c925f91a6f90b26b61d326cf2941b75e9`; former background audits [AUDIT-BACKGROUND-SERVICES.md](AUDIT-BACKGROUND-SERVICES.md) (historical, superseded), [BACKGROUND-AUDIT.md](BACKGROUND-AUDIT.md) (historical), and [BACKGROUND-OPERATIONS.md](BACKGROUND-OPERATIONS.md) (current behavior). [A–F closure](DATA-TOPOLOGY-BACKUP-CLOSURE.md) is separate. This ledger holds the 21-item source evidence so future passes do **not** need an out-of-repository upload.

### 1.1 Service census (not just failing tests)

| Service | Main production owner(s), in `source/` | Required boundary | Related BS |
|---|---|---|---|
| Startup/ownership | startup.js; ownership.js; app.html | Startup stage fence, writer lease, heartbeat, takeover, BFCache/page-exit | BS01, BS18 |
| Generic jobs and group wake | operation-lifecycle.js; app.html | Pending/deadline/blocker/execute/settlement and ownership gate | BS18, BS20 |
| Repository priorities | repository-background.js; backup-provider.js | Integrity < maintenance < convergence < user foreground; abort and actual settlement | BS02, BS11 |
| Canonical upkeep / Notes trash | repositories.js; repositories-notes.js; app.html | 20s cooperative maintenance; daily recurrence; note expiry | BS17, BS18 |
| Attachment GC | asset-maintenance.js; asset-storage.js; app.html | Reachability proof, OPFS reader leases, bounded deletion/sweep | BS08, BS09 |
| Attachment shallow verification | asset-storage.js; app.html | 5s/128 chunk; metadata presence+size with persisted scan | BS06, BS07 |
| OPFS scratch cleanup | exports.js; app.html | Durable journal/partial pins, reader locks and collector | BS10 |
| Device Folder adapter | device-backup.js; device-folder-storage.js | Permission, Web Locks, directory migration, per-provider backup | BS15 |
| Drive and convergence | backup-provider.js; drive.js; managed-repository.js | Durable provider intent, sync, backoff, immutable commit, protected GC | BS11, BS13, BS16 |
| Active Session ownership | app.html; backup-provider.js; timer-engine.js | 15s visible-page Drive claim, pause/resume, local snapshot | BS01, BS16 |
| PWA apply/update | pwa-lifecycle.js; app.html | Identity verified apply, stored state read-back, update retries | BS13, BS14 |
| Service worker and notifications | platform/sw.js; app.html; notice-coordinator.js | Verified cache generations, click behavior, device notices | BS03, BS12, BS19 |
| PDF/file/worker resources | app.html; exports.js; external/insights.js | Reader/Blob/worker teardown, popup polling and file watchdog | BS04, BS05 |
| Power/native capabilities | native-capabilities.js; timer-engine.js | Wake lock only when visible, clock reconciliation, worker yielding | BS17, BS18, BS21 |
| Profiles and unknown data | profiles.js; app.html | Special-case unowned-profile collector; fail-closed unknown schema | Cross-cutting preserve |
| Diagnostics/health | backup-operation-diagnostics.js; notice-coordinator.js | Bounded private state, warnings, current blocker and prior attempt | BS20 |

### 1.2 Rejected false-positive patterns

- Claiming there is no shared lifecycle or no foreground preemption — current source has both.
- Calling a presence/size attachment audit a failed cryptographic scrub — different contract.
- Adding `await` to synchronous Notes trash purge — it is synchronous and saves via ordinary Notes lane.
- Requiring all removed-profile collection to run only in the primary tab — that collector intentionally works on unheld profiles.
- Claiming SW apply always reloads dirty work — it has extensive preflight; the separate notification-click path is in scope.
- Assuming a settlement timeout forcibly stops browser storage/network I/O — incorrect.

## 2. Full independent candidate findings register — source evidence, controls and objectives

### BS01 — Remote-ownership freeze ignores thrown, null or {ok:false} local session flush and still stops the clock
- **Baseline classification:** Control-flow defect; **priority:** P1; **provisional pass:** P1; **status:** VERIFIED CLOSED — P1 source/fault harness + Repository Checks (manual browser pending). See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs01).
- **Source trace:** [`source/app.html`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/app.html#L2775), [`4091-4124`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/4091-4124). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** Remote-ownership freeze ignores thrown, null or {ok:false} local session flush and still stops the clock.
- **Target:** Preserve dirty/local rescue, stop duplicate execution safely, and prevent destructive interpretation of unverified state.
- **Closure evidence required:** IDB/quota failure, ownership loss, conflicted reflection, remount/restart equality.
- **Nearby defense / limit:** Capture save result and trace recovered local state; no data-loss conclusion without fault-run.

### BS02 — Equal/higher job contention can defer work under a long busy retry after the blocking slot is released
- **Baseline classification:** Liveness risk; **priority:** P2; **provisional pass:** P3; **status:** P0 SOURCE REVIEWED — QUALIFIED CONTENTION RISK — P3 clock proof pending. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs02).
- **Source trace:** [`source/core/repository-background.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/core/repository-background.js#L93), [`127-148`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/127-148), [`273-304`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/273-304), [`326-348`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/326-348). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** Equal/higher job contention can defer work under a long busy retry after the blocking slot is released.
- **Target:** Prove timing; wake eligible deferred jobs on release without collapsing deliberate error/permission backoff.
- **Closure evidence required:** Clocked contention/priority/release; zero hot loops.
- **Nearby defense / limit:** Provider release listeners currently redraw status; not necessarily a runnable wake.

### BS03 — Notification click can navigate an existing in-scope client to app root without that page's save preflight
- **Baseline classification:** Conditional navigation hazard; **priority:** P1/P2; **provisional pass:** P2; **status:** P0 SOURCE REVIEWED — SOURCE-CONFIRMED CONDITIONAL NAVIGATION — P2 browser proof pending. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs03).
- **Source trace:** [`source/platform/sw.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/platform/sw.js#L205), [`source/app.html`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/app.html#L2192). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** Notification click can navigate an existing in-scope client to app root without that page's save preflight.
- **Target:** Focus existing client and route in-page where possible; avoid destructive navigation of dirty data.
- **Closure evidence required:** Root/index/deep-link; dirty editor; multi-window; offline click.
- **Nearby defense / limit:** Pagehide rescue exists; loss of edits unproven.

### BS04 — PDF fallback handedOff=true prevents releasing Blob URL and OPFS reader with no visible later owner
- **Baseline classification:** Resource lifecycle gap; **priority:** P2; **provisional pass:** P2; **status:** P0 SOURCE REVIEWED — SOURCE-CONFIRMED READER/URL LIFETIME — P2 proof pending. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs04).
- **Source trace:** [`source/app.html`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/app.html#L2103). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** PDF fallback handedOff=true prevents releasing Blob URL and OPFS reader with no visible later owner.
- **Target:** Explicit bounded/acknowledged handoff retirement, not premature revoke.
- **Closure evidence required:** Open/download/popup denied, viewer lifetime, cancellation and exit.
- **Nearby defense / limit:** External reader may legitimately need the URL during handoff.

### BS05 — One-second popup poll persists until window
- **Baseline classification:** Performance trade-off; **priority:** P3; **provisional pass:** P2; **status:** P0 SOURCE REVIEWED — MEASURE ONLY — P2 optional resource cleanup. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs05).
- **Source trace:** [`source/app.html`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/app.html#L2118). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** One-second popup poll persists until window.closed; no explicit parent page-exit owner.
- **Target:** Consolidated popup lifetime cleanup, preserving long-lived PDF access.
- **Closure evidence required:** Multiple popups, parent exit, BFCache and eventual reader release.
- **Nearby defense / limit:** Avoid revoking before external viewer finishes.

### BS06 — Each 128-object shallow integrity chunk rematerializes, sorts, stringifies and SHA-hashes full metadata catalogue
- **Baseline classification:** Repeated work proven in source; **priority:** P2; **provisional pass:** P4; **status:** P0 SOURCE REVIEWED — REPEATED FULL SCAN CONFIRMED — P4 benchmark pending. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs06).
- **Source trace:** [`source/core/asset-storage.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/core/asset-storage.js#L65). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** Each 128-object shallow integrity chunk rematerializes, sorts, stringifies and SHA-hashes full metadata catalogue.
- **Target:** Recheck against stable generation/cursor; no false clean on mutation or corruption.
- **Closure evidence required:** 0/128/129/1000+ assets, changed metadata, restart cursor equality.
- **Nearby defense / limit:** Shallow audit intentionally tests presence/size, not every file hash.

### BS07 — Reference inventory gathering precedes the nominal five-second shallow-audit budget
- **Baseline classification:** Unbounded preflight risk; **priority:** P2; **provisional pass:** P4; **status:** P0 SOURCE REVIEWED — QUALIFIED BULK READ WITH YIELDS — P4 benchmark pending. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs07).
- **Source trace:** [`source/app.html`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/app.html#L8827). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** Reference inventory gathering precedes the nominal five-second shallow-audit budget.
- **Target:** Measure and if needed paginate/canonicalize source scan with no missing-reference false negative.
- **Closure evidence required:** Large notes/day sets, unavailable source and foreground preemption.
- **Nearby defense / limit:** Existing strict source check must be preserved.

### BS08 — GC phase constructs entire Notes/days/pending-review value arrays before bounded per-entry loop
- **Baseline classification:** Bulk materialization risk; **priority:** P2; **provisional pass:** P4; **status:** P0 SOURCE REVIEWED — BULK REFERENCES CONFIRMED — P4 benchmark pending. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs08).
- **Source trace:** [`source/core/asset-maintenance.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/core/asset-maintenance.js#L24). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** GC phase constructs entire Notes/days/pending-review value arrays before bounded per-entry loop.
- **Target:** Bound expensive snapshots only where benchmark warrants, with conservative complete reference proof.
- **Closure evidence required:** Large histories, interrupted phase, changed source revision and live edit.
- **Nearby defense / limit:** No deletion from partial/unknown reference census.

### BS09 — OPFS directory iterator and current entry survive yielded passes; browser mutation semantics deserve verification
- **Baseline classification:** Iterator liveness question; **priority:** P3; **provisional pass:** P4; **status:** P0 SOURCE REVIEWED — ITERATOR PORTABILITY RISK — P4 proof pending. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs09).
- **Source trace:** [`source/core/asset-storage.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/core/asset-storage.js#L127). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** OPFS directory iterator and current entry survive yielded passes; browser mutation semantics deserve verification.
- **Target:** Prove eventual orphan reclamation after mutation/sleep; reset iterator only at safe cycle boundaries.
- **Closure evidence required:** Concurrent put/remove, reload, suspension; retained bytes never removed.
- **Nearby defense / limit:** May be retained as-is with evidence.

### BS10 — Scratch GC rereads restore and integrity metadata for every candidate in a pass
- **Baseline classification:** Repeated metadata I/O; **priority:** P2; **provisional pass:** P4; **status:** P0 SOURCE REVIEWED — REPEATED PROTECTION READ CONFIRMED — P4 benchmark pending. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs10).
- **Source trace:** [`source/core/exports.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/core/exports.js#L23), [`source/app.html`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/app.html#L8609). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** Scratch GC rereads restore and integrity metadata for every candidate in a pass.
- **Target:** Eliminate redundant reads only with fresh per-deletion durable pin validation.
- **Closure evidence required:** 128 candidates; interrupted journal; mixed partial integrity scratch.
- **Nearby defense / limit:** Never delete on cached absence alone.

### BS11 — Read-only history/object maintenance planning precedes the bounded destructive lease
- **Baseline classification:** Safety/performance trade-off; **priority:** P2; **provisional pass:** P5; **status:** P0 SOURCE REVIEWED — INTENTIONAL SAFE PREFLIGHT — P5 measure before changes. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs11).
- **Source trace:** [`source/core/backup-provider.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/core/backup-provider.js#L715). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** Read-only history/object maintenance planning precedes the bounded destructive lease.
- **Target:** Measure pages, bytes, memory, responsiveness; safely resume preflight if material, keep fresh lease revalidation.
- **Closure evidence required:** 100/1000-version history, slow Drive, foreground preemption.
- **Nearby defense / limit:** Long planning is intentional to avoid locking foreground publication.

### BS12 — Installation rejects new generation at three shell caches before a capacity cleanup opportunity
- **Baseline classification:** Availability liveness trade-off; **priority:** P2; **provisional pass:** P3; **status:** P0 SOURCE REVIEWED — CONDITIONAL INSTALL LIMIT — P3 reproduction pending. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs12).
- **Source trace:** [`source/platform/sw.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/platform/sw.js#L65), [`108-142`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/108-142). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** Installation rejects new generation at three shell caches before a capacity cleanup opportunity.
- **Target:** Perform only proven-safe preinstall reclamation; preserve unknown/live generation protections.
- **Closure evidence required:** 0-3 caches; live/unknown clients; in-progress install; offline.
- **Nearby defense / limit:** No eviction under uncertainty.

### BS13 — PWA update check/download uses independent timer and may overlap large foreground network work
- **Baseline classification:** Network contention hypothesis; **priority:** P3; **provisional pass:** P5; **status:** P0 SOURCE REVIEWED — NETWORK CONTENTION HYPOTHESIS — P5 measurement. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs13).
- **Source trace:** [`source/app.html`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/app.html#L10248). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** PWA update check/download uses independent timer and may overlap large foreground network work.
- **Target:** Measure contention; optionally defer nonurgent check with bounded eventual retry.
- **Closure evidence required:** Long upload/import; offline; update found; cancellation.
- **Nearby defense / limit:** Update application itself already has safety gates.

### BS14 — Timed-out registration
- **Baseline classification:** Native API limitation; **priority:** P3; **provisional pass:** P3; **status:** P0 SOURCE REVIEWED — NATIVE API LIMIT — P3 late-state proof only. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs14).
- **Source trace:** [`source/core/pwa-lifecycle.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/core/pwa-lifecycle.js#L216). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** Timed-out registration.update() can continue in browser despite Promise timeout.
- **Target:** Reconcile late worker activation and reflect 'timed out' without implying native cancellation.
- **Closure evidence required:** Late install, timeout, controllerchange, duplicate checks.
- **Nearby defense / limit:** Browser-native request need not be abortable.

### BS15 — Concurrent focus/activation permission queries can overwrite newer permission state out of order
- **Baseline classification:** Async race risk; **priority:** P2; **provisional pass:** P6; **status:** P0 SOURCE REVIEWED — SOURCE-CONFIRMED PERMISSION RACE SHAPE — P6 fault proof. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs15).
- **Source trace:** [`source/core/device-backup.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/core/device-backup.js#L214). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** Concurrent focus/activation permission queries can overwrite newer permission state out of order.
- **Target:** Coalesce/generation-fence by handle identity; preserve user-gesture permission requests.
- **Closure evidence required:** Revoke/regrant; reorder promises; changed folder; denied prompt.
- **Nearby defense / limit:** prepareRepository already fences handle changes.

### BS16 — Visible session polls remote ownership every 15 s (up to four remote checks/minute)
- **Baseline classification:** Drive cost trade-off; **priority:** P2; **provisional pass:** P5; **status:** P0 SOURCE REVIEWED — 15-SECOND POLL CONFIRMED — P5 request/latency measurement. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs16).
- **Source trace:** [`source/app.html`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/app.html#L2768), [`source/core/backup-provider.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/core/backup-provider.js#L1108). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** Visible session polls remote ownership every 15 s (up to four remote checks/minute).
- **Target:** Measure latency/requests; adaptive cadence only if handoff responsiveness remains acceptable.
- **Closure evidence required:** 30-minute session, offline, 2 devices, session transfer and idle cost.
- **Nearby defense / limit:** Do not silently weaken ownership fencing.

### BS17 — Startup may wake multiple independent bounded housekeeping jobs simultaneously
- **Baseline classification:** Concurrency performance hypothesis; **priority:** P2; **provisional pass:** P5; **status:** P0 SOURCE REVIEWED — STARTUP OVERLAP HYPOTHESIS — P5 measurement. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs17).
- **Source trace:** [`source/app.html`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/app.html#L5413), [`11069-11081`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/11069-11081). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** Startup may wake multiple independent bounded housekeeping jobs simultaneously.
- **Target:** Measure overlap/CPU/input delay; deconflict only proven disruptive bursts.
- **Closure evidence required:** Cold start after backlog, user begins edit, provider and integrity queues.
- **Nearby defense / limit:** Do not introduce global lock/deadlock.

### BS18 — Wall-time deadlines plus throttled/suspended browser timers can delay opportunities after clock change
- **Baseline classification:** Clock/suspend policy; **priority:** P3; **provisional pass:** P3; **status:** P0 SOURCE REVIEWED — CLOCK/SUSPEND HYPOTHESIS — P3 testing. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs18).
- **Source trace:** [`source/core/operation-lifecycle.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/core/operation-lifecycle.js), [`source/core/repository-background.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/core/repository-background.js). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** Wall-time deadlines plus throttled/suspended browser timers can delay opportunities after clock change.
- **Target:** Clarify wall-time due vs monotonic attempt budget; rediscover after resume, no false guarantee.
- **Closure evidence required:** Time jump, sleep/reopen, BFCache, offline-to-online.
- **Nearby defense / limit:** No claim of hidden-page guaranteed execution.

### BS19 — Runtime SW cache reads rely on install-time SHA-256 rather than rehashing each retrieval
- **Baseline classification:** Accepted integrity envelope; **priority:** P3; **provisional pass:** P6; **status:** P0 SOURCE REVIEWED — INTENTIONAL INSTALL-TIME HASH POLICY — P6 retain. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs19).
- **Source trace:** [`source/platform/sw.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/platform/sw.js#L39), [`150-160`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/150-160), [`224-239`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/224-239). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** Runtime SW cache reads rely on install-time SHA-256 rather than rehashing each retrieval.
- **Target:** Retain unless actual corruption/recovery evidence warrants sampled validation.
- **Closure evidence required:** Corrupt cache, retained old version, offline fetch; performance.
- **Nearby defense / limit:** Not backup data corruption; policy/decision not automatic code fix.

### BS20 — Diagnostics lacks first-class preflight/CPU/lease/metadata-read phase metrics
- **Baseline classification:** Observability gap; **priority:** P3; **provisional pass:** P6; **status:** P0 SOURCE REVIEWED — OVERBROAD CLAIM REFUTED; NARROW METRICS — P6 only. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs20).
- **Source trace:** [`source/core/backup-operation-diagnostics.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/core/backup-operation-diagnostics.js), [`source/app.html`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/app.html). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** Diagnostics lacks first-class preflight/CPU/lease/metadata-read phase metrics.
- **Target:** Add only bounded, sanitized metrics needed to validate chosen corrections.
- **Closure evidence required:** Cross-job active peak, redaction, restart, no sensitive content.
- **Nearby defense / limit:** No unbounded trace logging.

### BS21 — No installed OS alarm/backend; page-owned work cannot run reliably after every window closes
- **Baseline classification:** Platform limitation; **priority:** Operational; **provisional pass:** P6; **status:** P0 SOURCE REVIEWED — ACCEPTED PLATFORM LIMIT — documented, no code. See [individual evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md#bs21).
- **Source trace:** [`source/core/operation-lifecycle.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/core/operation-lifecycle.js), [`source/platform/sw.js`](https://github.com/oneshubhamt/study-director/blob/05cf0d8c925f91a6f90b26b61d326cf2941b75e9/source/platform/sw.js). Frozen 31 Oct 2026 baseline; these line anchors are *not* proof of current code after any later commit.
- **Observed mechanism:** No installed OS alarm/backend; page-owned work cannot run reliably after every window closes.
- **Target:** Document eligibility-and-resume semantics; do not pretend an always-on scheduler exists.
- **Closure evidence required:** OS suspension/kill manually checked when available; unavailable platform labeled NOT TESTED.
- **Nearby defense / limit:** Explicit accepted limit; may close as documented policy.

## 3. Pass-to-source dependency map

| Source/boundary | BS IDs | Main dependencies/constraints |
|---|---|---|
| app.html Active Session watcher + activeSession repo + timer engine | BS01, BS16 | P1 must precede claimed Drive polling changes in P5 |
| service-worker message/notification + PWA lifecycle | BS03, BS12–BS14, BS19 | P2 notification handoff separate from P3 SW cache/update |
| reader/Blob lifetime and workspace navigation | BS04, BS05 | P2 local reader leases must not be shortened unsafely |
| job coordinator and repository coordinator | BS02, BS17–BS18 | P3 fairness only after measured/reproduced sequence; P5 global overlap later |
| asset-storage / asset-maintenance and reference-read host | BS06–BS09 | P4 complete-reference proof and cursor generation, no deletion on unknown |
| exports scratch collector / journals | BS10 | P4 must preserve previously certified A–F restore-journal semantics |
| backup-provider, Drive, repository integrity | BS11, BS16, BS17 | P5 no new provider engine / cross-provider copies / stale-GC safeguards |
| device-backup / permission flow | BS15 | P6 request generation must not interfere with user-gesture prompt |
| diagnostics, platform and cache policy | BS19–BS21 | P6 outcomes can be explicit retain-by-policy/no-change |

## 4. Master tracker — update on every pass

| ID | Severity | Initial class | Planned pass | Current state |
|---|---|---|---|---|
| BS01 | P1 | Control-flow defect | P1 | VERIFIED CLOSED — P1 source/fault harness + Repository Checks (manual browser pending) |
| BS02 | P2 | Liveness risk | P3 | QUALIFIED CONTENTION RISK — P3 clock proof pending |
| BS03 | P1/P2 | Conditional navigation hazard | P2 | SOURCE-CONFIRMED CONDITIONAL NAVIGATION — P2 browser proof pending |
| BS04 | P2 | Resource lifecycle gap | P2 | SOURCE-CONFIRMED READER/URL LIFETIME — P2 proof pending |
| BS05 | P3 | Performance trade-off | P2 | MEASURE ONLY — P2 optional resource cleanup |
| BS06 | P2 | Repeated work proven in source | P4 | REPEATED FULL SCAN CONFIRMED — P4 benchmark pending |
| BS07 | P2 | Unbounded preflight risk | P4 | QUALIFIED BULK READ WITH YIELDS — P4 benchmark pending |
| BS08 | P2 | Bulk materialization risk | P4 | BULK REFERENCES CONFIRMED — P4 benchmark pending |
| BS09 | P3 | Iterator liveness question | P4 | ITERATOR PORTABILITY RISK — P4 proof pending |
| BS10 | P2 | Repeated metadata I/O | P4 | REPEATED PROTECTION READ CONFIRMED — P4 benchmark pending |
| BS11 | P2 | Safety/performance trade-off | P5 | INTENTIONAL SAFE PREFLIGHT — P5 measure before changes |
| BS12 | P2 | Availability liveness trade-off | P3 | CONDITIONAL INSTALL LIMIT — P3 reproduction pending |
| BS13 | P3 | Network contention hypothesis | P5 | NETWORK CONTENTION HYPOTHESIS — P5 measurement |
| BS14 | P3 | Native API limitation | P3 | NATIVE API LIMIT — P3 late-state proof only |
| BS15 | P2 | Async race risk | P6 | SOURCE-CONFIRMED PERMISSION RACE SHAPE — P6 fault proof |
| BS16 | P2 | Drive cost trade-off | P5 | 15-SECOND POLL CONFIRMED — P5 request/latency measurement |
| BS17 | P2 | Concurrency performance hypothesis | P5 | STARTUP OVERLAP HYPOTHESIS — P5 measurement |
| BS18 | P3 | Clock/suspend policy | P3 | CLOCK/SUSPEND HYPOTHESIS — P3 testing |
| BS19 | P3 | Accepted integrity envelope | P6 | INTENTIONAL INSTALL-TIME HASH POLICY — P6 retain |
| BS20 | P3 | Observability gap | P6 | OVERBROAD CLAIM REFUTED; NARROW METRICS — P6 only |
| BS21 | Operational | Platform limitation | P6 | ACCEPTED PLATFORM LIMIT — documented, no code |

**P0 classification complete (2026-10-31, Entry 002):** 21 source candidates adjudicated, **not** 21 user-visible bugs. Direct control-flow gaps: 4 (BS01/03/04/15); repeated-work/rate patterns: 5; conditional risks: 4; resource hypotheses: 4; policy/platform: 3; refined observability: 1. **No P1–P6 runtime bugs or performance improvement certified yet.** Individual source proof and measurement gates: [P0 evidence](BACKGROUND-SERVICES-P0-EVIDENCE.md). Future accepted statuses: OPEN, REVALIDATING, IN PROGRESS, IMPLEMENTED—QA PENDING, VERIFIED CLOSED, RETAINED BY POLICY, DEFERRED, REFUTED WITH EVIDENCE.

## 5. Measurements and acceptance boundaries

| Boundary | Baseline metric to record in P0 | Pass-level invariant |
|---|---|---|
| Active Session remote claim | local flush return/read-back; time of freeze; dirty bytes | unverified save never silently treated as durable; duplicate clocks halt |
| Repository wake fairness | eligible-at, higher-priority release-at, next-run-at | release wakes eligible work; preserves intentional backoff |
| SW click navigation | source URL, requested URL, dirty state, navigation/reload outcome | existing window not unexpectedly navigated while dirty |
| PDF/Blob lifetime | URL count, viewer/reader leases, poll timers, exit timing | no premature revoke, no unowned permanent leases |
| Attachment shallow audit | entries scanned vs full catalogue read/hashed each pass; heap and pause | no incomplete proof; bounded incremental work where modified |
| Attachment GC | bulk source snapshot ms/bytes; batches, mutation epochs | no reachable asset removed, forward progress and low resource cost |
| Scratch GC | metadata reads/file; lock and journal pins | reduced redundancy only with fresh destructive proof |
| Provider maintenance | pages, preflight ms, bytes, lease ms and deletions | preemptible planning; fresh protected inventory at deletion |
| Drive ownership | calls/min, latency distribution, owner transfer detection | no wasted stable polling without slower unsafe handoff |
| PWA/SW updates | 0–3 caches, live/unknown clients, late activation | never evict live release; eventual safe update opportunity |
| Local job overlap | concurrent CPU/IO/worker peaks, input responsiveness | reduce disruptive startup burst if measured |
| Device permission | in-flight refresh, handle generation and published status | stale response cannot supersede latest handle/permission |
| Diagnostic privacy | exported safe fields, bounded record count | no sensitive data, false success, or unbounded history |

## 6. Implementation plan — pass cards (P0–P6)

**Phase 0 = documentation and orchestration (complete); P0 = source-evidence baseline (complete); P1 = verified source/targeted fault harness + Repository Checks (2026-11-01).** P2–P6 are **PLANNED**, not implementation evidence. The initial audit proposed B0–B6; for this active programme they are **renamed P0–P6 in the same order**. A–F remains the preceding, completed, independent programme. P0 closure and actual test boundaries: [evidence report](BACKGROUND-SERVICES-P0-EVIDENCE.md).

### P0 — Independent evidence baseline and risk disposition
**Status: SOURCE-BASELINE VERIFIED COMPLETE (2026-10-31, Entry 002), RUNTIME/DEVICE EXECUTION NOT RUN.** **Finding scope:** BS01–BS21.
- **Audit / analysis:** No product changes by default; establish exact current source and reproducible counterexamples; confirm owner, severity, source defenses, timing/perf envelope; classify each candidate and update tracker. Reuse existing fake clocks and production host; tests may validate but must not be used to invent the original findings.
- **Objectives (must be enumerated more finely before any edit):** For all 21: classification confirmed/amended/refuted; reproducibility plan and explicit not-run boundaries; before/after measurement plan. Reproduce failure paths where feasible without user data.
- **Targeted QA plan:** Source-only reinspection; focused hermetic instrumentation or fault-injection checks where feasible; no full QA; mark runtime environments not exercised.
- **Closure gate:** Preliminary orientation complete; current source fully retraced; issue statuses reconciled; goals recorded *before code changes*; exact objective-by-objective check and targeted QA recorded afterward. Document NOT MET/PARTIAL explicitly. No automatic full Promotion QA.

### P1 — Active Session remote claim and local durability
**Status: VERIFIED CLOSED — targeted production-function fault harness PASS; [Repository Checks 41269229853](https://github.com/oneshubhamt/study-director/actions/runs/41269229853) SUCCESS at executable SHA `0ef24c0bface97f3c8b6d85d600748466048c218` (2026-11-01). Standalone Node/browser/device tests NOT RUN.** **Finding scope:** BS01.
- **Audit / analysis:** Investigate flushLiveDraft→save() result→stopExecution→sessionClaimFreeze→reconciliation with real read-back. Choose minimal reliable failed-flush behavior without permitting two live clocks. No changes to backup schema or sync semantics.
- **Objectives (must be enumerated more finely before any edit):** Every possible failed/null/unverified save preserves recoverable data; duplicate timer stops safely; real local/remote state after reconnect equal to expected; errors are visible.
- **Targeted QA plan:** IDB fail/abort, quota, lost tab write authority, remote claim mid-edit, pending reflection, resume after reload, concurrent reconciliation.
- **Closure gate:** Preliminary orientation complete; current source fully retraced; issue statuses reconciled; goals recorded *before code changes*; exact objective-by-objective check and targeted QA recorded afterward. Document NOT MET/PARTIAL explicitly. No automatic full Promotion QA.

### P2 — Notification navigation and PDF lifetime
**Status: PLANNED — NOT STARTED.** **Finding scope:** BS03–BS05.
- **Audit / analysis:** Focus existing app for notification; avoid redirect without save-safe handshake. Establish explicit single owner for fallback Blob URL, external viewer/popup and reader lease, page exit/BFCache cleanup.
- **Objectives (must be enumerated more finely before any edit):** No surprise dirty navigation; no premature revoke; eventual URL/reader retirement; predictable popups and testable lifecycle.
- **Targeted QA plan:** SW notificationclick root vs /index.html and deep link; multiple clients/offline; popup blocked/open/download/cancel; 1+ PDFs, pagehide/pageshow.
- **Closure gate:** Preliminary orientation complete; current source fully retraced; issue statuses reconciled; goals recorded *before code changes*; exact objective-by-objective check and targeted QA recorded afterward. Document NOT MET/PARTIAL explicitly. No automatic full Promotion QA.

### P3 — Fairness, deadline semantics and safe SW lifecycle
**Status: PLANNED — NOT STARTED.** **Finding scope:** BS02, BS12, BS14, BS18.
- **Audit / analysis:** Prove whether priority-release misses eligible work; avoid retries spun hot. Allow capacity reclamation only when no live/unknown generation relies on it. Distinguish timed-out native SW update from cancelled update. Define clock-jump/resume behavior.
- **Objectives (must be enumerated more finely before any edit):** Eligible work wakes promptly without resetting intentional backoff; no live shell evicted; late worker converges; verified job state after sleep/clock shift.
- **Targeted QA plan:** Clock-driven coordination, contention, pause/release, dead clients, SW 3-cache saturation, late update, BFCache, system clock jump.
- **Closure gate:** Preliminary orientation complete; current source fully retraced; issue statuses reconciled; goals recorded *before code changes*; exact objective-by-objective check and targeted QA recorded afterward. Document NOT MET/PARTIAL explicitly. No automatic full Promotion QA.

### P4 — Incremental, bounded local maintenance
**Status: PLANNED — NOT STARTED.** **Finding scope:** BS06–BS10.
- **Audit / analysis:** Measure whole-catalogue building and metadata rereads; reuse existing source epochs where strong enough; never authorize deletion on incomplete notes, assets, journal, or file inventory. Changes limited to demonstrated bottlenecks.
- **Objectives (must be enumerated more finely before any edit):** Memory and reads materially reduced vs instrumented baseline where changed; bounded/resumable phases; all missing/unavailable references fail closed; journal pins survive interruption.
- **Targeted QA plan:** Empty/1/128/129/1000+ objects; source change at every await, stale cursor, same-size modification, active reader, iterator mutation, crash/restart.
- **Closure gate:** Preliminary orientation complete; current source fully retraced; issue statuses reconciled; goals recorded *before code changes*; exact objective-by-objective check and targeted QA recorded afterward. Document NOT MET/PARTIAL explicitly. No automatic full Promotion QA.

### P5 — Provider resource governance and Drive polling
**Status: PLANNED — NOT STARTED.** **Finding scope:** BS11, BS13, BS16, BS17.
- **Audit / analysis:** Measure provider planning without unbounded resource assumptions; no destructive lease dilution. Inspect simultaneous startup jobs and PWA download contention. Assess 15-second session-claim polling against handoff speed; do not add backend/new provider engine.
- **Objectives (must be enumerated more finely before any edit):** Known request/page/time metrics; only evidence-based optimizations; no unverified remote deletion or cross-provider copying; unchanged or accepted claim-detection latency.
- **Targeted QA plan:** 100+ or 1000+ checkpoints simulated; weak Drive/network, overlapping jobs, high-priority foreground, 30 min session, two-device turns, update check vs upload.
- **Closure gate:** Preliminary orientation complete; current source fully retraced; issue statuses reconciled; goals recorded *before code changes*; exact objective-by-objective check and targeted QA recorded afterward. Document NOT MET/PARTIAL explicitly. No automatic full Promotion QA.

### P6 — Permission currency, diagnostics and documented policy
**Status: PLANNED — NOT STARTED.** **Finding scope:** BS15, BS19–BS21.
- **Audit / analysis:** Fence stale async permission reads with handle identity and request generation; retain selected SW verification policy unless changed by explicit evidence; add privacy-safe metrics; document PWA execution limit.
- **Objectives (must be enumerated more finely before any edit):** Stale permission cannot win; no new access prompt without gesture; diagnostics truthful and sanitized; accepted platform limits clearly recorded; outstanding hardware tests labeled unrun.
- **Targeted QA plan:** Out-of-order query results, revoke/regrant, folder swap, cache integrity trade-off, status export redaction, Android/iPad real-device matrix separately.
- **Closure gate:** Preliminary orientation complete; current source fully retraced; issue statuses reconciled; goals recorded *before code changes*; exact objective-by-objective check and targeted QA recorded afterward. Document NOT MET/PARTIAL explicitly. No automatic full Promotion QA.

## 7. Cross-cutting verification, stop/go and completion policy

1. **Early-stop rule:** If the exact production pathway already prevents an alleged failure, reclassify with proof; do not patch for the sake of closing an item.
2. **Batching:** Make coherent edits, build/test once for the affected batch, fix failures and rerun relevant targeted checks. Avoid repeated full runs inside each pass.
3. **Performance evidence:** Record baseline, input scale, browser/hardware class, p50/p95 when appropriate, resource cost and exact changed result. A theoretical complexity claim is not a measured heat or battery win.
4. **Migrations:** If a proposed change touches formats or checkpoint identity, stop and seek a separate design/evidence decision; compatibility of previously released data is never speculative.
5. **Doc fidelity:** BACKGROUND-OPERATIONS is behavioral contract, this ledger is investigation/plan; historical docs retain original dates and closure. When behavior changes, update the current contract and this tracker together.
6. **Close P0–P6:** independent current-source proof, objectives and scoped changes, regression/exhaustion checks, documented failure cases and explicit not-run hardware requirements; no fabrication of external-device certification.
7. **Programme final gate:** after substantial implementation and explicit owner authorization, run full Promotion QA at exact SHA (hermetic, risk, mutation, branch-edge, release, Chromium journeys, three independent Insights samples), then separately run operator/device acceptance using disposable data. Do not reclassify earlier A–F final run as proof of new P1–P6 changes.

## 8. Append-only implementation journal and agent scratchpad

> Preserve every past entry. Each future pass appends rather than rewriting old interpretations. Current master tracker and pass statuses may be updated after evidence. Keep minimal private reasoning/checklist material here, not personal data.

### Entry 000 — Phase 0: documentation consolidation and pass planning (2026-10-31)

- **Branch/HEAD at orientation:** `current-fixes` @ `05cf0d8c925f91a6f90b26b61d326cf2941b75e9` (confirmed before documentation commit).
- **Orientation:** Read A–F F1–F20 disposition and Entry 013, historical background audits, current BACKGROUND-OPERATIONS, AGENTS, README, VERIFICATION, current source traces and frozen independent BS01–BS21 audit.
- **Step 1 (audit):** Classified 21 initial source observations; retained nearby existing protections; did not claim live-device reproduction or a global loss-of-data condition. Frozen original references in §2.
- **Step 2 (analysis/plan):** Carry A–F playbook forward verbatim in substance; distinguish documentation Phase 0 from future investigative P0. Plan P0–P6 with dependencies, measurable objectives, performance/operational limits and explicit no-change dispositions.
- **Step 3 (implementation):** Documentation only: new consolidated A–F closure, this active ledger, programme index and navigation/handoff references. No app source, generated files, tests, data formats, CI policy or release changed.
- **Step 4 (objective verification):** Verify all 21 BS IDs and P0–P6 cards mapped; all 20 earlier F IDs accounted for; correct main branch/HEAD; source pointers and historical certification unchanged; no false QA claims.
- **Step 5 (targeted QA):** Documentation structure/read-back and docs-only diff; *not* application/runtime tests. Record outcome after commit verification; no full QA for this phase.
- **Next:** **P0 NOT STARTED** — establish exact then-current HEAD, re-trace candidate source chains, run a focused proof/evidence baseline and reclassify findings before choosing P1 implementation.

### Entry 001 — Phase 0 documentation QA closure (2026-10-31)

- **Verified initial Phase 0 commit:** `de37f1073032e9611d6bb15ab4d4a52bdc73ae98`; authenticated read-back confirmed `current-fixes` HEAD at that exact SHA before this QA-note-only follow-up.
- **Diff and scope:** `05cf0d8c925f91a6f90b26b61d326cf2941b75e9..de37f107` = exactly **10 Markdown files** (3 new documents, 7 existing docs/navigation files); no runtime JS/HTML, tests, CI workflows, generated files, schemas, release identity or deployment settings changed.
- **Completeness gate:** all **BS01–BS21** have one source-evidence heading and one tracker row, with separate provisional classification/priority/owner and closure criteria; seven planned **P0–P6** pass cards; one append-only journal; A–F **F1–F20** distinctions in consolidated closure; no item silently marked fixed.
- **Read-back:** `docs/PROGRAMMES.md`, `docs/DATA-TOPOLOGY-BACKUP-CLOSURE.md`, and `docs/BACKGROUND-SERVICES-REMEDIATION.md` were fetched from the committed revision and verified; branch was an ordinary one-commit fast-forward.
- **Objective verdict:** Phase 0's document organization, historical preservation, five-step workflow and coverage **MET**. Evidence limits and open P0 scope remain explicit. **No product QA was run:** not required for docs-only work; no runtime acceptance or physical-browser checks claimed.
- **Next authorized activity:** P0 **NOT STARTED**. At the next instruction, re-read current HEAD and source afresh before recording measurement/failure evidence; no P1–P6 edits were pre-authorized.
### Entry 002 — Pass P0: de novo source revalidation and triage (2026-10-31)

- **Source baseline:** `current-fixes` @ `bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6`. GitHub compare since initial BS audit confirms documentation-only updates, no application source/test drift.
- **Preliminary orientation:** AGENTS, programme index, complete BS ledger/journal, A–F closure, background coordination behavior and verification were reread; per-pass objectives and source-protection gates oriented before evidence writing.
- **Step 1 — audit:** Retraced production call chains for **all BS01–BS21**, including cross-source `attachments.js` cooperative-yield behavior, timer release/rearm, Session save success shape, provider maintenance post-preflight revalidation, SW cache capacity and sanitized diagnostics. Evidence and frozen line anchors: [P0 report](BACKGROUND-SERVICES-P0-EVIDENCE.md).
- **Step 2 — analyze:** Reclassified 4 source control-flow gaps, 5 repeated-work/cadence mechanisms, 4 conditional risks, 4 measurement-only hypotheses, 3 policy/platform matters and 1 narrower diagnostics matter. Changed BS02/BS07/BS11/BS20 claims where safeguards refute original breadth. Prioritize P1 (BS01), P2 (BS03–05), P3 liveness/worker, P4 bounded local upkeep, P5 provider cost, P6 permission and documentation.
- **Step 3 — implementation:** **Documentation/tracker/evidence only**. No runtime source, tests, schemas, providers, build, workflow, release or deployment modifications. No P1–P6 implementation started.
- **Step 4 — objective check:** P0.1 HEAD/source drift MET; P0.2 21/21 source traces MET; P0.3 refuted/qualified hypotheses MET; P0.4 scoped dependencies and test gates MET; P0.5 repeatable scenarios **PLANNED/NOT EXECUTED** (not misreported as baselines measured); P0.6 docs-only MET; P0.7 ledger and append-only journal MET.
- **Step 5 — targeted QA:** 21 source-text anchors statically checked: **21/21 PASS after correcting two check-expression mismatches (BS07 and BS18)**. The initial 19/21 result was a probe-matching mistake; exact production lines were re-read. Compared branch commits and verified no source changes. **Actual JS suites/Chromium/browser/iOS/Drive/device tests NOT RUN**, no local connected executable checkout; tests are only mapped by file and scenario. Documentation commit diff/read-back verification follows this entry; full Promotion intentionally not run.
- **Status:** P0 **SOURCE-EVIDENCE COMPLETE**; all source-level open claims remain subject to the runtime/cost gates of their planned passes, BS21 accepted as platform policy. P1–P6 **NOT STARTED**.
- **Next action:** **P1** — live Session owner claim save-result/read-back proof and smallest coherent repair, only after new instruction; read this entry, §0 and P1 card first.
### Entry 003 — P0 source-documentation targeted QA and link correction (2026-10-31)

- **P0 baseline commit inspected:** `f0d522b09bff185eee427c004bdefa416334e962`; verified `current-fixes` HEAD and exact five-file Markdown-only diff from `bb1fd4aa...` (new P0 evidence plus tracker, programmes index, background contract and handoff status). No product source, tests, generated files, CI or release change.
- **Objective/read-back QA:** All 21 **BS01–BS21** source-evidence sections are present exactly once; all 21 tracker entries have P0 dispositions; all seven P0–P6 pass cards and journal Entries 000–002 remain. `docs/PROGRAMMES.md` points to P1 as next and does not claim P1 began.
- **Source-link correction:** The P0 evidence report now uses stable `### BSxx` GitHub anchors and fully qualified immutable source links for **all** cited multi-range/compound paths; the ledger's `#bsxx` links now resolve correctly. Solely a citation correction discovered in first committed read-back.
- **Targeted QA scope:** Source-text proof checks **21/21** with two corrected static probes; docs structure/read-back and GitHub diff PASS; real unit/integration/Chromium/Drive/iPad tests **NOT RUN**. Do not infer performance gains or verified user-level fixes.
- **P0 disposition:** **SOURCE-EVIDENCE BASELINE COMPLETE.** P1–P6 not started; unverified runtime and physical-device claims remain explicit next-pass tests.
### Entry 004 — P1 preliminary audit, analysis and pre-implementation objectives (2026-11-01)

- **Branch/current baseline:** `current-fixes` @ `da8669736382dbf3a109a56b921f94b14f4db7f7`; owner explicitly authorized P1. P0/Phase 0 already complete. No drift assumed without re-reading.
- **Step 1 source audit:** `source/app.html` `checkSessionOwnershipClaim()` currently reads verified lightweight claim and strict local session, calls `await flushLiveDraft()` but ignores null/`{ok:false}` result and catches thrown failures; then stops display and sets freeze, schedules shared sync. `writeLiveDraftNow` can return null on suppression/loss; `writeActiveSessionNow` can return null/unsuccessful result. `source/core/repositories.js` emergency save first writes synchronous local recovery envelope and strict IDB commit, returns `storage.local/idb` flags; local-only can be recoverable but is **not** canonical-IDB safe for sync. `source/core/backup-recovery-host.js` managed-recovery preflight already requires durable IDB + strict read-back equality, so unverified local state is **not** silently overwritten by ordinary sync; avoid redundant competing guards. `TimerEngine.stopExecution()` stops interval/presentation but leaves session runtime and canonical data intact. The watcher is single-flight and repeats at 15 s.
- **Reproducible source counterexample:** Remote owned claim is applicable; local strict load is initially healthy; `flushLiveDraft()` resolves `{ok:false,storage:{local:false,idb:false}}` or null (no exception); original code takes 'Syncing its latest state' path and schedules sync, despite no demonstrated persisted local snapshot. A local-only `{ok:true,storage:{local:true,idb:false}}` is recoverable but lacks the canonical IDB confirmation managed sync requires.
- **Step 2 decision:** Keep the existing page-owned watcher and managed-recovery preflight. Freeze the runtime promptly when a verified remote owner is observed; **never resume duplicate timer** while remote. Track whether the frozen snapshot has been durably saved to IDB and strictly read back. Retry unverified saves at the existing 15 s watcher cadence, not a second timer. Do **not** schedule claim-triggered full shared sync or present a successful handoff until verified. Show persistent, actionable safety warning while unresolved; distinguish a recoverable emergency local envelope from a verified canonical save. If ownership returns, do not resume a still-unverified frozen draft. No schema/change to Drive claim or storage. Existing generic provider-sync preflight still protects independent convergence attempts.
- **Numbered gates before edits:** **P1.1** valid remote claim freezes timer once without destroying runtime; **P1.2** null, thrown, `{ok:false}` and local-only saves cannot assert verified handoff or trigger claim sync; **P1.3** strict IDB result plus matching readback unlocks claim sync, clears only owned warning; **P1.4** retries on existing watcher after failure, no hot loop/duplicate interval; **P1.5** successful normal handoff retains existing epoch-aware sync 30 s cadence and return-to-owner behavior; **P1.6** no provider/backup formats or destructive paths changed; **P1.7** focused regression tests and runtime source proof cover eligible fault cases.
- **Targeted QA before closure:** Production function harness with real `source/app.html` function extraction and controlled fake ports for success, null, failed, local-only, throw, failed/mismatched readback, recovery/retry, unchanged/new epoch, release-to-own, non-remote, duplicate checks. Existing `session-plan-sync` browser and repository tests must remain runnable; do not state they ran if no checkout or CI. Examine on-push Repository Checks if available; do not trigger full Promotion.
- **Constraint:** If storage in *both* IndexedDB and localStorage is unavailable, no client-side code can guarantee restart recovery; fail closed, keep unsaved runtime in memory and warn the person to keep tab open until durable storage returns. Never claim a durable recovery copy in that case.
- **State:** PLAN RECORDED, IMPLEMENTATION PENDING (this entry is immutable; later entries record actual changes and failures).
### Entry 005 — P1 implementation, independent objectives and targeted QA closure (2026-11-01)

- **Authorized scope / baseline:** Branch `current-fixes`, P1 BS01 only; preliminary source audit and numbered gates recorded *before edits* in Entry 004 at SHA `3a3c6508...`. Final executable source+test SHA **`0ef24c0bface97f3c8b6d85d600748466048c218`**. Compared Entry 004 to final source SHA: exactly **two changed files** — `source/app.html` (+55/−8) and new `tests/integration/app/session-claim-flush-safety.mjs` (207 lines). No other runtime module, schema, storage contract, backup/Drive format, release, generated file, workflow, dependency or build configuration changed.
- **Step 1 audit and root cause:** `checkSessionOwnershipClaim()` silently ignored `{ok:false}`/null local draft saves and always scheduled a claim-triggered Drive sync. Real `saveActiveSessionRecord()` returns independent `storage.local` / `storage.idb` durable outcomes; a local-only emergency envelope can be recoverable but managed sync's existing strict-IDB, saved-revision readback preflight (`backup-recovery-host.js`) requires canonical IDB. `TimerEngine.stopExecution()` stops execution/UI, **not** its underlying resumable runtime clock. Fresh Session snapshots taken by recovery preflight after freeze could count waiting time. Existing reconciliation fail-closed checks were preserved, not duplicated.
- **Step 2 design chosen:** Stop execution as soon as a verified remote claim and local owner are established; freeze the timer/practice evidence once while retaining current review and non-time edits. Save the composed Session via the existing emergency strict canonical path, read back via existing `AppData.activeSession.load(0,{strict:true})` and require matching revision + canonical IDB evidence. No new job/timer, schema, checkpoint or retry engine. Failed/unverified states publish a persistent safety warning and never report handoff or schedule claim-triggered sync; existing 15 s watcher retries after storage recovers. Returning owner resumes only after verified local snapshot and actual TimerEngine resume success. Existing managed-recovery preflight remains its own separate safety barrier.
- **Step 3 code:** `source/app.html` now has small `verifyFrozenSessionClaim()` and `snapshotWhileSessionClaimFrozen()` helpers in the existing host; frozen clock/practice held at handoff but updated reflections/metadata are captured anew; `writeLiveDraftNow()` uses that projection during the freeze and stays unchanged otherwise. `sessionClaimFreeze` holds the original timer evidence, epoch, first freeze time and canonical verification flag. Handoff status and error banner accurately distinguish unverified from verified. `resumeAfterReleasedSessionClaim()` retains freeze if TimerEngine declines resumption. New production-code regression harness created in the existing integration test tree.
- **Step 4 gates:** **P1.1 MET** — verified remote owner freezes the timer before any awaited write, without resetting the session; **P1.2 MET** — null/failed/throw and emergency local-only never authorize claim-sync or success, warn and retain in-memory snapshot; **P1.3 MET** — strict IDB save + readback matching revision gates sync and clears only the owned safety warning; **P1.4 MET** — reuse 15 s watcher, single-flight, repeated failed write does not accrue timer/practice seconds or launch a second scheduler; **P1.5 MET** — unchanged-epoch claim-sync stays on 30 s retry cadence, change of epoch re-freezes once, original owner only resumes after successful TimerEngine outcome; **P1.6 MET** — only host + new test changed; existing independent providers, A–F recovery journal, backup and migration contracts unchanged; **P1.7 MET at *targeted source fault harness* level**, with precise non-executed environments listed below.
- **Step 5 actual QA:** Dynamically extracted **the exact production** `verifyFrozenSessionClaim`, `snapshotWhileSessionClaimFrozen`, `writeLiveDraftNow`, `checkSessionOwnershipClaim` and resume functions from committed `source/app.html`, and ran the committed test logic as an isolated **V8 fake-port runtime harness** through the connected coding tools; final execution **PASS across 18 scenario groups**, including successful save/readback, null, `{ok:false}`, local-only, thrown saves, bad/mismatched/unavailable readback, retry after failure, frozen-time evidence, later reflection preserved, returned ownership, refused timer restart, changed/same epoch, non-applicable claim, capture failure and concurrent observer single-flight. Two temporary harness expectation errors surfaced after evolving from frozen whole-snapshot to frozen clock-only projection; corrected expectations to assert the new intended behavior, then reran to PASS. **This is an executed simulated production-function test, not a real browser integration test.**
- **Independent GitHub verification:** [Repository Checks run 41269229853](https://github.com/oneshubhamt/study-director/actions/runs/41269229853) completed **SUCCESS** on exact executable source/test SHA `0ef24c0b...`; inspected job steps: targeted safety/repository contracts, PWA deployment contract, source build, generated-build verification and generated syntax all SUCCESS. Standard on-push targeted workflow does **not** explicitly execute the new standalone Node integration file; do **not** claim it ran in Node. `npm run test:integration`, Chromium two-device journey, real Drive, Safari/iPad and mobile power/suspend **NOT RUN**. No full Promotion QA requested or triggered.
- **Safety limit / acknowledged boundaries:** When both localStorage and IndexedDB fail, client JS cannot guarantee recovery after page kill; the runtime remains in memory, remote timer stops, claim-sync is withheld, and user is warned to keep the tab open until storage returns. If local strict read/claim projection is unavailable **before** the app can verify the remote claim, the watcher fails closed by not making an unverified ownership decision; the provider's existing authoritative claim and managed-recovery barriers remain, but physical failure experience is untested. No real-device durability claim.
- **Disposition and next action:** **P1 VERIFIED CLOSED at source + targeted simulated fault-injection + Repository Checks level**; BS01 tracker closed with physical/Chromium acceptance explicitly untested. Do not reopen without a concrete counterexample. **Next P2:** notification click navigation and PDF reader/Blob lifetime, begin with entire ledger, current SHA, current source, then audit→plan→implement→verify→targeted QA. Keep A–F certified closure intact.
### Journal template — duplicate this for the next pass

- **Entry NNN — Pass P#, topic / date:**
- **Branch / source HEAD before / HEAD after / relevant changes:**
- **Preliminary ledger and source orientation:**
- **Step 1 — Current-source audit, nearby defenses, proved/refuted claims:**
- **Step 2 — Analysis/root cause, numbered objectives, intended minimal change, trade-offs:**
- **Step 3 — Implementation, file map and exact commits (or explicit no-change disposition):**
- **Step 4 — Objectives MET/PARTIAL/NOT MET with reread evidence and remaining failures:**
- **Step 5 — Targeted QA exact commands/runs, failures/reruns, not-run environments:**
- **Tracker/pass cards updated; performance/compatibility impact; carry-forward dependencies:**

---
**Read-first contract:** orient → audit current production code → analyze and record plan → implement minimally → reverify every objective → targeted QA → append evidence → close only when substantiated. Do not let a prior passing fixture replace a de novo audit.
