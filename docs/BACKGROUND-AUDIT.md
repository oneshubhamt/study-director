# Background services: backlog recovery and retention verification

3 October 2026. Correction baseline: `2c0fc8dfba350567d85d20aa900d440489c8e100`, branch `refactor/background-coordination`. This report records source review, the backlog correction and targeted production-path verification. It is not an unconditional browser/native certification.

## Assessment

The central job lifecycle and repository priority/settlement coordinator remain the owners of discovery, durable pending intent, blockers, execution, retry and completion. The previous correction unified deletion safety, protected inventory/deletion phases and strict local recovery discovery. Those protections are retained. This pass corrects the remaining Drive inventory capacity gap without replacing the coordinator or adding another scheduler, durable store or permanent timer layer.

The 64-version cutoff was incorrectly tied to normal retention capacity: retention describes which versions should remain after safe cleanup, not how many files can exist before cleanup. A failed, blocked or interrupted pass can leave obsolete committed versions behind. Once that finite backlog exceeded the listing cutoff, both cleanup and publication stopped. Preserving data was correct; making complete discovery impossible was the design defect.

## Confirmed retention policy

Both managed providers use 15 ordinary slots: one Latest, six preceding daily dates, four preceding calendar weeks and four older calendar-month buckets. The Latest checkpoint's captured local calendar anchors selection. Each occupied bucket selects its newest eligible checkpoint, and older tiers exclude dates already accounted for by newer tiers. Missing periods do not create copies or fill redundant slots. Week boundaries are Monday-based. The latest capture may be on any weekday.

The user confirmed that the newest unexpired protected Before restore / combine / clear-library snapshot remains an extra temporary safety copy. Fully populated ordinary history therefore retains 15 versions, or 16 with that safety point. A version consists of one manifest and its commit marker; shared object files are separate. This is the settled retention target, not an instantaneous physical ceiling. Publication verifies the replacement before maintenance removes obsolete immutable versions. When safe reads or deletion are unavailable, old files remain and pending work retries.

Calendar buckets and sparse capture dates mean the oldest actual snapshot is not guaranteed to be an exact five months and one week old.

## Correction objectives and implementation

1. **A legitimate finite backlog has complete discovery and a route to recovery.** Drive reads all checkpoint/commit pages rather than stopping at 64 entries or 100 pages. Each HTTP page remains bounded to 1,000 descriptors, with existing authorization, repository identity, request/body watchdogs, cancellation and renewable exclusion checks. Explicitly incomplete Drive searches remain uncertain. Repeated page tokens fail safely rather than looping or certifying completion.
2. **Recovery does not retain all full manifests.** Verification uses the existing eight-reader ceiling. Every history body is validated, then obsolete history retains only compact provenance/retention proofs. Full object references are loaded only for the selected ordinary/protected versions. The existing full-body cache remains bounded to 64 entries. Compact proofs belong to that same cache owner, are bound to repository scope and exact immutable listed identity/version/digest, and are pruned when history changes or cleanup completes. In-memory proofs accelerate interrupted attempts; durable pending intent still owns reload/reconnection wake-up.
3. **No uncertainty authorizes deletion.** The common cleanup executor still requires complete, interpretable history before any incomplete-artifact, retention or object deletion. Pair validation covers every manifest/commit. An unavailable body keeps the job pending. Deletion allowance and entry limits remain unchanged; large backlogs finish over governed partial passes. A failed/deferred checkpoint deletion blocks object GC.
4. **Foreground activity takes priority without false completion.** The batch propagates the owner's cancellation reason and waits for all active readers to settle before returning. A later foreground history observation may legitimately renew the pending request; diagnostics record the actual preempted execution independently. Verified progress is reused on retry, while changed file versions are verified again. A fixed verified retention evaluation time carries through selected-manifest loading and deletion planning, preventing an expiry boundary from changing which full object references GC needs.
5. **Publication/history/restore stay usable with a backlog.** Their metadata discovery shares complete pagination. History projects the retained points; new publication verifies its latest base without materializing all old manifests. Genuine incomplete-history messages now describe unavailable inventory rather than alleging an excessive version count.

## Assembled verification

Existing domain suites were extended; no new standalone test suite or historical category was added. The Drive fixture waits for actual settlement before moving its clock to just before the recorded retry deadline, then advances in small steps. It no longer jumps through real asynchronous hashing and request watchdogs; production budgets and assertion limits remain unchanged. The shared Drive HTTP harness simulates provider I/O, clock, page faults and read latency while executing the actual plugin transport, provider runtime, history verifier, retention executor and owned lifecycle.

- A 65-version valid backlog accepts another committed backup before maintenance becomes eligible, then automatically recovers to the exact selected history and reachable object set.
- A separate 65-version case makes one obsolete commit unavailable. No repository-data deletion occurs. After normal retry, already verified obsolete history is reused and recovery completes.
- A 300-version backlog accepts publication, crosses more than 100 listing pages, is interrupted during actual history reads by foreground history, and preserves a scheduled pending request. Execution diagnostics report preemption, all readers settle, and no backup data is deleted during the interruption. One previously verified file changes remote version; that proof is discarded and reverified. Unchanged obsolete checkpoint bodies are read exactly once. The resumed backlog settles to exactly 15 manifests and 15 commits, with exactly their referenced objects; 70 abandoned objects exercise bounded GC continuation. No maintenance marker remains.
- Transport checks independently cover both checkpoint and commit inventories across 110 one-entry pages, explicit incomplete search and repeated pagination tokens.
- Retention checks cover every weekday plus leap-day and year/month boundaries over dense duplicate-per-day history. They verify 1 + 6 + 4 + 4 slots, unique dates, newest representatives, input-order/evaluator-date independence and idempotence. Existing sparse, tier-graduation, timezone and protected-snapshot checks remain intact.
- Existing seven-way unknown-history checks still produce zero mutation. Device Folder production cleanup, provider retry/recovery, repository restore/preparation, integrity state, lifecycle and developer diagnostics receive targeted regression checks.

## Verification status and limits

12 targeted suites passed through the guarded runner. Source build and generated-build verification passed (111 development / 112 deployment files); generated syntax validation passed (130 JavaScript files / 8 inline scripts). The original reproduction now reduces its 65-version backlog and accepts its subsequent backup without an error; its final two physical versions include that newly published copy awaiting its scheduled cleanup. The assembled suites separately verify exact settled retention and cleared pending intent.

Full Promotion QA, browser smoke and physical Google/device-permission acceptance were not rerun. The earlier remote Insights timing acceptance remains separate and open. This pass does not claim background execution after the app/browser closes.

The confirmed Drive backlog finding is closed. Source review of the changed pagination, compact-proof identity/lifetime, cancellation/settlement, retained-object loading and partial-cleanup boundaries found no additional confirmed defect after correction. Green targeted checks establish the exercised rules, not absence of every possible defect elsewhere in the app.

Evidence is retained in `/workspace/drive-backlog-recovery-evidence`: guarded targeted logs, build/verification/syntax logs and the original 65-version reproduction rerun against corrected source. The branch remains unmerged.
