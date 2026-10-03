# Fresh background-services audit — 3 October 2026

Baseline: branch `refactor/background-coordination`, commit `3d91713b98dfdb73d155717bcf595c4fa74b5ed1`. Source was reviewed before tests or previous audit conclusions. This is an audit, not a claim of certification.

## Conclusion

Do not close the programme yet. Three source-level defects violate the requested safety/liveness rules. The common scheduling and priority mechanism is coherent; the remaining defects are incomplete executor proofs and discovery/progress contracts. Passing the existing tests does not invalidate the reproductions below.

## Confirmed findings

### High — unreadable repository metadata can authorize deletion of a real backup's counterpart

`device-backup.js:426` and `backup-provider.js:407` omit metadata that could not be read before classifying manifest/commit pairs. A manifest with an unreadable commit is then classified as uncommitted; a commit with an unreadable manifest becomes orphaned. `device-backup.js:513` and `backup-provider.js:606` delete those apparent incomplete artifacts despite the unknown history. The common retention executor (`managed-repository.js:428`) blocks object GC on invalid checkpoint reads but still permits checkpoint pruning.

Reproduced through both actual adapter runtimes with a temporary read exception, in both directions. All four cases deleted the readable counterpart of the unavailable file. The device tests use the existing adapter fixture's repository port; the provider probe also uses the production classifier/retention pipeline. A complete backup can disappear from usable history after one temporary read failure. Object GC initially stays blocked, but that does not undo the loss of the checkpoint pair.

Correction objective: any incomplete/uncertain history must prohibit all destructive artifact and retention decisions. Put the invariant at the common cleanup boundary and apply it before the adapters' direct incomplete-artifact removals. Preserve intent and retry; after a complete inventory, genuinely abandoned artifacts and retention surplus should still be collected. Cover both directions, both adapters, read recovery, and reachability after recovery.

### Medium — healthy slow Drive inventory cannot finish within repeated housekeeping attempts

`backup-provider.js:991` gives the whole maintenance attempt a 30-second budget. `cleanupRepositoryProviderSafely` performs full history discovery and object discovery inside it. `drive.js:626` accumulates listing pages only within the current call. Cancellation loses pagination progress. Verified immutable body caching helps body reads but does not resume a listing.

A deterministic runtime probe supplies a finite four-page inventory with responsive 10-second pages and honours cancellation. Across nine attempts, pages continued responding, but no complete inventory was produced and no cleanup completed. Pending work and retries remain visible, so this is starvation rather than silent timer loss.

Correction objective: read progress must survive the short destructive allowance, with foreground cancellation and scope/source revalidation. Do not simply remove the limit: Drive maintenance protection expires, and extending the scan requires a valid exclusion/renewal or a safely revalidated continuation protocol. Keep deletes bounded and fail closed if the inventory or protection is incomplete.

### Medium — unavailable local records can be treated as an empty recovery candidate and suppress automatic backup

`app.html:8387` calls `dailyRecords.list()` and `activeSession.load()` without strict reads and does not inspect the session's `ok`/`error` result. The list's forgiving path can return an empty rescue list; session load can return `{ok:false,value:null,error}`. The helper then returns true for empty data.

`device-backup.js:158` records the current observed source revision before using that answer to skip catch-up backup. A later ordinary wake checks for a source revision different from that observed revision, so the missed catch-up is not discovered again until another change or intervention.

The actual host helper returned true with unavailable Saved Days and Active Session data. A companion controller probe reproduced idle/no pending work and no automatic commit despite a newer current revision than the recorded backup revision.

Correction objective: distinguish verified empty data from unavailable data; use strict canonical reads and inspect session results. Unknown state must retain a discovery/retry opportunity, not be remembered as a settled empty candidate. Preserve the intended recovery-first behaviour for genuinely empty local data with an existing external backup.

## Source coverage

Reviewed the lifecycle owner and repository coordinator; host startup/control/focus/encryption/reconnection wiring; Device Folder publication, permission/source discovery, inventory/exclusion and cleanup; Drive scoped transport, response validation, pagination, chunk upload recovery, publication/maintenance exclusion and convergence; canonical maintenance and deletion reconciliation; attachment reference scans, logical deletion and physical sweep; attachment shallow verification; repository quarantine, resumable hashing and repository binding; OPFS scratch leases and durable retention; recovery preflight, safety checkpoints, journals and verified rollback; ingest/export/search/image/Insights worker ownership, cancellation and watchdog boundaries; developer diagnostic assembly.

The source supports several useful safeguards: one owned opportunity per declared job; foreground reservation followed by actual settlement; preservation of future retry deadlines; progressing uploads without a 30-second total deadline; strict asset references; reader locks around physical storage; resumable attachment/scratch traversal and integrity hashing; provider-specific repository identities and request fences; transactional integrity metadata; verified recovery before journal cleanup. These are conditional guarantees while the app is running with available storage/control/authorization, not promises of execution after the browser closes.

No additional defect was confirmed in the reviewed attachment/quarantine/worker/journal paths during this audit. This does not prove they are bug-free. PWA update behaviour was excluded from this pass as requested. Native Google authorization and physical device permission behaviour were not acceptance-tested.

## Verification and why the tests missed these cases

22 existing lifecycle, storage, backup, worker and diagnostic suites passed on this baseline; results are in `targeted-baseline.json`. The adversarial probes expose compositions absent from those suites: partial counterpart-read failure before cleanup, responsive paginated inventory longer than the total deadline, and failed forgiving reads before recovery-first dirty discovery. Some adapter fixtures duplicate classification/cleanup logic and can pass while omitting these unknown-state transitions. Architecture regex checks confirm wiring, not these behavioural invariants.

The next correction pass should strengthen the existing domain suites around complete assembled outcomes, including both failed-read directions and eventual recovery. It should not create another historical test category, relax timeouts to force a pass, or treat a green suite as a substitute for source reasoning.

## Evidence

- `device-uncertainty.mjs`: actual device controller, failing checkpoint/commit metadata reads, surviving file inventory.
- `provider-uncertainty.mjs`: actual provider/classifier/retention runtime, failing checkpoint/commit downloads, deletion receipts.
- `drive-progress.mjs`: owned maintenance job plus scoped, cancellable slow inventory; attempts/pages/completion/intent diagnostics.
- `recovery-emptiness.mjs`: actual host helper with unavailable canonical sources.
- `empty-discovery.mjs`: controller's source-discovery and wake behaviour after a false-empty answer.
- `targeted-baseline.json`: existing tests and durations.

The probes are retained outside the repository because this pass requests an audit before implementation. They are evidence, not replacements for durable regression cases in the domain suites.

## Insights timing investigation after the audit

The 590-day fixture remains representative: canonical records, worker rendering, worker-unavailable fallback, constructor-failure recovery, model parity and progressive DOM rendering. No budgets or assertions were weakened.

Profiling identified repeated locale-formatter construction for calendar labels. The source now shares three formatters and formats calendar dates in UTC, preserving labels without shifting the date. The existing scaling suite checks parity with the previous labels across five time zones, every month, every weekday, year boundaries, leap days and daylight-saving transition dates. An isolated pre-change benchmark compared 7,500 labels: 71.0 ms before and 14.3 ms with shared formatters. This measures formatting, not total page responsiveness.

The performance fixture now reports phase timings on failure and omits the large model signature from log output only; the actual signature equality assertion remains. Five targeted integration/architecture suites and three targeted browser cases passed. The browser cases ran with precise runtime coverage enabled. The local worker path completed in 871.4 ms against the unchanged 1,000 ms target, with a 65 ms maximum main-thread task and an 11.6 ms maximum DOM chunk. Build generation, build verification and generated syntax checks passed.

The earlier GitHub run on the baseline completed in 1,559.2 ms and failed the 1,000 ms total deadline. The new revision has not yet passed that GitHub timing gate. Local total time did not improve beyond measurement variability; this small optimization does not establish that the remote failure is resolved. Keep the gate open until the new revision is measured there. No background production changes were made in this audit pass.
