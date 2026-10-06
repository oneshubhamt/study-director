# Backup engine

This is the target design for automatic backups. Device Folder and Google Drive become two storage adapters of one engine. The repository format (immutable versions, shared objects, commit markers and lock files) is unchanged, so existing backups stay readable without a compatibility layer.

## Why

Device Folder (`device-backup.js`) and Drive (`backup-provider.js`) each carry their own copy of the same machinery: locks, state reading, publication, cleanup, integrity checks, history, restore, scheduling and status. A fix in one does not reach the other, and the two decide "does this need a backup?" differently.

## Shape

- **Repository core** (`managed-repository.js`, existing). Checkpoint capture and preparation, the publication protocol, verified reads, retention selection, cleanup planning and the integrity scrub. Format-level code only.
- **Engine** (one module). Owns every operation on a backup location, the same way for every location:
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
  - Device Folder: a local directory handle.
  - Drive: the Drive API (`drive.js`).

## Rules the engine applies once

- **Needs a backup.** Each location records the change time its last committed backup captured. It needs a backup when the change clock has moved past that. The clock is the mutation epoch written inside every save's transaction, and it only moves forward.
- **Automatic timing.** One cadence for every location (`automaticQuietMs`, `automaticUrgentMs` and `automaticExpiryLeadMs` in `repository-policy.js`): within 20 minutes of the first change a location does not hold, within three seconds of a key moment (finishing the day, all blocks resolved, saving a day to Library), and five minutes before a sign-in that expires runs out.
- **Opt-in for Drive.** Drive backs up automatically only on a device that has backed up to Drive before, and only while signed in (Google ends the sign-in after about an hour). Changes made while signed out go up on the next sign-in. When a sign-in ends, a person who backs up to Drive gets one toast with Reconnect, which they can dismiss; nobody else is told anything.
- **One reminder.** The 7-day backup reminder counts every backup (file, Device Folder, Drive). It stays away while an automatic backup can run, and while some backup already holds the latest changes.
- **Incremental in both directions.** A backup uploads only objects the location lacks. A restore reads only what the chosen scope needs and the device does not already have:
  - attachments with a matching checksum come from local storage;
  - a one-note restore reads only that note's objects;
  - every byte used is checked against the version's verified manifest.
- **Retention.** 15 ordinary versions: Latest, six Daily, four Weekly and four Monthly, all chosen from periods that have a backup. Leftover slots go to the remaining days, widest time gap first. One protected safety version is kept on top of those.
- **Safety.** Every restore makes a protected safety version first and rolls back locally if anything fails.

## Steps

1. Device Folder storage adapter implementing the adapter interface, with its own tests.
2. Device Folder backups run through the engine; the Device Folder controller keeps only the folder connection, permission and its status row.
3. Device Folder history, restore, maintenance and scrub run through the engine; the duplicates are deleted.
4. One scheduler and the change-time rule for both locations. Done for timing and Drive; the Device Folder joins in step 2.
5. The engine no longer renders location controls itself; the host renders them from engine status.
6. Version History talks to the engine for every location, with no per-location branches.
