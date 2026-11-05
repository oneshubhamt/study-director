# Backlog

This is the **current work register**, not an implementation journal. Current contracts are in [area documentation](README.md), detailed testing plans in [test-programme.md](test-programme.md), and the BF-1/BF-2/BF-C1–C8 implementation ledgers and earlier audit receipts remain in [Git history](https://github.com/oneshubhamt/study-director/blob/788a548e335e5f6ca83334efc1b0f1c76ea3059c/docs/backlog.md). Source code, not an old completion claim, is authoritative.

**Branch checkpoint (2026-11-05):** `bug-fixes` source revision [77080fdf](https://github.com/oneshubhamt/study-director/commit/77080fdfcbbf7b6b3632416f6c56a654162bbb88) passed [Repository Checks 42057139422](https://github.com/oneshubhamt/study-director/actions/runs/42057139422): 157 fast-suite files, PWA contract, source build and generated verification/syntax. These are **not** current-revision browser, physical-device or real Drive certifications. `main` has independent subsequent progress. The **documentation-only intake** below was compared with `main` at [919a6980](https://github.com/oneshubhamt/study-director/commit/919a6980f27b9c216d6a5dddcb4bbbcff100493b) on 2026-11-05. No production changes or tests from `main` were transferred by that intake.

## Source-verified fixes awaiting browser and device acceptance

| Original report | Current source-level disposition on `bug-fixes` | Unfinished acceptance/decision |
| --- | --- | --- |
| **#1** Continue Here unexpectedly opens Plan editing | Corrected; applied schedule and separate authoring draft retain independent state | Real A→B→A handoff, restored/suspended/previous-day Plan display, Cancel/Done and browser visuals |
| **#2** Repeated “earlier day unsaved” notices after saving on device B | Canonical Day evidence, same-lineage acknowledgments, retained divergence, unfinished Practice Pacer and the **24-hour active-unit cap** are covered in source | Actual next-day reconnection, same-date divergence, interrupted/failed storage and no false reminder |
| **#3** Kept Versions appears repeatedly and explains too little | Field-level ancestry, semantic Saved Plan meaning/order, repeated alternative convergence, replicated resolution receipts, full Plan-draft/Saved Plan comparisons corrected | Real provider/visual counts and choices, absent-Note recovery and **authoring device attribution** |
| **#5** Plan draft disappears after session transfer | Draft is settled and canonically verified before a narrow Active Session ownership claim; session application does not persist the draft | Never-authored/empty/edited local draft, pending/failed write, interrupted ownership handoff on real devices |

**Unmet product details for #3:** A retained Note alternative may contain only a changed field mask, so it cannot safely recreate a missing complete Note; keep it available or restore the original from Recently deleted before comparison. `PendingReview.v1` does not record which installation **authored** an alternative or a precise typed conflict reason. The retained timestamp and publishing device cannot supply that identity. Adding versioned provenance requires explicit approval, not fabricated metadata.

**Source owners:** `source/core/plan.js`, `source/app.html`, `source/core/review.js`, `source/core/record-codecs.js`, `source/core/practice-pacer.js`, `source/core/backup.js`, `source/core/backup-provider.js`, `source/core/interactions.js`, `source/core/reconciliation-baseline.js`, `source/core/reconciliation-ui.js`, and the existing repositories. The durable rules are in [Study session](areas/study-session.md) and [Backup and sync](areas/backup-and-sync.md). No parallel save, ownership, notification or merge engine is justified.

## Other reported bugs and follow-up investigations

Owner reports from 2026-11-03, augmented by [main's issue register](https://github.com/oneshubhamt/study-director/blob/919a6980f27b9c216d6a5dddcb4bbbcff100493b/docs/backlog.md) (observations on 2026-11-04). **These are reports, not evidence that `bug-fixes` already contains `main`'s fixes. Reinspect both branches at source level before assigning an implementation status.**

| # | Report | Required investigation |
| --- | --- | --- |
| **4** | First iPad Drive connection stayed at “Bringing in what’s on Google Drive” until restart | Trace first-connection catch-up, repository lease/yields and timeouts; preserve diagnostics from the *stuck* operation. Later logs included 112 versions/241 objects and a publisher wait lasting hours. **Main reports a distinct, source-fixed empty-device case:** when upload was skipped because there was nothing local, the automatic look at Drive was also skipped (`tests/integration/backup/automatic-provider-backup.mjs`). That main-side fix has **not** been ported here; the original data-bearing iPad freeze may have a different cause. |
| **6** | The sync progress bar remained at a short stationary segment | Investigate with #4: did progress stop, events fail to reach UI, or Safari fail to animate? Show genuine indeterminate activity when no percentage is measurable. |
| **9** | Drive/Device Folder “Recheck” seemed inert; completed scans did not appear in status | Trace verified scan completion, preemption and retry: a Drive scan checked 38/38 but did not update `completedAt`; Device Folder yielded at 4/20. New phone observation on main: Drive verification remained `running` with 0/0 checked for 58 seconds, then across 31 minutes while backgrounded, before yielding. Determine where initial waiting occurs, and distinguish paused/frozen from active progress. |
| **11** | Browser storage estimate appeared implausible, especially ~4 GB on mobile | Current display uses `navigator.storage.estimate().usage` (whole-origin browser estimate, possibly rounded/padded), not measured Study Director data. On the affected device compare measured IndexedDB, OPFS attachment/scratch and app caches against the estimate. A real 4 GB suggests orphaned data; a padded estimate calls for clear labeling, not fabricated precision. |

| **12** | Drive cleanup starts but does not finish on busy/mobile devices | Main's phone logs: ~200 versions took over one minute to inventory; two cleanup attempts yielded to higher-priority sync/upload before deleting anything (after ~0.6 s and ~65 s). Measure on an open laptop first; if still meaningful, resume safe verified inventory/cleanup work rather than re-listing everything after each yield. Do not bypass publication/abort safety. |
| **13** | Bring-in repeated its safety upload despite no user edits | After a mobile site-data clear, automatic add-missing uploaded a Before-restore safety version, detected local mutation during its ~17-second upload, safely aborted and retried with a second safety upload. Identify the local writer and verify whether this remains a real issue for nonempty devices. Main reports that **empty devices now skip** that safety upload; that implementation has not been imported into this branch. Never relax the change-during-restore fence merely to save requests. |
| **14** | Small Drive backups are slow on phone; catch-up repeated downloads | Main observed ~1–4 seconds per request, roughly six sequential requests for a ~10-KB upload (~15–20 seconds), and repeated download of eight unchanged files after bring-in. Profile and collapse redundant requests/read-back where verifiably safe; reuse already verified state and parallelize only independent work with bounded concurrency. Preserve atomic publication, cancellation, privacy and recovery guarantees. |

**#15 — mobile background execution (constraint, not a pending coding fix):** An iPhone/iPad backgrounded PWA can be frozen. A verification appearing “running” for 31 minutes may have done no work. Device Folder permissions need the open page, and existing short-lived Drive authorization does not create a reliable closed-app sync service. The owner has **not approved** a new background server or service; show paused/interrupted status accurately and let an open device complete shared cleanup. Verify actual platform behavior before making broader promises.

Previously reported **#7** (safe-area/notch layout) and **#8** (retired Verification wording) were marked source-fixed; real visual confirmation remains appropriate. **#10** (Drive versions retained too long behind an abandoned upload marker) was source-fixed using renewing markers and bounded stale cleanup; verify retention on real connected devices. It remains worth measuring whether a running study session needs to publish a full version about every two minutes.

## New main-side programme and acceptance decisions (documentation intake only)

Main's 2026-11-04 notes set an **investigation and design direction**, not an implemented replacement: prioritize handoff latency, then incremental sync speed; measure Drive's round-trip overhead before changing repository topology. Preserve whole-version verified publication and resumable content-addressed attachments, which may be up to 300 MB. Evaluate shared history versus per-device streams per data kind; smaller fields, plans and individual Notes could eventually use a well-defined merge-by-design approach, while Saved Days scale to thousands and attachments remain chunked. A possible CRDT/per-record approach is a future **explicit product/contract decision**; do not implement speculatively during these bug passes. Device Folder remains within scope of any later backup-machine review. Full source: [main backlog at 919a6980](https://github.com/oneshubhamt/study-director/blob/919a6980f27b9c216d6a5dddcb4bbbcff100493b/docs/backlog.md#owners-requirements-for-the-new-backup-machinery-2026-11-04).

**Scheduling discrepancy to preserve:** Main proposes bug investigation from 2026-11-07 and then resuming the test programme, while the earlier `bug-fixes` notes defer test-programme step 4 until about 2026-11-10. Do not silently change the owner's pause; clarify when step 4 is authorized. No source or test cherry-pick has occurred.

## Future constructive branch integration — not begun

**Only after explicit approval:** create a **new integration branch from updated `main`**, inspect exact code/doc/test differences and transfer the still-needed #1/#2/#3/#5 improvements **one logical correction at a time**, adapting each to newer `main` work. Preserve correct main-branch fixes, new reported bugs, new test coverage and useful documentation. Add missing regression cases, run targeted and broader QA, and propose review before any merge to `main`. Do not blindly cherry-pick, overwrite newer source, or assume an earlier green run certifies the combined code. **Neither branch's application code is being changed as part of this documentation cleanup.**

## Other outstanding owner requests

- **Test consolidation:** [Test programme](test-programme.md) is the single active plan. Steps 1–3 were recorded complete; step 4 (backup/storage) and subsequent work were paused until about **2026-11-10**. Inspect actual tests and any separate `main` progress before resuming.
- **First-start Drive join:** offer known Drive profile/library discovery before asking for a new local name. The existing initial form can already join and recover settings, but true connection-first discovery is not built.
- **First sync on real iPad:** confirm data arrival and understandable Connect-card feedback, not only mock sync.
- **Further report-only audits:** another backup audit, second background-services audit, Notes-system audit and whole-app CLEER review. Include startup/tab/Library/Insights/typing performance on throttled hardware, long-session memory, CPU, battery and heat.
- **Backup architecture/speed review:** verify incremental upload/download, all-or-nothing publication and restore, Drive backup then restore speed, Device Folder speed, and Compare single-owner Continue Here with near-live multi-device sync under local-first/no-server/short-lived Drive authorization requirements. Propose measured changes first.
- **Notes UX:** enlarge/zoom/pan images and review discoverability of tags, links and other features before designing an interface change.
- **Migration/footprint:** retire compatibility only after Format Cleanup readiness on all used devices. Minified distribution/Wordgard footprint work is deferred pending measurement and full verification.

## Decided, not yet scheduled

- Better `mergeThreeWay` Smart merge: owner will return to it; do not preemptively redesign.
- Mathematics in Notes and code formatting: later.
- Browser data-at-rest encryption, E2EE, sign-in-first recovery, password changes/recovery: future explicit security programme.
- Fully silent closed-app sync would need a server/authorization model; current accepted design uses an open app during short-lived Drive sign-in windows. The short-lived browser-stored Drive token is an accepted, documented trade-off.
- Large-library restores, real Drive maintenance planning with paginated inventories and duplicate checkpoint-capture optimizations: measure before changing.
- Large orchestration modules are not refactor targets by size alone. Remove only proven dead/duplicated logic with regression checks.
- `backup-encryption` browser test must run isolated under load ([browser reliability rules](../tests/README.md#browser-test-reliability)).
- The unregistered `study-director.backup-operation-diagnostics.v1` sessionStorage key should be assessed within the storage-key contract before any schema change.

## Noted for later

Do not introduce CRDTs, parallel backup/sync authorities, new durable queues or universal clocks solely to close an old audit ledger. Past BF-C passes are implementation history, not additional required passes.

## Not yet checked

Fast-suite and simulated provider tests **cannot** certify:

- **Cross-device:** real A→B→A session, D→D+1 saved-day convergence, genuine unsaved divergence, nullable/edited independent drafts, Continue Here interruptions, repeated Kept Versions and replicated tombstones.
- **Providers/storage:** live Drive sign-in, large/interrupted/paginated transfers and retention; Device Folder grant/revoke/regrant; cancelled restore with Before-restore safety, storage clear/recovery, quota pressure, verified external backup restoration.
- **Platform/UX:** desktop Chromium; actual Mac Safari; installed Android PWA; iPad/iPhone Safari; safe areas, narrow full-text dialogs, accessible keyboard/screen reader, status indicator and sounds, update/suspend/relaunch and OPFS cleanup behavior.
- **Operational:** measured browser vs app storage, long-session resource usage, power-loss recovery only with disposable profiles and independently verified backups.

See [Workflow](workflow.md#real-device-acceptance) and [tests/README](../tests/README.md). Keep hermetic, browser and physical results separate and date/source-bound.
