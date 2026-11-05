# Backlog

This is the **current work register**, not an implementation journal. Current contracts are in [area documentation](README.md), detailed testing plans in [test-programme.md](test-programme.md), and the BF-1/BF-2/BF-C1–C8 implementation ledgers and earlier audit receipts remain in [Git history](https://github.com/oneshubhamt/study-director/blob/788a548e335e5f6ca83334efc1b0f1c76ea3059c/docs/backlog.md). Source code, not an old completion claim, is authoritative.

**Branch checkpoint (2026-11-05):** `bug-fixes` source revision [77080fdf](https://github.com/oneshubhamt/study-director/commit/77080fdfcbbf7b6b3632416f6c56a654162bbb88) passed [Repository Checks 42057139422](https://github.com/oneshubhamt/study-director/actions/runs/42057139422): 157 fast-suite files, PWA contract, source build and generated verification/syntax. These are **not** current-revision browser, physical-device or real Drive certifications. `main` has independent subsequent progress and has **not** been compared or integrated in this documentation pass.

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

Owner reports from 2026-11-03. **Re-check both branches before assigning a fresh implementation status.**

| # | Report | Required investigation |
| --- | --- | --- |
| **4** | First iPad Drive connection stayed at “Bringing in what’s on Google Drive” until app restart | Trace live first-connection catch-up, renewal, repository lease/yields and timeouts; retain diagnostics from the stuck operation. Prior logs included Drive cleanup listing 112 versions/241 objects and prolonged publisher wait. |
| **6** | The sync progress bar remained at a short stationary segment | Investigate with #4: did progress stop, events fail to reach UI, or Safari fail to animate? Show genuine indeterminate activity when no percentage is measurable. |
| **9** | Drive/Device Folder “Recheck” seemed inert; completed scans did not appear in status | Trace verified scan completion, preemption and retry. An earlier Drive scan checked 38/38, but the displayed completion timestamp did not update; Device Folder yielded at 4/20. Clarify what each button measures. |
| **11** | Browser storage estimate appeared implausible, especially ~4 GB on mobile | Compare coarse `navigator.storage.estimate()` with separately measured app IndexedDB, OPFS attachments/scratch and caches on the actual affected device. Differentiate browser padding from leaked bytes before changing the label. |

Previously reported **#7** (safe-area/notch layout) and **#8** (retired Verification wording) were marked source-fixed; real visual confirmation remains appropriate. **#10** (Drive versions retained too long behind an abandoned upload marker) was source-fixed using renewing markers and bounded stale cleanup; verify retention on real connected devices. It remains worth measuring whether a running study session needs to publish a full version about every two minutes.

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
