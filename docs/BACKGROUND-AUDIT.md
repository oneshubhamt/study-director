# Background services: productive progress and verification

4 October 2026. Branch: `refactor/background-coordination`. Source-first correction and targeted assembled-system verification. The existing job owner and repository coordinator retain responsibility for pending work, eligibility, retry, foreground priority and actual settlement.

## Findings addressed

- Drive range downloads used a fixed 30-second body deadline. A healthy slow stream could repeatedly discard the same one-MiB segment without advancing its saved hash/offset.
- Local attachment verification, attachment GC and backup scratch GC could consume their five-second allowance on successful preparation reads, then repeat that preparation without advancing a row, reference phase or candidate.
- Architecture assertions still required old callback shapes and an aggregate maintenance-budget spelling, rather than the current shared signal/deletion-phase budget contract.

Source review also established two related boundaries: integrity's aggregate 120-second timer could discard a slow segment before its checkpoint committed, and fetch cannot observe upload bytes, leaving binary uploads subject to a fixed request deadline. Both are addressed in this correction.

## Objectives and implementation

1. **Slow productive transfers can finish; stalled transfers remain bounded.** Binary multipart and resumable Drive uploads use asynchronous browser upload-progress events. Upload/response byte counts must increase to renew the existing 120-second inactivity watchdog. Range readers renew the same watchdog only for nonempty bytes. Empty chunks and repeated progress counts cannot keep a stall alive. The one-MiB range bound, size/digest/version checks, endpoint validation, authorization fencing, resumable server offsets and required server SHA-256 receipts remain enforced. Metadata JSON retains its 45-second request/body deadline. Fetch-only capability fallback retains a finite deadline because it cannot observe upload progress.
2. **Integrity saves useful work before yielding.** The shared scheduler applies its 120-second allowance after awaited durable progress advances bytes, authenticated frames or an object cursor. Scratch initialization alone does not count. Device Folder and Drive pass their committed progress through that same boundary. Slow useful segments may finish beyond the allowance; transport and worker stall watchdogs remain active. A failed progress write rejects before the scheduler can treat it as saved.
3. **Finite local housekeeping has a route to completion after slow preparation.** Attachment reference scans retain successfully read phase values and cursors. Logical deletion commits a bounded subset when candidate reads are slow; physical collection retains its directory candidate. Shallow verification and scratch GC permit at least one useful candidate after slow strict preparation, then yield at a retained boundary. Five-second allowances and entry caps remain. This is a cooperative allowance, not a timer that interrupts an atomic native storage commit.
4. **Foreground work retains priority and data protection.** Ownership, foreground and source checks always run, including before mutation; the minimum-progress rule never bypasses them. Foreground cancellation aborts active Drive transport and waits for the executor's actual release. Unknown reads cannot authorize deletion, classify corruption or publish a clean audit. Reference/revision fences, library retention, reader leases, recovery/integrity scratch retention and strict metadata transactions remain unchanged.
5. **Verification remains maintainable.** Existing domain suites contain the new latency/progress cases; no historical test category or additional scheduler/store is introduced. GitHub Repository checks now include the directly affected lifecycle, transfer, integrity, GC and architecture suites. Fake server Blob/crypto processing is drained independently of virtual network time, rather than changing production deadlines or weakening checksum assertions.

## Expected execution rules

| Work | Rule |
| --- | --- |
| Local attachment/scratch housekeeping | Cooperative five-second allowance; bounded entries; permit useful progress after successful slow preparation; check foreground/ownership before writes |
| Repository integrity | Cooperative 120-second allowance checked after useful committed progress; one-MiB segments and object/byte/frame limits; foreground cancellation throughout |
| Binary Drive uploads / range downloads | 120 seconds without increasing byte progress; productive transfers may take many minutes |
| Drive metadata | 45-second request/body deadline; bounded retry; failure remains unavailable |
| Destructive managed-repository maintenance | Existing provider-specific short deletion allowance and bounded remote maintenance leases remain; these are exclusion/safety rules, not upload deadlines |
| Worker processing | Existing inactivity watchdogs and cancellation/termination contracts remain |

## Assembled targeted verification

22 domain suites passed with Node.js 22 through the guarded hermetic runner. Neighboring coverage includes Device Folder operation/recovery, managed publication/restore, provider backlog recovery, capture safety, integrity state, attachment storage/worker lifetime, exports, library-clear rollback and test governance.

The new checks establish:

- Exact downloaded bytes complete with 9-, 35- and 90-second intervals between chunks, including segments lasting longer than the integrity allowance.
- Multipart and resumable uploads finish with increasing progress every 90 seconds; the multi-chunk resumable case lasts approximately 18 simulated minutes and requires the original server checksum receipt.
- A stalled body, empty chunks, absent upload progress and repeated byte counts hit a finite watchdog; incomplete uploads do not become accepted immutable objects.
- Actual Drive transport plus the production continuation/hash executor and shared scheduler saves each slow segment and finishes with data-read offsets exactly `0`, `1048576`, `2097152`, without downloading a completed segment again.
- Successful local preparation latencies at the 4,999/5,000-ms boundary and at 6/20 seconds still finish finite work. Multiple attachment orphans exercise partial logical commits and physical enumeration across attempts. Scratch leases/retained files survive collection.
- Foreground arrival during slow proof reads forbids deletion. Foreground arrival during slow upload/download aborts transport and waits for actual coordinator release. Existing uncertainty, changed-source, failed-write, corruption and recovery-journal tests remain passing.

Source build, generated-build verification (111 development / 112 deployment files) and generated syntax (130 JavaScript files / eight inline scripts) passed. Workflow governance passed after the CI scope update. No new confirmed defect was found in the changed boundaries after targeted verification and source diff review.

## Assessment and limits

The confirmed productive-progress findings and stale assertions are addressed. This establishes the exercised safety, liveness and priority rules under available control, successful finite reads and eventual scheduling opportunities; it does not promise work after the browser/app closes. Native storage operations that do not support cancellation must actually settle before conflicting foreground mutation proceeds.

Retention remains 15 ordinary versions plus one temporary protected safety point. Verified replacement publication still precedes reclamation; unsafe/unavailable reads retain physical backlog for later retry.

Full Promotion QA, browser smoke, real Google Drive/CORS acceptance and physical device permission/background suspension were not rerun. The separate previously recorded remote Insights timing acceptance remains open. This correction does not certify that gate or authorize merging the draft PR.

Local evidence: `/workspace/background-progress-fix-evidence/`. The existing branch and draft PR remain the delivery surface; main remains unmerged.
