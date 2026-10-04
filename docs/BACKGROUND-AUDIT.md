# Background coordination: recovery and protected cleanup

4 October 2026. Branch: `refactor/background-coordination`. The current correction addresses the two confirmed blockers from the fresh source audit: Notes recovery could replace an intervening edit, and Drive cleanup could retry indefinitely while its metadata requests succeeded.

## Recovery ownership

Recovery reads are asynchronous; a successful read is not proof that the live model remained unchanged. Notes now wait for the captured save chain and pending recovery writes, then fence adoption against both the live revision and any newly queued canonical save. The revision changes on every accepted mutation, independently of throttled note timestamps.

A superseded snapshot leaves the live model, dirty work, recovery copies and autosave timers intact. Canonical maintenance reports `yielded / notes-changed`, retains its durable pending intent and retries through its existing automatic wake-up. Timers are cleared only when a stable snapshot can actually be adopted. Maintenance cannot report completion until the accepted work is reconciled.

Existing local data protections remain: immediate strict read barriers, fresh rescue retirement that preserves unrelated/newer copies, transaction-bound stale-replay checks, strict deletion reconciliation, attachment reference proofs, recovery journals and verified rollback. A committed save remains acknowledged if later housekeeping fails; developer diagnostics retain the pending cleanup. Review's Copy report remains study-only.

## Drive protection and progress

The old marker's useful assertion window was 30 seconds. Renewal and verification required sequential network reads, so two healthy 16-second requests could exhaust that window before useful cleanup. The deletion allowance did not describe the time needed to maintain network exclusion.

The shared repository policy now distinguishes these limits:

| Boundary | Limit |
| --- | --- |
| Drive metadata request, including JSON body | 45 seconds |
| Drive maintenance marker, version 2 | Five minutes |
| Drive assertion margin | 75 seconds: one request plus release grace |
| Drive renewal threshold | One quarter of the verified marker lifetime |
| Drive destructive work | Cooperative 30 seconds, checked between productive protected units |
| Device Folder marker / assertion margin | Existing 60 / 30 seconds |

These timings preserve bounded stale protection without extending housekeeping execution budgets or introducing another scheduler. Immutable rotation verifies that the previous marker remains present, correctly scoped and unexpired. Unreadable expiry also invalidates protection. Lost protection requires fresh inventory before deletion can resume. Foreground cancellation still interrupts requests and waits for actual settlement; marker release reuses the verified operation scope instead of adding a redundant folder read. An identity change invalidates that scope.

Version 1 Drive markers retain their original lifetime. Current coordination uses the adapter's verified expiry, rather than assuming every marker lasts 60 seconds. Version 2 markers are unrecognized by older clients' validators, causing their existing uncertainty handling to defer rather than expire active protection prematurely. An abandoned newer marker requires a current client to retire it after expiry.

## Verification

**26 targeted suites passed** through the guarded hermetic runner. They cover lifecycle and diagnostics, local recovery and strict durability, journals, capture, restore, Device Folder, Drive, cleanup, incremental preparation, Library clear, architecture boundaries and test governance. The three changed integration suites were revalidated after the final unreadable-expiry guard. Existing authoritative tests were strengthened; no test file, runtime module, dependency, persistent store or timer layer was added.

- Notes conservation is checked across 13 schedules: stable recovery and edits, additions, deletion or queued saves at canonical-read, final-result and autosave boundaries. Tests compare the exact live, canonical and restarted models, include equal timestamps, verify subsequent edits use the latest base, and exercise the production host's automatic wake-up.
- The assembled Drive domain now includes 16 scenarios. Metadata latencies of 1, 3, 6, 11, 16, 31 and 44 seconds complete cleanup; the 44-second case also covers slow marker creation and deletion. Each bounded continuation retires new data, with at most four unfinished passes for four eligible objects. Completion preserves exactly the committed backup's referenced objects and immutable manifest/commit pair, retires orphan objects and clears pending intent and maintenance markers.
- Foreground interruption, unavailable history and lost protection preserve pending work and data. A competing writer cannot expire an active version 2 marker at the old 60-second boundary. Direct transport tests cover legacy/future versions, missing/expired/unreadable/foreign protection, ambiguous creation/deletion, cancellation release and repository identity invalidation.

Source build, exact generated inventory verification, source syntax and generated syntax passed in a disposable checkout: **111 development files, 112 deployment files, 130 generated JavaScript files and eight inline scripts**. QA evidence stays outside the source tree.

## Assessment and limits

Both confirmed blockers are addressed. The final review of their assembled paths found no additional material blocker requiring another coordination redesign. The consolidated lifecycle owner, provider-specific progress and strict storage proofs remain appropriate; these corrections repair their existing handoffs.

Automatic completion requires a running page, eventual available access/control, stable source and verifiable protection. Unknown or expired protection cannot authorize deletion. Retention remains 15 ordinary recovery points plus one temporary protected safety snapshot.

Full Promotion QA, browser smoke, physical Device Folder and live Drive acceptance were outside this correction. These results establish the exercised source contracts and controlled failure schedules; they are not a claim that every browser or network condition has been certified. Main remains unmerged.
