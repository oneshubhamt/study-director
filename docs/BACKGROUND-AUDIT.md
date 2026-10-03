# Background services: corrective refactor and follow-up audit

3 October 2026. Correction baseline: `739b3db18b7b147095747cc60c8972e1863f3e1d`, branch `refactor/background-coordination`. The latest audit reviewed the corrected source and assembled production paths. This report distinguishes verified corrections from remaining work; it is not a blanket certification.

## Assessment

All three requested defects are corrected. The central job lifecycle and repository priority/settlement coordinator remain suitable foundations. The surrounding engineering was insufficiently consistent: adapters separately decided whether incomplete artifacts could be removed, total execution deadlines conflated read discovery with destructive work, and a forgiving UI read influenced durable backup discovery. A shared timer alone did not enforce the full system's safety and completion contracts.

The correction therefore refactors the boundaries instead of adding three caller-specific retry exceptions. Shared cleanup now owns the safety decision and phase order for both providers. Provider-specific transports retain responsibility for permission, authorization, physical I/O and exclusion. No replacement scheduler or additional permanent job/timer layer was introduced.

**Do not close the programme yet.** The post-fix audit confirmed one further medium recovery limitation: a valid Drive backlog exceeding the 64-version history listing cutoff cannot automatically clean itself or publish another backup. The guard preserves data, but it does not provide eventual completion.

## Corrected objectives and evidence

### 1. Uncertain history cannot authorize any repository-data deletion

`managed-repository.cleanupRepositoryRetention` checks unreadable, ignored and overflowed history before incomplete-artifact deletion, retention selection/deletion, object inventory or object GC. It returns retained history and an explicit pending/uncertain outcome. Device Folder and Drive now supply incomplete artifacts to this common executor; their separate deletion loops are removed.

The complete-history path remains useful: incomplete artifacts and surplus checkpoints share a bounded deletion allowance; partial passes preserve referenced objects and retry. Read-only object inventory precedes the destructive phase for background maintenance. Publication contention, deletion failure and uncertainty continue to produce governed pending outcomes.

Verification covers all seven combinations of unreadable, ignored and overflowed history. Each produces zero data mutations and zero preparation calls. After recovery, the same physical dataset finishes within a bound derived from the two deletion allowances; every surviving checkpoint remains reachable after every partial pass. Actual adapter tests cover both failed metadata directions, retaining the valid counterpart and other repository files, followed by ordinary scheduled recovery and verified cleanup.

### 2. Responsive Drive inventory can finish beyond the former total deadline

The scheduler's existing execution scope owns a one-shot deletion budget that can start after discovery. Repeated phase notifications cannot extend it; released scopes cannot restart it; transfer jobs cannot acquire a housekeeping deadline.

Drive operation contexts run the maintenance protection check between requests/pages. Renewal creates a new immutable marker, proves overlap with the existing unexpired marker, then releases the old one. Existing app versions understand both markers and the original expiry protocol. Missing, expired or foreign protection discards the attempt and requires fresh inventory. No PATCH access or extended expiry protocol was added.

The background executor inventories history and objects under that protection, then starts its thirty-second destructive allowance. Network/body watchdogs, cancellation, foreground preemption, marker release and actual execution settlement remain active. Transports without renewable/scoped protection retain a bounded total opportunity.

The assembled test uses the actual Drive plugin transport, provider runtime, classifier, retention executor and owned scheduler. Responsive ten-second pages require more than thirty seconds in total. Cleanup finishes, removes only genuinely unreferenced objects, retains the exact committed metadata pair, clears its pending intent and releases its marker. A separate case interrupts the actual page request with foreground history access: no backup data is deleted, the pending job resumes automatically, and verified completion follows. Marker tests also exercise ambiguous create/delete outcomes and missing, expired or foreign prior protection.

### 3. Unavailable local data cannot settle an empty recovery decision

The actual host helper strictly reads Saved Days and Active Session, checks the session outcome, and returns `null` for unavailable data. Verified empty and verified non-empty remain distinct boolean outcomes. The controller records the observed source revision only after a successful, stable decision with current permission/control. Unknown data preserves the owner's retry; it does not enqueue an empty backup that could obscure external recovery data.

Tests execute the actual host function against canonical repository reads. Saved Days, Active Session, Ongoing Notes and metadata failures each return unknown. After ordinary retry, a recovered non-empty dataset publishes its catch-up backup; a proven empty dataset retains recovery-first behavior and does not publish an empty replacement. A failed session result is independently rejected as an emptiness proof. Tests cover both recovery outcomes for each failed canonical source.

## Test consolidation and QA

- Device Folder tests now execute the production classification, retention policy and cleanup engine; copied implementations were removed.
- The shared Drive HTTP harness is reused by transport/security and assembled backup tests. Its multipart simulation now preserves binary bytes; the former text parser corrupted compressed data. Its error realm matches the application's shared window, so artificial VM boundaries do not replace cancellation reasons. It reads the production repository policy.
- Existing domain suites were extended; no historical regression category or new standalone test suite was added. Fixtures retain their original safety assertions and timing budgets.
- 27 targeted suites passed through the repository's guarded runner. The initial direct launch of the hermetic-policy self-check lacked its required guards; the normal runner verified child-process and worker-network restrictions successfully. It required no test relaxation.
- Final source build, generated-build verification and generated syntax checks passed. Full promotion QA, browser smoke and native Google/device-permission acceptance were not rerun in this pass. The earlier Insights GitHub timing acceptance remains separate and open.

## Follow-up finding: medium — valid Drive backlog cannot recover past 64 history entries

`drive.repositoryList` limits each checkpoint/commit listing to 64 items. `repositoryProviderStateWork` carries overflow into cleanup; the common executor correctly refuses deletion from this incomplete inventory. Publication-base discovery also rejects that overflow. The result is safe preservation with no route back to a complete inventory.

An adversarial assembled probe created 65 valid committed versions while background work was blocked, then restored eligibility. All metadata and object reads were healthy. Repeated maintenance left all 65 manifests, 65 commits and 66 objects unchanged, with `blocked-uncertain` pending intent. The next legitimate backup rejected with “An unusual number of backup versions was found. Backup was stopped for review.” This is an intentional safety guard, but it fails the programme's automatic-recovery/eventual-completion objective for a finite valid backlog.

Recommended next scope: refactor history discovery into bounded processing that can establish a complete inventory without retaining every full payload at once. Keep provider/repository identity, renewable exclusion, cancellation, verified manifest/commit pairing and the global unknown-history deletion prohibition. Advance through legitimate backlogs and retain governed progress; raising or removing the numeric cutoff alone is insufficient. The central scheduler can continue to own this job.

This remaining issue is reported, not implemented in the correction pass.

## Audit coverage and limits

The follow-up reviewed job discovery, eligibility, deadlines, priority, preemption, request fencing and settlement; both repository adapters and publication/maintenance protocols; canonical maintenance/deletion reconciliation; attachment reachability, quarantine and GC; integrity recurrence, saved hashing progress and repository scope; temporary-file leases and recovery handoffs; journals and verified rollback; ingest/export/search/image/Insights worker cancellation and watchdogs; diagnostic projections. Particular adversarial attention went to unknown reads, admission/release races, interruption, finite work and capacity limits.

No additional data-deletion defect was confirmed in the reviewed attachment, quarantine, scratch, worker or recovery-journal paths. Execution remains conditional on an open app and available storage, control and authorization. There is no promise of maintenance after the browser closes. The capacity finding prevents unconditional closure of the background programme despite green targeted QA.

Local evidence is retained in `/workspace/background-correction-evidence`: `targeted-governed.log`, build/verification/syntax logs, the extended domain-test logs, and `drive-backlog-audit.mjs` / `drive-backlog-audit.log`. The backlog probe is audit evidence outside the repository, not a passing substitute for the future production regression test.
