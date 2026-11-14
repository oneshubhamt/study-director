# Backlog

Open work, decisions still to make, and what has not been checked yet. Nothing here is started without the owner's go-ahead. When an item is done, remove it and record any lasting decision in its area's doc.

## Bugs reported by the owner (2026-11-03)

**Top priority (2026-11-05): local data disappears by itself on the phone and the iPad.** On F20, the phone lost its study data on 2026-11-05 (and probably on 2026-11-04) without browser data being cleared, and the iPad lost its data the same way, though Safari's data was never cleared. Syncing with Drive brought everything back. It did not happen before multi-device sync and profiles. An offline-first app must never lose local data by itself: deep audit first, before other bugs.

- **Lead (2026-11-12, from recreating handoffs, not proven on the phone):** a device closed while a sync is still applying what it brought in finds that sync's safety journal at the next start and rolls back to the state before the sync (`recoverInterruptedRestore`, as designed for an interrupted restore). On a device refilling itself from Drive after a loss, that would look like data vanishing at the next cold start and coming back at the following sync. The phone's Copy diagnostics (`startup-restore-recovery` in the trace) would show it.
- **Suspects to check, in this order:**
  1. Profiles and per-profile storage: the app opening a different or new profile's (empty) storage, for example after a change of device id or a profile registry read that fails, so the data is still there but not shown.
     - **Lead (2026-11-05, from the code, not yet proven):** the profile list lives in localStorage (`ProfileScope.registryKey`), and each profile's database and folders are named after its scope (`ProfileScope.scoped` in `app.html`; `source/core/profiles.js`). If that list is missing or unreadable at start-up, the app may create a fresh profile with a new scope, open a new, empty database, and leave the old one untouched under its old name: everything device-local then looks gone (verification history and the remembered Device Folder too), which fits both the phone and the iPad. If so, the old data may still be on the device. Also check `remove()` (the last profile is replaced by a new, empty one, and the old scope is queued in `removing`) and `collect()`, which deletes queued scopes' databases: confirm no automatic path can reach them.
     - First step: add the list of this site's databases (`indexedDB.databases()`) and the profile list to Copy diagnostics, then check the phone and iPad for a second database.
  2. Start-up and update paths: database upgrades, read-once migrations, and the compatibility removals, which might drop records an update no longer reads.
  3. Code that clears or replaces local data: the storage-reset flow, Library clear and its recovery journal, restore rollback, sync apply or handoff ("Continue here") replacing local data with an empty or older state.
  4. Browser eviction: Safari's 7-day limit on storage for sites used in a tab and not added to the Home Screen; whether persistent storage was really granted on each device.
  5. Low device storage: the phone has only 2–3 GB free of 128 GB. Chrome normally keeps persisted storage under pressure, but Android or a cleaning app (for example a "free up space" tool clearing Chrome's data) can still remove it, and that would also explain the folder permission being forgotten. Check whether the iPad is low on space too, and whether the loss lines up with times the phone ran out of space.
     The iPad has almost 1 TB free and also lost its data, and no cleaning tool was ever used; on the phone the data was there at night and gone in the morning with nothing done in between. So low storage is ruled out as the cause. The owner notes that the phone was just as low on space before the losses began, so the timing points to a change in the app. Start from the releases where it began (multi-device sync, profiles, F19 and F20): list every change to how the database is named, opened, upgraded or deleted, and to per-profile storage, and check each against a full-storage start-up.
- **Phone snapshot, 2026-11-05 02:56 UTC (F20), taken after the data was found missing and synced.** Everything device-local was gone too, not only study data: no Drive verification history, no format counts, Device Folder permission unknown, and usage was about 10.7 MB, the same as the phone right after its site data was cleared on 2026-11-04. Trace history starts at the 02:51 launch. Persistent storage reads granted. So the whole storage looks emptied or replaced, rather than one record lost: suspects 1 (another profile's storage) and 2 (start-up deleting or recreating the database) come first; Chrome evicting persisted storage is unlikely.
- **When it happens (owner, 2026-11-07):** at a cold start, the first open after a day or two unused, not after a Drive sync. The iPad was starting a new version; the phone was on the same version. So an update and sync are not needed for it; what runs at a cold start, or the browser clearing storage while the app is unused, is.
- **Owner's answers (2026-11-07):** Delete everywhere was never used; both profiles date from before profiles existed (so they use the plain storage names), nothing was deleted; both devices run the app from the Home Screen icon. After the loss Drive was signed out (expected: a sign-in lasts about an hour), the name was probably still shown, no first-start form or new profile was needed, and signing in caught up with the same library.
  - *What that tells us:* the device's profile list and other browser storage (localStorage) most likely survived, since a lost list would have opened the first-start form and Drive would have asked to join the library. What was emptied is the database (IndexedDB), with what lives in it: study data, Drive verification history, format counts and the Device Folder permission. So not a whole-site wipe (Safari's would clear localStorage too), and not the profile or Delete-everywhere paths.
  - *Leading suspects now:* on the iPad, which was starting a new version and held data from before profiles, the database upgrade or a start-up migration on that first start; on the phone (same version, 2–3 GB free), the browser evicting the database, which Chrome can do while keeping localStorage, or a start-up step that runs on every cold start.
- **Checked in the code (2026-11-07):**
  - *A lost profile list opening a new, empty database* does not apply to a device's first profile. It always uses the plain storage names, so with or without the list it opens the same database. Only a profile made later with Add profile has its own names, and could open empty if the list were lost.
  - *Nothing wipes the whole site:* no `Clear-Site-Data` header, and the service worker clears only its own caches. The app deletes local data only on a person's action (Delete profile, Library clear, Reset Today), with one exception below.
  - *The exception:* when Google Drive holds a "deleted" marker for this profile (left by Delete everywhere on another device) and this device has nothing unsynced, the app deletes the profile here without asking and starts a new, empty one. If Delete everywhere was never used, this is not the cause.
  - *Copy diagnostics now has a "Profile storage" line* (counts only): whether this profile has its own storage names, whether the profile list exists and lists it, whether this start created a new database, and how many Study Director databases the site holds. A new database with another one still present means the data is probably still on the device.
  - Since the profile path is unlikely and both devices lost everything local, browser eviction (suspect 4) and the sync or restore paths (suspect 3) are next.
- **Upgrade and migration audit (2026-11-07): not the cause.**
  - Opening and upgrading the database only renames stores, adds missing ones and drops the three retired, data-free ones (`persistence.js`, `compatibility.js`).
  - Each start-up migration (Saved Days, notes, Active Session, deletion state, old metadata) runs in one transaction that rolls back rather than drop a record it cannot convert.
  - Nothing clears the app's own bookkeeping (Drive verification history, format counts, the Device Folder permission) as a whole, yet that vanished with the study data. So the whole database most likely disappeared, rather than being emptied record by record.
  - The app deletes a whole database only when cleaning up a removed profile. It could also open a different, empty one only if the profile list named another profile as active.
  - One narrow path, not this bug: deletion records from very old builds (a tombstone store) are applied once to the Saved Days they name, when the day was not changed after the deletion. It can remove only those days.
  - *Next:* the browser removing the database while the app is unused (Chrome can, keeping localStorage), or the app opening another profile's empty database. The Profile storage diagnostics line tells these apart.
- **No Welcome form either (owner, 2026-11-07): only the database was removed.** With the database empty, the app opens the Welcome form whenever the device's profile list is missing, so the list, and with it the rest of browser storage, survived. The "No local study data found" hint was not seen, but it is a brief news toast that any leftover rescue copy or deletion record in browser storage also suppresses, so its absence proves little. Still to find: what removes a site's database on a phone and an iPad left unused for a day or two while keeping its other browser storage (on Android, Chrome's storage eviction can; on iPadOS, not yet known), and whether anything the app does invites it.
- **Detector added (2026-11-07):** a start that creates a new database where study data was saved before now shows the "Browser data was cleared" notice and pauses automatic backups, and Copy diagnostics shows when it was found ([data-and-storage.md](areas/data-and-storage.md#browser-data-clearing)). It would have caught both losses: each device kept its browser storage and started with a new database. If it ever happens with no notice, the whole site was cleared.
- **Happened again on F24 (owner, 2026-11-08, phone).** Same pattern as 2026-11-05: the database was removed and the rest of browser storage kept.
  - *Owner's account:* the phone ran a block, the app was swiped away and the phone locked; about 30 minutes later, the next open (a cold start, from the Home Screen icon) showed the "Browser data was cleared" notice. The Active Session was rescued (it was the phone's own running block, kept in browser storage), there was no Welcome form, and the notice offered to restore or keep the current data. The Saved Days, probably all of them, came back through the restore at Drive sign-in; what else was missing is not known. No other device was in use, and nothing that clears data (Reset Today, Library clear, a restore) was used. F24 had worked normally on the phone for three or four earlier opens.
  - *So the detector and the recovery worked; the cause is still open.* The loss came only 30 minutes after the last use, not after a day or two.
  - *Diagnostics (copied at 16:32:06 UTC, after the sync):* `startedFresh=false` describes only that page load (`IndexedDb.lifecycle()`), and the line carries no data-cleared time, so the copy most likely came from a later load, after the notice was answered; it does not contradict the notice. Drive verification and canonical maintenance `state=never` (the bookkeeping went with the database); Device Folder disconnected since 16:13:50, the likely start; a convergence at 16:30:46 uploaded 7 objects from `units=1`; storage persisted.
  - *Strongest lead now:* the phone is 97% full (about 125 of 128 GB), and the site itself used about 4.3 GB of a 15 GB quota, far more than the study data needs. This is the same 4 GB the owner reported as impossible in item 11, so treat the two as one investigation: a real 4 GB would make the app itself the biggest user of a nearly full phone's space, and a false figure would rule this lead out. Find what holds those 4.3 GB (caches, attachments, kept copies, trace history or something that grows without limit), and check whether Chrome on Android removes a persisted site's database under low disk. The iPad loss (1 TB free) still shows low space is not the only cause.
  - *Next time:* Copy diagnostics before answering the notice and before signing in to Drive.
- **Happened again on F24 (owner, 2026-11-11, phone; diagnostics copied 16:39:16 UTC, screenshot at 10:09 pm local).** Third time on the phone, same pattern: the "Browser data was cleared" notice at a cold start (this start began 16:38:46 UTC) and Drive bringing its latest version back in (`provider-combine`, 4 versions on Drive, no conflicts). F25's storage census and database record were not on the phone yet.
  - *Storage now:* `usageBytes=248173` (about 0.25 MB) of `quotaBytes=10737666413` (about 10 GB). On 2026-11-08 it was about 4.3 GB of 15 GB. Whatever made up the 4.3 GB went with the database; the quota also shrank, as the phone's free space did.
  - *Clear time looks stale:* the notice and `Profile storage dataClearedAt` both say 2026-11-09 06:18:22 UTC (11:48:22 local), two days before this start. **Fixed 2026-11-11:** the detector (`noteDatabaseRemovedWhileClosed`) recorded a new loss only when no earlier notice was unanswered, and the 2026-11-09 one never was; each loss now records its own time ([data-and-storage.md](areas/data-and-storage.md)).
  - *Reasons on this start:* attachment cleanup and Drive convergence paused with `reason=storage-reset`; `startedFresh=false`, `databases=1`.
  - *Owner's answers:* last open two days before, as the installed app, closed by swiping it away from the recent-apps view; the 2026-11-09 notice was never answered (so its time showing again is expected, but this loss got no time of its own); everything came back after the sync. So, as on 2026-11-05, the loss followed a gap of days unused, closed by a swipe.
  - *Next:* get F25 (PR #21) onto the phone, so the next occurrence has the census and the record of the database before the loss. Copy diagnostics before answering the notice.
- **External audit (owner, 2026-11-10; source read only, no code changed).** The owner confirmed the app holds **no attachments**. Conclusions, checked against the code where cheap:
  - *Leave attachment cleanup alone:* its reachability checks, locks, fencing and tests are sound, and with no attachments it cannot explain this. An orphan may survive a reload until the next sweep; acceptable.
  - *No app path deletes the active database* (agrees with the 2026-11-07 audit above): `indexedDB.deleteDatabase` is called only from profile cleanup (`profiles.js`), which skips the open plain profile; upgrades only add or retire named stores; sync and Continue Here delete no database.
  - *The 4.3 GB is not measured app data:* the figure is `navigator.storage.estimate().usage` for the whole site, and the app ignores `usageDetails`. App caches (three release caches, a few MB), diagnostics and the local recovery copy (capped at 4 MiB) are all small, and there were 0 kept versions. The only app-owned bucket that could grow large is the backup scratch folder (OPFS), whose cleanup also looks sound. So the candidates are: scratch files piling up somehow, the browser's physical database files being far larger than the records, or a wrong estimate (Chromium has an open bug on wrong OPFS estimates on Android).
  - *Not ordinary eviction:* storage was persisted, and eviction removes a whole site, yet here only the database went and localStorage stayed. Browser-side loss of only IndexedDB has happened before in Chromium. Leading family now: a browser or storage-engine fault that loses or resets the database.
  - *Do not add speculative fixes:* no change to attachment cleanup, and no `db.close()` on `pagehide` until evidence points there. The app keeps one long-lived connection and closes it only on `versionchange`; WebKit has had background faults with such connections, worth keeping in mind for the iPad.
- **Our reading of the audit (2026-11-10):**
  - *Timeline of the figure on the phone:* about 4 GB on 2026-11-03 (item 11); about 10.7 MB after the site-data clear and the 2026-11-05 loss; 4.3 GB again by the 2026-11-08 loss, and it survived that loss; 4,305,971,748 bytes on 2026-11-08 16:32 and 4,305,794,215 on 2026-11-09 06:16, so it then stopped growing. The laptop, with the same data, reads about 23 MB. So on the phone something outside the study database grows from almost nothing to about 4 GB within about three days and then stays put. The OPFS folders, and any folder at the OPFS root the current code no longer knows, come first in the census.
  - *A sharper mechanism than eviction, to verify:* browsers may delete an IndexedDB database they cannot open (treated as corrupt) and start a new one under the same name. That gives exactly what was seen: same name, version 0, localStorage intact. On a 97%-full phone, failing writes are a plausible way there; on the iPad, a process killed mid-write. Still browser-side, but it says what to record: errors before the loss.
  - *Keep the forensics where they survive:* localStorage survived both losses, the database did not. A tiny localStorage record (last successful database write, record counts per store, the last database error and when, unexpected closes) lets the next start after a loss say how much was there, when it last worked and what failed first.
  - *Faster backups limit the damage whatever the cause:* the app cannot stop a browser fault, but a loss costs only what has not reached Drive or the Device Folder yet. Items 18 and 22 stopped Drive backups for up to 30 minutes, so fixing them is also data-loss protection.
- **Storage census: built in F25 (2026-11-10),** as listed below (Copy diagnostics lines "Storage census …", "Database this start" and "Database before last loss"). Not yet checked in a real browser or on the phone. Next: the owner copies diagnostics on the phone, then the fix follows the evidence.
- **Storage census as specified (read-only; counts and sizes only, never content):**
  1. `navigator.storage.estimate()`: usage, quota, persisted, and `usageDetails` where the browser gives it.
  2. IndexedDB per store: record count and approximate bytes (Saved Days, summaries, notes, Active Session, attachment metadata, appMeta), and appMeta by family (reconciliation base, pending reviews, journals, preparation units).
  3. OPFS: the attachment folder and the backup scratch folder, each with file count and summed file sizes, plus every other root entry, so a folder left by an older release shows up.
  4. Cache Storage: caches, requests and measured bytes.
  5. Measured app total against the browser's figure, and the gap between them.
  6. Database lifecycle, kept in localStorage: opened fresh or existing, version on open, unexpected `close` or `versionchange`, last successful write, last error, and record counts at the last good start.
- **Evidence to capture next time, before syncing:** Copy diagnostics (Local storage health, Profiles, journals, Unsupported data); a screenshot of what the app showed (an empty app, the first-start form, or "No local study data found"); and, for each device, the browser and whether the app runs from the Home Screen or a browser tab.
- **Then:** a test for each path found, at the right layer, and a guard so that no automatic path can leave local data emptier than it found it without the person's choice.
- **Related: no low-space warning.** The phone has 2–3 GB free and the app never warned. Browsers do not tell a web app how much space the device has left, only the site's quota (about 10.7 GB on the phone) and its own use, so the app cannot see that the phone is nearly full.
- **Related: Device Folder permission lost often on Android.** On the Android phone the folder permission is lost again and again, even between sessions on the same day, and has to be granted anew; on the laptop it held, even before sync. An occasional re-grant is expected, a frequent one is not. It may be the same fault: the chosen folder is remembered in the app's own storage, so if that storage is emptied, the folder is forgotten too. Also check how Chrome on Android keeps folder permission between visits.
- **Related: automatic restore after a data loss did not happen.** What the owner expects, to be confirmed against the code:
  - App open when its storage is cleared, with the Device Folder or Drive still connected: it adds back what is missing by itself, from the Device Folder first, otherwise Drive. The storage-reset flow (`restoreMissingAfterStorageReset` in `app.html`) does this today.
  - App closed when it happens: on the next start nothing is connected any more, since the folder choice and the Drive sign-in were in the emptied storage too. The app can only show "No local study data found" (only when it sees signs of earlier use, which may be gone as well). After the person signs in to Drive, sync brings the data in by itself (fixed in F21). After the person chooses the Device Folder again, the app offers its newest version.
  - Fixed on this branch (2026-11-07): when only the database was removed, the clear notice paused the sync too, so signing in to Drive brought nothing back until the notice was answered. Drive connecting now syncs the library back by itself, and choosing the Device Folder again offers its newest version from before the clear. "Study data was saved here" now covers sessions, plans and kept versions too (settings alone do not: the empty-device hint showed wrongly when only a name was saved), and an older open tab can no longer move it back.
  - To check: why the phone on 2026-11-05 showed no such recovery (the whole site's storage may have been cleared, which leaves nothing that says data was there).

**Bugs come first** (owner, 2026-11-03): every bug here before new features, performance work or other improvements, except the test programme. A fix in a sensitive area (sync, storage, sessions, timer) comes with a test; a small fix elsewhere needs none ([workflow.md](workflow.md#choosing-tests)). Numbers below are kept from the owner's reports, so earlier references still hold.

### Open

- **11. The storage figure** (about 4 GB on the phone, 21.9 MB on the laptop): one investigation with the data loss above. The census in F25 says what the figure is made of; then show the app's own measured size, and the browser's estimate only as a labelled extra.
- **12. Drive cleanup on a busy phone.** A busy device finishes cleanup (tested: 200 versions, 3 s per read, a version every 2 minutes). Still open: verified summaries live in memory, so a page the phone reloads reads them again; keep them across reloads only if the phone's diagnostics show reloads cutting cleanup off. Confirm the Drive version count falls back to about 30.
- **14. Drive requests are slow on the phone:** 1–4 s each, about six in a row per upload, so a 10 KB upload takes 15–20 s; the catch-up after a bring-in downloaded the same 8 files again. Part of the Drive speed work below.
- **16. The app feels slow overall** (owner, 2026-11-05). Measure on the phone and iPad first (start-up, tab switches, Library, Plan, Execute, typing, dialogs, sync in the background), then fix the worst. Last among the bugs; includes row 7 of the observations table.
- **15. Background work on phones** (decided for now): a backgrounded mobile page is frozen and no service worker can help (Drive sign-in lasts an hour without a server). No background service; any device that completes Drive cleanup tidies it for all.

### Fixed, to confirm on real devices

| # | Fixed | Confirm on the devices |
|---|---|---|
| 1 | Applying a continued session no longer opens the Plan draft for editing | a real handoff |
| 2 | The "earlier day not saved" reminder clears once any device's Saved Day holds the day | the morning after a handoff |
| 3 | Kept versions: per-item merge of plans and settings, duplicates merged, the review shows the item, the device and when ("From iPad · Safari, changed 06 Nov, 21:40") | fewer, clearer reviews |
| 4, 6 | Stuck first sync on the iPad, still progress bar: one cause fixed (an empty device never looked at Drive) | reopen if seen on the current build |
| 5 | A handoff removes nothing on either device (audit and `handoff-data-journey`, [study-session.md](areas/study-session.md)) | saved plans, draft and notes intact after a handoff |
| 7 | Screen top no longer under the iPhone and iPad status bar | iPhone, iPad |
| 9 | Recheck in Library → Data → Verification answers at once and shows its result | the phone |
| 17 | Practice Pacer Start works with the default target | |
| 18, 22 | Drive cleanup no longer blocks uploads; the old device lets go after Continue Here | two devices, a handoff |
| 19 | Review and Execute editors stay live through syncs and block changes | |
| 20 | Save Today is not interrupted by a sync and keeps the newer reflection | |
| 21 | Finish Today ends the day for good ([study-session.md](areas/study-session.md)) | |
| 23 | One Drive check every 10 s (6 requests a minute) for handoff and new versions | handoff speed with real Google Drive |
| 24 | No "Previous study day needs review" after a saved day: Save Today pauses a running timer, only the device that ran the day asks, notes after the save leave it saved ([study-session.md](areas/study-session.md)) | a few mornings |

**Which build:** the reports above were seen on F18; F25 (PR 21) carries the fixes and a format change, so update every device at about the same time.

## Order of work (2026-11-12)

1. **Data loss on the phone** (top of this page, with item 11): F25 on the phone, then Copy diagnostics after the next loss, before answering the notice. The fix follows the evidence.
2. **Drive speed** (item 14, with the backup and sync review below): fewer requests per upload first.
3. **The remaining bugs:** item 12 if the phone shows it, item 16 (measure first).
4. **Test programme:** resume at step 4a.
5. **The new backup machinery:** the review, options and requirements below, Device Folder included.

## Owner's observations (noted 2026-10-25)

Status checked against the code and git history and confirmed by the owner on 2026-11-02.

| # | Item | Status | Evidence / what is left |
|---|---|---|---|
| 1 | **Seamless first start with Drive.** A new phone install, with data already on the laptop, showed the name form and "Connect Google Drive". Can connecting Drive come first and offer the profiles found there, so a second device needs no name and no setup? | Open | Joining a library from the first-start form already takes its name and settings, and a new device's start-up settings are no longer kept for review (`5bbc008`). Picking the profile from Drive before the form is not built. |
| 2 | **Catch-up when Drive connects.** On the iPad, connecting Drive took a while, it was unclear what happened, and the laptop's changes did not arrive. | Done, not yet tried on a real device | A sync that failed and looped on every catch-up was fixed (`2eaf3fe`); Drive backups were made faster (`5bbc008`); a Connect card now shows each step on every tab (`eb8601d`; [status-indicator.md](areas/status-indicator.md#connect-google-drive-card)). |
| 4 | Audit the backup system again (report only). | Partly | Drive backup speed and the kept-for-review loop were audited and fixed on 2026-11-01. A full backup audit has not been done since. |
| 5 | Audit the background services twice more (report only). | One of two done | An independent audit and fix programme (21 findings, P0–P6) finished on 2026-11-01 ([history.md](history.md)). The second pass is open. |
| 6 | Audit the notes system again (report only). | Open | |
| 7 | **Performance check** on a slow, throttled profile: start-up, tab switches, Library, Insights, typing in notes. | Partly | Insights now opens from an idle pre-computed model (`c24fc30`). The other surfaces have not been measured on a slow profile. |
| 8 | **Backup speed and safety** for both Drive and the Device Folder. | Partly | Drive backups measured and made faster on 2026-11-01. Device Folder speed and restore speed not measured again. |
| 9 | Remove the migration code (compatibility layer and Release B). | Waiting | Only once "Format cleanup" reads ready on every device in use ([backup-and-sync.md](areas/backup-and-sync.md#one-format)). Owner, 2026-11-07: retire within days, once every device runs the current build. All old-format reading now sits in the compatibility layer (host, the marked blocks and the registry in `contracts/compatibility.mjs`); it reads only forms that released builds wrote (sync baseline v3 with v1 day rows, claim v2 and the plain forms, restore journal v1–v5); forms only unreleased builds wrote are refused. Until every device updates, a device on F22 or older cannot read a v4 ownership claim, so Continue Here between an updated and an older device can leave both running; update all devices before handing over. |
| 10 | **Optional size work.** The plain deployment build is not minified; a minified one exists (`stage:firebase:minified`). | Deferred (owner, 2026-11-02) | Later: deploy the minified build, or minify only `wordgard.js`, with a full test run. |
| 11 | **Whole-app quality pass.** Is the app clean, lean, elegant, efficient and reliable after this round of work? Is the notes system first-class? Measure memory over a long session and CPU and battery while idle and studying, then propose where to trim. | Open | Report only. |

## Test suite programme (approved by the owner on 2026-11-02)

The full plan, its rules and live status are in [test-programme.md](test-programme.md). Steps 1–3 are done; step 4 (backup and storage) was paused by the owner and resumes at step 4a.

## Owner's requests (noted 2026-11-03)

**Notes: interface review and redesign.** Tags, links and other note features may be buried: someone could use the app and never find them, or never get their full use. Review how each is discovered and used, and whether the rest of the app makes the most of them. Then propose a redesign. Not started; after the test programme.

**Backup and sync review.** Questions to settle first, as a report, before any building. In this order:

1. **Is the repository design right, from first principles?** The point of the repository is that unchanged large files are never uploaded or downloaded again, which makes transfers faster and safer. Does it upload and download only what changed, and does each upload and restore land whole or not at all? Is it well optimised overall? The owner thinks the repository principle is good; propose a better one only if there is one.
2. **Handoff or live sync?** Today one device runs the session and "Continue here" hands it over. It sends few requests but feels slow and heavy: Continue here takes a while, and a pause reached the other device only at the next check, about every 2 minutes (within about 10 seconds since 2026-11-12, item 23). The alternative is live sync, the way a messaging app works: the same session runs on several devices, and a note edit, a timer pause or an added block reaches the other devices on its own. Compare the two.
3. **Constraints any answer must meet.** Local-first: nothing in the app waits for the internet or Drive. Drive sign-in lasts about 1 hour and there is no server. Full end-to-end encryption, at rest and in transit, comes later and must fit.
4. **Then speed.** Drive backups take over 20 s and Device Folder backups 2–3 s. Make Drive faster first (backup, then restore), then make handoff feel seamless and quick, then make the Device Folder (about 2 s) faster still. Rows 4 and 8 above and the Drive items under "Noted for later" belong to this work.

### First look at items 1 and 4 (2026-11-04, from the phone's diagnostics)

- **Upload markers after bug 10.** A running upload refreshes its marker every 2 minutes, alongside the upload; a marker unrefreshed for 15 minutes is dead (closed or frozen page) and cleanup removes it. A long upload (a large attachment, 20 minutes or more) stays live because it keeps refreshing. One frozen over 15 minutes stops before its commit; next time it reuses the pieces already on Drive (unused pieces are kept 48 hours). Since PR #15 a short upload pays nothing extra: the renewal before the commit runs only when one is due, and the marker check was always there.
- **Why Drive is slow.** Request count, not data size. Each Drive request takes 1–4 s on the phone and an upload makes about 6 in a row, so a 10 KB upload takes 15–20 s. Handoff waits on the same steps.
- **What the design already gets right.** Data is split into pieces named by their fingerprint, like a torrent's. Only changed pieces move, every piece is checked on arrival, uploads resume by reusing pieces already there, big files go in resumable chunks, 8 pieces move at once, and a version exists only once complete. Safe, and it never loses data.
- **Where it is heavier than it needs to be.** All devices write into one shared history, so they need turns: upload markers, refusals when Drive moved on, the heartbeat, and cleanup that must step around live uploads. Most of the complexity and many of the round trips come from that. The whole library is also small (the phone's version was 8 pieces, about 12 KB), so round trips, not bytes, are the cost.
- **Options, cheapest first:**
  1. Fewer requests on today's design: make one file both the version and its commit, bundle a version's small pieces into one file (like git's pack files), ask Drive only for what changed since the last look (its changes list), and run independent steps together.
  2. One stream per device: each device writes only its own files, and the others read and merge them. No device ever waits for another, so markers, turns and most of the cleanup coordination go away; an upload becomes one or two requests.
  3. Merge by design (CRDTs, as in Automerge, Yjs or Loro): devices exchange small change records that are guaranteed to merge the same way everywhere, notes merged character by character. Fewer "kept for review" items (bug 3), and live sync (item 2) becomes possible. The largest change: the editor's text and the stored formats would move to it.
  4. Not worth it here: content-defined chunking (attachments rarely change in place) and devices talking straight to each other (needs a server to introduce them, against the no-server rule).
- **Suggested path:** measure, do option 1, then decide between 2 and 3 with the owner.
- **Handoff, first pass (2026-11-07).** Continue Here's waiting path cut from about 17 Drive round trips in a row to about 7 ([study-session.md](areas/study-session.md#moving-a-session)), with a full background sync starting the moment the session runs. Bringing notes in before the rest was considered and not done: a sync takes in one whole version in one verified step and downloads only what changed, so the notes and the rest arrive together within seconds; splitting it would add a second, partial merge path for little gain. Second pass (2026-11-07, owner's go-ahead): one lease for both the session read and the claim, Drive read while the person confirms, and "Moving Here…" shown at once (timer only after Drive confirms): about 5 round trips, 4 when Drive has not moved on. Next: measure on the devices; real seamlessness (a pause reaching the other device in seconds) needs the new backup machinery.

### Owner's requirements for the new backup machinery (2026-11-04)

A redesign must fit each kind of data, not one rule for all. Likely a fusion: merge-by-design (CRDT) records for small data, and today's fingerprinted-piece repository for large files. Settle per kind whether data lives in a shared history or in one stream per device.

| Data | Expected size | Needs |
|---|---|---|
| Settings, plans, review records | Small | Merge automatically (CRDT or per-record merge). |
| Active Session | Small, changes often | Fast handoff between devices: the biggest pain today. |
| Notes | Many notes, some large | Merge per note (one CRDT document per note, not one for all), and sync only the notes that changed. |
| Saved Days | 1,000–2,000 or more | Past days rarely change: store them in parts (per day or month), and sync only what changed. Never re-send the whole history. |
| Attachments | Up to 300 MB (a PDF) | Upload and download in pieces, pausable and resumable, including after the app closes or reloads. An interrupted upload from the same device never starts again from zero. Keep the fingerprinted repository for these, referenced from the records by fingerprint. Check how far today's resumable chunks survive a reload. |

- **Device Folder** uses the same machinery. It takes 2–3 s today: faster is welcome but not a concern.
- **Goals, in order:** handoff speed, then sync speed, sized to the data actually saved.

## Owner's requests (noted 2026-11-08)

- **Notification lifecycle, as a whole (not now).** Every notification should have a lifecycle: it appears when it matters, and it goes away by itself once it no longer applies, instead of staying around or piling up. Action notifications matter most: they must appear at the right time and, above all, never offer an action that could now do something unintended. Example: a "kept for review" from two or three weeks ago, after much syncing since, whose Review could restore something the person no longer means to restore. Such an action has to re-check that it still applies when pressed, expire, or explain what it would change now. View-only notifications should not bombard the person with things that no longer matter. Start with an inventory of every notification source (sync, kept versions, session hand-off, storage and backup check, Device Folder, app update, sign-in) with what retires each one.
- **Expand the sync QA matrix? (to decide).** The sync journeys (`tests/browser/backup/sync-journeys.mjs`, `session-handoff-journeys.mjs`) found many hidden bugs on their first runs: a 30 s takeover check, devices with a wrong clock unable to read each other's data, sync not resuming after going offline, an app killed mid-sync locked until a reload, changes made during an upload left unsent; asserting no reviews after each handoff then found a new device saving the starter plan as its draft. Consider more permutations of real multi-device use: three devices, longer offline spells, a phone killed at each sync step, password changes, app updates mid-sync, large attachments, several days of history.

## Owner's requests (noted 2026-11-14)

Notes: creating, moving, renaming and empty notes. Noted, not started; the owner asked for the findings first.

1. **Rename "does not work" on a new note.** A note is stored only once it has text, so until then Rename, Move, Earlier versions, Export, Print and Delete in its ⋯ menu are all disabled, and its title is plain text instead of a button. The reason is only a hover tooltip ("Write something in this note first"), which touch screens never show. Proposed: an unsaved note can be renamed and moved at once (only its in-memory name changes, nothing is stored) and Delete discards it; the other items say why they are unavailable in the menu itself. Also start the inline rename after the menu has closed, so a browser that hands focus back to ⋯ late (possibly Safari) cannot end it at once; Chromium was checked and works.
2. **New and Move dialogs are unrefined.** Move asks for a typed full path with `>` (`GS2 > Polity`); there is no list of places, no search, no "Top level", and the preview only echoes the text. New offers only "Inside <open note>" or "At top level", so another parent must be opened first; its copy uses "Area or topic" and "Creates a child", and its hint and preview are noisy. Proposed: one destination picker shared by both, built on the existing note picker (search, paths, "Top level", the note itself and its children excluded). Move picks a place and keeps the name; the result line reads "Polity › Articles, with 2 nested notes", and a name already there shows the merge question in place. New asks for the name first, with a "Location: GS2 › Polity · Change" line that opens the same picker. Rename stays separate (the title).
3. **Right-click a note in the list** for its actions (Rename, Move, New note inside, Earlier versions, Export, Print, Delete), the same items as ⋯, opened at the pointer; a long press does the same on touch screens. Support Activities offers none, as now.
4. **Empty notes.** Four different things look the same in the list (muted, "empty") but behave differently, checked 2026-11-14:

   | Kind | How it arises | Today |
   |---|---|---|
   | New, unsaved | New, before anything is typed | Every ⋯ item disabled, title not clickable; it vanishes without a word when another note is opened |
   | Plan placeholder | An Area in today's plan with no note | Same disabled menu; meta reads only "In today’s plan" |
   | Parent placeholder | A child's path names a parent with no note ("Geo" for "Geo > Rivers") | Same disabled menu, so the parent cannot be renamed or moved except by moving each child; the stray "Support Activities" was one of these |
   | Cleared | A saved note whose text was deleted | Stays stored with a full menu; Export and Print then say "Write something first" |

   The header count also counts placeholders (4 for 3 real notes and a parent placeholder in the check). Proposed: let all three unstored kinds be renamed and moved (a parent placeholder carries its children; a plan placeholder offers to rename the Area in the plan, as Rename does now); give each a plain line in place of "empty" ("Not written yet", "In today’s plan · not written yet", "Holds 2 notes"); keep a new note in the list until it is written or discarded, with Delete discarding it; count real notes only; and offer "Delete" for a cleared note as for any other. To decide with the owner: whether a cleared note should be removed by itself after a while (it never is today).

## Decided, not yet scheduled

- **Better Smart merge** (`mergeThreeWay`). The owner will come back to it; until then, do not audit it or suggest changes.
- **Math equations in notes.** Later. Code formatting can be switched on in the editor if wanted.

## Noted for later

- **A saved day keeps itself up to date** (owner, 2026-11-12; to consider later, close to autosave). Today Save Today pauses a running timer so the Saved Day cannot fall behind (item 24). The alternative: Save Today never touches the timer, and work done after a save updates the Saved Day by itself (when the app is closed, at midnight, or at the next start), with a quiet note such as "Updated in Library: +34 min on Ethics after your save". It asks only when the Saved Day holds something the session lacks (edited in Library, say). A finished day never saved would be saved the same way the next morning. Trade-off: a timer left running until a fixed block or closing counts, as on a day never saved; Finish Today still ends the day exactly. The pause stays until this is decided.
- **Encryption at rest.** Browser data (IndexedDB, browser storage, attachments) is not encrypted; backups are, when a password is set. End-to-end encryption with a sign-in-first experience is the intended direction, and it also decides password recovery and changes.
- **Fully silent background sync** would need a small server to hold Google refresh tokens. Not planned: sync during sign-in windows is the accepted design.
- **Drive sign-in in localStorage.** An accepted trade-off (short-lived `drive.file` token, no refresh token). Revisit only as an explicit product and security decision ([backup-and-sync.md](areas/backup-and-sync.md#rules-the-engine-applies-once)).
- **Very large backups.** Measure restore of a very large library. Aggregate backup size and storage pressure on small devices are deferred until there is concrete evidence of a problem.
- **Drive maintenance planning** can be expensive on a cold, paginated Drive inventory. Measure it with real Drive before building a resumable planning cursor.
- **Duplicate local checkpoint captures**: an optimisation to make only if measurement shows it matters.
- **Large orchestration modules** (`backup-provider.js`, `backup.js`, `app.html`): no splitting by size alone; consolidate only proven duplication.
- **`backup-encryption` browser test** fails only under concurrent load and runs alone until its cause is found ([tests/README.md](../tests/README.md#browser-test-reliability)).
- **Unregistered sessionStorage key** `study-director.backup-operation-diagnostics.v1` is not listed in `contracts/data-architecture.mjs` with the other browser-storage keys.

## Not yet checked

CI and simulated devices cover the code paths; these need a person and real hardware ([workflow.md](workflow.md#real-device-acceptance)).

- Real Google Drive: sign-in, long and interrupted transfers, paginated inventory, slow maintenance, two real devices handing a session over.
- Device Folder permission revoked and granted again on desktop Chromium; iPad and iPhone fallback without folders.
- Android and desktop suspend, kill and reopen; storage pressure and eviction; idle battery and heat.
- Safari and iPad OPFS iterator behaviour during cleanup.
- The status indicator, notification stack and profile panel: in every skin and theme, with a screen reader, and the new sounds on phone speakers.
