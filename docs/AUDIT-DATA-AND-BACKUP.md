> Historical audit snapshot. Its migration inventory is superseded on TS-Conversion by [the execution record](../TS-CONVERSION-EXECUTION.md); current canonical validation and recovery are retained.

# Audit: data topology and backup system (2026-10-10)

Read-only audit of how Study Director stores data and how it backs it up and restores it. Notes and background services are out of scope (to be audited later).

## Status (2026-10-10, after implementation)

Every finding is closed. Details are in `HANDOFF.md` 1.5 to 1.8.

| Finding | Outcome |
|---|---|
| B1 automatic backup on phones and Drive | Accepted limit (your decision). The 7-day reminder shows at every launch once nothing has covered the changes for a week, and now counts Drive, Device Folder and downloaded backups. |
| T7 compatibility layer | Kept (your decision), consolidated and pinned to a fixed set of entry points by a guard test; ARCHITECTURE §10 lists what retiring it deletes. |
| T1 record names | appMeta names carry no version; old names are moved once. |
| T2 last backup stored four ways | One record (`verifiedRecoveryBackups` v3). Storage health's copy, the folder settings' fields and the engine's own copy are gone. |
| T3 record built around two locations | Keyed by location id (v7). |
| T4 emergency copies | One shared budget in priority order; reads and clears keep each copy's ceiling. |
| B3 encryption pause | Rows read "Paused until unlocked". The encryption system itself waits for the end-to-end design (your decision). |
| B4 Drive scrub downloads everything | Compares Google's stored checksum; nothing is downloaded. |
| B5 engine draws UI | The engine and the backup runtime draw nothing; the app draws all three rows (Device Folder, Drive, file). |
| B6 code size | Reduced where it was duplication (the Drive dialog, coverage copies, the file row's two owners); the rest is safety work. |
| T5 dead folder-settings fields | Removed (settings v4). |
| T6 migration marker | Lives in the compatibility block; ordinary code never reads it. |
| B7 retention | Stated once in Data & Backup and tested against the policy. Tiers no longer share a week or a month, so the reach is four to five months. |
| B8 restore modes | One verb family: Versions, Restore…, Restore note…, Restore from file…. |
| B9 old-format test helper | Publishes version-5 manifests. |
| B10 #45 / #46 | #45 done (bounded writes, measured at 1,000 versions); #46 closed with reasoning. |

## Verdict

The foundations are sound.
- **Data:** every stored record has one typed home and is validated on every read and write. Old data is converted once and then retired.
- **Backups:** both automatic locations run on one engine. Every write is verified before it counts, and destructive operations are journaled and protected.

The weak points are elsewhere:
1. On most devices nothing backs up automatically for long. Only a Device Folder does; Drive stops after about an hour.
2. A few records overlap or are named inconsistently.
3. The backup code is very large for what it does. Much of that is temporary compatibility code that could now be retired.

## What is solid

- **One home per record.** 6 IndexedDB stores, 25 appMeta families, 19 browser-storage keys, 2 OPFS areas, all declared in `contracts/data-architecture.mjs` with owner, role and lifetime. The ordinary runtime reads only current forms; every older form is converted once by the compatibility path and is listed for retirement (21 entries). A guard test keeps it that way.
- **Write safety.** Strict transactions, a mutation epoch written with every change, ownership tokens so only one tab writes, journals for restore and Library clear, a protected "before restore" point, and a safety copy before any replace.
- **Backup correctness.** Every object is checked after upload; versions become visible only after a commit marker; Drive uploads are checked against Google's own SHA-256, so they need no download. Publication and maintenance leases keep two devices from colliding. A rolling 14-day integrity scrub quarantines damaged objects.
- **Restore safety.** Version restore, add-what's-missing, single-note restore and file import all verify before touching local data, keep a rollback, and resume after a crash.
- **Behaviour without a location.** Someone who uses neither Device Folder nor Drive gets no errors and no stray notices (tested).
- **Already in place:**
  - The app asks the browser for persistent storage at start-up.
  - The 7-day reminder fires only for changes that have not been backed up.
  - Automatic backups run when the app goes to the background and before an update.

## Findings, most important first

### High

**B1. Only the Device Folder backs up automatically and dependably.**
- **Drive.** Its access token lasts about an hour and cannot be renewed without a click: the browser-only Google sign-in has no silent refresh. So Drive's automatic backups stop an hour after the person last connected, and on every launch, until they press Reconnect.
- **iPad, iPhone and other browsers without folder access.** There the Device Folder is unavailable, so nothing backs up automatically for long. The only safety net is the 7-day reminder and manual backups.

For "it must never fail the person", this is the largest gap. It is structural, not a bug. Options to discuss:
- (a) say so plainly in Data & Backup: Drive backs up "while signed in", not around the clock;
- (b) on devices without folder access, prompt for a one-tap backup at natural moments (end of a session, after a Saved Day) when changes are waiting;
- (c) a small server that holds a Drive refresh token, which gives true automatic Drive backups but adds a backend and goes against the local-only design;
- (d) accept the limit and rely on (a) and (b).

**T7. The compatibility layer can probably be retired now.**
You control every installation. Steps:
1. Run the installation proof (`verifyCanonicalInstallation`) on each device.
2. Make one fresh verified backup per device.
3. Delete the temporary layer.

That layer is:
- `compatibility-host.js` (41 KB), `compatibility-codecs.js` (18 KB) and `compatibility.js` (10 KB);
- the IndexedDB upgrade bridges;
- the readers for 13 old backup-file versions (v7–v19) plus pre-v7 JSON;
- the old repository formats.

This is the single biggest step toward one clean canonical data structure, which is your stated goal. Old `.sdbackup` files and old Device Folder or Drive versions you still want readable are the only reason to wait.

### Medium

**T1. Record names and versions follow no single rule.** The key name sometimes carries a version and the value carries another:
- `personalPreferences.v1` holds version 2;
- `restoreJournalPayload.v1` holds version 4;
- `repositoryMaintenancePending.v2` holds version 4;
- `repositoryIntegrityScrub` (no suffix) holds version 6, while its declared schema label says v3;
- `automaticDeviceBackup` (no suffix) holds version 3.

This invites mistakes like the stray conversions fixed today. Suggested rule: stable key names without versions; the version lives only inside the value. Each rename is a one-time conversion in the compatibility layer, so it fits naturally into the retirement in T7.

**T2. "When was the last backup" is stored four ways.**
- `verifiedRecoveryBackups` (appMeta) is the true record: per file and per location, with the change it covers.
- `storageHealth.lastBackupAt` (browser storage) is a looser copy.
- The Device Folder settings still carry `lastBackupAt` and `lastFilename`, always written empty.
- The engine also keeps its own in-memory state.

Suggest: one record (`verifiedRecoveryBackups`) read everywhere, and drop the rest.

**T3. The integrity record is shaped around two fixed locations.**
It has `device` and `drive` slots, mapped through `INTEGRITY_TARGETS`. Everything else in the engine (pending retries, maintenance, status) is keyed by location id. Keying this record by location id too would make a third location, or a second folder, a non-event.

**T4. The browser-storage rescue copies are not budgeted together.**
- Fallback Saved Days: 3 MiB.
- Unsaved-note rescue: 1 MiB.
- Delete recovery: 64 KiB.
- Plus the session recovery copy and storage health.

That is over 4 MiB against a per-site quota of about 5 MB. The worst case is exactly when they are all needed, while IndexedDB is failing. Suggest one shared budget with a priority order (session, then notes, then Saved Days).

**B3. With encryption on, every launch pauses automatic backups until the person unlocks.**
- **Today:** this is latent, since no one uses encryption.
- **If encryption is turned on:** the Device Folder and Drive rows keep showing "On · Last verified …". The pause is mentioned only in the encryption section.

Suggest the row say "Paused until unlocked", or reconsider whether automatic backups should need the password at all.

**B4. Drive's integrity scrub downloads every object every 14 days.**
The scrub reads each stored object once per cycle. On Drive that means downloading the whole library, attachments included, every two weeks on every device. Upload checks already trust Drive's server SHA-256. The scrub could do the same for stored bytes, and keep full content checks for restore or a small sample.

**B5. The engine still draws two pieces of UI.**
- **What changed today:** the Drive row is now drawn by the host from engine status.
- **What remains:** the Drive settings dialog and the foreground progress overlay are still built inside `backup-provider.js` (18 DOM touchpoints).

For one status model, they belong in the host as well. Not urgent.

**B6. The backup code is large.**
- **Total:** about 765 KB across 14 modules, plus about 48 backup, integrity and maintenance functions in `app.html`.
- **Largest modules:** `backup-provider.js` (164 KB) and `backup.js` (146 KB), the two largest core modules.

Much of this is genuine safety: leases, journals, verification, resumable work. The clear reductions are:
- retiring old formats (T7);
- one freshness record (T2);
- moving the backup state stores that live in `app.html` (integrity record, maintenance intents, pending retries, verified backups) into one backup-state module.

### Low

**T5. The Device Folder settings record has two dead fields** (`lastBackupAt`, `lastFilename`). Its `sourceRevision` field actually means "back up on its own from this change". A cleaner v4 shape would follow T1 and T2.

**T6. One migration marker lives among current records.** `dailyRecordMigration` is used only by the compatibility path and retires with it (T7). It is listed here so it is not forgotten.

**B7. Retention keeps about four months.** Fifteen points: 6 daily, 4 weekly and 4 monthly, plus the latest. Nothing older than about four months survives in the Device Folder or Drive, and the notes trash keeps 30 days. Fine if intended; worth confirming.

**B8. There are several restore modes.** Restore this version, Add what's missing, Combine, single-note restore and file import. Each is safe, but the names and choices are worth a UX pass so a person always knows which one they want.

**B9. A test helper writes an old format.** `tests/helpers/device-folder-world.mjs` publishes version-2 manifests, so the Device Folder tests exercise the engine on an old layout. Switch it to version 5 when next touched.

**B10. Open items from before.**
- **#45 (performance):** bounded writes in `device-folder-storage`, history sidecars, fewer Drive metadata calls, and a 1,000-version measurement.
- **#46 (incremental restore):** likely to close with the reasoning already in `HANDOFF.md`.

## Suggested order (for discussion)

1. **Decide B1:** what automatic means on devices without a Device Folder, and what Drive should promise.
2. **T7:** prove each installation and retire the compatibility layer. This removes the most code and lets T1, T2 and T5 happen as one clean schema step.
3. **Tidy the topology:** T2 (one freshness record), T3 (keyed integrity record), T4 (shared rescue budget).
4. **Backup cost and clarity:** B4 (Drive scrub), B3 (lock state on the rows), B5 (host draws the dialog), B8 (restore names).
5. **#45 measurements, then close #46.**
