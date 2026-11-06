# Main → bug-fixes: constructive integration ledger

**Verified source refs (2026-11-05):** main `919a6980f27b9c216d6a5dddcb4bbbcff100493b`, bug-fixes before integration `ef65bcd2ce18b41baabc8683888fc57c5e213cfe`, merge base `56b0ada6df7dae3d5307f305a34025a2d1ed52a2`. The merge base was obtained from GitHub's two-way commit comparisons. Main has 10 independent commits; bug-fixes has 370. A direct source comparison found two altered main production modules: `backup-provider.js` and `managed-recovery.js`. The newer release identity on bug-fixes (SDVB75F23 vs main's F22) is retained.

**Scope:** this is a disposition record for the independently added main changes, not a claim of real-device verification, a merge of branches or a new programme. Current contracts live in [Backup and sync](areas/backup-and-sync.md), [Study session](areas/study-session.md) and [Background jobs](areas/background-jobs.md); open acceptance lives in [Backlog](backlog.md). All writes in this integration target `bug-fixes`; main is read-only.

## Independent main commits and dispositions

| Main commit | Source-level change / value | State of bug-fixes before integration | Decision, regression risk and proof |
| --- | --- | --- | --- |
| `f9878423` | On an empty device, Drive sign-in must run a remote inventory even when automatic upload is skipped. Avoids a Connect-card stall. | Automatic upload correctly skipped empty data; convergence did not independently inspect the remote head in that case. Stronger ancestry safeguards already existed. | **Adapted** into `backup-provider.js` with existing `sync.ancestryPending` checks kept. Added fake-clock empty-device remote-history and empty-Drive assertions in `automatic-provider-backup.mjs`. Verify live phone/iPad separately. |
| `b82b03de` | Records that the observed phone failure followed site-data clearing, while data-bearing iPad issue may differ. | The bug-fixes backlog already describes the separate phone and iPad cases. | **Consolidated** into bug #4 without asserting that the iPad freeze is fixed. |
| `418c6767` | Merge of PR #14, carrying the previously listed empty-device fix and related work. | No additional standalone production change beyond the commit comparison. | **Covered by the source-level disposition above**; do not merge its history wholesale. |
| `a5a09f15` | Suppress redundant before-commit marker renewal for short Drive uploads. Also skip protected Before-restore safety creation when `automaticHooks.ready()===false`. | Heartbeat, stale-marker rejection, protected Before-restore checks and managed rollback already worked; marker renewal made a needless request. | **Split by invariant.** Adopt timed renewal/marker assertion and short/long/removed-marker regressions in `repository-checkpoint.mjs`. **Later approved and adapted** the empty-device safety shortcut, retaining proof and final revision checks (see below). |
| `60967f82` | Merge of remote-tracking main changes within the refactor branch. | The net changes are already represented by the compared file set. | **No independent transfer**; avoid redundant historical merge machinery. |
| `d75005d2` | PR #15 merge from background-coordination. | Marker, cleanup and other repository machinery already had separately evolved bug-fixes source. | **No blanket transfer**; compare net resulting code, retain bug-fixes safeguards. |
| `7e4ee328` | Analysis of Drive request latency, upload coordination, shared history, repeated downloads. | Bug-fixes backlog already imports those observations and later-design constraints. | **Retain as open, measurement-led work**, not an unverified architecture rewrite. |
| `57af7d6a` | PR #16 merge of prior main-side developments. | No additional independently introduced production files in the net diff. | **No separate cherry-pick**; individual changes assessed above. |
| `1f73f82a` | Design requirements: data-kind-sensitive sync, very large resumable attachments, local-first/no-server, performance prioritization and possible CRDT alternatives. | The backlog already records the direction and deliberately leaves the new architecture undecided. | **Documentation retained**, architecture proposal deferred pending contract approval and measured evidence. No speculative CRDT, queue or secondary engine. |
| `919a6980` | PR #17 merge of the design requirements. | No further independently changed production source. | **Covered by documentation disposition.** |

Other main-only files: `docs/areas/backup-and-sync.md`, `docs/backlog.md`, `docs/test-programme.md`, `release.config.mjs`, and tests `automatic-provider-backup.mjs`, `repository-checkpoint.mjs`, `managed-recovery.mjs`. Current main-side Bug #12–#15 findings were already in the bug-fixes backlog; their live-device acceptance remains open. Main's test-programme scheduling change does not override the existing pause.

## Source re-audit: 2026-11-06

A fresh two-way GitHub comparison confirmed main `919a6980f27b9c216d6a5dddcb4bbbcff100493b`, bug-fixes `c826fec189582840a5a55e9df355578051151e41` and merge base `56b0ada6df7dae3d5307f305a34025a2d1ed52a2`. Main remains 10 commits ahead of that ancestor, bug-fixes 375. **Main has exactly nine net-changed files and only two production modules relative to the shared ancestor.** No further unassessed main-only production fix was found.

| Main-only changed file | Current disposition on bug-fixes |
| --- | --- |
| `source/core/backup-provider.js` | Publication-heartbeat optimization; empty-device Drive discovery and ancestry; verified-empty restore shortcut all integrated and tested, with stronger safeguards than main |
| `source/core/managed-recovery.js` | Empty-device skip accepted only with an explicit final emptiness proof and revision fence; normal verified-safety path unchanged |
| `tests/integration/backup/automatic-provider-backup.mjs` | Main's empty-device/empty-Drive scenarios incorporated; newer ancestry and other cases preserved |
| `tests/integration/backup/repository-checkpoint.mjs` | Short-upload marker, long renewal and removed-marker assertions incorporated |
| `tests/unit/backup/managed-recovery.mjs` | Main's positive empty skip and invalid skip tests covered by stronger final-empty/revision/failed-read assertions |
| `docs/areas/backup-and-sync.md` | Both main policy changes incorporated and clarified with stricter actual safety contract |
| `docs/backlog.md` | All 15 reported items, phone log additions, detailed latency/design alternatives, five data-kind requirements and work order reconciled; broken table rows #12–#14 repaired |
| `docs/test-programme.md` | Later 2026-11-07 bug-hunt-first instruction reconciled with earlier approximately 2026-11-10 pause; no automatic resumption |
| `release.config.mjs` | Main's `SDVB75F22` intentionally not copied over the newer `SDVB75F23` on bug-fixes; release identity is not a missed production fix |

Shared-ancestor fixes #7 (safe-area insets), #8 (Verification copy) and #10 (renewing stale-marker cleanup) are already present on bug-fixes; they are **not** additional main-only commits. Source ownership and test evidence for #1/#2/#3/#5 extend beyond main. [Repository Checks for the audited source revision](https://github.com/oneshubhamt/study-director/actions/runs/42086364608) passed 157 fast-suite files and PWA/build checks. This does not certify real Drive, Safari, multi-device or physical-device behavior.

The integration intentionally does **not** merge histories, overwrite the branch with main, roll back the release number or import speculative backup architecture. The current backlog is the canonical status register; the copied source observations there remain explicitly identified as observations/proposals.
## Approved empty-device safety optimization

The original `main` shortcut did not inspect unresolved Kept Versions or retain the final revision check. The approved `bug-fixes` implementation uses the existing recovery coordinator and local rollback journal, with these safeguards:

- Positive emptiness requires no Saved Days, Notes, Active Session, Plans, attachments or unresolved PendingReview. Preferences and disposable caches do not block the shortcut.
- Failed storage reads remain unknown, not empty. Unknown or nonempty data retains the normal verified external safety checkpoint.
- The provider's explicit final `verifyEmpty` callback is required to accept an empty-device result. Inside final quiescence, both the initial revision (even if blank) and emptiness are rechecked; a change or failed recheck prevents local apply.
- Existing data formats, backup publication and synchronization ownership are unchanged.

Tests: `tests/unit/backup/managed-recovery.mjs` checks positive skip, missing proof, changed revision and failed recheck; `tests/integration/backup/repository-restore.mjs` exercises provider restore. Real Drive and mobile-device acceptance remain open.

## Protected bug-fixes logic and acceptance gates

- **#1 / #5:** Active Session application does not overwrite a separately saved Plan draft. Plan Done/Cancel authoring and pending saves remain governed by their own revision and strict-write semantics.
- **#2:** Same-lineage, content-evidence-based Saved Day retirement; the post-yield final-session evidence is rechecked before retiring an owner. No timestamp-only dismissal.
- **#3:** Field-level note/Plan alternatives, replicated resolution receipts, complete Save Plan comparisons and strict review fencing. An empty-device optimization must not discard PendingReview records.
- **Repository:** no unverified publication, no deletion of a live upload's referenced immutable data, and no skipping an external safety version without a positive empty-state proof and final recheck.
- **Testing:** new short-upload heartbeat coverage; fake-clock empty-device catch-up coverage; rejection coverage for unsupported safety bypass and the empty-device restore. The existing sync/shared-base, repository restore, managed-recovery, session-claim, Saved Day and Plan tests remain intact.
- **Outside automated certification:** actual connected Drive, Device Folder permissions, iPhone/iPad Safari, Mac Safari, two-device handoff, site-data clearing with real backups and real-device restore. These remain in the backlog.

**Quality evidence:** GitHub Repository checks for each source push are the available remote fast-suite/build gate. The Promotion QA workflow is manually dispatched and is not implicitly run by a push. Do not describe either as passed until its actual workflow result is observed.
