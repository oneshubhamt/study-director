# Backlog

Open work, decisions still to make, and what has not been checked yet. Nothing here is started without the owner's go-ahead. When an item is done, remove it and record any lasting decision in its area's doc.

## Bugs reported by the owner (2026-11-03)

**Bugs come first** (owner, 2026-11-03): every bug here before new features, performance work or other improvements, except the test programme. A fix in a sensitive area (sync, storage, sessions, timer) comes with a test; a small fix elsewhere needs none ([workflow.md](workflow.md#choosing-tests)). Item numbers are kept from the owner's reports, so references in code and docs still hold.

### Top priority: local data disappears by itself (phone and iPad, since 2026-11-05)

An offline-first app must never lose local data by itself: deep audit first, before other bugs. It did not happen before multi-device sync and profiles. Each time, a Drive sync brought everything back.

**What happens.** At a cold start, the app's database (IndexedDB) is gone, and with it everything kept there: study data and the app's own bookkeeping (Drive verification history, format counts, the Device Folder permission). The rest of browser storage (localStorage) survives: the profile list, the name and the Active Session's rescue copy are still there, so there is no Welcome form. Persistent storage reads granted. Both devices run the app from the Home Screen icon; Delete everywhere was never used; both profiles date from before profiles existed (plain storage names).

| When | Device, build | What the owner saw |
|---|---|---|
| 2026-11-05 (probably 11-04 too) | Phone, F20 | At a cold start after a day or two unused (data there at night, gone in the morning, nothing done in between). Snapshot 02:56 UTC: everything device-local gone, usage about 10.7 MB, the same as right after its site data was cleared on 11-04. Drive signed out (expected: a sign-in lasts about an hour); signing in caught up. "No local study data found" not seen, but that brief toast is suppressed by any leftover rescue copy or deletion record, so its absence proves little. |
| 2026-11-05 | iPad | The same, on the first start of a new version (the phone was on the same version as before: so neither an update nor a sync is needed for it, only a cold start or the browser while the app is unused). Safari's data was never cleared; about 1 TB free; no cleaning tool ever used. |
| 2026-11-08 | Phone, F24 | A block ran, the app was swiped away and the phone locked; 30 minutes later a cold start showed "Browser data was cleared". The session was rescued, the notice offered restore or keep, and the Saved Days (probably all) came back through the restore at Drive sign-in; what else was missing is not known. No other device in use, nothing that clears data used; F24 had worked for three or four opens before. Diagnostics (copied after the sync, so from a later page load: its `startedFresh=false` does not contradict the notice): bookkeeping `state=never`, Device Folder disconnected since 16:13:50 (the likely start), storage persisted. The phone was 97% full (about 125 of 128 GB) and the site used about 4.3 GB of a 15 GB quota. |
| 2026-11-11 | Phone, F24 | The notice again at a cold start, two days after the last open (installed app, closed by a swipe); Drive's latest version came back in (4 versions, no conflicts). `databases=1` (no old database left beside the new one); attachment cleanup and Drive convergence paused with `reason=storage-reset`. F25's census was not on the phone yet. Usage then 0.25 MB of about 10 GB: the 4.3 GB went with the database, and the quota shrank with the phone's free space. |
| 2026-11-17 | Device not stated, F29 | Diagnostics copied 01:17 UTC, after Drive had refilled the device. `Database this start: state=fresh, foundVersion=0, openedVersion=9`; `Profile storage: startedFresh=true, databases=1, scoped=false`, profile list present and listing this profile. **No "Database before last loss" line**, so either the loss record in localStorage was not written or this start was not counted as a loss. Drive sync at 01:15:07 restored the latest of 4 versions (16 objects, no conflicts; `startup-restore-recovery recovered=false`, so no interrupted-restore rollback). Storage: usage 12.9 MB of about 10.7 GB, persisted; census measured 6.3 MB, 6.5 MB unexplained, the browser's cache figure (11.2 MB) twice the measured caches (5.0 MB). 15 notes, 17 Saved Days, 7 attachments after the refill. `Format cleanup: state=unknown, retirementReady=false`; `google-drive formats: state=unknown, currentVersions=0` (the formats count was not filled in yet). |

**Ruled out, and why.**

- *The app wiping the site:* no `Clear-Site-Data` header; the service worker clears only its own caches.
- *The app deleting or emptying the database:* `indexedDB.deleteDatabase` is called only by profile cleanup (`profiles.js`), which skips the open plain profile. Opening and upgrading only rename stores, add missing ones and drop the three retired, data-free ones (`persistence.js`, `compatibility.js`). Each start-up migration runs in one transaction that rolls back rather than drop a record it cannot convert. Sync and Continue Here delete no database. Local data is otherwise deleted only by a person (Delete profile, Library clear, Reset Today). One narrow exception: a Drive "deleted" marker for this profile (Delete everywhere on another device) deletes it here when nothing is unsynced; never used, so not this. One narrow old path: very old tombstone records remove, once, only the Saved Days they name. And nothing clears the bookkeeping as a whole, yet it vanished: the whole database went, not records one by one.
- *A lost profile list opening a new, empty database:* a device's first profile always uses the plain storage names, with or without the list (only a profile from Add profile has its own names); and the list survived (no Welcome form).
- *A sync interrupted by closing the app* (lead of 2026-11-12, read in the code 2026-11-16): a sync applies through the restore's journaled path, and the next start rolls back to the state before that sync, with a "Local recovery completed: the interrupted restore was rolled back" notice. Only what the sync brought in goes, and Drive still holds it. It writes into the existing database, while every loss showed the notice only a new database raises, and lost bookkeeping a rollback leaves alone. Still possible as a side effect: on a device refilling itself from Drive after a loss, it could make the refill vanish once more at the next cold start (`startup-restore-recovery` in the trace would show it).
- *Ordinary eviction:* storage was persisted, and eviction removes a whole site, not only its database. Safari's 7-day limit applies to sites used in a tab, not from the Home Screen.
- *Low space alone:* the iPad lost its data with about 1 TB free, and the phone was just as low on space before the losses began, so the timing points to something that changed with the app (multi-device sync, profiles, F19, F20). Low space may still contribute on the phone.

**Leading explanation, to verify: a browser or storage-engine fault that loses or resets the database.** Browsers may delete an IndexedDB database they cannot open (as corrupt) and start a new one under the same name: same name, version 0, localStorage intact, as seen. On a 97%-full phone failing writes are a plausible way there; on the iPad, a process killed mid-write. Chromium has lost only IndexedDB before; WebKit has had background faults with long-lived connections, and the app keeps one, closed only on `versionchange` (worth keeping in mind for the iPad). So record errors before a loss, in storage that survives it.

**The phone's storage figure (one investigation with item 11).** About 4 GB on 11-03; about 10.7 MB after the site-data clear and the 11-05 loss; 4.3 GB again by the 11-08 loss, which it survived (4,305,971,748 bytes on 11-08 16:32, 4,305,794,215 on 11-09 06:16: it had stopped growing); gone with the database on 11-11. The laptop, with the same data, reads about 23 MB. So on the phone something outside the study data grows from almost nothing to about 4 GB within about three days, then stays. It is not measured app data: the figure is `navigator.storage.estimate().usage` for the whole site; app caches (three release caches, a few MB), diagnostics and the local recovery copy (at most 4 MiB) are small, and the app holds no attachments and had no kept versions. Candidates: backup scratch files (OPFS) piling up despite cleanup that looks sound, a folder at the OPFS root the current code no longer knows, the browser's physical database files being far larger than the records, or a wrong estimate (Chromium has an open bug on OPFS estimates on Android). A real 4 GB would make the app the biggest user of a nearly full phone; a false figure would rule that lead out.

**Built so far.**

- *Detector* (2026-11-07): a start that creates a new database where study data was saved before shows "Browser data was cleared", pauses automatic backups and records when ([data-and-storage.md](areas/data-and-storage.md#browser-data-clearing)). It caught both later losses; a loss with no notice would mean the whole site was cleared. Since 2026-11-11 each loss records its own time (an unanswered earlier notice used to keep the old time).
- *Recovery* (2026-11-07): Drive connecting syncs the library back by itself (the notice used to pause sync until answered); choosing the Device Folder again offers its newest version from before the clear; "study data was saved here" covers sessions, plans and kept versions (settings alone do not); an older open tab cannot move it back. With the app open when storage is cleared and a location still connected, missing data comes back from the Device Folder first, otherwise Drive (`restoreMissingAfterStorageReset`). With the app closed when it happens, nothing is connected at the next start (the folder choice and the Drive sign-in were in the emptied database too): the app can only show "No local study data found" if it sees signs of earlier use, and signing in to Drive then syncs the data back (since F21).
- *Diagnostics:* a "Profile storage" line (own storage names or plain, the profile list present and listing this profile, whether this start created the database, how many Study Director databases the site holds: a new database beside an old one means the data is probably still on the device), and since F25 the storage census ("Storage census …", "Database this start", "Database before last loss"): the browser's estimate with `usageDetails`; per-store counts and sizes, appMeta by family; OPFS folders with every root entry; Cache Storage; the measured total against the browser's figure; and a database record kept in localStorage (opened fresh or existing, version, unexpected closes, last good write, last error, counts at the last good start). Not yet checked on the phone or in a real browser.
- *Deliberately not done:* no change to attachment cleanup (reachability checks, locks and tests are sound; an orphan may survive a reload until the next sweep) and no `db.close()` on `pagehide`, until evidence points there.

**Next.**

1. The current build on the phone. After the next loss, before answering the notice and before signing in to Drive: Copy diagnostics, a screenshot of what the app showed, and the browser and whether it ran from the Home Screen.
2. Meanwhile, from the releases where it began (multi-device sync, profiles, F19, F20): list every change to how the database is named, opened, upgraded or deleted, and to per-profile storage, and check each against a start-up on a full device.
3. The fix follows the evidence: a test for each path found, at the right layer, and a guard so that no automatic path can leave local data emptier than it found it without the person's choice.
4. Faster backups limit the damage whatever the cause: a loss costs only what has not reached Drive or the Device Folder yet (items 18 and 22 once stopped Drive backups for up to 30 minutes).
5. Still to explain: why the phone on 11-05 showed no automatic recovery (perhaps nothing survived that said data had been there).

**From the 2026-11-17 diagnostics, to check next.** Why no "Database before last loss" record was kept, although localStorage survived (`Local storage health` and the profile list are there): the record may be written only after the start's first count, or skipped for a database it did not see open before. Whether the owner saw "Browser data was cleared" this time. Why the Drive formats row reads `unknown` with a connected, verified Drive (F30 needs it to read `ready`).

**Related.**

- *No low-space warning:* browsers tell a web app only its quota (about 10.7 GB on the phone) and its own use, not the device's free space.
- *Device Folder permission lost often on Android,* even between sessions on the same day (on the laptop it holds). Perhaps the same fault, since the chosen folder is remembered in the database; also check how Chrome on Android keeps folder permission between visits.

### Open

- **28. Drive sign-in gets stuck after the hour expires** (owner, 2026-11-17, iPad and Mac, F29). The app had been in the background. The sign-in requested after the hour runs out does not finish; Disconnect and then signing in again works. The 05:57 UTC diagnostics were copied after the workaround, so they show only the new sign-in (`signInEndsAt` 06:53:48, so signed in at about 05:53:48) and normal syncs; Drive work at 05:50–05:51 still succeeded. **The sign-in flow itself is not traced:** no start, pop-up, token or timeout lines. *Next:* trace the renewal (requested, pop-up opened or blocked, token received, gave up, and the step it stopped at); check renewal after the page was hidden (a pop-up opened without a fresh tap, a stale pending request, or a background tab's timers); fix with a test.

- **11. The storage figure** (about 4 GB on the phone, 21.9 MB on the laptop): see the data-loss investigation above. Once the census says what the figure is made of, show the app's own measured size, and the browser's estimate only as a labelled extra.
- **12. Drive cleanup on a busy phone.** A busy device finishes cleanup (tested: 200 versions, 3 s per read, a version every 2 minutes). Still open: verified summaries live in memory, so a page the phone reloads reads them again; keep them across reloads only if the phone's diagnostics show reloads cutting cleanup off. Confirm the Drive version count falls back to about 30.
- **14. Drive requests are slow on the phone:** 1–4 s each, about six in a row per upload, so a 10 KB upload takes 15–20 s; the catch-up after a bring-in downloaded the same 8 files again. Part of the Drive speed work below.
- **15. Background work on phones** (decided for now): a backgrounded mobile page is frozen and no service worker can help (Drive sign-in lasts an hour without a server). No background service; any device that completes Drive cleanup tidies it for all.
- **16. The app feels slow overall** (owner, 2026-11-05). Measure on the phone and iPad first (start-up, tab switches, Library, Plan, Execute, typing, dialogs, sync in the background), then fix the worst. Last among the bugs; includes observation 7.
- **25. Attachments seen downloading on a cold open** (owner, 2026-11-16: laptop, phone and iPad, at a cold open and its first sync; perhaps uploading too). Not reproduced: in two-device tests, with and without a backup password, through cold opens, catch-ups and uploads after a cold open, each attachment moved once per device and never again (Drive objects are reused by fingerprint). The constant uploads fixed in F28 (item 27) may be what was seen. Next time: Copy diagnostics right after that first sync; its `provider-object-download-start` and `provider-object-upload-start` lines give each object's size, so attachment-sized ones show whether attachments really moved.
  - *Reproduced on the laptop, F29 (2026-11-16 12:20 UTC with a screenshot, and 2026-11-17 02:08 UTC):* the sync panel read "Downloading backup data from Google Drive… 0 of 14 complete · 0 KB of 471 KB", and the next day about 937 KB. **The diagnostics show that attachments were not downloaded.** Only the small objects were fetched: 8 of 14 (29 KB) on 11-16 and 9 of 16 (38 KB) on 11-17. The attachments were already on the device and were reused. **The panel's total is wrong:** it counts every object in the version, attachments already here included (the 452,935 and 921,535 attachment bytes on the device plus the 29 KB and 38 KB fetched make exactly 471 KB and 937 KB). *Fix:* count only what will be downloaded (perhaps "38 KB to fetch, 900 KB already here"), and test it.
  - *Also seen, to weigh:* every bring-in first writes a full local safety copy, attachments included (`local-safety-capture` 478,780 bytes on 11-16, 955,832 on 11-17). That work grows with the library, for every sync, even one that changes one note.
  - *By contrast:* the fresh database of 2026-11-17 01:15 (bug 1 table) downloaded all 16 objects, attachments included (66–469 KB each). That is correct after a loss.
  - *Same traces:* 11-16 12:20 kept a session for review (`session-kept-for-review · reason=yield`; see "Kept versions that keep coming back"). The page before the 12:19 reload deferred Drive with `needs-update`, as expected for a page still on F28 once Drive held an F29 version. The laptop's Drive formats read `olderVersions=1` (Format cleanup `pending`): F30 must wait for it.
- **26. Editor mount and unmount lifecycle** (owner, 2026-11-16: wanted; after F28 is confirmed on the devices, as its own pull request). One clear owner of when an editor mounts, stays and goes, in place of the runtime, the lifecycle step and each view each deciding part of it. F28 closed the gaps that showed (item 28); more may remain, such as the diary editor or a note open through a date change or a restore.

### Fixed, to confirm on real devices

Each fix shipped in the build named, or in F25 if none is (the reports were seen on F18; F25 also changed a format, so update every device at about the same time).

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
| 27 | Typing no longer uploads to Drive every few seconds: one upload 20 minutes after the first change, within seconds of a key moment, at once on going to the background (F28, [backup-and-sync.md](areas/backup-and-sync.md)) | Drive activity while typing; Continue Here still quick |
| 28 | A sync while typing keeps the editor and the cursor (Library note, reflection, Execute note); no raw `WG1:` text; today's reflection takes a click at once with no session (F28, [notes.md](areas/notes.md#which-editors-are-live)) | type while another device syncs; reopen after the app sat in the background |
| Notes D | Support Activities stored under its own name and a fixed id, every copy converted (note, kept versions, browser copy, older backups and versions); backup files v26 and Drive versions 11, so older builds wait for an update; "Format cleanup" also checks the newest Continue Here claim (F29, [notes.md](areas/notes.md#how-notes-and-areas-fit-together)) | every device on F29 at about the same time; Support Activities reads normally; then Copy diagnostics, "Format cleanup" on each device |
| Obs. 2 | Catch-up when Drive connects: a looping failed catch-up fixed (`2eaf3fe`), faster Drive backups (`5bbc008`), a Connect card showing each step on every tab (`eb8601d`; [status-indicator.md](areas/status-indicator.md#connect-google-drive-card)) | the iPad connecting Drive |

## Order of work (2026-11-12)

1. **Data loss on the phone** (top of this page, with item 11): the current build on the phone, then Copy diagnostics after the next loss, before answering the notice. The fix follows the evidence.
2. **Drive speed** (item 14, with the backup and sync review below): fewer requests per upload first.
3. **The remaining bugs:** item 12 if the phone shows it, item 16 (measure first).
4. **Test programme:** resume at step 4a.
5. **The new backup machinery:** the review, options and requirements below, Device Folder included.

## Owner's observations (noted 2026-10-25)

Status checked against the code and git history and confirmed by the owner on 2026-11-02. Done: 2 (to confirm, in the table above) and 6 (the notes audit, 2026-11-13; its open findings are under Notes below).

| # | Item | Status | Evidence / what is left |
|---|---|---|---|
| 1 | **Seamless first start with Drive.** A new phone install, with data already on the laptop, showed the name form and "Connect Google Drive". Can connecting Drive come first and offer the profiles found there, so a second device needs no name and no setup? | Open | Joining a library from the first-start form already takes its name and settings, and a new device's start-up settings are no longer kept for review (`5bbc008`). Picking the profile from Drive before the form is not built. |
| 4 | Audit the backup system again (report only). | Partly | Drive backup speed and the kept-for-review loop were audited and fixed on 2026-11-01. A full backup audit has not been done since. |
| 5 | Audit the background services twice more (report only). | One of two done | An independent audit and fix programme (21 findings, P0–P6) finished on 2026-11-01 ([history.md](history.md)). The second pass is open. |
| 7 | **Performance check** on a slow, throttled profile: start-up, tab switches, Library, Insights, typing in notes. | Partly | Insights now opens from an idle pre-computed model (`c24fc30`). The other surfaces have not been measured on a slow profile. |
| 8 | **Backup speed and safety** for both Drive and the Device Folder. | Partly | Drive backups measured and made faster on 2026-11-01. Device Folder speed and restore speed not measured again. |
| 9 | Remove the migration code (compatibility layer and Release B). | F30 complete on branch | Owner confirms all devices upgraded (2026-11-17); canonical-only retirement completed on `refactor/background-coordination`. See Release B below and [data and storage](areas/data-and-storage.md#canonical-only-storage). |
| 10 | **Optional size work.** The plain deployment build is not minified; a minified one exists (`stage:firebase:minified`). | Deferred (owner, 2026-11-02) | Later: deploy the minified build, or minify only `wordgard.js`, with a full test run. |
| 11 | **Whole-app quality pass.** Is the app clean, lean, elegant, efficient and reliable after this round of work? Is the notes system first-class? Measure memory over a long session and CPU and battery while idle and studying, then propose where to trim. | Open | Report only. |

## Test suite programme (approved by the owner on 2026-11-02)

The full plan, its rules and live status are in [test-programme.md](test-programme.md). Steps 1–3 are done; step 4 (backup and storage) was paused by the owner and resumes at step 4a.

## Backup and sync review (owner, 2026-11-03)

Questions to settle first, as a report, before any building. In this order:

1. **Is the repository design right, from first principles?** The point of the repository is that unchanged large files are never uploaded or downloaded again, which makes transfers faster and safer. Does it upload and download only what changed, and does each upload and restore land whole or not at all? Is it well optimised overall? The owner thinks the repository principle is good; propose a better one only if there is one.
2. **Handoff or live sync?** Today one device runs the session and Continue Here hands it over: few requests, but it feels slow and heavy, and a pause reaches the other device only at the next check (about every 2 minutes then, about every 10 seconds since item 23). The alternative is live sync, the way a messaging app works: the same session runs on several devices, and a note edit, a timer pause or an added block reaches the others on its own. Compare the two.
3. **Constraints any answer must meet.** Local-first: nothing in the app waits for the internet or Drive. Drive sign-in lasts about 1 hour and there is no server. Full end-to-end encryption, at rest and in transit, comes later and must fit.
4. **Then speed.** Drive backups take over 20 s and Device Folder backups 2–3 s. Make Drive faster first (backup, then restore), then make handoff feel seamless and quick, then make the Device Folder faster still. Observations 4 and 8 and the Drive items under "Noted for later" belong to this work.

### First look at 1 and 4 (2026-11-04, from the phone's diagnostics)

- **Why Drive is slow.** Request count, not data size: each Drive request takes 1–4 s on the phone and an upload makes about 6 in a row, so a 10 KB upload takes 15–20 s. Handoff waits on the same steps.
- **What the design gets right.** Data is split into pieces named by their fingerprint, like a torrent's. Only changed pieces move, every piece is checked on arrival, uploads resume by reusing pieces already there (unused pieces are kept 48 hours), big files go in resumable chunks, 8 pieces move at once, and a version exists only once complete. Safe, and it never loses data. (How upload markers stay live: [backup-and-sync.md](areas/backup-and-sync.md).)
- **Where it is heavier than it needs to be.** All devices write into one shared history, so they need turns: upload markers, refusals when Drive moved on, the heartbeat, and cleanup that must step around live uploads. Most of the complexity and many round trips come from that. And the whole library is small (the phone's version was 8 pieces, about 12 KB), so round trips, not bytes, are the cost.
- **Options, cheapest first:**
  1. Fewer requests on today's design: one file as both the version and its commit, a version's small pieces bundled into one file (like git's pack files), asking Drive only for what changed since the last look (its changes list), and independent steps run together.
  2. One stream per device: each device writes only its own files and the others read and merge them. No device waits for another, so markers, turns and most cleanup coordination go; an upload becomes one or two requests.
  3. Merge by design (CRDTs, as in Automerge, Yjs or Loro): devices exchange small change records guaranteed to merge the same way everywhere, notes merged character by character. Fewer "kept for review" items (bug 3), and live sync (question 2) becomes possible. The largest change: the editor's text and the stored formats would move to it.
  4. Not worth it here: content-defined chunking (attachments rarely change in place), and devices talking straight to each other (needs a server to introduce them, against the no-server rule).
- **Suggested path:** measure, do option 1, then decide between 2 and 3 with the owner.
- **Handoff so far (2026-11-07):** Continue Here waits on about 5 Drive round trips, 4 when Drive has not moved on, down from about 17 ([study-session.md](areas/study-session.md#moving-a-session)). Bringing notes in before the rest was considered and not done: a sync takes in one whole version in one verified step and downloads only what changed, so notes and the rest arrive together within seconds; splitting it would add a second, partial merge path for little gain. Next: measure on the devices. Real seamlessness (a pause reaching the other device in seconds) needs the new backup machinery.

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

- **Notification lifecycle, as a whole (not now).** Every notification appears when it matters and goes away by itself once it no longer applies, instead of staying around or piling up. Action notifications matter most: they must appear at the right time and, above all, never offer an action that could now do something unintended. Example: a "kept for review" from two or three weeks ago, after much syncing since, whose Review could restore something the person no longer means to restore. Such an action has to re-check that it still applies when pressed, expire, or explain what it would change now. View-only notifications should not bombard the person with things that no longer matter. Start with an inventory of every notification source (sync, kept versions, session hand-off, storage and backup check, Device Folder, app update, sign-in) and what retires each one.
- **Expand the sync QA matrix? (to decide).** The sync journeys (`sync-journeys.mjs`, `session-handoff-journeys.mjs`) found many hidden bugs on their first runs: a 30 s takeover check, devices with a wrong clock unable to read each other's data, sync not resuming after going offline, an app killed mid-sync locked until a reload, changes made during an upload left unsent, a new device saving the starter plan as its draft. Consider more permutations of real use: three devices, longer offline spells, a phone killed at each sync step, password changes, app updates mid-sync, large attachments, several days of history.

## Notes: what is left (agreed with the owner, 2026-11-15)

The notes audit's findings A to D are done (D, Support Activities under its own name and a fixed id, in F29).

- **Real-device check of the notes work of 2026-11-13 to 16.** Not yet tried on Safari, the iPad or the phone: swiping the tag row, the line under each note and its "# Tag" picker, Rename from ⋯ (the fix for a menu handing focus back late), right-click and long press (no system callout or text selection on the rows), New and Move, pinch zoom in the image view, dropping files. One pass per device.
- **Recently Deleted has no right-click or long-press menu** (owner, 2026-11-17). In the Library's notes list, deleted notes open no actions menu. Give them their own: Restore, and Delete forever. Fix it, and test it like the other rows.
- **Recently Deleted's arrow points the wrong way** (owner, 2026-11-17). When the drawer is open, the arrow left of the "Recently Deleted" label points down, but the drawer opens upward. The arrow should match the direction the drawer opens, in both states.

## Kept versions that keep coming back (owner, 2026-11-16)

After resolving every review on the iPad and on the laptop, they came back again and again, and the status badge's yellow dot came and went (the iPad had last been opened over a week before). Diagnostics then held a session kept at a handoff and a Saved Day kept as `saved-day-deletion` (one device deleted it, the other kept a copy; changed 8 Nov, kept again today). Not yet explained from the code; two leads:

- Each review's default is "keep this device's". Resolved that way on both devices while they hold different versions, the difference remains, and a later sync can find it and keep it again under a new review.
- Each Continue Here may keep a session for review when the two copies' decisions differ (`yield`, `hand-over`); the trace marks `session-kept-for-review` with its reason.
- *Next:* Copy diagnostics on the device where a review reappears, right after it does (the "Status badge" line, the Kept version lines and `session-kept-for-review`), and note which item it is. Workaround: on one device choose "Use kept", so both hold the same version.

## Release B (F30): complete on `refactor/background-coordination` (2026-11-17)

The owner confirms all devices completed the F29 upgrade and authorizes canonical-only retirement, including dropping old theme aliases. The F29 upgrade path was verified in source. This completes Claude's unfinished `dfa0eec5`, preserving the subsequent backlog additions through `49dbb65e`.

- **Source objectives met:** only current backup v26, repository manifest v11, ownership claim v4 and current local records remain readable. Startup converters, historical imports, obsolete identities, folder moves, retirement proofs and format-cleanup diagnostics are removed. Older data is refused or held untouched; current validation, crash recovery, failed-write rescue, restore journals and attachment protection remain. The inert F29 marker is ignored without conversion or authority ([storage policy](areas/data-and-storage.md#canonical-only-storage)).
- **Contracts, tests and docs aligned:** migration-only tests removed; mixed suites retain current-format and failure-path coverage. A real F29 export imports and re-exports in F30, including encryption, preserving records, notes, session, plans, preferences, deletions and attachments. Current publication markers remain renewable; unrecognized markers cannot authorize writes or cleanup.
- **QA passed:** 85 distinct targeted unit/integration/architecture files; build/verify, source/generated syntax, deployment and minified verification; binary backup capacity (64 MiB). Eight browser journeys passed: unsupported data (11 cases), populated Insights, maximum Insights import, Insights performance, complete encrypted library restore, Device Folder backup, two-device Finish Today and PWA update. Fixture dependencies on retired converters were replaced with canonical data; performance budgets were unchanged.
- Follow-up audit (2026-11-18) removed residual old checksum, file-picker, cache and reload paths, and regenerated four stale bundles. Current manifests still use bounded JSON parsing. A real F29 browser update preserved IndexedDB v9, all six stores and the saved Plan, then accepted a new Plan edit. F29's encrypted portable backup and v11 repository manifest also opened in F30. Bundle reproducibility and targeted backup, storage and PWA checks passed.
- Browser-state audit (2026-11-20) removed the v1 tab-owner reader, implicit storage-health conversion, duplicate maintenance-intent normalization and unused verification APIs. Current recovery readers preserve unreadable data and validate the whole record before replay or cleanup. The F29 marker exemption applies only to the version-1 metadata envelope. The same F29 database and F29 exports remain the upgrade baseline.
- The external-identity audit removed pre-profile Drive claiming and implicit local profile adoption. The format ledger now covers operational markers and leases. Completed F29 Device Folders retain their identity and versions. Unknown ownership evidence cannot authorize library adoption or profile cleanup. Version History requires current format, attachment and notes evidence. Drive publication checks now use the same renewal window as cleanup. Cross-build checks reopened a Drive library and both coordination markers written by F29, and preserved all ten files of a three-version folder moved by F29 byte for byte.
- Release audit (2026-11-21) found two regressions from the strict readers, both fixed with tests. (1) A sync or restore that brought in a session could fail with "Canonical Active Session read-back differs". Every lifecycle step first flushes the session with a fresh revision; the incoming session, saved after it, often carries a lower one, and its commit no longer retired the flush's rescue copy, which then won the next load. A save now replaces and retires a readable rescue copy whatever its revision; an unreadable one is still kept. (2) A restore or sync whose attachment bytes were already on the device failed with "Attachment metadata is invalid": the reused local row still carried its `id`. Before shipping, every device should show Format cleanup `ready` (Drive still held one older version on 11-17). After the update, Profiles should read `observed` and the Device Folder should show no old folder.
- No full promotion suite or real-device certification was run. Wordgard, `main`, TypeScript branches and unrelated backlog findings are unchanged. This is branch completion, not a production release.

## Decided, not yet scheduled

- **Better Smart merge** (`mergeThreeWay`). The owner will come back to it; until then, do not audit it or suggest changes.
- **Math equations in notes.** Later. Code formatting can be switched on in the editor if wanted.

## Noted for later

- **A saved day keeps itself up to date** (owner, 2026-11-12; to consider later, close to autosave). Today Save Today pauses a running timer so the Saved Day cannot fall behind (item 24). The alternative: Save Today never touches the timer, and work done after a save updates the Saved Day by itself (when the app is closed, at midnight, or at the next start), with a quiet note such as "Updated in Library: +34 min on Ethics after your save". It asks only when the Saved Day holds something the session lacks (edited in Library, say). A finished day never saved would be saved the same way the next morning. Trade-off: a timer left running counts until a fixed block or closing, as on a day never saved; Finish Today still ends the day exactly. The pause stays until this is decided.
- **Encryption at rest.** Browser data (IndexedDB, browser storage, attachments) is not encrypted; backups are, when a password is set. End-to-end encryption with a sign-in-first experience is the intended direction, and it also decides password recovery and changes.
- **Fully silent background sync** would need a small server to hold Google refresh tokens. Not planned: sync during sign-in windows is the accepted design.
- **Drive sign-in in localStorage.** An accepted trade-off (short-lived `drive.file` token, no refresh token). Revisit only as an explicit product and security decision ([backup-and-sync.md](areas/backup-and-sync.md#rules-the-engine-applies-once)).
- **Very large backups.** Measure restore of a very large library. Aggregate backup size and storage pressure on small devices are deferred until there is concrete evidence of a problem.
- **Drive maintenance planning** can be expensive on a cold, paginated Drive inventory. Measure it with real Drive before building a resumable planning cursor.
- **Duplicate local checkpoint captures**: an optimisation to make only if measurement shows it matters.
- **Large orchestration modules** (`backup-provider.js`, `backup.js`, `app.html`): no splitting by size alone; consolidate only proven duplication.

## Not yet checked

CI and simulated devices cover the code paths; these need a person and real hardware ([workflow.md](workflow.md#real-device-acceptance)).

- Real Google Drive: sign-in, long and interrupted transfers, paginated inventory, slow maintenance, two real devices handing a session over.
- Device Folder permission revoked and granted again on desktop Chromium; iPad and iPhone fallback without folders.
- Android and desktop suspend, kill and reopen; storage pressure and eviction; idle battery and heat.
- Safari and iPad OPFS iterator behaviour during cleanup.
- The status indicator, notification stack and profile panel: in every skin and theme, with a screen reader, and the new sounds on phone speakers.
