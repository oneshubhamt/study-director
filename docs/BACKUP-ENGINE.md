# Backup engine

This is the design of automatic backups. Device Folder and Google Drive are two storage adapters of one engine. The repository format (immutable versions, shared objects, commit markers and lock files) is unchanged, so existing backups stay readable without a compatibility layer.

## Why

The Device Folder and Drive used to carry their own copies of the same machinery: locks, state reading, publication, cleanup, integrity checks, history, restore, scheduling and status. A fix in one did not reach the other, and the two decided "does this need a backup?" differently. Now there is one copy.

## Shape

- **Repository core** (`managed-repository.js`, existing). Checkpoint capture and preparation, the publication protocol, verified reads, retention selection, cleanup planning and the integrity scrub. Format-level code only.
- **Engine** (`backup-provider.js`). Owns every operation on a backup location, the same way for every location:
  - Back up: lock, read the repository state, publish, then bookkeeping.
  - Version History.
  - Open a version for restore, in four scopes: whole version, add what's missing, one note, and attachments or Saved Days.
  - Maintenance: retention cleanup and object garbage collection.
  - Integrity scrub.
  - Automatic scheduling and retries.
  - The protected safety backup before a restore.
  - Foreground and background coordination, and status.
- **Storage adapters**. Each one only knows how to reach its storage:
  - `list(kind)`, `download(item)`, `upload(file)` (verified) and `delete(item)` for checkpoints, commits and objects.
  - The lock files, with the same names and formats as today, so devices on different app versions still coordinate.
  - Connection state, permission and authorization.
  - Device Folder: a local directory handle (`device-folder-storage.js`). A thin controller (`device-backup.js`) keeps the chosen folder, its permission, remembering it across launches and its status row.
  - Drive: the Drive API (`drive.js`).

## Rules the engine applies once

- **Needs a backup.** Each location records the change time its last committed backup captured. It needs a backup when the change clock has moved past that. The clock is the mutation epoch written inside every save's transaction, and it only moves forward.
- **Automatic timing.** One cadence for every location (`automaticQuietMs`, `automaticUrgentMs` and `automaticExpiryLeadMs` in `repository-policy.js`): within 20 minutes of the first change a location does not hold, within three seconds of a key moment (finishing the day, all blocks resolved, saving a day to Library), and five minutes before a sign-in that expires runs out. The first waiting change owns the deadline: later changes and other wake-ups never move it, and changes made during a backup wait a full cadence from its end. Changes found on start or on reconnect (not seen being made) go at once, but only while local data is present, so an emptied browser never becomes a location's newest version. Waiting changes also go out at once when the app goes to the background (a phone may close it there), and before an update applies (the update waits up to a minute for them).
- **When a location backs up on its own.** The Device Folder from when it is chosen: an empty folder gets a first backup at once; a folder that already holds backups is left as it is until this device's next change. Drive whenever it is signed in, because it syncs (below).
- **Drive sign-in.** Google ends a sign-in after about an hour. The sign-in is kept for the rest of that hour across reloads and reopening (`studyDirector.driveSession.v1` in localStorage, shared by the device's tabs) and forgotten on expiry, disconnect or a rejected token. No refresh token is requested. Changes made while signed out go up on the next sign-in. When a sign-in ends, a person who uses Drive gets one toast with Reconnect, which they can dismiss; nobody else is told anything.
- **One history (the spine).** A version is made once and placed in each connected location under the same id, so the Device Folder and Drive show the same versions. The next location copies the version instead of making its own; Drive waits up to two minutes for the Device Folder to make it, so files come from this device. A location that was away copies the versions it missed that it would keep (Drive never takes one newer than its newest). A copy that fails is not tried again; that location makes its own version and history goes on. Back up now copies the same way.
- **One reminder.** The 7-day backup reminder counts every backup (file, Device Folder, Drive). It stays away while an automatic backup can run, and while some backup already holds the latest changes.
- **Incremental in both directions.** A backup uploads only objects the location lacks. A restore reads only what the chosen scope needs and the device does not already have:
  - attachments with a matching checksum come from local storage;
  - a one-note restore reads only that note's objects;
  - every byte used is checked against the version's verified manifest.
- **Retention.** 15 ordinary versions: Latest, six Daily, four Weekly and four Monthly, all chosen from periods that have a backup. Weeklies start below the oldest Daily's week and Monthlies below the oldest Weekly's month, so the history reaches about four to five months back. Leftover slots go to the remaining days, widest time gap first. On top of those, up to 10 Hourly versions from the 24 hours before Latest: one per local hour, only where the notes changed (each version records a fingerprint of its notes, `retention.notesFingerprint`; on Drive it is also the `sdHistoryNotes` property). One protected safety version is kept on top of those. The Device Folder and Drive use the same rules.
- **Safety.** Every restore makes a protected safety version first and rolls back locally if anything fails.

## Sync through Drive

Every device stays fully local. Whenever Drive is signed in, the device syncs with it: Drive is where a person's devices meet. The Device Folder is this device's own copy and never a second sync channel. The app works the same with either location, both or neither.

- **Shared base.** Each device keeps what it last shared through Drive (`reconciliationBase`, header v3): note titles and text, one fingerprint per Saved Day (rows `reconciliationBaseDays:YYYY-MM`), one of the Active Session and one of plans and settings, with the Drive version id. Only Drive moves it: a Drive backup, a copy of the spine version to Drive, or a Combine of Drive's newest version (the sync's own or the person's review). Device Folder versions, Replace and add-what's-missing never move it.
- **Catch up first.** On sign-in, start, a return to the app (at most once a minute), going to the background and every 20 minutes, the device compares Drive's newest version with its base. When Drive moved on, it takes that version in by a quiet Combine (`sync: true`) before uploading anything. What changed on one side only since the base is taken from that side. A note whose text changed on both sides in different paragraphs is joined by Smart merge (`mergeThreeWay`, only when it reports `safe`). Anything else changed on both sides never stops the sync: the newer shows and the other is kept for review (below). Timestamps never settle a difference; they only choose what shows until the person reviews it. Only a version the sync cannot settle that way (an older backup format, or more kept versions than may wait) stops it without changing anything; the Drive row and the sidebar then show "Needs review", and Review opens Combine on that version.
- **Kept for review (5.2).** A version a sync did not show is kept as a `PendingReview` record (appMeta `pendingReview:<id>`, one row each; contract `PendingReview.v1`): a note's other text or title with what both last shared, a note deleted on the other side (`kept: null`; the note stays), a Saved Day or its deletion, plans and settings, or a session. It is synced data: it goes into every version (backup v23 entity `pendingReview`, manifest v8 unit `pendingReview:<id>`), reaches every device, never expires, and ends only when the person resolves it on any device (the record then keeps only its id, and a resolved one wins every merge). At most `maxPendingReviews` (2000) may wait; more stops the write and nothing is dropped. Images a kept version uses are kept like any other reference. A note with one shows a quiet "Needs review" mark; Library → Data and the sidebar show the count. Review (`reviewKeptVersions`) asks the choices first (titles, deletions, Saved Days, plans and settings, the session), then note texts in the comparison dialog (current against kept, with Smart merge from what both last shared). Nothing is written until both are confirmed, nothing that changed meanwhile is overwritten (that review simply waits), and each choice is an ordinary edit that syncs. A kept session waits while a session runs here; a used one is set aside as suspended, ready to continue. Reviewing never opens by itself.
- **Active Session.** The session names the device running it (`runningOn`, the installation id), and only that device runs its timer. Another device keeps a copy it never runs and shows "Running on another device"; notes, Saved Days and everything else work there as usual, and that copy follows the running device at every sync. Otherwise an incoming session is taken only when this device's session is the shared one and the incoming one follows it (same day, same or later revision), or this device has none, or the incoming side saved this device's day and cleared its session. While a session runs here, an incoming change to it waits ("hold") and everything else merges, during a sync and during a review alike.
- **Moving a session.** Suspend hands the session over: it uploads at once, and the other device offers "Continue here" after its next sync. Continue Here on a device whose copy is still running elsewhere asks first (showing that device's last update), then moves the session here and uploads at once. The device taken over from stops its timer at its next sync: with nothing unsynced it simply follows; otherwise it shows the session running on the other device and keeps its own progress, suspended, for review. The same holds when the other device already saved that day and has no session left: the session ends here too and never comes back (a session the other device never had is not affected). Applying a new plan on a device that shows another device's session asks the same way.
- **Upload.** A Drive upload is refused when Drive's newest version is not the base (another device uploaded meanwhile): the device catches up and the upload follows. When another device's publication marker younger than 15 minutes is on Drive, this device waits its turn; its own markers never block it.
- **Status.** "Synced 10:42", "Changes since 10:42", "Syncing…" or "Needs review", in the sidebar and in the Drive row.
- **Known limits.** A fresh device whose plans and settings differ from Drive's keeps the other side's for review on its first sync (the first-start form will settle this). A kept session the person uses comes back as suspended on this device; the device running the session carries on until it syncs that change.

## Standalone backup files

A backup file stays one self-contained file covering everything, not a repository: gzip-compressed metadata followed by the attachments as they are (they are already compressed), optionally sealed in authenticated AES-GCM frames. It shares the capture, the codec and the file worker with the engine, and nothing else.

- **Export.** The save dialog opens from the click itself, so the browser allows it and the status line answers at once. After a location is chosen the backup is captured, packaged into a private scratch file, verified by a full self-restore check, optionally encrypted, written to the chosen file and read back; the saved file must match byte for byte. Each step and its byte progress show as it happens. Browsers without a save dialog download the verified file instead. A file saved and read back counts for the backup reminder; a started download does not.
- **File worker.** One SHA-256 for every file checksum in the app (files up to 32 MB use the browser's own; larger ones stream through a fast incremental one), byte comparison a word at a time, and AES-GCM with four 1 MB frames in flight. Reads stay bounded to one frame.
- **Measured** on 200 MB of attachments: export 2.5 s (5.3 s encrypted), save and verify through the dialog 4.6 s, check before restore 1.1 s. Before this work: 10.2 s, 17.1 s and 4.9 s.

## Steps

1. Device Folder storage adapter implementing the adapter interface, with its own tests. **Done.**
2. Device Folder backups run through the engine; the Device Folder controller keeps only the folder connection, permission and its status row. **Done.**
3. Device Folder history, restore, maintenance and scrub run through the engine; the duplicates are deleted. **Done.**
4. One scheduler and the change-time rule for both locations. **Done.**
5. The engine no longer renders location controls itself; the host renders both rows from `locationStatus` (with `wasConnected` and `engineBusy`) and redraws on `subscribeStatus`. **Done.**
6. Version History talks to the engine for every location, with no per-location branches. **Done.**
7. Someone who uses neither location: every backup path in the app works and stays quiet (`tests/integration/backup/no-backup-location.mjs`). **Done.**
8. Sync through Drive and one history for both locations (`tests/integration/backup/checkpoint-handoff.mjs`, "Drive sync between two devices"). **Done.**
