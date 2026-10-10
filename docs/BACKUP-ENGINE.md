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
- **When a location backs up on its own.** The Device Folder from when it is chosen: an empty folder gets a first backup at once; a folder that already holds backups is left as it is until this device's next change. Drive only on a device that has backed up to it before.
- **Opt-in for Drive.** Drive backs up automatically only on a device that has backed up to Drive before, and only while signed in (Google ends the sign-in after about an hour). Changes made while signed out go up on the next sign-in. When a sign-in ends, a person who backs up to Drive gets one toast with Reconnect, which they can dismiss; nobody else is told anything.
- **One reminder.** The 7-day backup reminder counts every backup (file, Device Folder, Drive). It stays away while an automatic backup can run, and while some backup already holds the latest changes.
- **Incremental in both directions.** A backup uploads only objects the location lacks. A restore reads only what the chosen scope needs and the device does not already have:
  - attachments with a matching checksum come from local storage;
  - a one-note restore reads only that note's objects;
  - every byte used is checked against the version's verified manifest.
- **Retention.** 15 ordinary versions: Latest, six Daily, four Weekly and four Monthly, all chosen from periods that have a backup. Leftover slots go to the remaining days, widest time gap first. One protected safety version is kept on top of those.
- **Safety.** Every restore makes a protected safety version first and rolls back locally if anything fails.

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
