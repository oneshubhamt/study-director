# Data and storage

Where Study Director keeps data on the device, how it is named and protected, and how older data is read. Backups and sync are in [backup-and-sync.md](backup-and-sync.md).

## Where data lives

Structured application state is stored in IndexedDB. Attachment bytes are stored in OPFS and published only after write/read-back integrity verification. Backup scratch files also live in OPFS under opaque operation-scoped names: workers reopen those names inside OPFS rather than receiving FileSystemHandle objects across postMessage boundaries. Scratch ownership uses browser Web Locks only for the active operation; abandoned scratch bytes are collectible later and never block a future backup or restore. Important writes use explicit transactions, revision/conflict checks or recovery journals as appropriate.

## Profiles and devices

**Profiles.** Every durable name belongs to one profile, except the device list of profiles (`studyDirector.profiles.v1`), the device ID, the install notice and the update check. The first profile keeps the plain names; a later one adds `~<scope>` (scope fixed when it is made). A small script at the top of `app.html` reads the active profile before anything opens storage and publishes it as `Symbol.for('studyDirector.profileScope.v1')`; the database, browser-storage keys, OPFS folders (passed to the workers, which accept only these), locks, channels, the Drive sign-in and the Device Folder repository all take their names from it. `core/profiles.js` keeps the list: add, switch (every tab reloads), remove (data deleted once no tab holds it; the last profile is replaced by a new, empty one) and renew (a new id for a profile kept after it was deleted elsewhere). Deleting a profile everywhere leaves a marker in Drive that other devices act on ([backup-and-sync.md](backup-and-sync.md#profiles-on-drive-and-in-the-device-folder)).

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

- Saved Days / daily records;
- Notes;
- Plans and preferences;
- Active Session and timer recovery state;
- attachment metadata and OPFS bytes;
- versions kept for review (`PendingReview`, appMeta `pendingReview:<id>`): what a sync did not show where both sides changed the same thing, synced and backed up like the rest until the person resolves it;
- repository/recovery metadata needed for safe backup and restore.

Temporary UI projections are not authoritative. After protected operations, controls are re-derived from the current runtime/canonical state rather than restoring stale pre-operation DOM state.

## Record names

**Record names.** appMeta records have stable names without versions (`planDraft`, `restoreJournalState`, `repositoryMaintenancePending`, …); the version lives only inside the value. Older suffixed names (`planDraft.v1`, `reconciliationBase.v2`, …) are listed in `RENAMED_APP_META_KEYS` and are moved once, in one strict transaction, as the first compatibility step; an old and a new copy that differ stop the move. Browser-storage keys keep their names: several are read before the compatibility step runs (theme, storage health, ownership leases), so renaming them would need a second read path. The one exception is the emergency copy of unsaved notes, which nothing reads before that step.

**Note and Device Folder names.** Notes once carried the internal name "area note" and the Device Folder settings "automatic device backup". Everything now uses the plain names, stored data included:

| Where | Name now | Name before |
|---|---|---|
| Notes store | `notes` (database version 9) | `areaNotes` (database version 7 and earlier) |
| Note deletion records | `noteDeletion:`, format `study-director.note-deletion` | `areaNoteDeletion:` (and `areaNoteDeletion.v1:`), format `study-director.area-note-deletion` |
| Device Folder settings | `deviceFolder`, format `study-director.device-folder-settings` | `automaticDeviceBackup`, format `study-director.device-backup-settings` |
| Emergency copy of unsaved notes | `studyDirector.noteRescue.v1`, format `study-director.note-rescue` | `studyDirector.areaNoteRescue.v1`, format `study-director.area-note-rescue` |
| Interrupted-restore journal | version 5, `noteDeletions` | version 4 and earlier, `areaNoteDeletions` |
| Backup file | version 23, entity `note`, with `pendingReview` | versions 20 and earlier, entity `areaNote` (21 and 22 came only from unreleased builds and are refused) |
| Protected checkpoint manifest | version 3, `noteDeletions`, authority `notes` | version 2, `areaNoteDeletions`, authority `areaNotes` |
| Repository checkpoint | version 8, kind `note`, with `pendingReview` | versions 5 and earlier, kind `areaNote` (6 and 7 came only from unreleased builds and are refused) |

The store is renamed in place inside the upgrade (rows are never copied): an older database opens at bridge version 8, which renames it, and the compatibility step then retires the bridge stores at version 9. The records and the emergency copy move in the first compatibility step, their value format renamed with them. Older backup files and checkpoints are read under the names they were written with: checksums, completion proofs, pack shards and the logical-state fingerprint are all checked against the written names, and what they hold is then read under the current ones. An older build refuses the version 9 database and the new backup versions until it is updated. Device Folder and Drive upload each note once more after the change, because the note objects are now written under the new kind.

## Last backup record

**Last backup.** `verifiedRecoveryBackups` (version 3) is the one record of past backups. Every entry has the same three fields: when the copy was made (`at`), the change it holds (`sourceRevision`) and its backup `format`. `file` is the last portable backup; `verified` says whether it was read back through the save dialog or is a download, which the browser cannot read back but is still a backup the person made. `providers` holds each location's last verified copy. A download can't be derived from anything else, and on iPhone it is the only manual backup, so without it the 7-day reminder would show again right after every backup. Nothing derivable is stored: no type, id, label or app version per entry. The record changes in memory first, so whether a location still has changes waiting is decided from this one record; the engine keeps no copy of its own. The 7-day reminder, the row labels and the fresh-backup proof all read it.

## Drive sign-in

**Drive sign-in** is kept in browser storage (`studyDirector.driveSession.v1`: the access token and when it expires) for the rest of its hour, so a reload or reopening keeps it; the device's tabs share it, and it is removed on expiry, disconnect or a rejected token.

## Storage health

**Storage health** keeps three facts in browser storage: the change clock's fast copy (`lastLocalSaveAt`), when Saved Days or notes were last saved here (`lastStudyDataSaveAt`, for the start-up hint) and an unresolved browser-data clear. Issues are shown live and never stored. The browser's storage estimate is measured at launch and again on returning to the app (at most hourly), and kept in memory for diagnostics. When the database fails, the record is rewritten once to show at once whether browser storage can still be written. The Device Folder settings record (version 4) holds only the folder handle and `baseline`, the change from which it backs up on its own.

## Data this version cannot read

**Data this version cannot read.** Nothing a build cannot read is changed, deleted or shown; the app works with everything else, so a newer version's data never stops an older one from starting. At every start, before anything reads stored data, a census (`UnsupportedData` in `app.html`) holds:

| What | Held as |
|---|---|
| A record whose `version` is above this build's (Saved Day, summary, note, session, attachment) | newer; a Saved Day and its summary are held together |
| An appMeta row whose envelope `version` is above 1, or whose key this build does not know (and is not one it retires) | newer or unknown |
| An appMeta value whose `version` is above its family's schema and that this build cannot validate | newer |
| An appMeta value still unreadable once the compatibility steps are done | unreadable |

The storage layer (`persistence.js`) then keeps held records out of every read, refuses a write or delete of one (`STUDY_DIRECTOR_UNSUPPORTED_DATA`) and leaves them in place on a clear or a range delete; with nothing held, every transaction is the plain browser one. Bookkeeping whose family is `operational` in the data contract (leases, maintenance progress, caches) is held too but replaced as usual. While protected data is held, local clean-up waits (it decides what nothing refers to, and held data may refer to attachments) and Drive uploads wait (a version without that data would read as its deletion on other devices); Device Folder and file backups go on with what this build can read. The person is told once, Library → Data names what is held, and diagnostics has an "Unsupported data" row.

A newer database opens as it is, never upgraded or downgraded. If a store this build needs is gone or keyed differently, the profile does not open: start-up says it needs a newer version and offers another profile, and nothing in it is touched. A profile list from a newer version is used read-only: nothing in it is rewritten, and adding, switching or removing profiles (and deleting removed profiles' data) waits for an update. On Drive, a version this build cannot read shows muted in Version History with Restore disabled and Remove in red; sync waits on it ("Needs app update") instead of retrying, and never uploads over it.

For this to keep working, a later build bumps a record's `version` when its shape changes, gives new appMeta families names an older build does not know, and treats removing or re-keying a store as a change that older builds meet by leaving the profile alone.

## Local durability and failure domains

**Authority.** IndexedDB is the working authority for canonical structured study data; attachment bytes live in OPFS and become referencable only after verification. UI state and browser-storage rescue copies are not independent archives. Canonical acknowledgements, revision/ownership checks, recovery journals and verified backup/restore protect different failure modes; none substitutes for the others.

**IndexedDB commit strength.** `source/core/persistence.js` provides ordinary and selective strict transactions through `strictTransaction` and `strictStoreTransaction`. Its strict transaction constructor requests `{durability:'strict'}` for read/write transactions; if the browser cannot confirm support it falls back to default durability and records a diagnostic warning. This does **not** imply that every write takes the strict path, nor that `strict` makes a device immune to physical loss. Evaluate important call sites and failure windows by their actual current implementation before extending strict usage. Older SDVB74J notes asserting no strict-transaction support are obsolete.

**Browser persistence.** A browser-granted persistent-storage status (shown as Protected where available) primarily reduces normal quota-pressure eviction risk for the origin. It does **not** protect against clearing site data, removing the browser profile, app-origin changes, OS/browser corruption, device loss, or storage hardware failure. IndexedDB and OPFS belong to the same origin and generally share that loss domain. A new deployment under the same origin ordinarily retains application storage, subject to sound migrations and compatible formats.

**Residual editing risks.** Autosave timers, cross-tab races and sudden process termination can affect the most recent *uncommitted* edit; a visible “saved” result must be tied to the relevant canonical write/verification, not an in-memory state change. The prior SDVB74J analysis of a distinct Reflection-draft autosave interval should not be copied into current requirements without validating the present data model and source. Never equate existence of a Saved Day with proof that it covers a particular unsaved Active Session branch.

**Independent recovery.** Device Folder and/or Google Drive verified backups protect against total local-origin/device loss in a way local journals cannot. Version retention, verified checkpoint/read-back, a Before-restore backup and journaled restore provide additional protection, but coverage is only as recent as the last *successfully verified* backup; connected/queued/attempted is not equivalent to completed. A backup on the same physical disk is not fully independent against disk failure. Periodic restoration tests with disposable profiles are part of a credible durability claim.

**Acceptance principle.** Preserve the strong local-first design; prioritize evidence of actual gaps, failure injection and honest UI status over blanket “data can never disappear” guarantees. The current follow-up is tracked in [BF-C7](../backlog.md#bf-c7--post-c6-correctness-follow-up-and-durability-gate-open-2026-11-05).


## Emergency copies

**BF-C7.4 audit correction (2026-11-05):** Current Notes enter a 250-ms shared save lane immediately and are transactionally committed with strict IndexedDB durability, but an emergency localStorage note copy is **not** written on every keystroke. The rescue copy is created on a failed write and on page-exit protection; a hard termination inside the uncommitted write window may lose the very latest note edit. Debounced Plan-draft writes use default durability and explicit Apply/Done/Cancel barriers use strict durability. Reflection Drafts are no longer an independently persisted store in the current backup format; current Review work is protected through Active Session evidence and the strict, verified Saved Day commit. These are current-source findings, not the older SDVB74J timing/model assumptions. Full source and QA matrix: [BF-C7.4 audit](../BF-C7.4-STORAGE-DURABILITY-AUDIT.md).

**Emergency copies.** When IndexedDB fails, the session recovery copy, unsaved notes, delete recovery and fallback Saved Days share one browser-storage budget (`localRescueBytes`, 4 MiB) in that priority order. Each copy may use what the higher-priority copies leave, up to its own ceiling, so the most important copy is never crowded out.

## Browser data clearing

Clearing site data deletes IndexedDB, localStorage and OPFS even with persistent storage granted. Once the clear is counted, background backup work reports `storage-reset` and does not run. The host then pauses automatic Device Folder and Drive publication and writes back the notes, plan, preferences and session the tab still holds, forcing the Plan draft past its write cache. Each write is checked. Failed parts are retried after 3, 10 and 30 seconds, and the notice names what is still only in memory instead of claiming it was saved. Backup capture reads the clear count before its first storage access and checks it at every fence, so a capture that saw a clear is never saved; a capture finished before the clear still publishes, because it holds complete data. Past Saved Days and attachments exist only in a backup. With a connected Device Folder, or otherwise a Google Drive that is still signed in (this never prompts for sign-in), a missing-only Combine adds them back without asking, from the newest verified version saved before the clear. Incoming notes, note deletions and the Active Session are excluded, personal-data differences keep this device, and any other difference returns `needs-decision` before anything changes. That recovery keeps today's session, so the managed recovery skips its final session rewrite and the reconciliation fence ignores the session, which lets it run while the timer runs. The same missing-only Combine is offered by hand as “Add only what’s missing” next to Combine and Replace for every Device Folder, Drive and file backup. Otherwise a non-dismissible notice offers "Restore from backup" (it stays until a restore finishes) and "Continue with current data". Restore opens the versions of the connected backup location; with none connected it opens Library → Data with Google Drive, the backup file import and, where the browser supports folders, the Device Folder in view. The notice names only those choices, and mentions the automatic-backup pause only while a Device Folder or Drive is connected. A start with no local data shows the same "Restore from backup" hint. The pause lifts on Continue, on any verified restore or combine, or on a backup the user makes (Device Folder Back up now, a Drive backup, a backup file export). Lifting it writes the in-memory Device Folder settings back to storage. Until then, the clear time is kept as `browserDataClearedAt` in the storage-health record, an existing operational record, so a reload or a takeover brings back the notice and the pause. Reconnecting the Device Folder while the clear is unresolved runs the same missing-only Combine. A tab without control that is first to reopen storage tells the tab in control over the ownership channel. Only an external backup survives a deliberate clear.

## Attachments

Attachment bytes live in OPFS and are published only after write and read-back verification (above). Ingestion, files in use and cleanup are in [background-jobs.md](background-jobs.md).

PDF attachments retain their OPFS reader while an in-app iframe or an external viewer needs the Blob URL. The in-app viewer releases on overlay close as before. An external native viewer with a readable popup handle is observed until it closes; the URL/reader and interval are released on closure or origin pagehide. For fallback options, Open under a direct click attempts a tracked `noopener` popup and otherwise uses the browser's ordinary noopener link with a **10-minute bounded lease**; Download uses native link handling with **2-minute bounded lease**. The options overlay closes after handoff and on pagehide so a BFCache-returned page does not display invalid links. Unreadable window handles cannot supply an exact close signal. Timeouts are conservative cleanup limits and **cannot guarantee** that an external PDF viewer continues working after its opener unloads or beyond the bounded fallback expiry. These are user-gesture file-handling policies, not PWA scheduled work.

## Compatibility and migration

**The rule (owner, 2026-10-10).** Older data is read once, converted into the current canonical form, verified and retired, never used again. Only the compatibility host (`compatibility-host.js`, plus repository adapters where a transaction requires it) reads old forms; the ordinary runtime reads only current forms. Every conversion is listed in `contracts/compatibility.mjs` with its retirement condition. Only formats a released build wrote need a reader; formats that existed only in unreleased builds are refused (owner, 2026-10-18).

Compatibility is deliberately isolated. Current canonical repositories/codecs do not depend on historical representations for ordinary operation.

The compatibility layer covers live-install migration and historical external formats where still required. Live-install migration must not be removed until the explicit retirement-readiness contract is satisfied. Historical backup readers can remain even after installation migrations are retired.

The layer is reached through a fixed set of entry points, pinned by `compatibility-isolation`: the facade's four call sites (start-up migration and proof, a tab taking over writing, opening a backup file), the IndexedDB upgrade bridge (its store rename and conversions), and `AppData.compatibility`, which only the facade uses. The repositories keep their migrations in one marked block (`/* COMPATIBILITY … END COMPATIBILITY */`); ordinary code never calls into it or reads the `dailyRecordMigration` marker. Retiring the layer deletes:

1. `compatibility.js`, `compatibility-host.js`, `compatibility-codecs.js` and their module loads.
2. In `app.html`: the facade block, its three start-up uses (keeping a plain start-up path), `RuntimeBackupCodec.inspect` (back to the current reader), the IndexedDB upgrade bridge, its store rename and legacy store names, and the `compatibilityAppMeta`/`compatibilityCodec`/`legacyStores`/`legacyKeys` inputs to AppData.
3. In the repositories: the marked block, which holds every Daily Record, Active Session and note conversion (the notes repository has none), and the namespace that closes it; the Insights conversions it calls (`migrateLegacyEnvelope`, `verifyCanonicalEnvelope`) and `AttachmentStorage.cleanupLegacy`.
4. In the contracts: the compatibility registry, the obsolete and renamed identity lists and the `dailyRecordMigration` family.
5. Their tests (`compatibility-*`, `retirement-readiness`) and legacy fixtures.

Readers for old backup files (`backup-codec` versions 7 to 20) and for repository checkpoints version 5 and older, the ones released builds wrote, are a separate choice: keep them while old `.sdbackup` files and checkpoints should still open. Version 20 differs from today's in note names and ids and has no versions kept for review (registry: `name-keyed-notes-in-backups`).
