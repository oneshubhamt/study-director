# Handoff

Status of the work on this branch (`refactor/background-coordination`, draft PR #1): what is done, what is left, the wider programme and the agreed direction, and a record of the work so far.

**Current state (2026-10-10):** the backup engine design is complete: both locations run on the shared engine and the host draws both rows from engine status. Older stored data is read only by the compatibility host, once (1.4). The audit's schema step is done (1.5): stable record names, one last-backup record, a location-keyed verification record, Device Folder settings v4, one emergency-copy budget and a download-free Drive scrub. All 138 fast tests and the browser smoke suite pass. The engine draws no UI any more; both locations are drawn by the host the same way (1.6). Next: #45/#46 and the compatibility-layer isolation check (#64).

---

## 1. Done: the Device Folder is one location of the backup engine

Goal (task #39, `docs/BACKUP-ENGINE.md`): one engine (`source/core/backup-provider.js`) does every backup operation for every location; each location only supplies storage access. Drive already worked this way. The Device Folder had its own ~1,000-line copy of the same machinery (`device-backup.js`, 113 KB), with its own scheduler, locks, publication, cleanup, integrity, history and restore.

### 1.1 What changed

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
- Integrity record now version 6. Following the compatibility contract, the ordinary runtime reads only v6; versions 2–5 are converted once at start-up by `compatibility-host.js` (`migrateHostMetadata`, registry entry `l7-host-metadata-normalization`). The retired directory handle is dropped, scan progress and quarantine carry over, an unknown shape is kept untouched and fails closed, and `verifyRetiredHostCompatibility` reports any old version still present. Existing Device Folder scan progress restarts once because the identity changed.
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
  - `repository-integrity-state` (scope identity, v6 only in the ordinary validator); `compatibility-host` (v5-with-handle and v2 conversion, unknown shape preserved).
- Data contract and `ARCHITECTURE.md` text updated for the integrity record.

### 1.2 Behaviour changes to confirm

| Area | Before | Now |
|---|---|---|
| Restoring a Device Folder version | The restored state was marked as backed up; no new version. | Same as Drive: when automatic backups resume, a new version records the restored state, so Latest matches the device. Objects are reused, so it costs one manifest and one commit. It is skipped entirely when the newest version is identical. |
| Long write step | Device-only "taking longer than expected" notice. | Dropped. Reads are bounded (10 s); writes in `device-folder-storage.writeFile` are not. Consider bounded writes (`createWritable`, `write`, `close`) so a stalled sync folder fails instead of hanging. |
| Automatic Device Folder backup | Disabled Back up now. | Shows "Backing up…"; Back up now stays available (a foreground backup preempts the automatic one). |
| Concurrent foreground operations | Device and Drive were independent. | The engine's foreground lock is shared: one at a time across locations; the second returns "busy". |
| Start-up discovery | — | The guard reads local data once per start-up catch-up (records, notes, session, plans, attachments list). |

### 1.3 Finishing the move (2026-10-09/10)

- **Tests rewritten for the new design.**
  - `device-backup.mjs` and `folder-encryption.mjs` now run the production controller, engine, folder storage, retention and cleanup on an in-memory folder and a fake clock (`tests/helpers/device-folder-world.mjs`). Only checkpoint preparation is a stand-in.
  - Settings writes go through the app's own stored-record validator.
  - The fake clock steps from timer to timer and waits for real work in between.
- **New test** `no-backup-location.mjs` (task #53): with no location registered, change notices, flush on hide, the update wait, the browser-data-clear fallback, restore entry, Clear Library, Version History and diagnostics all work, and nothing is shown.
- **Contracts and other tests** updated to assert the new shape: a thin controller, a hosted engine location, no Device scheduler, no host device port.
- **Bugs found and fixed on the way.**
  - **Early automatic backup.** A check that was deferred while a foreground backup was busy fired 15 s later and backed up fresh changes, skipping the 20-minute quiet window. Each location now keeps its due time; any earlier wake-up re-arms it.
  - **Lease renewal.** Device Folder maintenance leases renewed on every file call after the first interval; they now renew once per interval.
  - **Stale app calls.** The app still called removed controller methods (`syncOwnership`). This broke start-up in the browser; the calls are removed.
  - **Settings record shape.** The settings record lost two fields the stored-record validator requires. The v3 shape is kept, with `lastBackupAt` and `lastFilename` written empty.
  - **Aborted maintenance.** A browser "clear site data" during canonical data maintenance was reported as an error. One aborted run in a row is now retried quietly; a second is reported. This was the intermittent `site-data-clear` flake.
- **Paused state.** The Device Folder status shows `paused` while restores, updates or a browser-data clear hold backups.
- **Docs** brought up to date:
  - `BACKUP-ENGINE.md`: all seven steps done (step 5 on 2026-10-10, see 1.4).
  - `BACKGROUND-OPERATIONS.md`, `ARCHITECTURE.md`, `NOTIFICATIONS.md`.
  - The in-app guide has a Device Folder entry.

Faster local loop: run each fast test in its own process with the hermetic flags `npm test` uses (`--experimental-loader ./tests/helpers/hermetic-loader.mjs --import ./tests/helpers/hermetic-runtime.mjs`), six at a time, and list failures. `npm test` stops at the first failure.

### 1.4 Last engine step, start-up hint and read-once migration (2026-10-10)

- **Drive's row is drawn by the host.** The engine no longer creates buttons. `renderDriveBackup()` in `app.html` draws the Google Drive row from `locationStatus('google-drive')` on every `subscribeStatus` notice, as the Device Folder row does. `locationStatus` gained `wasConnected` (so a lapsed sign-in reads "Signed out" with one Reconnect button) and `engineBusy` (another location's foreground operation holds the engine). `backingUp` also covers a running external backup. Buttons and order are unchanged: Back up now, Versions, Settings when connected; Reconnect after a lapse; Connect, Recover before first use. The Drive buttons are owner-gated like the Device Folder's.
- **Device Folder row on Turn off.** Forgetting the folder now redraws the row at once. Before, status said "off" while the row briefly still said "On" (an intermittent `pwa-device-backup` failure).
- **Start-up hint only after real loss.** "No local study data found…" now appears only when storage health shows that Saved Days or notes were saved in this browser before, no deletion history explains the emptiness, and no browser-data-clear notice is already showing. A brand-new install never sees it (`site-data-clear` browser test covers both).
- **Read-once migration everywhere it was missing** (user's rule, 3.0). Older stored forms are converted once at start-up by `compatibility-host.js`, verified, and the old form retired; the ordinary runtime reads only the current form:
  - backup verification record v2–v5 → v6;
  - pending repository maintenance v1–v3 (in either key) → v4;
  - the single-row note merge base `reconciliationBase.v1` → header plus one row per note (the key is now obsolete, owned by the compatibility host);
  - attachment check record v1 → v2 (already converted; the ordinary validator no longer reads v1);
  - data maintenance v5 is retired (maintenance runs again once).
  Each conversion fails closed on an unknown shape and keeps the source untouched, and `verifyRetiredHostCompatibility` reports anything old still present.
- **Whole-topology sweep (second pass, same day).** Every stored surface in `contracts/data-architecture.mjs` was checked: IndexedDB stores, appMeta families, browser storage, OPFS, caches, journals and backup formats. The ordinary runtime now reads only current forms everywhere; older forms are read once by the compatibility path, converted, verified and retired. Strays found and fixed:
  - **Old backup password record and old encrypted format.** No encrypted backups exist (your confirmation), so the password record v1, its unlock-time conversion and the SDENC01 reader are deleted outright; only SDENC02 and password record v2 remain.
  - **Restore journals v1–v3.** Converted once to v4 by the compatibility host before interrupted-restore recovery runs (start-up runs the compatibility step first). Missing deletion lists become empty lists. The journal reader accepts only v4.
  - **Old note-recovery journal rows (`areaNoteRecovery.v1:*`).** Already folded only by the one-time migration, but still declared a current, validated family. Now an obsolete identity: only the migration reads it (raw), and the obsolete-metadata cleanup removes any residue.
  - **`attachmentMaintenanceDay.v1` in browser storage.** Declared obsolete, but nothing removed it. The compatibility host now retires it with the other leftover keys.
  - A guard test (`compatibility-contract`) fails if a retired browser-storage key has no compatibility path, if a retired appMeta identity is still a current family, or if the host metadata validators read old versions again.
- **Confirmed clean:** Daily Records, summaries, Area Notes, Active Session, deletion history, preferences and plans, attachments (old metadata is rejected in ordinary reads and cleaned only by the compatibility path), browser-storage recovery copies, the IndexedDB schema bridges and the service-worker update bridge.
- **Old backup-repository formats (your decision: keep for now).** Device Folder and Drive checkpoints written by builds before SDVB75F10 (repository manifest versions 1–4, history entries without summaries, older Drive maintenance markers) stay readable. They are now registered for retirement (`backup-repository-v1-v4`: retire once every repository holds only version-5 checkpoints) and tested: `repository-restore` unpacks a current checkpoint into the older one-object-per-record layout and restores it as versions 1–4.

### 1.5 Schema step after the audit (2026-10-10)

Your decisions on the audit (`docs/AUDIT-DATA-AND-BACKUP.md`) and what was done:
- **B1, automatic backup on phones and Drive.** Accepted as a limit of a browser-only app. The 7-day reminder is the safety net: it shows at every launch when no backup of any kind (Device Folder, Drive or a downloaded file) has covered the changes for 7 days. Before this step a Drive backup did not count toward it; it does now (T2). No serverless way to renew Drive's one-hour sign-in exists: the browser-only Google sign-in has no refresh token.
- **T7, compatibility layer.** Kept, consolidated and shallowly wired so it can be deleted in one step later (task #64).
- **T1, record names.** appMeta names lost their version suffix; the version lives only in the value. `RENAMED_APP_META_KEYS` lists the old names, and the compatibility step moves them first, in one strict transaction (registry entry `appmeta-stable-names`). Browser-storage keys keep their names, because the theme, storage health and ownership leases are read before the compatibility step runs.
- **T2, last backup.** One record, `verifiedRecoveryBackups` v2, with the last started download. `storageHealth.lastBackupAt` is carried over once and retired; the Device Folder settings record is v4 (`directoryHandle`, `baseline`) without the two dead fields (T5).
- **T3, integrity record.** Version 7, keyed by location id. `INTEGRITY_TARGETS` is gone.
- **T4, emergency copies.** One shared budget (`localRescueBytes`, 4 MiB): session copy, then unsaved notes, then delete recovery, then fallback Saved Days.
- **B4, Drive scrub.** Trusts Google's stored SHA-256 from the listing; nothing is downloaded.
- **B9.** The Device Folder test world publishes version-5 manifests.
- **T6.** The `dailyRecordMigration` marker is named in the daily-record retirement entry.
- **Encryption (B3).** Left as is. Direction for later: full end-to-end encryption at rest and in transit, with a sign-in first experience (unlock, then use the app normally).

### 1.6 One way to draw every backup location (2026-10-10, task #63)

- **The engine draws nothing.** The Drive settings dialog, its progress block, status line and Cancel button are gone from `backup-provider.js`, with their focus, Escape and outside-click handling. The engine no longer takes `document` or `requestAnimationFrame`. Net: 268 lines removed, 107 added.
- **Drive's row has the Device Folder's parts:** Connect or Reconnect (one click, as the expired-sign-in toast already did), Back up now, Cancel, Versions, and Settings that open in place (state, access, last verified, Disconnect Drive).
- **One inline note per location**, drawn from `BackupPresentation.current(source)`. The Device Folder's own note now only says how the folder is doing; messages and progress are in the shared note, so nothing shows twice.
- **Sign-in:** Connect prepares Google sign-in while background work gives way, then opens it. A successful connect leaves no message (the row says On); a failure stays in the row's note.
- **Privacy wording** moved from the plugin descriptor into the Drive row's info popover (before connecting) and the settings panel (access line and Privacy link).
- **Still drawn outside the host:** the portable-file row (`backup.js`: Export button, Cancel and status line, three DOM touchpoints). Same treatment when convenient.

### 1.7 Lean records and the rest of the audit (2026-10-10)

- **Last-backup record v3.** One shape per copy: `at`, `sourceRevision`, `format`; the file entry adds `verified`. A download is the file entry with `verified:false` (it is not derivable, and on iPhone it is the only manual backup). Removed: the separate download field, and the per-entry type, id, label and app version. The engine's own copy of coverage is gone; the record changes in memory first.
- **Storage health** keeps `lastLocalSaveAt`, `lastStudyDataSaveAt` and `browserDataClearedAt`. Retired once by the compatibility host: last-backup time, per-kind save times (folded into one), storage estimate (in memory now), last error, `updatedAt`, `lastIdbOkAt`.
- **B3.** A locked row reads "Paused until unlocked".
- **B7.** Data & Backup states how far back versions go; a test keeps the sentence in step with the retention policy.
- **B8.** Versions → Restore… / Restore note… / Restore from file….

### 1.8 Compatibility isolation, #45 and #46, the file row (2026-10-10)

- **T7 / T6.** The compatibility layer stays (your decision) and is now provably shallow: the repository migrations sit in one marked block, ordinary code never reads the `dailyRecordMigration` marker, and `compatibility-isolation` pins every entry point. ARCHITECTURE §10 lists exactly what retiring it deletes.
- **#45, done.**
  - Device Folder writes are bounded like reads: every write, close and removal times out instead of hanging (test: a stalled write fails with `DEVICE_FILESYSTEM_TIMEOUT`).
  - Measured with 1,000 versions and 50,000 objects (`drive-repository-scale`): Version History takes 4 Drive requests in all and downloads nothing; listing 50,000 objects takes 51 requests; choosing what to keep from 1,000 versions takes about 5 ms. No change needed to Drive's metadata calls.
  - History sidecars: not needed. Device Folder summaries come from each manifest; only an encrypted, locked manifest hides them, and encryption is deferred until the end-to-end design.
- **#46, closed.** Incremental restore would save little: text data is small, attachments already present locally are reused, and a single note restore already downloads only what that note needs.
- **File row.** `backup.js` no longer touches the page; the app draws Export, Cancel and the note from one renderer, replacing two places that shared the Cancel button.
- **Dead code.** The engine's `subscribePresentation` (a third copy of the presentation subscription) is removed. A scan found no other unreferenced functions in the persistence and backup modules; four engine members are used only by tests, as entry points for testing the engine directly.

---

## 2. Remaining from the rest of this work

- **Audit done (2026-10-10):** `docs/AUDIT-DATA-AND-BACKUP.md` covers the data topology and the whole backup system, with findings ranked and a suggested order. Your decisions and the schema step are in 1.5. B5 is done (1.6). Still open: B7 retention and B8 restore names (to propose), #45/#46 and the compatibility-layer isolation check (#64).
- **#45 and #46:** done and closed (1.8).

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

**Migration (user's rule, 2026-10-10).** Older data is read once, converted into the current canonical form, verified and retired, never used again. Only the compatibility host (`compatibility-host.js`, plus repository adapters where a transaction requires it) reads old forms; the ordinary runtime reads only current forms. Every conversion is listed in `contracts/compatibility.mjs` with its retirement condition, so the whole migration machinery can be deleted later, leaving one clean canonical data structure.

**No upfront analysis.** Do not spend effort analysing or planning the notes and background-service phases until we reach them. The suggestions below are a starting list for those discussions, not a plan.

### 3.1 Notes as a first-class system

**Decided: no separate local version history for notes.** Earlier versions of a note come from the backup versions in the Device Folder and Google Drive. Retention is Latest, six daily, four weekly and four monthly, so about four to five months of history. Together with undo and redo in the editor and Recently deleted (30 days), that is enough for realistic use.

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
- `d8000e4` and the commit after `9afe06d`: the Device Folder runs through the shared backup engine. It was saved mid-move, then finished, with the due-time, lease-renewal and aborted-maintenance fixes.
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

- **Testing rhythm (user's rule, 2026-10-10).** Make all the app changes for a piece of work first, then build once and run the suites once. Fix what fails, then rerun only the failing tests. Do not rerun tests after each small edit.
- **Chromium for browser tests:** `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. On a fresh profile, preset `localStorage` user defaults so the name dialog does not block clicks.
- **Rebuild the worker bundles** after changing `portable/`: `node build/wordgard-bundle.mjs --write`.
- **Fake-clock tests** that hash or encrypt must wait for real background work (`realWorkSettled` in `repository-checkpoint.mjs`).
- **Shell heredocs mangle backticks.** Use quoted heredocs or small Python edit scripts with exact-match assertions.
- **No model names in commits.** Commit messages end with the Co-Authored-By and Claude-Session lines.
