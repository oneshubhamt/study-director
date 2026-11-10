# Data and storage

Where Study Director keeps data on the device, how it is named and protected, and how older data is read. Backups and sync are in [backup-and-sync.md](../BACKUP-ENGINE.md).

## Where data lives

Structured application state is stored in IndexedDB. Attachment bytes are stored in OPFS and published only after write/read-back integrity verification. Backup scratch files also live in OPFS under opaque operation-scoped names: workers reopen those names inside OPFS rather than receiving FileSystemHandle objects across postMessage boundaries. Scratch ownership uses browser Web Locks only for the active operation; abandoned scratch bytes are collectible later and never block a future backup or restore. Important writes use explicit transactions, revision/conflict checks or recovery journals as appropriate.

## Profiles and devices

**Profiles.** Every durable name belongs to one profile, except the device list of profiles (`studyDirector.profiles.v1`), the device ID, the install notice and the update check. The first profile keeps the plain names; a later one adds `~<scope>` (scope fixed when it is made). A small script at the top of `app.html` reads the active profile before anything opens storage and publishes it as `Symbol.for('studyDirector.profileScope.v1')`; the database, browser-storage keys, OPFS folders (passed to the workers, which accept only these), locks, channels, the Drive sign-in and the Device Folder repository all take their names from it. `core/profiles.js` keeps the list: add, switch (every tab reloads), remove (data deleted once no tab holds it; the last profile is replaced by a new, empty one) and renew (a new id for a profile kept after it was deleted elsewhere). Deleting a profile everywhere leaves a marker in Drive that other devices act on ([backup-and-sync.md](../BACKUP-ENGINE.md#profiles-on-drive-and-in-the-device-folder)).

Decisions (owner, 2026-10-18):

- A profile is a name, an optional backup password and an optional Google account. Drive and the password can be added or changed later, in the profile panel (the primary home) or in Library → Data.
- A profile id (`prof_<name>_<time>_<random>`) is made once and never changes with the name. Names are not unique and there are no usernames; two or three people per device is the expectation, not a limit.
- One name per profile, synced with its library.
- Device-wide, and nothing else: the profile list, the device ID, the install notice and the update check (with the service worker).
- Switching reloads every open tab into the chosen profile. With one profile its backup key is kept on the device (a non-extractable key, never the password); with several, each start asks ("Not now" keeps sync and encrypted backups waiting). It is not a privacy lock: browser data is not encrypted. A forgotten password cannot be recovered, by design.
- **Device names.** Nobody types one. The device ID says what the device is (`inst_<type>_<browser>_<first-use time>_<random>`), and any device can name any other from it ("iPhone · Safari", with "(since 12 Oct)" only when two would look the same).
- **First start.** Someone new gives a name, an optional password (set before Drive is used, so no unencrypted version reaches it) and optionally connects Drive; joining a library from the form takes its name and settings. Existing data becomes the first profile with no form. Add profile opens the same form.

## What is stored

Principal persisted domains include:

- Saved Days / daily records (read as a view: the stored fields plus fields worked out from them; a view handed back to be saved, such as by a Diary edit, an attachment removal or its rollback, is saved as its stored fields, `storedDailyRecordFields`, and any other unknown field is refused);
- Notes;
- Plans and preferences;
- Active Session and timer recovery state;
- attachment metadata and OPFS bytes;
- versions kept for review (`PendingReview`, appMeta `pendingReview:<id>`): what a sync did not show where both sides changed the same thing, synced and backed up like the rest until the person resolves it;
- repository/recovery metadata needed for safe backup and restore.

Temporary UI projections are not authoritative. After protected operations, controls are re-derived from the current runtime/canonical state rather than restoring stale pre-operation DOM state.

## Canonical identities

`contracts/canonical-identities.mjs` owns the exact names and versions. Notes use permanent IDs in the `notes` store; appMeta family names are stable and versions live inside values. The runtime opens only the current topology and reads only current record/backup schemas. [Data contracts](../DATA-CONTRACTS.md) owns the version inventory and preservation policy.

The owner assumes the earlier upgrade is complete everywhere. This branch contains no store renaming, old-key movement, old backup readers, or schema-conversion path. Unknown/unsupported input is held or rejected safely; current rescue copies, rollback journals, and derived-view rebuilding remain active.

## Last backup record

**Last backup.** `verifiedRecoveryBackups` (version 3) is the one record of past backups. Every entry has the same three fields: when the copy was made (`at`), the change it holds (`sourceRevision`) and its backup `format`. `file` is the last portable backup; `verified` says whether it was read back through the save dialog or is a download, which the browser cannot read back but is still a backup the person made. `providers` holds each location's last verified copy. A download can't be derived from anything else, and on iPhone it is the only manual backup, so without it the 7-day reminder would show again right after every backup. Nothing derivable is stored: no type, id, label or app version per entry. The record changes in memory first, so whether a location still has changes waiting is decided from this one record; the engine keeps no copy of its own. The 7-day reminder, the row labels and the fresh-backup proof all read it.

## Drive sign-in

**Drive sign-in** is kept in browser storage (`studyDirector.driveSession.v1`: the access token and when it expires) for the rest of its hour, so a reload or reopening keeps it; the device's tabs share it, and it is removed on expiry, disconnect or a rejected token.

## Storage health

**Storage health** keeps three facts in browser storage: the change clock's fast copy (`lastLocalSaveAt`), when study data was last saved here (`lastStudyDataSaveAt`: notes, Saved Days, sessions, plans or kept versions, made here or taken in by a sync, the same things the empty-device check counts; settings alone, such as a name or theme, and canonical hydration do not) and an unresolved browser-data clear. The two save times only move forward: each tab writes the later of the stored time and its own, so an older tab never hides a newer save. Issues are shown live and never stored. The browser's storage estimate is measured at launch and again on returning to the app (at most hourly), and kept in memory for diagnostics. When the database fails, the record is rewritten once to show at once whether browser storage can still be written. The Device Folder settings record (version 4) holds only the folder handle and `baseline`, the change from which it backs up on its own.

## Data this version cannot read

**Data this version cannot read.** Nothing a build cannot read is changed, deleted or shown; the app works with everything else, so a newer version's data never stops an older one from starting. At every start, before anything reads stored data, a census (`UnsupportedData` in `app.html`) holds:

| What | Held as |
|---|---|
| A record whose `version` is above this build's (Saved Day, summary, note, session, attachment) | newer; a Saved Day and its summary are held together |
| An appMeta row whose envelope `version` is above 1, or whose key this build does not know (and is not one it retires) | newer or unknown |
| An appMeta value whose `version` is above its family's schema and that this build cannot validate | newer |
| An appMeta value still unreadable after current validation | unreadable |

The storage layer (`persistence.ts`) then keeps held records out of every read, refuses a write or delete of one (`STUDY_DIRECTOR_UNSUPPORTED_DATA`) and leaves them in place on a clear or a range delete; with nothing held, every transaction is the plain browser one. Bookkeeping whose family is `operational` in the data contract (leases, maintenance progress, caches) is held too but replaced as usual. While protected data is held, local clean-up waits (it decides what nothing refers to, and held data may refer to attachments) and Drive uploads wait (a version without that data would read as its deletion on other devices); Device Folder and file backups go on with what this build can read. The person is told once, Library → Data names what is held, and diagnostics has an "Unsupported data" row.

A newer database opens as it is, never upgraded or downgraded. If a store this build needs is gone or keyed differently, the profile does not open: start-up says it needs a newer version and offers another profile, and nothing in it is touched. The early profile-scope bootstrap distinguishes an absent registry (first start) from a present registry that cannot safely resolve a profile; the latter fails startup before profile-owned feature hydration rather than being treated as an empty profile. A profile list from a newer version is used read-only when its active or first known profile can still be resolved: nothing in it is rewritten, and adding, switching or removing profiles (and deleting removed profiles' data) waits for an update. On Drive, a version this build cannot read shows muted in Version History with Restore disabled and Remove in red; sync waits on it ("Needs app update") instead of retrying, and never uploads over it.

For this to keep working, a later build bumps a record's `version` when its shape changes, gives new appMeta families names an older build does not know, and treats removing or re-keying a store as a change that older builds meet by leaving the profile alone.

### Synced data from a newer version

What travels between devices is read inside a container whose version every build checks first: the backup file (`metadataVersion`), the Drive or Device Folder version (repository manifest) and the Continue Here claim. A build meeting a newer one keeps it, uploads nothing over it and asks for an update:

| What it meets | What it does |
|---|---|
| A newer backup file | "This backup was created by a newer Study Director version. Update the app before importing it." |
| A newer Drive version | Keeps it, uploads nothing over it: "Update the app to finish syncing" |
| A newer claim (same format, higher version) | The timer here stops and the progress is saved and read back; "Another device runs a newer version of Study Director… Update the app to continue here." Continue Here and sync wait for the update; nothing is written to Drive. A claim of unknown form stays "could not be verified". |

### Changing a synced form

The current-only `contracts/format-ledger.mjs` records one supported set of synced forms. A shape change updates its schema version and containing backup/repository versions together; a claim change updates the claim version. Validate current values and reject unsupported versions. Coordinate releases under the owner's canonical-only assumption; do not add historical converters. Local-only families keep their own schemas and unsupported-data census rules.

## Emergency copies

**Emergency copies.** When IndexedDB fails, the session recovery copy, unsaved notes, delete recovery and fallback Saved Days share one browser-storage budget (`localRescueBytes`, 4 MiB) in that priority order. Each copy may use what the higher-priority copies leave, up to its own ceiling, so the most important copy is never crowded out.

## Browser data clearing

Clearing site data deletes IndexedDB, localStorage and OPFS even with persistent storage granted. Once the clear is counted, background backup work reports `storage-reset` and does not run. The host then pauses automatic Device Folder and Drive publication and writes back the notes, plan, preferences and session the tab still holds, forcing the Plan draft past its write cache. Each write is checked. Failed parts are retried after 3, 10 and 30 seconds, and the notice names what is still only in memory instead of claiming it was saved. Backup capture reads the clear count before its first storage access and checks it at every fence, so a capture that saw a clear is never saved; a capture finished before the clear still publishes, because it holds complete data. Past Saved Days and attachments exist only in a backup. With a connected Device Folder, or otherwise a Google Drive that is still signed in (this never prompts for sign-in), a missing-only Combine adds them back without asking, from the newest verified version saved before the clear. Incoming notes, note deletions and the Active Session are excluded, personal-data differences keep this device, and any other difference returns `needs-decision` before anything changes. That recovery keeps today's session, so the managed recovery skips its final session rewrite and the reconciliation fence ignores the session, which lets it run while the timer runs. The same missing-only Combine is offered by hand as “Add only what’s missing” next to Combine and Replace for every Device Folder, Drive and file backup. Otherwise a non-dismissible notice offers "Restore from backup" (it stays until a restore finishes) and "Continue with current data". Restore opens the versions of the connected backup location; with none connected it opens Library → Data with Google Drive, the backup file import and, where the browser supports folders, the Device Folder in view. The notice names only those choices, and mentions the automatic-backup pause only while a Device Folder or Drive is connected. A start with no local data shows the same "Restore from backup" hint. The pause lifts on Continue, on any verified restore or combine, or on a backup the user makes (Device Folder Back up now, a Drive backup, a backup file export). Lifting it writes the in-memory Device Folder settings back to storage. Until then, the clear time is kept as `browserDataClearedAt` in the storage-health record, an existing operational record, so a reload or a takeover brings back the notice and the pause. Connecting a location while the clear is unresolved (signing in to Drive, a Drive sign-in kept from before the clear, or choosing the Device Folder again, from Library or the permission pop-up) runs the same missing-only Combine from that location, once per connection. A tab without control that is first to reopen storage tells the tab in control over the ownership channel. Only an external backup survives a deliberate clear.

**Removed while the app was closed.** A browser can remove a site's database while the app is closed and keep the rest of its browser storage (Chrome can evict it this way). The next start then creates a new, empty database. When browser storage says study data was saved here (`lastStudyDataSaveAt`), that start counts as a clear: it records `browserDataClearedAt`, pauses automatic publication, and shows the same notice with Restore from backup or Continue with current data, which a reload keeps until settled. There is nothing in memory to write back, so the device holds nothing, and a missing-only Combine (which brings no notes) is not enough. Once Google Drive is connected (a sign-in kept in browser storage from before, or the person signs in) the app runs a sync at once, in the foreground: with the sync history gone with the database it is a first sync, so everything on Drive comes in and nothing is deleted on either side. A verified sync lifts the pause and says "Your library was brought back from Google Drive". Choosing the Device Folder again offers its newest version from before the clear ("Recover latest"). A failed, unverified or declined recovery leaves the notice and the pause. Whether the device holds nothing is read from storage (`canonicalLocalRecoveryEmpty`); if that read fails, the device is treated as holding data and only what is missing is added. A fresh install, a new profile and a secondary tab never take this path. When the whole site's storage is cleared, nothing on the device says data was there, so the app starts as new and signing in to Google Drive brings the library back.

## Attachments

Attachment bytes live in OPFS and are published only after write and read-back verification (above). Ingestion, files in use and cleanup are in [background-jobs.md](../BACKGROUND-OPERATIONS.md).

PDF attachments retain their OPFS reader while an in-app iframe or an external viewer needs the Blob URL. The in-app viewer releases on overlay close as before. An external native viewer with a readable popup handle is observed until it closes; the URL/reader and interval are released on closure or origin pagehide. For fallback options, Open under a direct click attempts a tracked `noopener` popup and otherwise uses the browser's ordinary noopener link with a **10-minute bounded lease**; Download uses native link handling with **2-minute bounded lease**. The options overlay closes after handoff and on pagehide so a BFCache-returned page does not display invalid links. Unreadable window handles cannot supply an exact close signal. Timeouts are conservative cleanup limits and **cannot guarantee** that an external PDF viewer continues working after its opener unloads or beyond the bounded fallback expiry. These are user-gesture file-handling policies, not PWA scheduled work.

## Runtime boundaries

Current canonical validation, unsupported-input holds, ownership, current recovery replay, safety publication and rollback protect live data. They remain required after historical migration code is retired. A Plan edit's progress-transfer routine preserves work between two current schedules; it does not convert stored topologies.
