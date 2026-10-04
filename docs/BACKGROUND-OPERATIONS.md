# Background coordination

Background work belongs to the open application. It is not an operating-system service that is guaranteed to run after the app closes. Pending durable work is rediscovered when the app opens and its required access is available.

## Ownership

```mermaid
flowchart TD
  State[Startup, control, connection, encryption and activation changes] --> Group[Application owner group]
  Group --> Job[Shared job lifecycle]
  Job --> Gate[Repository priority and settlement gate, where needed]
  Gate --> Executor[Storage or transfer executor]
  Executor --> Proof[Verified outcome and saved progress]
  Proof --> Job
  Job --> Diagnostic[Current state and last attempt]
```

`operation-lifecycle.createJob` owns pending opportunities, a coalesced deadline, eligibility, one executor promise and its explicit outcome. `createGroup` reconnects the application owners after eligibility changes, isolating a failed owner's wake-up from other owners and foreground completion. `repository-background` adds priority, reservation, preemption and real settlement for each repository. Transport and storage modules own the actual proof of safety, durable progress and provider-specific retry cadence. Shared repository cleanup owns the order: complete history, protected object inventory, bounded deletion, and an explicit complete or pending outcome. Incomplete artifacts use that same safety and work allowance, rather than separate adapter-owned deletion loops.

There is one timer owner per job. Provider registration and hook configuration establish all available provider jobs; connection notifications wake cleanup, integrity and pending publication together. Foreground release wakes the repository owner. It does not require a history or backup caller to remember a second completion handoff.

```mermaid
stateDiagram-v2
  [*] --> Pending: discovered or requested
  Pending --> Paused: access or control blocked
  Paused --> Pending: eligibility restored
  Pending --> Scheduled: retain governed deadline
  Scheduled --> Running: due and admitted
  Running --> Scheduled: partial progress or retry
  Running --> Paused: access lost
  Running --> Idle: verified completion, no newer request
  Idle --> Pending: new work or recurrence
```

Discovery is part of job ownership: an unknown settings read retains a retry, and a restored connection compares the current source revision with the last verified backup before declaring itself idle. A known-clean job does not repeatedly rediscover itself.

A future recurrence counts as a pending opportunity. Current execution and the previous attempt are separate: a job can be scheduled while its last outcome is unavailable. An unavailable metadata read never establishes that work is absent. Local recovery discovery distinguishes verified empty, verified non-empty and unavailable data; an unavailable result preserves its retry and does not settle the observed source revision. Named permission/control/key blockers sleep until an eligibility event; an unknown availability failure retains a bounded retry.

## Jobs and policies

| Job / owner | Pending work and progress | Execution and recovery |
| --- | --- | --- |
| Canonical data maintenance / host | Strict pending/completion metadata; canonical notes, session, fallback and deletion recovery | Shared cooperative 20-second allowance; retained phase cursor fenced by strict canonical epoch, local rescue values, live Notes revision and ownership; safe revalidation after changes/reload; recovery retires only exact serviced requests and checkpoints prefixes between transactions; 24-hour successful cadence and governed retry |
| Attachment cleanup / asset maintenance | Durable pending/success markers; in-memory reference and directory continuation under a stable source proof | Five seconds / 128 units; strict references, write tokens, journals and leases; reader release, control return and daily discovery reconnect work |
| Attachment verification / host | Strict saved findings and inventory-bound scan cursor | Five seconds / 128 units; warnings survive unavailable reads and partial scans; 24-hour full-scan cadence |
| Scratch collection / file store | Durable journal/hash references, reader/producer/download pins; in-memory directory continuation | Startup orphan discovery; five seconds / 128 entries; fresh retained-reference read under each candidate lock; failed reads retry without deletion |
| Device Folder automatic backup / controller | Strict startup settings recovery; discovery of actual source revisions, original quiet/urgent deadline and verified completion metadata | Quiet window (30 minutes in production), three-second urgent trigger; permission/control/key blockers; progressive writes remain interruptible; capped infrequent retry continues after repeated temporary failures |
| Drive convergence / provider runtime | Strict pending requests with compare-before-clear completion | Noninteractive access only; no total housekeeping deadline; existing request/worker progress watchdogs and cancellation remain; failure backoff caps at 30 minutes |
| Device / Drive retention and object GC / repository coordinator | Strict identity-bound cleanup intent, reason, eligibility and request fencing | Device Folder first completes a cancellable inventory under a renewable exclusion marker, with a ten-second timeout on each read. Deletion then has a cooperative twenty-second / bounded-entry allowance. Drive inventories history and objects under renewable immutable maintenance markers, with network watchdogs and cancellation; its cooperative thirty-second deletion allowance starts after inventory. The shared cleanup engine permits one protected productive unit, then checks the allowance before another; foreground cancellation remains effective within units. Shared cleanup blocks all artifact and retention deletion when history is incomplete and governs grace, contention, failure and uncertainty; reconnection wakes cleanup independently of publication |
| Device / Drive integrity / repository coordinator | Identity-bound quarantine, inventory/cursors and resumable stored/plain hash checkpoints | Shared cooperative 120-second allowance after durable useful progress, with object/byte/segment limits; 14-day full-scan cadence; unavailable and corruption remain distinct; foreground preemption preserves completed progress |
| Search, attachment, file and Insights workers / their clients | Request identity and caller lifetime; obsolete requests are deliberately cancelled | Existing worker watchdogs, cancellation, retired-worker fencing and fallback remain. These transient requests are not durable periodic jobs |

The shared `createWorkBudget` separates a housekeeping allowance from foreground cancellation and IO stall watchdogs. An elapsed allowance cannot cancel the successful safety reads needed for the first useful unit. Progress never renews the allowance; it makes yielding eligible at the next saved boundary. Canonical maintenance retains a phase cursor, repository cleanup advances through confirmed physical deletions, and integrity retains committed hash offsets. Housekeeping can stop between these bounded units and continue later. A healthy upload is allowed to finish while remaining cancellable; a 30-second total timeout no longer repeatedly destroys the progress of a 45-second upload. Native browser calls still have cooperative cancellation boundaries: a settlement timeout does not pretend a native operation or its lock has finished.

Device Folder and Drive share the coordination contract, not transport assumptions. Device Folder requires a persisted directory handle and browser permission. Drive requires a valid authorized repository connection and uses its existing bounded network/progress controls. Attachment cleanup proves local reachability before reclaiming data. Repository identity, immutable objects/commits, deletion reconciliation, recovery journals and verified rollback remain storage responsibilities.

## Invariants and evidence

| Expected rule | Authoritative targeted verification |
| --- | --- |
| Unknown reads cannot authorize deletion or erase warnings | `storage/background-gc-reliability`, `storage/attachment-reference-recovery`, `exports/scratch-gc`, `library/library-clear`, `backup/capture-safety` |
| Every pending job has a deadline or an identified blocker and wake-up | `unit/app/operation-lifecycle`, `unit/backup/repository-background`, production-runtime `backup/pending-provider-recovery` |
| Healthy finite work eventually finishes once required access is available | Lifecycle workload/blocker/failure matrices; work-allowance latency matrices; actual canonical host/storage phase continuation; assembled Drive cleanup with slow protection reads and foreground interruption; real binary-pipeline 45-second Drive publication in `backup/repository-checkpoint` |
| Foreground work safely takes priority without releasing unsettled storage | Repository coordinator settlement tests; Device Folder safety/recovery and slow-inventory cancellation tests; assembled Drive cancellation and retry; worker-client lifetime tests |
| Completion cannot clear a newer request | Common lifecycle late-request tests, maintenance request fencing, durable provider compare-before-clear tests, Device source-revision tests |
| Diagnostics reflect execution, retained work and unavailable data | `unit/backup/backup-operation-diagnostics` and `integration/ui/background-diagnostics`; typed safe fields and privacy assertions |
| Exact dependency composition remains functional | Assembled BackupModule with live integrity hooks, successful history, actual integrity execution and verified publication; generated source build/syntax checks |

Developer diagnostics belong to Library → Data & Backup → Copy diagnostics. Review → Copy report remains study-only. No background implementation details have been added to that user report.

These tests establish the listed contracts under deterministic access, I/O, cancellation and failure schedules. Full regression uses the GitHub Promotion QA workflow, including all browser journeys and built-runtime coverage. Native-device acceptance remains separate; the existing pull request links the current workflow result.

## Why the follow-up found defects

The shared scheduler originally owned execution after a request was queued, while callers still owned discovering whether a request existed. A failed startup settings read and edits during a permission block could therefore leave an idle scheduler with undiscovered work. The Device Folder job now owns both discovery and execution. Permission, control and startup recovery reconnect that same lifecycle.

The former twenty-second total allowance also treated a complete filesystem inventory like an independently repeatable cleanup unit. Restarting a healthy forty-second scan could never reach deletion. Inventory now completes under renewed exclusion, yields regularly and remains cancellable; each individual read is bounded. Destructive work retains its short allowance and never proceeds from an incomplete inventory.

Assembled browser checks exposed gaps that identity-only repository mocks and stale fixtures could not reveal. Current-schema tests now use the real canonical codec and cover sorted and windowed reads, preventing a second projection from discarding valid Saved Days. Reflection checks cover persistence through the active session and Saved Days. Browser fixtures exercise current backup choices, actual worker cancellation, trusted input and completed navigation; they do not add a separate draft-reflection store or change product interactions.

The same checks found a presentation wait that could block hidden-window startup and an update wake-up that could supersede the editing idle deadline. Both waits are now governed explicitly. The note-status tooltip keeps its toolbar anchor and belongs to the editor dialog. Touch image controls retain tap-to-select behavior.

Read-only ownership probes also used to change the authority revision even when no access changed. That could invalidate an update preparation between its checks. Failed availability probes now preserve the secondary state; actual acquisition, hydration and release still invalidate write tokens. Tests cover repeated unavailable Web Lock and BroadcastChannel probes followed by real takeover and release.

The PWA and Device Folder browser checks use the shared browser harness, including process settlement and temporary-profile cleanup. PWA checks observe completed navigation, actual foreground/hidden tabs and terminal check/installation state, and reinstall their security-policy listener before every document. Automatic update counts measure explicit registration update calls; browser-initiated registration checks are not mistaken for duplicate application work. Offline serving, damaged-worker rejection and required-asset verification still exercise real service workers and caches.

Populated Insights reads no longer fetch the summary inventory twice or repeatedly create locale formatters for English weekday labels. The same saved records, derived results and progressive rendering remain in use. Its 590-day performance, worker/fallback parity and worker-failure retry checks retain their original limits. Browser attachment checks use a valid PCM WAV and actual media readiness; click automation preserves already-visible targets so it does not manufacture page scrolling.

## Retention and backlog recovery

Device Folder and Drive share the same retention policy: 15 ordinary recovery points, plus at most one unexpired protected safety point. The protected point remains an extra temporary copy, as confirmed by the user; it does not displace an ordinary slot.

| Tier | Slots | Selection |
| --- | ---: | --- |
| Latest | 1 | Newest ordinary committed checkpoint; its capture date anchors the windows |
| Daily | 6 | Newest checkpoint on each of the six preceding dates |
| Weekly | 4 | Newest eligible checkpoint in each of the four preceding Monday-based calendar weeks, excluding dates already covered by Daily |
| Monthly | 4 | Newest eligible checkpoint in each of the four calendar-month buckets immediately before the weekly boundary, excluding the newer tiers |
| Protected safety | 1 extra | Newest unexpired Before restore / combine / clear-library checkpoint |

Missing periods leave empty slots. The latest day can be any weekday. Windows use the local calendar recorded at capture, so changing the evaluator's timezone does not reinterpret history. Calendar months and partial boundary periods mean the oldest available snapshot is not guaranteed to be an exact five months and one week old.

Retention selects recovery points; it cannot enforce an instantaneous physical file limit. Publication first commits and verifies a new immutable version, then maintenance safely removes obsolete versions. A blocked, interrupted or failed cleanup can therefore leave more than 15 ordinary manifest/commit pairs temporarily. Each version has a manifest and a commit marker; shared objects are separate files and are not counted as versions. Version History projects retained points while physical cleanup catches up.

Drive history inventory now reads all pages, independently of the retention slot count. Pages remain bounded to 1,000 descriptors and history verification to eight concurrent reads. Each verified obsolete manifest is reduced to a compact retention/provenance proof; full object references are loaded only for the selected points. The existing full-body cache remains limited to 64 entries. Compact proofs are scoped to the current repository and exact listed immutable file identity/version/digest. They are reused on ordinary retry, discarded on changed identity or repository, and pruned when physical history changes or cleanup completes. They are in-memory acceleration; durable pending intent still owns wake-up after reload.

The same attempt validates every manifest/commit pair before authorizing deletion. Unknown history, an explicitly incomplete Drive search, repeated pagination tokens, or lost exclusion cannot produce a clean result or authorize reclamation. The verified retention evaluation time stays fixed through loading the selected manifests and deletion planning. Foreground preemption preserves its actual cancellation reason and waits for all active readers to settle; a later history observation may legitimately renew the pending request. Deletion still uses its existing short allowance and bounded entry count. Large finite backlogs and object GC continue through governed passes until verified completion.

See [the current audit and evidence](BACKGROUND-AUDIT.md). The former 64-version recovery limitation is corrected; full browser/native acceptance and the separate remote Insights timing gate were not rerun in this correction.
