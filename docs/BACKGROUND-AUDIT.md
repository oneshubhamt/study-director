# Local recovery safety and background coordination

4 October 2026. Branch: `refactor/background-coordination`. This correction addresses the three confirmed local recovery findings: loss of a newer active-session rescue, loss of an unrelated saved day's rescue, and replacement of unread pending deletion intent.

## Cause and correction

The production LocalStorage adapter returns the supplied default after a failed read and exposes the failure through `lastError`. A successful later read or write clears that error. Checking it after filtering through another reader could therefore turn unavailable data into apparent absence. Some mutating callers did not check it at all.

Repository recovery now uses one immediate read barrier. The active-session deletion executor decodes the same successfully read envelope, removing its duplicate presence/read handoff. Saved-day and deletion-ledger readers reject unavailable contents before filtering, merging, retiring or replacing them. Session deletion staging reports failure before any destructive work when its shared ledger cannot be read.

Saved-day cleanup has one shared retirement operation for saves, batches, imports and reconciliation. It rereads the raw current rescue collection, retains unrelated and newer copies, and retires only values covered by the committed data. This preserves entries hidden by a pending deletion as well as saves arriving during awaited database work. Passive reconciliation compares the canonical record inside the same strict transaction and cannot overwrite a newer canonical value. Explicit save/import overwrite behavior remains available.

A committed canonical save still acknowledges success and notifies backup when rescue cleanup is unavailable. Developer diagnostics retain the cleanup failure, and the rescue remains available to existing maintenance/recovery. Fire-and-forget reconciliation catches failures; strict maintenance propagates them and retains its pending marker.

Fault testing also exposed a failed Notes startup result that remained cached after successful strict recovery. Each subsequent maintenance phase reloaded Notes and invalidated its own source proof. Successful recovery now replaces that cached result, allowing stable finite work to converge.

## Rules verified

- An uncertain read cannot authorize deletion or erase an unseen rescue collection.
- Operations on one entity conserve unrelated acknowledged data and pending deletion intent.
- An older pending deletion cannot consume a newer acknowledged rescue.
- Known committed data remains acknowledged when housekeeping fails; diagnostics distinguish the remaining work.
- Rescue replay preserves newer canonical data, and cleanup preserves copies arriving during asynchronous reconciliation.
- Finite failures followed by available storage permit recovery and maintenance to complete.
- Existing ownership, strict durability, foreground priority, journal/rollback, capture completeness and retention boundaries remain enforced.

## Verification

Existing domain suites were strengthened; no test file or runtime dependency was added. The repository fixture now uses the actual production LocalStorage adapter, including successful-operation error reset, and the production import batch limit. Import tests require a real committed record.

The recovery suite injects one failure at every local read in each healthy operation trace: **112 cases across 12 operations**. It checks copy and intent conservation after the attempt and completion after a healthy retry. Seven further cases cover committed-save acknowledgement and diagnostics, stale replay, and unrelated/newer same-day arrivals during migration and deletion recovery.

Four deliberate mutations were rejected: ignoring the immediate read error, allowing stale rescue replay, retiring a cached rescue collection, and keeping the failed Notes result cached. The unmodified control passed; the cached-result mutation reproduced nontermination under a bounded external test timeout.

**32 targeted suites passed locally** through the guarded hermetic runner: the repository-fixture consumers and affected capture, restore, library clear, attachment-reference, maintenance, durability, architecture and governance contracts; plus shared repository lifecycle, checkpoint cleanup and Drive transport tests. Several structural assertions in the existing architecture fixture were updated to the current availability guard, renewable lease port and shared deletion allowance. Behavioral safety tests passed independently of those assertion changes.

Source build, exact generated inventory verification and generated syntax passed in a disposable checkout: **111 development files, 112 deployment files, 130 JavaScript files and eight inline scripts**. The existing GitHub Repository checks workflow now includes the strengthened deletion/recovery suite.

## Design and limits

The job lifecycle owns scheduling, blockers and retry; the repository coordinator owns priority and actual settlement; storage executors own authoritative reads, data protection and resumable progress. This correction adds no scheduler, persistent store, timer layer or general state-machine framework. Successful slow work retains the shared productive-unit allowance; stalled requests and workers retain their separate watchdogs.

Automatic completion requires a running page, eventual available storage/control and stable source. Unavailable or expired protection cannot authorize deletion. Retention remains 15 ordinary recovery points plus one temporary protected safety snapshot.

The three confirmed recovery blockers are addressed by the verified correction. Full Promotion QA, browser smoke and physical Device Folder/live Drive acceptance were not rerun. Main remains unmerged; these results establish the exercised source contracts and failure schedules.
