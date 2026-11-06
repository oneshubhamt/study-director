# Backlog

This is the **current work register**, not an implementation journal. Current contracts are in [area documentation](README.md), detailed testing plans in [test-programme.md](test-programme.md), and the BF-1/BF-2/BF-C1–C8 implementation ledgers and earlier audit receipts remain in [Git history](https://github.com/oneshubhamt/study-director/blob/788a548e335e5f6ca83334efc1b0f1c76ea3059c/docs/backlog.md). Source code, not an old completion claim, is authoritative.

**Branch parity audit (2026-11-06):** Compared `main` at [919a6980](https://github.com/oneshubhamt/study-director/commit/919a6980f27b9c216d6a5dddcb4bbbcff100493b) with `bug-fixes` at [c826fec1](https://github.com/oneshubhamt/study-director/commit/c826fec189582840a5a55e9df355578051151e41). Main has 10 independent commits changing exactly two production modules; those fixes are already integrated on `bug-fixes`, with stronger restore safeguards. [Repository Checks 42086364608](https://github.com/oneshubhamt/study-director/actions/runs/42086364608) passed 157 fast-suite files and build/deployment checks. Browser and real-device acceptance remain open. File-by-file status: [integration ledger](MAIN_TO_BUG_FIXES_LEDGER.md).

## Source-verified fixes awaiting browser and device acceptance

| Original report | Current source-level disposition on `bug-fixes` | Unfinished acceptance/decision |
| --- | --- | --- |
| **#1** Continue Here unexpectedly opens Plan editing | Corrected; applied schedule and separate authoring draft retain independent state | Real A→B→A handoff, restored/suspended/previous-day Plan display, Cancel/Done and browser visuals |
| **#2** Repeated “earlier day unsaved” notices after saving on device B | Canonical Day evidence, same-lineage acknowledgments, retained divergence, unfinished Practice Pacer and the **24-hour active-unit cap** are covered in source; verified former-owner claims now permit retirement of **positively covered post-handoff focus**, rechecked after final yield | Actual next-day reconnection, same-date divergence, interrupted/failed storage and no false reminder |
| **#3** Kept Versions appears repeatedly and explains too little | Field-level ancestry, semantic Saved Plan meaning/order, repeated alternative convergence, replicated resolution receipts, full Plan-draft/Saved Plan comparisons corrected | Real provider/visual counts and choices, absent-Note recovery and **authoring device attribution** |
| **#5** Plan draft disappears after session transfer | Draft is settled and canonically verified before a narrow Active Session ownership claim; session application does not persist the draft | Never-authored/empty/edited local draft, pending/failed write, interrupted ownership handoff on real devices |

**2026-11-05 focused source correction:** [a570b60](https://github.com/oneshubhamt/study-director/commit/a570b60da60c696fa3a56b1f7d271bc42b9594cf) shares one checkpoint-Day coverage proof between the original claim-aware decision and post-yield recheck. [Repository Checks 42071843915](https://github.com/oneshubhamt/study-director/actions/runs/42071843915) passed 157 fast-suite test files and build/deployment/syntax gates, including active-owner, ended-owner, shorter-Day and uncovered-final-tick scenarios. Physical cross-device Drive acceptance is still open. No schema, ownership claim or review format changed.

**Unmet product details for #3:** A retained Note alternative may contain only a changed field mask, so it cannot safely recreate a missing complete Note; keep it available or restore the original from Recently deleted before comparison. `PendingReview.v1` does not record which installation **authored** an alternative or a precise typed conflict reason. The retained timestamp and publishing device cannot supply that identity. Adding versioned provenance requires explicit approval, not fabricated metadata.

**Source owners:** `source/core/plan.js`, `source/app.html`, `source/core/review.js`, `source/core/record-codecs.js`, `source/core/practice-pacer.js`, `source/core/backup.js`, `source/core/backup-provider.js`, `source/core/interactions.js`, `source/core/reconciliation-baseline.js`, `source/core/reconciliation-ui.js`, and the existing repositories. The durable rules are in [Study session](areas/study-session.md) and [Backup and sync](areas/backup-and-sync.md). No parallel save, ownership, notification or merge engine is justified.

## Other reported bugs and follow-up investigations

Owner reports from 2026-11-03, augmented by [main's issue register](https://github.com/oneshubhamt/study-director/blob/919a6980f27b9c216d6a5dddcb4bbbcff100493b/docs/backlog.md) (observations on 2026-11-04). The statuses distinguish source-level fixes from unverified physical-device outcomes; source-level parity was checked on 2026-11-06.

| # | Report | Required investigation |
| --- | --- | --- |
| **4** | First iPad Drive connection stayed at “Bringing in what’s on Google Drive” until restart | Trace first-connection catch-up, repository lease/yields and timeouts; preserve diagnostics from the *stuck* operation. Later logs included 112 versions/241 objects and a publisher wait lasting hours. **The separate empty-device case is now corrected on `bug-fixes`:** when upload is skipped because there is nothing local, convergence still reads Drive and either brings in its newer version or records that Drive is in sync (`tests/integration/backup/automatic-provider-backup.mjs`). The original data-bearing iPad freeze may have a different cause and remains unverified. |
| **6** | The sync progress bar remained at a short stationary segment | Investigate with #4: did progress stop, events fail to reach UI, or Safari fail to animate? Show genuine indeterminate activity when no percentage is measurable. |
| **9** | Drive/Device Folder “Recheck” seemed inert; completed scans did not appear in status | Trace verified scan completion, preemption and retry: a Drive scan checked 38/38 but did not update `completedAt`; Device Folder yielded at 4/20. New phone observation on main: Drive verification remained `running` with 0/0 checked for 58 seconds, then across 31 minutes while backgrounded, before yielding. Determine where initial waiting occurs, and distinguish paused/frozen from active progress. |
| **11** | Browser storage estimate appeared implausible, especially ~4 GB on mobile | Current display uses `navigator.storage.estimate().usage` (whole-origin browser estimate, possibly rounded/padded), not measured Study Director data. On the affected device compare measured IndexedDB, OPFS attachment/scratch and app caches against the estimate. A real 4 GB suggests orphaned data; a padded estimate calls for clear labeling, not fabricated precision. |
| **12** | Drive cleanup starts but does not finish on busy/mobile devices | Main's phone logs: ~200 versions took over one minute to inventory; two cleanup attempts yielded to higher-priority sync/upload before deleting anything (after ~0.6 s and ~65 s). Measure on an open laptop first; if still meaningful, resume safe verified inventory/cleanup work rather than re-listing everything after each yield. Do not bypass publication/abort safety. |
| **13** | Bring-in repeated its safety upload despite no user edits | After a mobile site-data clear, automatic add-missing uploaded a Before-restore safety version, detected local mutation during its ~17-second upload, safely aborted and retried with a second safety upload. Identify the local writer and verify whether this remains an issue for nonempty devices. **The empty-device optimization is integrated:** unresolved Kept Versions block it, unknown reads cannot authorize it, and both the initial revision and emptiness are rechecked in final quiescence. Ordinary preferences are excluded; nonempty or uncertain devices still require verified safety. Real-device acceptance remains open. |
| **14** | Small Drive backups are slow on phone; catch-up repeated downloads | Main observed ~1–4 seconds per request, roughly six sequential requests for a ~10-KB upload (~15–20 seconds), and repeated download of eight unchanged files after bring-in. Profile and collapse redundant requests/read-back where verifiably safe; reuse already verified state and parallelize only independent work with bounded concurrency. Preserve atomic publication, cancellation, privacy and recovery guarantees. |

**#15 — mobile background execution (constraint, not a pending coding fix):** An iPhone/iPad backgrounded PWA can be frozen. A verification appearing “running” for 31 minutes may have done no work. Device Folder permissions need the open page, and existing short-lived Drive authorization does not create a reliable closed-app sync service. The owner has **not approved** a new background server or service; show paused/interrupted status accurately and let an open device complete shared cleanup. Verify actual platform behavior before making broader promises.

Previously reported **#7** (safe-area/notch layout) and **#8** (retired Verification wording) were marked source-fixed; real visual confirmation remains appropriate. **#10** (Drive versions retained too long behind an abandoned upload marker) was source-fixed using renewing markers and bounded stale cleanup; verify retention on real connected devices. It remains worth measuring whether a running study session needs to publish a full version about every two minutes.

## Main-side investigation and future-design decisions (not a new implementation contract)

**Parity intake:** The original `main` analysis and user requirements are retained below, including numeric observations, proposed alternatives, per-data-kind requirements and the recorded work order. These describe exploratory options and expectations, **not completed designs or proven runtime guarantees**. The current `bug-fixes` implementations and their stricter safety invariants remain authoritative; no new CRDT, server, sync engine or queue was authorized by this intake.

### First look at items 1 and 4 (2026-11-04, from the phone's diagnostics)

- **Upload markers after bug 10.** A running upload refreshes its marker every 2 minutes, alongside the upload; a marker unrefreshed for 15 minutes is dead (closed or frozen page) and cleanup removes it. A long upload (a large attachment, 20 minutes or more) stays live because it keeps refreshing. One frozen over 15 minutes stops before its commit; next time it reuses the pieces already on Drive (unused pieces are kept 48 hours). Since PR #15 a short upload pays nothing extra: the renewal before the commit runs only when one is due, and the marker check was always there.
- **Why Drive is slow.** Request count, not data size. Each Drive request takes 1–4 s on the phone and an upload makes about 6 in a row, so a 10 KB upload takes 15–20 s. Handoff waits on the same steps.
- **What the design already gets right.** Data is split into pieces named by their fingerprint, like a torrent's. Only changed pieces move, every piece is checked on arrival, uploads resume by reusing pieces already there, big files go in resumable chunks, 8 pieces move at once, and a version exists only once complete. Safe, and it never loses data.
- **Where it is heavier than it needs to be.** All devices write into one shared history, so they need turns: upload markers, refusals when Drive moved on, the heartbeat, and cleanup that must step around live uploads. Most of the complexity and many of the round trips come from that. The whole library is also small (the phone's version was 8 pieces, about 12 KB), so round trips, not bytes, are the cost.
- **Options, cheapest first:**
  1. Fewer requests on today's design: make one file both the version and its commit, bundle a version's small pieces into one file (like git's pack files), ask Drive only for what changed since the last look (its changes list), and run independent steps together.
  2. One stream per device: each device writes only its own files, and the others read and merge them. No device ever waits for another, so markers, turns and most of the cleanup coordination go away; an upload becomes one or two requests.
  3. Merge by design (CRDTs, as in Automerge, Yjs or Loro): devices exchange small change records that are guaranteed to merge the same way everywhere, notes merged character by character. Fewer "kept for review" items (bug 3), and live sync (item 2) becomes possible. The largest change: the editor's text and the stored formats would move to it.
  4. Not worth it here: content-defined chunking (attachments rarely change in place) and devices talking straight to each other (needs a server to introduce them, against the no-server rule).
- **Suggested path:** measure, do option 1, then decide between 2 and 3 with the owner.

### Owner's requirements for the new backup machinery (2026-11-04)

A redesign must fit each kind of data, not one rule for all. Likely a fusion: merge-by-design (CRDT) records for small data, and today's fingerprinted-piece repository for large files. Settle per kind whether data lives in a shared history or in one stream per device.

| Data | Expected size | Needs |
|---|---|---|
| Settings, plans, review records | Small | Merge automatically (CRDT or per-record merge). |
| Active Session | Small, changes often | Fast handoff between devices: the biggest pain today. |
| Notes | Many notes, some large | Merge per note (one CRDT document per note, not one for all), and sync only the notes that changed. |
| Saved Days | 1,000–2,000 or more | Past days rarely change: store them in parts (per day or month), and sync only what changed. Never re-send the whole history. |
| Attachments | Up to 300 MB (a PDF) | Upload and download in pieces, pausable and resumable, including after the app closes or reloads. An interrupted upload from the same device never starts again from zero. Keep the fingerprinted repository for these, referenced from the records by fingerprint. Check how far today's resumable chunks survive a reload. |

- **Device Folder** uses the same machinery. It takes 2–3 s today: faster is welcome but not a concern.
- **Goals, in order:** handoff speed, then sync speed, sized to the data actually saved.

### Order of work (from Saturday 2026-11-07)

1. Bug hunting: the open bugs above, the major ones first.
2. Test suite refinement: resume [test-programme.md](test-programme.md) at step 4a.
3. The new backup machinery: the options and requirements above, Device Folder included.

**Schedule reconciliation:** Main's later 2026-11-04 instruction begins the bug hunt on 2026-11-07 and places test-programme step 4a afterwards. The earlier `bug-fixes` note deferred that programme until approximately 2026-11-10. Both are planning context, not authorization to resume it automatically. Bug corrections and this source-parity audit have proceeded independently.

## Constructive main → bug-fixes integration

The source-level disposition for all 10 independent `main` commits from merge base `56b0ada6` through `919a6980` is recorded in [the integration ledger](MAIN_TO_BUG_FIXES_LEDGER.md). **Working branch: `bug-fixes` only.** Both main-only production modules are reconciled; the three substantive changes are incorporated surgically:

- Drive publication markers: omit a redundant renewal for a short upload, retaining the authoritative before-commit marker check, existing heartbeat and removal rejection. Regression: `tests/integration/backup/repository-checkpoint.mjs`.
- Empty-device Drive sign-in: inspect remote history even though automatic publication is skipped; preserve `ancestryPending`, unresolved review and other newer `bug-fixes` sync safeguards. Regression: `tests/integration/backup/automatic-provider-backup.mjs`.

- Empty-device Before-restore shortcut: unresolved Kept Versions block the skip, failed reads stay unknown, and the managed coordinator rechecks the revision and empty state immediately before applying; nonempty or uncertain restores still require a verified safety checkpoint. Tests: `tests/unit/backup/managed-recovery.mjs` and `tests/integration/backup/repository-restore.mjs`.

The other `main` progress is documentation/QA analysis or future design exploration, and is retained without duplicating a backup engine. Bugs #1/#2/#3/#5 stay owned by `bug-fixes` production source and its existing tests. No release/deployment workflow or `main` ref is changed.

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
