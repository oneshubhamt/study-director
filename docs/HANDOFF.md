# Handoff — paused 2026-10-06

Work stopped part-way through moving the Device Folder onto the shared backup engine. This note says exactly where things stand, what is left, what the wider programme is, and what has been done so far on this branch (`refactor/background-coordination`, draft PR #1).

**The latest commit is a work-in-progress save.** The build passes and most suites pass, but 17 fast tests still fail because they assert the old Device Folder design or need rewriting (listed in 1.3). CI on the PR will be red until 1.3 is finished.

---

## 1. In progress: the Device Folder becomes one location of the backup engine

Goal (task #39, `docs/BACKUP-ENGINE.md`): one engine (`source/core/backup-provider.js`) does every backup operation for every location; each location only supplies storage access. Drive already worked this way. The Device Folder had its own ~1,000-line copy of the same machinery (`device-backup.js`, 113 KB), with its own scheduler, locks, publication, cleanup, integrity, history and restore.

### 1.1 Done in the WIP commit

**Engine (`source/core/backup-provider.js`)**
- `automaticBaseline` on a location: the change time from which it backs up on its own. The Device Folder uses it (from when it was chosen); Drive does not (it starts after this device first backs up to it).
- Start-up guard: a waiting change found on start or reconnect (before any edit in this session) is backed up only while local data is present (`configureAutomaticBackup({ready})`, wired to `canonicalLocalRecoveryEmpty()`), so an emptied browser never becomes a location's newest version. Old Device Folder behaviour, now for every location.
- After a restore, every *other* connected location that backs up on its own is reported in `convergence.others` and backs up when automatic backups resume. Replaces the Device-only `configureConvergencePropagation` hook (deleted).
- `disconnect(id)`, `forget(id)` (drops everything this device holds about a location; backups stay), `locationStatus(id)`, `subscribeStatus(listener)`, `list({hosted:true})`.
- Status listeners are notified on foreground changes, change notices, maintenance and integrity start and finish.
- Wording no longer names Drive in shared messages.

**New Device Folder controller (`source/core/device-backup.js`, rewritten, about 220 lines)**
- Owns only:
  - the chosen folder handle and its permission;
  - remembering the folder (same settings record, v3; `sourceRevision` now means the automatic baseline);
  - its status projection for the Data & Backup row.
- Registers the hosted location `device-folder` with the engine. Its transport is `device-folder-storage.js`, wrapped so a folder deleted outside the app is forgotten cleanly.
- The folder picker and permission prompt open from the click itself, before anything is awaited.
- Connecting:
  - an empty folder gets a first backup straight away;
  - a folder that already holds backups is left as it is (this device's data goes in with its next change, or with Back up now).
- A stored folder that needs permission again shows **one dismissible toast per launch** with "Allow access". This replaced a persistent notice.
- Public API: `install`, `status`, `connect`, `disconnect`, `refreshPermission`, `rememberAfterStorageReset`, `backupNow`, `cancelForeground`. Everything else goes to the engine with id `device-folder`.

**Recovery host (`backup-recovery-host.js`)**
- No Device Folder port any more. Version History, restore, combine, remove-safety and cancel go through the engine for every location.
- A restore pauses automatic backups everywhere through one engine hold.

**App (`source/app.html`)**
- Removed `DeviceRepositoryBackground` and `DeviceRepositoryIntegrity`.
- Device Folder integrity runs on the engine's integrity scheduler (`INTEGRITY_TARGETS`: `device-folder`→`device`, `google-drive`→`drive`). Its identity is the repository scope (`device-folder:1:<id>` from the scope file), replacing the stored directory handle and `isSameEntry`.
- Integrity record now version 6. Versions 3–5 still validate; the old handle field is ignored (`host-metadata.js`). Existing Device Folder scan progress restarts once because the identity changed.
- Change notices, flush on background, waiting check, reminder, update hold and storage-reset hold all go through the engine only. They are no-ops with no locations.
- Clear Library's protected safety copy now goes to the Device Folder, otherwise Google Drive while signed in, otherwise it is skipped as before.
- The missing-data restore after a browser-data clear uses the Device Folder, otherwise any connected location.
- The file-restore port `requestDeviceBackupConvergence` is now `restoredFromFile`. It notes an urgent change and says "Automatic backups will include it shortly." when any location backs up on its own.
- Diagnostics: the 'Device maintenance', 'Device integrity' and 'Device repository' rows are gone. The engine's 'Provider background' rows cover `device-folder` maintenance, integrity and convergence.
- `EXTERNAL_REPOSITORY_IDENTITIES` is declared in the app (a build token).

**Other**
- `device-folder-storage.js`: `renewMaintenance` returns the renewed lease time. **Bug fix:** before this, after 15 s every file call renewed the lock.
- Presentation:
  - a `backingUp` label ("Backing up…");
  - "Allow access" as the Device Folder permission action label;
  - outcome text lists `others`.
- Tests updated and passing:
  - `repository-checkpoint`, `repository-restore`, `checkpoint-handoff`, `restore-assets`, `repository-incremental-preparation`, `backup-persistence`;
  - `repository-integrity-state` (scope identity, v6, legacy handle tolerance).
- Data contract and `ARCHITECTURE.md` text updated for the integrity record.

### 1.2 Behaviour changes to confirm

| Area | Before | Now |
|---|---|---|
| Restoring a Device Folder version | The restored state was marked as backed up; no new version. | Same as Drive: when automatic backups resume, a new version records the restored state, so Latest matches the device. Objects are reused, so it costs one manifest and one commit. It is skipped entirely when the newest version is identical. |
| Long write step | Device-only "taking longer than expected" notice. | Dropped. Reads are bounded (10 s); writes in `device-folder-storage.writeFile` are not. Consider bounded writes (`createWritable`, `write`, `close`) so a stalled sync folder fails instead of hanging. |
| Automatic Device Folder backup | Disabled Back up now. | Shows "Backing up…"; Back up now stays available (a foreground backup preempts the automatic one). |
| Concurrent foreground operations | Device and Drive were independent. | The engine's foreground lock is shared: one at a time across locations; the second returns "busy". |
| Start-up discovery | — | The guard reads local data once per start-up catch-up (records, notes, session, plans, attachments list). |

### 1.3 Remaining to finish the move (in order)

1. **Rewrite `tests/integration/backup/device-backup.mjs`** (96 KB, tests the deleted controller). Build it on:
   - the new controller and the real engine;
   - `device-folder-storage` over `tests/helpers/memory-directory.mjs`;
   - the fake clock, following `automatic-provider-backup.mjs`.

   Carry over the behaviours from the old file's sections:
   - picker cancel is neutral;
   - permission request failures are contained;
   - a stored folder at start-up is non-interactive;
   - reconnect renews permission;
   - an empty folder makes a first backup at once;
   - a folder with backups is not published to on choose;
   - start-up notices data newer than the last backup without waiting for an edit;
   - deleting only the repository subfolder self-heals in the same backup;
   - deleting the chosen folder forgets it and returns to a clean "Choose folder";
   - legacy and unknown files are ignored;
   - Clear Library safety preempts an automatic backup and publishes exactly one protected version;
   - a managed-recovery suspend waits for an in-flight automatic backup to unwind;
   - source changes before or after manifest verification leave no new committed version;
   - a failed commit marker keeps Latest;
   - Versions does not lose the automatic deadline;
   - missing-only restore after a clear uses only a version saved before the clear and never prompts;
   - flush on hide and before an update;
   - the 20-minute cadence, and seconds after key moments;
   - the permission toast appears once per launch and is dismissible.
2. **`folder-encryption.mjs`**: rewrite for the engine. With encryption locked, automatic backups wait (availability `locked`) and a foreground backup fails with a clear message. Unlocking resumes.
3. **`tests/unit/backup/backup-recovery-host.mjs`**:
   - drop the `device` port and `configureConvergencePropagation`;
   - `providers.list` includes `device-folder`;
   - convergence is now `{source, others}`.
4. **`backup-reminder.mjs`**: the reminder uses only `BackupProviderRuntime.automaticActive()`. The test should drive that, not `DeviceBackup.status().connected`.
5. **`application-update-safety.mjs`**: the update hold no longer suspends the Device Folder separately.
6. **`background-diagnostics.mjs`**: expects the old 'Device repository' rows. Point it at the engine's per-location rows.
7. **`notification-lifecycle.mjs`**: its code slice now needs `notifyStatus` (ReferenceError).
8. **Architecture contracts that assert the old design** — update each to assert the new shape:
   - `runtime-boundaries`;
   - `cleer-integration` (also lines 129–137 about device convergence and the file-restore port);
   - `backup-recovery-ux-contract`;
   - `background-work-contract`;
   - `managed-version-history-contract`;
   - `data-architecture` (settings capability);
   - `managed-recovery-contract`;
   - possibly `internal-module-boundary` (`device-backup` no longer takes `repositoryPolicy`).

   The new shape to assert: a thin controller, a hosted engine location, no Device scheduler, no host device port.
9. `suite-policy.mjs` failed when run directly with `node`. Check it under `npm test`; it is probably runner-only.
10. **Browser tests** (`CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`):
    - `tests/browser/backup/pwa-device-backup.mjs`;
    - `restore-session-safety`;
    - `tests/browser/storage/site-data-clear.mjs`;
    - `tests/browser/backup/encryption.mjs`;
    - `tests/browser/exports/exports.mjs`.

    Also run the smoke suite (`npm run test:browser`).
11. **Task #53 — nothing breaks for someone who uses neither the Device Folder nor Drive** (user requirement). Add an integration test with no locations (and one with `showDirectoryPicker` unsupported, so the Device Folder is never registered). It should cover:
    - change notices;
    - flush on hide;
    - `backUpBeforeUpdate` returns at once;
    - the 7-day reminder works;
    - the browser-data-clear hold, and the missing restore returning false so the decision notice shows;
    - `openBackupRestore` opening Data & Backup;
    - Clear Library safety skipped;
    - Version History "no source";
    - diagnostics;
    - no toasts at any point.
12. **Docs**:
    - `BACKUP-ENGINE.md`: steps 2, 3, 4 and 6 are done; step 5 remains (the engine still renders Drive's buttons; move rendering to the host from `locationStatus`).
    - `BACKGROUND-OPERATIONS.md`: the Device rows are now engine jobs.
    - `ARCHITECTURE.md`: the Device Folder sections.
    - `guide.js`: check the help text.
13. Run everything: unit, integration, architecture and browser tests. Then commit, push, and close #39.

Faster local loop: run each fast test in its own process, six at a time, and list failures. `npm test` stops at the first failure. A throwaway runner script was used in the session scratchpad; recreate it from this description.

---

## 2. Remaining from the rest of this work

- **The user's audit request.** After the move, audit all three backup mechanisms again (file, Device Folder, Drive) and the shared machinery, optimise, and report.
- **#45 Drive/Device performance and reliability review** (open). Candidates:
  - bounded writes in `device-folder-storage`;
  - plain-text history sidecars so Device Folder history shows summaries while encryption is locked;
  - fewer Drive metadata round trips on history;
  - measure a 1,000-version, 50,000-object repository (list, history, cleanup).
- **#46 incremental structured restore** (pending). Judged low value because text data is small; attachments are already reused locally. Close with that reasoning unless measurements say otherwise.
- **Intermittent flake** in `tests/browser/storage/site-data-clear.mjs`: "AbortError: The transaction was aborted", seen once. Not investigated.
- **Engine step 5:** the host renders every location's controls from `locationStatus`; the engine stops touching DOM buttons.

---

## 3. The wider programme (user's direction)

The aim is a machine that works every time: cohesive, bounded, lean and fast, with flexibility built in. There are three strands.

### 3.0 How we proceed (agreed 2026-10-06)

**Philosophy.** The app is clean, lean, efficient, elegant and reliable. No extravagant or unnecessary features. Everything works rock solid within the range it is meant for. Do the simple things very well; do not over-engineer.

**Order, and when the session ends.**
1. Finish refining the backup system to its best shape (section 1, then section 2).
2. Audit it and report to the user what I think.
3. Hold a brainstorming session with the user to understand how to improve notes. Discuss first; build only after agreement.
4. Then the background services (3.3).
5. The session concludes only once all three — backup, notes, background services — are as good as we can reasonably make them.

**No upfront analysis.** Do not spend effort analysing or planning the notes and background-service phases until we reach them. The suggestions below are a starting list for those discussions, not a plan.

### 3.1 Notes as a first-class system

**Decided: no separate local version history for notes.** Earlier versions of a note come from the backup versions in the Device Folder and Google Drive. Retention is Latest, six daily, four weekly and four monthly, so about four months of history. Together with undo and redo in the editor and Recently deleted (30 days), that is enough for realistic use.

Accepted limits:
- Earlier versions from the same day are not kept. The user considers this insignificant.
- Someone who uses neither the Device Folder nor Drive has no earlier versions; that is their choice.
- Standalone backup files are not a source of note versions.

**No annotation features** (PDFs, audio, photos). Not needed.

**What earlier versions should feel like** (refine the existing single-note restore; do not add a new system):
- Opening a note's earlier versions shows simple, plain-time choices: "3 days ago", "2 weeks ago", "a month ago".
- No backup machinery shows: no locations, checkpoints, tiers or other jargon. The person should not need to know how backups work, or even that versioning is happening.
- Choosing a version opens the same note review used when a restore finds a note that differs. From there the person can keep parts of the newer note, merge, or replace, easily.
- Things to settle in the notes brainstorm:
  - list versions from both locations together, without duplicates;
  - list only versions where the note actually differs;
  - where the entry point sits on the open note.

Done so far:
- one save engine for notes, Diary and Review;
- Recently deleted for 30 days;
- rename, move and merge;
- 20,000-word and 10,000-note limits;
- clash safety (the losing text is always kept);
- the tree UI, breadcrumb and editable title;
- single-note restore from any backup version, including its images.

Starting list for the notes brainstorm (to discuss, not a plan):
- Performance at the limits:
  - a virtualised notes tree for 10,000 notes;
  - an incremental search index (update per save, not a rebuild);
  - measure open, save and search at 10,000 notes and 20,000 words.
- Link and reference integrity between notes and attachments; a repair pass inside existing maintenance.
- Keep multi-tab behaviour simple: one writer, others read-only, as the ownership model already does. Verify note editing during a takeover.
- Export and import of a single note or subtree (Markdown plus images).

### 3.2 Backup and restore at its best

**Goal (user).** Very fast, performant and efficient, and extremely reliable. As far as we can manage, it must never fail the person, and it includes every needed safety feature.

- Finish 1.3, then the audit (section 2).
- One status model for all locations, rendered by the host; one notice policy (dismissible, opt-in only, never persistent).
- Restore paths:
  - keep "add what's missing" as the safe default after a browser-data clear;
  - measure restore of large libraries;
  - consider streaming verification during restore downloads.
- Integrity scrub:
  - confirm the cadence (14 days) and budgets per location;
  - surface quarantine clearly in Version History.
- Consider a "backup health" summary in Data & Backup: last verified per location, waiting changes, next check.

### 3.3 Every background service, mapped and held to one standard

**History, as the user describes it.** The background services began as a patchwork, built at different times. One broke another, and they did not give way to what the person asked for: clicking Back up first waited for maintenance to finish. Much has been fixed since — the services are now state machines with shared coordination — but the job is not finished.

**Goal.**
- Every background service gives way at once to anything the person explicitly does.
- Every service runs smoothly, efficiently and in bounded time.
- Together they cover everything this app needs, and nothing more.
- When we get there, also decide:
  - whether a service is missing;
  - whether duplicate or similar services should be merged;
  - what should be refined.

Inventory to cover:
- PWA update checks and the safe update apply;
- the service worker and its caches;
- web workers: export/file worker, attachment worker, search worker;
- canonical data maintenance;
- attachment maintenance, cleanup and integrity audit;
- backup scratch-file (OPFS) cleanup;
- backup locations: automatic backups, maintenance, integrity;
- deletion-ledger trimming;
- storage health and quota estimates;
- notice timers.

The standard for each job:
1. Bounded work per run, with a work budget or progress watchdog.
2. Preemptible by foreground work, resuming from a durable checkpoint.
3. Intent persisted when it must survive a reload; idempotent when repeated.
4. One retry policy: backoff with a cap, and a user notice only when a person can act.
5. Runs only while this tab owns writes; pauses during restores, updates and browser-data clears.
6. Visible in one diagnostics view with state, next run and last outcome.
7. Tested on a fake clock, plus one browser test for the real lifecycle.

Suggestions:
- **One scheduler.** `BackgroundOperations` and the repository-background coordinators already cover most jobs. Bring the remaining ad-hoc timers under them, with clear priorities (integrity < maintenance < automatic backup < convergence < foreground).
- **Workers.** Terminate idle workers after a quiet period to return memory. Keep one queue per worker; it is already serialized. Reuse the faster SHA-256 everywhere (already shared).
- **Storage.** Request persistent storage; watch quota; trim OPFS scratch after crashes (exists); consider IndexedDB compaction of deletion ledgers (bounded already).
- **Service worker.** Keep the verified update flow. Add a cache size budget. Make sure an update never interrupts a restore or backup: the update already waits up to a minute for backups.
- **Idle and visibility awareness.** Run heavy maintenance only when the page is visible and idle (`scheduler.postTask` or `requestIdleCallback` where available), and never on battery saver if that becomes detectable.

---

## 4. Record of work on this branch

Commits since `main` (newest first), grouped:

### Backups (this and recent sessions)
- (this commit) **WIP:** Device Folder moved onto the shared backup engine.
- `d27570f` Prepare the backup engine to host the Device Folder (hosted locations, server-digest receipts, operation views, protected safety API).
- `f71a941` Check runs of small attachments with one read (`checksum.ranges`).
- `9696df4` Skip backups that would duplicate the newest version.
- `d03d0ce` Let the Drive cleanup test wait for background hashing (CI flake fix).
- `5e199b0` Describe standalone backup files in the backup design.
- `cae38d9` Encrypt and decrypt backup frames four at a time.
- `d597287` Save backup files where you choose, verified, with progress from the first click.
- `7b3db98` Back up when the app goes to the background and before an update.
- `3c57544` Hash files three to four times faster.
- `976c982` Back up to Google Drive automatically, every 20 minutes at most:
  - opt-in;
  - one dismissible expiry toast with Reconnect;
  - one 7-day reminder rule.
- `66977b9` Add a Device Folder storage adapter for the shared backup engine.
- `9614004` Describe the target backup engine.
- `16adda3` Restore attachments from this device instead of downloading them again.
- `68662cf` Add only what's missing from Drive and backup files.
- `eb54715` Use one forward-only change clock for every save.
- `d2c6bba` Cut two sequential Drive round trips from every backup.
- `0da44c1`, `7af933d`, `258e51a`, `8aa1275` Single-note restore: only the note's data is read, its images come back, and it works during a study session.
- `b68b9f0` Keep 15 backup versions through any gaps in backup history.

Measured on 200 MB of attachments:

| Operation | Before | After |
|---|---|---|
| File backup | 10.2 s | 2.5 s |
| Encrypted file backup | 17.1 s | 5.3 s |
| Save through the dialog, then verify | — | 4.6 s |
| Check before restore | 4.9 s | 1.1 s |
| SHA-256 in the worker | about 38 MB/s | about 135 MB/s |

### Notes and Library
- `546fbf2`, `26f862b`, `db1824a` Notes tree, Recently deleted, note menu, breadcrumb, editable title.
- `691a83d` One save engine for notes, Diary and Review reflections.
- `ff69680` Rename or move with children; merge only when asked.
- `941174c` Recently deleted for 30 days.
- `731c5c1` 20,000 words and 10,000 notes behind one count.
- `0244dae`, `a79d528`, `269e6e1` Save straight to the database with one safety copy; conflict-copy store removed.
- `e067b7b`, `f3f6602`, `7a482ce` Keep a clash's losing version; Recently deleted yields at the limit; bounded deletion ledgers.
- `397458f` Wordgard customisations behind the adapter.

### Browser data clearing and recovery
- `6c34bd7`, `cf8725c`, `52797b6`, `0ca95cb`:
  - restore what a clear removed, or let the person choose;
  - the decision stays on screen until made;
  - restore from what the person has;
  - pause backups until resolved;
  - carried across reloads.
- `ae93201` Keep Ongoing Notes and recovery intact across overlapping saves and clears.

### Background operations (earlier sessions)
- `abe12ff`, `8a85212`, `205b3b2`, `2c0fc8d`, `01a0995`, `e254fc6`, `a64f45d`, `cf4de02`, `a84a60d`, `707653f`, `38ef8c5`, `739b3db`:
  - one background job ownership model;
  - bounded, preemptible maintenance and integrity with preserved progress;
  - Drive publications resume across sign-in expiry;
  - verified Drive history inventory.

### Study session
- `6109402`, `4837fef` Away time counted only while the running block's study time lasted; the inactive-gap dialog is released when its timer already stopped.

### Tests and QA
- `8891f6c`, `eb77264`, `3d91713`, `8338f5b`, `7105b02`: fixtures, suite policy, native visibility in browser tests, de-duplicated harnesses.

---

## 5. Working notes

- **Chromium for browser tests:** `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. On a fresh profile, preset `localStorage` user defaults so the name dialog does not block clicks.
- **Rebuild the worker bundles** after changing `portable/`: `node build/wordgard-bundle.mjs --write`.
- **Fake-clock tests** that hash or encrypt must wait for real background work (`realWorkSettled` in `repository-checkpoint.mjs`).
- **Shell heredocs mangle backticks.** Use quoted heredocs or small Python edit scripts with exact-match assertions.
- **No model names in commits.** Commit messages end with the Co-Authored-By and Claude-Session lines.
