# P0 source-evidence baseline — background services (31 October 2026)

> **P0 disposition: SOURCE-EVIDENCE BASELINE COMPLETE; NO RUNTIME/DEVICE CERTIFICATION.** Branch `current-fixes` production source at `bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6`. The prior Phase 0 (docs-only) commits after `05cf0d8...` changed **no** `source`, `portable`, `rich-text`, `tests`, `contracts` or build code, verified by GitHub compare. The P0 commit likewise changes docs only. Reinspect source afresh for P1 and every later pass.

## 1. How P0 was performed and evidence limits

- Read `AGENTS.md`, `docs/PROGRAMMES.md`, the complete BS remediation ledger and journal, A–F certified closure, background coordination contract, verification policy and relevant current production source at the exact commit.
- Retraced all BS01–BS21 against the **current** leaf functions and nearby blockers: `app.html`, `source/platform/sw.js`, `source/core/repository-background.js`, `operation-lifecycle.js`, `asset-storage.js`, `asset-maintenance.js`, `attachments.js`, `exports.js`, `backup-provider.js`, `device-backup.js`, `pwa-lifecycle.js`, and `backup-operation-diagnostics.js`.
- Evaluated tested-looking claims against existing **test source** rather than assuming tests pass. Inspected `tests/unit/backup/repository-background.mjs`, `tests/helpers/session-ownership-claim-regression.mjs`, `tests/integration/attachments/pdf-reader-lifetime.mjs`; mapped other existing targeted tests by tree.
- Checked 21 anchored source patterns, corrected **two overly restrictive check expressions** (BS07, BS18) against the actual function text and re-read their exact paths: final **21/21 SOURCE-TRACE CHECKS PASS**. These are targeted *static* assertions only, not execution of the production app or test suite. 19 checks matched on first pass; the two failed probes were probe-expression errors, not app test failures.
- Browser/runtime performance, real Drive, device permission and mobile/OPFS tests: **NOT RUN**. This environment has GitHub source inspection but no executable linked repository checkout. Do **not** extrapolate zero runtime defects or measured latency/battery savings.

## 2. Corrected issue triage — not 21 confirmed defects

| ID | P0 class/severity | Carry-forward status | Main source |
|---|---|---|---|
| BS01 | CONTROL-FLOW GAP · P1 | Open for P1 | app.html 2775–2790; 4101–4106; 4149–4155 |
| BS02 | QUALIFIED CONTENTION-LIVENESS · P2 | Open for P3 | repository-background.js 93–116, 127–147, 282–284, 326–344 |
| BS03 | CONFIRMED NAVIGATION PATH · P1/P2 | Open for P2 | platform/sw.js 205–221; app.html 2192–2210 |
| BS04 | CONFIRMED LIFETIME GAP · P2 | Open for P2 | app.html 2105–2115, 2117–2140 |
| BS05 | LOW-COST PERFORMANCE HYPOTHESIS · P3 | Measure in P2 | app.html 2117–2121 |
| BS06 | PROVEN REPEATED WORK · P2 | Measure/optimize in P4 | asset-storage.js 65–96 |
| BS07 | QUALIFIED BULK PREPARATION · P2 | Measure in P4 | app.html 8818–8835; attachments.js 77–99 |
| BS08 | PROVEN BULK MATERIALIZATION · P2 | Measure in P4 | asset-maintenance.js 23–45, 59–75 |
| BS09 | ITERATOR PORTABILITY RISK · P3 | Prove or retain in P4 | asset-storage.js 127–150 |
| BS10 | PROVEN REPEATED PROTECTION READ · P2 | Measure in P4 | exports.js 23–40; app.html 8609–8615 |
| BS11 | INTENTIONAL PROTECTION/PERF TRADE-OFF · P2 | Measure in P5 | backup-provider.js 715–766 |
| BS12 | CONDITIONAL SW INSTALL LIVENESS · P2 | Reproduce in P3 | platform/sw.js 65–92, 108–143, 161–169 |
| BS13 | NETWORK CONTENTION HYPOTHESIS · P3 | Measure in P5 | app.html 10248–10278 |
| BS14 | NATIVE API TIMING LIMIT · P3 | Retain policy; verify P3 | pwa-lifecycle.js 216–255 |
| BS15 | CONFIRMED ASYNC RACE SHAPE · P2 | Open for P6 | device-backup.js 199–223, 227–262 |
| BS16 | CONFIRMED POLLING RATE; VALUE UNMEASURED · P2 | Measure in P5 | app.html 2763–2822; backup-provider.js 1755–1758 |
| BS17 | CONDITIONAL STARTUP RESOURCE BURST · P2 | Measure in P5 | app.html 5411–5429, 5435–5469, 11069–11081 |
| BS18 | TIMER/WALL-CLOCK PLATFORM HYPOTHESIS · P3 | Prove or document P3 | operation-lifecycle.js 53–98; repository-background.js 93–116 |
| BS19 | INTENTIONAL INTEGRITY ENVELOPE · P3 | Retain design; document P6 | platform/sw.js 40–63, 150–159 |
| BS20 | REFINED OBSERVABILITY GAP · P3 | Only targeted metrics in P6 | backup-operation-diagnostics.js 13–24, 33–51, 53–125; backup-provider.js 724–762 |
| BS21 | ACCEPTED PWA PLATFORM LIMIT | Policy documented; no code | operation-lifecycle.js 51–98; platform/sw.js 161–239; app.html 11069–11081 |

**Overall:** 4 direct code-path gaps (BS01/03/04/15, with consequences still conditional); 5 verified repeated-work/rate sources (BS06/07/08/10/16, with performance impact unmeasured); 4 conditional liveness/iterator/clock risks (BS02/09/12/18); 4 resource-performance hypotheses requiring measurements (BS05/11/13/17); 3 design/platform cases requiring no speculative rewrite (BS14/19/21); 1 significantly narrowed observability proposal (BS20). This is a classification of engineering work, **not** a count of confirmed user-visible failures.

## 3. Per-finding de novo source adjudication and scenario gate

### BS01 — CONTROL-FLOW GAP · P1

**P0 outcome:** Open for P1. **Source:** [`source/app.html:2775`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/app.html#L2775); 4101–4106; 4149–4155.

**Independent re-evaluation:** `await flushLiveDraft()` is `try/catch` only. `writeActiveSessionNow()` can yield null or `{ok:false,error}` instead of rejecting; `TimerEngine.stopExecution()` and freeze still execute. An in-memory timer is stopped; loss of saved progress is **not** established from this trace because other rescue/reconciliation guards exist.

**Next-pass proof requirement:** Inject strict save `{ok:false}`/null/throw and assert the last-tick/unsaved content is recoverable, no two clocks run, and the remote owner is not overruled.

### BS02 — QUALIFIED CONTENTION-LIVENESS · P2

**P0 outcome:** Open for P3. **Source:** repository-background.js 93–116, 127–147, 282–284, 326–344.

**Independent re-evaluation:** Correction: a scheduled callback suppressed by an active peer is **rearmed** by `scope.release() -> resumeTimers()`; the generic ‘lost timer’ claim was false. However `beginBackground()` denial leads to `MAINTENANCE.busyMs` (15 s) or `INTEGRITY.retryMs` (10 min), and releasing the blocking peer does not pull those deliberate *future* deadlines forward.

**Next-pass proof requirement:** Fake clock: denial→higher-priority release after 50 ms→eligible pending job; distinguish immediate eligible work from error/authorization retry; verify no hot loop.

### BS03 — CONFIRMED NAVIGATION PATH · P1/P2

**P0 outcome:** Open for P2. **Source:** platform/sw.js 205–221; [`source/app.html:2192`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/app.html#L2192).

**Independent re-evaluation:** System notifications request root `./` and `notificationclick` invokes `existing.navigate(requested.href)` before `focus()` whenever URLs differ. A dirty in-scope `/index.html`, query route or deep link can be navigated. Pagehide/rescue may prevent loss, so actual data corruption is **not** shown.

**Next-pass proof requirement:** Real Chromium: notification click from `/index.html`/deep link while Notes/editor or Session dirty, with multiple clients, offline and popup denials; preserve content/route and focus.

### BS04 — CONFIRMED LIFETIME GAP · P2

**P0 outcome:** Open for P2. **Source:** app.html 2105–2115, 2117–2140.

**Independent re-evaluation:** Fallback link click marks `handedOff=true`; overlay close's `release()` only revokes Blob URL and releases OPFS retained reader when `!handedOff`. No observed subsequent explicit release owner for clicked handoff. Normal iframe viewer has a deterministic onAfterClose release.

**Next-pass proof requirement:** Instrument Blob URL/reader counts; open, download, close, tab exit, multiple fallback clicks, premature-revocation prevention.

### BS05 — LOW-COST PERFORMANCE HYPOTHESIS · P3

**P0 outcome:** Measure in P2. **Source:** [`source/app.html:2117`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/app.html#L2117).

**Independent re-evaluation:** Direct native PDF uses 1 s polling until `opened.closed`; interval naturally dies with parent page, so 'leaks after page destroyed' would be overclaiming. Cost while long-lived tabs remain and popup behavior are unmeasured.

**Next-pass proof requirement:** Inspect timers after many external viewers and BFCache; decide whether cleanup merits a change.

### BS06 — PROVEN REPEATED WORK · P2

**P0 outcome:** Measure/optimize in P4. **Source:** [`source/core/asset-storage.js:65`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/core/asset-storage.js#L65).

**Independent re-evaluation:** `shallowAudit()` reconstructs sorted `allEntries()` plus sorted references and SHA-256 of the full serialized identity **each invocation**, while checking at most 128 file entries. Rough scan-work amplification across N/128 chunks is source-inherent; wall time/memory unknown. Rechecking mutations is a deliberate correctness property.

**Next-pass proof requirement:** Count IDB reads, bytes encoded/hashed and pauses at N=0/128/129/1000; change metadata mid-scan and reject stale progress.

### BS07 — QUALIFIED BULK PREPARATION · P2

**P0 outcome:** Measure in P4. **Source:** [`source/app.html:8818`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/app.html#L8818); [`source/core/attachments.js:77`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/core/attachments.js#L77).

**Independent re-evaluation:** The host awaits full `AttachmentReferences.sources()` before its 5 s/128-entry `shallowAudit` budget. **Correction:** `sources()` cooperatively yields after Notes/Day descriptors when background budget indicates; however its `readFreshPayload()` and `dailyRecords.list({strict:true})` materialize complete collections and it returns a whole map/array.

**Next-pass proof requirement:** Benchmark 1000+ Notes/Days/large reflection strings; track capture/read cost vs yields; never scan partial inventory as complete.

### BS08 — PROVEN BULK MATERIALIZATION · P2

**P0 outcome:** Measure in P4. **Source:** asset-maintenance.js 23–45, 59–75.

**Independent re-evaluation:** The GC reference walk is bounded *after* source phase population; `Object.values(readNotes())`, `listDailyRecords().map(...)` and `readPendingReviewTexts()` can allocate full arrays first. Source change gates and fail-closed incomplete reference checks exist.

**Next-pass proof requirement:** Large Notes and Day history, mid-phase revision, unsupported text, earlier user edit, crash; prohibit deletion on unknown references.

### BS09 — ITERATOR PORTABILITY RISK · P3

**P0 outcome:** Prove or retain in P4. **Source:** [`source/core/asset-storage.js:127`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/core/asset-storage.js#L127).

**Independent re-evaluation:** OPFS sweep iterator persists across yielded passes; on nonbudget errors it resets. The code checks `storedFiles()` and reader leases, limiting destructive exposure. Browser iterator mutation/suspend semantics are not established from source.

**Next-pass proof requirement:** Chrome + iPad where supported: add/remove during scan, delayed resumption, reopen; check orphan eventual reclamation and reachable-file safety.

### BS10 — PROVEN REPEATED PROTECTION READ · P2

**P0 outcome:** Measure in P4. **Source:** [`source/core/exports.js:23`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/core/exports.js#L23); [`source/app.html:8609`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/app.html#L8609).

**Independent re-evaluation:** `retained()` is called inside every candidate's exclusive file lock; it reads restore-journal payload and repository integrity scrub state each time. Fresh pins are important; simply caching absence could make deletion unsafe.

**Next-pass proof requirement:** Count metadata reads per 128 candidates; injection: create/retire pinned rollback between iterations; compare candidate-safe fresh validation.

### BS11 — INTENTIONAL PROTECTION/PERF TRADE-OFF · P2

**P0 outcome:** Measure in P5. **Source:** [`source/core/backup-provider.js:715`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/core/backup-provider.js#L715).

**Independent re-evaluation:** Read-only history and object inventory happen outside the destructive lease expressly to keep foreground unblocked. Source **already** rehashes fresh digests and checks the inventory under the lease before deletion. Performance of long preflight is not proven unacceptable.

**Next-pass proof requirement:** Mock 100/1000 checkpoints, slow paginated object list and a simultaneous new publication; record wall/read requests, preserve all fresh-delete guards.

### BS12 — CONDITIONAL SW INSTALL LIVENESS · P2

**P0 outcome:** Reproduce in P3. **Source:** platform/sw.js 65–92, 108–143, 161–169.

**Independent re-evaluation:** At three shell-cache generations, a new identity refuses install before reclamation. Existing cleanup respects live/unknown client release and preserves recent history; this may be a deliberate safety constraint, not an unconditional bug.

**Next-pass proof requirement:** Simulate cap with zero/live/unknown clients; navigate to trigger retirement, retry install; ensure no pinned cache eviction.

### BS13 — NETWORK CONTENTION HYPOTHESIS · P3

**P0 outcome:** Measure in P5. **Source:** [`source/app.html:10248`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/app.html#L10248).

**Independent re-evaluation:** The PWA update check has an independent due timer, primary-tab ownership, online condition, browser Web Lock and failure backoff. It does not explicitly share backup's network eligibility check; 'downloads saturate backup' is unmeasured.

**Next-pass proof requirement:** Throttle network and overlap large Drive upload/update; check delay and user progress; retain update liveness.

### BS14 — NATIVE API TIMING LIMIT · P3

**P0 outcome:** Retain policy; verify P3. **Source:** [`source/core/pwa-lifecycle.js:216`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/core/pwa-lifecycle.js#L216).

**Independent re-evaluation:** `Promise.race(registration.update(), 120s timeout)` does not cancel browser-native update. The lifecycle already listens to `controllerchange`, install states and page resumes; late activation may converge. No source-based evidence that extra cancellation is needed.

**Next-pass proof requirement:** Simulate resolve after timeout and statechange later; verify messages reflect timeout vs native completion, no unsafe reload.

### BS15 — CONFIRMED ASYNC RACE SHAPE · P2

**P0 outcome:** Open for P6. **Source:** device-backup.js 199–223, 227–262.

**Independent re-evaluation:** `refreshPermission()` assigns `permission=await query()` with no identity/generation check. Multiple focus wakeups, disconnect or new folder selection can overlap; a late answer may publish stale permission. `prepareRepository()` separately guards folder identity, but not this status assignment.

**Next-pass proof requirement:** Two perm queries resolve out of order (including handle switch, regrant, disconnect); latest handle and user-gesture prompt rules win.

### BS16 — CONFIRMED POLLING RATE; VALUE UNMEASURED · P2

**P0 outcome:** Measure in P5. **Source:** [`source/app.html:2763`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/app.html#L2763); [`source/core/backup-provider.js:1755`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/core/backup-provider.js#L1755).

**Independent re-evaluation:** `SESSION_CLAIM_WATCH_MS=15000`; while visible, initialized, connected and TASKS exist or claim is frozen, watcher reads remote session claim and strict local Session. Thus upper scheduled rate is 4 attempts/min (less under gating/inflight). Detection latency is a correctness/product trade-off.

**Next-pass proof requirement:** Count actual Drive requests per 30 min session across idle/running/offline/dual devices; measure owner-transfer detection p95.

### BS17 — CONDITIONAL STARTUP RESOURCE BURST · P2

**P0 outcome:** Measure in P5. **Source:** app.html 5411–5429, 5435–5469, 11069–11081.

**Independent re-evaluation:** Startup `BackgroundOperations.wake()` discovers six owners and separately calls `BackupFiles.collect()`, though each has own blockers/work budgets. Peak concurrent CPU/IO is not measured; no claim that startup always overloads the device.

**Next-pass proof requirement:** Cold/warm startup with backlog, slow CPU, immediate typing; measure time-to-interaction, concurrent active jobs, worker/IO peak.

### BS18 — TIMER/WALL-CLOCK PLATFORM HYPOTHESIS · P3

**P0 outcome:** Prove or document P3. **Source:** [`source/core/operation-lifecycle.js:53`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/core/operation-lifecycle.js#L53); [`source/core/repository-background.js:93`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/core/repository-background.js#L93).

**Independent re-evaluation:** Due times are `environment.now()/Date.now` and browser timers are set using a derived delay. App has foreground/resume wake, but wall-clock jumps and throttled timers can create drift. No guarantee of background execution is feasible.

**Next-pass proof requirement:** Clock jump forward/back, BFCache and suspended timers; validate eventual wake and bounded retry; no 'always on' promises.

### BS19 — INTENTIONAL INTEGRITY ENVELOPE · P3

**P0 outcome:** Retain design; document P6. **Source:** platform/sw.js 40–63, 150–159.

**Independent re-evaluation:** New/reused shell assets are SHA-256 verified during installation; subsequent cache fetch returns cached response without hashing every read. A blanket per-fetch hash is unjustified absent actual browser cache corruption evidence.

**Next-pass proof requirement:** Cache-corruption simulation only if risk material; verify offline previous generation; avoid speed regression.

### BS20 — REFINED OBSERVABILITY GAP · P3

**P0 outcome:** Only targeted metrics in P6. **Source:** backup-operation-diagnostics.js 13–24, 33–51, 53–125; [`source/core/backup-provider.js:724`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/core/backup-provider.js#L724).

**Independent re-evaluation:** Correction: diagnostics **already include** maintenance inventory-start/end/invalidation and deletion-start, sanitized bounded traces, dropped-count and active state. Broad claim 'no preflight diagnostics' is **refuted**. Per-candidate read counts, explicit resource lease maxima and high-level work/idle durations are not all surfaced.

**Next-pass proof requirement:** First identify missing decision-relevant counters; prove whitelisting, redaction and stable cardinality; avoid duplicating existing metrics.

### BS21 — ACCEPTED PWA PLATFORM LIMIT

**P0 outcome:** Policy documented; no code. **Source:** [`source/core/operation-lifecycle.js:51`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/core/operation-lifecycle.js#L51); platform/sw.js 161–239; [`source/app.html:11069`](https://github.com/oneshubhamt/study-director/blob/bb1fd4aa8cb4a30908ee37505c880ea631a1e4c6/source/app.html#L11069).

**Independent re-evaluation:** Jobs are page-owned, and service-worker events cannot supply a guaranteed repeating OS scheduler after all windows close. Existing A–F F18 already accepted this operational restriction.

**Next-pass proof requirement:** Document only; real Android/iPad suspend/kill, recovery on next eligible open requires operator; do not build imaginary always-on service.

## 4. P0 false-positive corrections and dependencies

1. **BS02:** The earlier generic claim of an orphaned timer is disproved by `beginBackground().release()->resumeTimers()` and the timer callback preserving `scheduled`. The remaining real question is contention-induced **future** deadlines (15 s maintenance, 10 min integrity), where release re-arms but does not pull the due time forward. Never change error/permission retries just to shorten this.
2. **BS07:** The source aggregator is not entirely synchronous: descriptor scanning can yield after each Notes/Day. Bulk `readFreshPayload()` and `dailyRecords.list(strict)` remain whole-source reads **before** the shallow per-128 chunk.
3. **BS11:** Provider maintenance intentionally does read-only planning before the exclusion lease **and** revalidates fresh digests under lease; optimizing this by moving the lease earlier is unsafe.
4. **BS20:** Existing diagnostics already expose inventory-phase start/completion/invalidation and deletion milestones. Any added instrumentation must be justified by a genuinely missing observable metric; do not duplicate or enlarge traces.
5. **BS14/19/21:** Native update continuation, install-time shell hashing and closed-PWA scheduling limitations are not ordinary JavaScript bugs. Default recommendation is to retain the existing design, unless a precise counterexample or explicit policy decision emerges.
6. **A–F boundary:** No evidence reopens F1–F15 certification, prior verified-object publication, protected journals, current-format preference, Drive token policy or migration. Real-device acceptance remains separate.

## 5. Test/fault-injection map (existing files, no execution claimed)

| Next pass | Existing code/test starting points | Missing scenario that must be proved before closure |
|---|---|---|
| P1 | `tests/helpers/session-ownership-claim-regression.mjs`; `tests/browser/backup/session-plan-sync.mjs`; `tests/browser/app/session-draft-edit.mjs`; `tests/integration/storage/active-session-recovery-migration.mjs` | Failure/null of *local flush while remote claim arrives*, local read-back, no dual timer and resume/reconcile |
| P2 | `tests/integration/attachments/pdf-reader-lifetime.mjs`; `tests/integration/attachments/worker-client-lifetime.mjs`; `tests/integration/pwa/service-worker-lifecycle.mjs`; `tests/browser/pwa/pwa-offline.mjs` | Notification click dirty-navigation; fallback Open/Download ownership and long-lived popup teardown; reused viewer cases |
| P3 | `tests/unit/backup/repository-background.mjs`; `tests/integration/pwa/pwa-lifecycle.mjs`; `tests/integration/pwa/service-worker-lifecycle.mjs`; `tests/browser/pwa/pwa-update.mjs` | Busy-retry vs release fake clock; 3-cache cap with live/unknown clients; late update & wall clock jump |
| P4 | `tests/integration/storage/attachment-integrity-audit.mjs`; `tests/integration/storage/background-gc-reliability.mjs`; `tests/integration/storage/attachment-reference-recovery.mjs`; `tests/integration/attachments/attachment-storage-dedup.mjs` | N=0/128/129/1000+, metadata identity change across chunks, mid-GC source mutation, pinned scratch, iterator mutation |
| P5 | `tests/integration/backup/repository-checkpoint.mjs`; `tests/integration/backup/automatic-provider-backup.mjs`; `tests/browser/backup/session-plan-sync.mjs`; `tests/browser/backup/pwa-device-backup.mjs` | Paging/requests/latency at scale; slow transfer and claim detection trade-offs; startup resource overlap |
| P6 | `tests/integration/backup/device-folder-storage.mjs`; `tests/integration/ui/background-diagnostics.mjs`; `tests/integration/pwa/pwa-lifecycle.mjs` | Permission refresh A/B reordered, folder identity changed, copied diagnostics privacy and under-browser constraints |

**Manual boundary:** Android/iPad suspend/kill, real Drive network and auth, real folder permission revocation, physical memory/battery and native PDF process state are operator-only and remain **NOT TESTED**.

## 6. P0 objectives and independent closure gates

| Objective | Outcome | Source evidence |
|---|---|---|
| P0.1 HEAD/source unchanged since first BS audit | **MET** | Github compare `05cf0d8...bb1fd4aa` = 10 docs only, no source/tests/build diff |
| P0.2 Re-evaluate BS01–BS21 against current source and safeguards | **MET (source)** | §3 21-item traces and individual next-pass scenario gates |
| P0.3 Correct false positives, reject ungrounded bug claims | **MET** | BS02/07/11/20 and BS14/19/21 qualifications in §4 |
| P0.4 Identify scopes, priorities and dependency order for next passes | **MET** | New §2 adjudication + P1–P6 dependency/test map |
| P0.5 Reproducibility and measurement baseline | **MET for *plans*, NOT EXECUTED for runtime baselines** | Specific fault-injection, scale and browser requirements recorded; no browser/device checkout here |
| P0.6 No unsolicited product or QA policy changes | **MET** | Documentation-only P0, confirmed in final commit diff |
| P0.7 Full implementation playbook and append-only journal | **MET** | Active ledger P0 result/tracker, objective check, and Entry 002 |

## 7. Recommended execution order after P0

**P1 first (BS01).** It protects a high-consequence Active Session transition and is a narrow correction only after fault reproduction. **P2 next** for navigation/reader lifetimes. **P3–P6** should prioritize direct correctness proof over attractive but speculative performance edits. A P4 optimization is permitted only if actual scan/pause metrics improve under proven identical safety checks.

**Decision rule:** Any risk not observed or disproved in a focused test becomes **RETAIN/DEFER/REFUTE WITH EVIDENCE**, never an obligatory patch. Full Promotion QA is not a P0 deliverable; it remains a later explicit programme milestone.
