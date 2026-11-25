# Backlog

Open work, decisions still to make, and what has not been checked yet. Nothing here is started without the owner's go-ahead. When an item is done, remove it and record any lasting decision in its area's doc.

## Experimental native platform (tauri-spike only)

Owner-authorized programme: see [native platform](areas/native-platform.md). Phase 0 source/design census and exact baseline CI evidence are recorded; independent local baseline reproduction remains unperformed. P1.A shell/platform boundary is completed with real Windows compilation, authentic Cargo.lock, packaged WebView2 feature/persistence/security acceptance and targeted PWA regression. Phase 1 B–G and Phase 2 A–I remain open. Native managed transports, OS capabilities, close settlement, updater and packaging remain outstanding; P1.G includes comprehensive real Windows qualification (including OS restart, sleep, power-loss and broader fault scenarios). No production configuration is changed. The installed-app OAuth client/project and signed updater configuration need appropriate owner approval before external configuration changes. Use synthetic test libraries only.

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
| 2026-11-22 | Phone, F29 → F32 | The database was found empty at the first F32 start (16:12 UTC). The last start before it was on F29 (03:09, last write 03:11). Drive refilled it: 21 of 21 Saved Days, notes 19 → 20. localStorage survived, and `storagePersisted=true`. In the test browser a straight F29 → F32 update keeps the database, so the update alone does not cause it. |

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

**From the 2026-11-17 diagnostics, to check next.** Why no "Database before last loss" record was kept, although localStorage survived (`Local storage health` and the profile list are there). Simulated in Chromium on 2026-11-22: a database deleted while the app is closed keeps the record, also for a second loss with no cold start in between (each start writes its record once the tab controls the data, and its first write counts as data held). So the gap is in the device, not in the record's rules: Copy diagnostics on that device after the next loss. Whether the owner saw "Browser data was cleared" this time. The Drive formats row and Format cleanup belong to F29 (F30 has neither): read them on each device while it still runs F29.

**Related.**

- *No low-space warning:* browsers tell a web app only its quota (about 10.7 GB on the phone) and its own use, not the device's free space.
- *Device Folder permission lost often on Android,* even between sessions on the same day (on the laptop it holds). Perhaps the same fault, since the chosen folder is remembered in the database; also check how Chrome on Android keeps folder permission between visits.

### Kept versions that keep coming back (owner, 2026-11-16)

After resolving every review on the iPad and on the laptop, they came back again and again, and the status badge's yellow dot came and went (the iPad had last been opened over a week before). Diagnostics then held a session kept at a handoff and a Saved Day kept as `saved-day-deletion` (one device deleted it, the other kept a copy; changed 8 Nov, kept again today). Not yet explained from the code; two leads:

- Each review's default is "keep this device's". Resolved that way on both devices while they hold different versions, the difference remains, and a later sync can find it and keep it again under a new review.
- Each Continue Here may keep a session for review when the two copies' decisions differ (`yield`, `hand-over`); the trace marks `session-kept-for-review` with its reason.
- *Next:* Copy diagnostics on the device where a review reappears, right after it does (the "Status badge" line, the Kept version lines and `session-kept-for-review`), and note which item it is. Workaround: on one device choose "Use kept", so both hold the same version.

### Open

- **11. The storage figure** (about 4 GB on the phone, 21.9 MB on the laptop): see the data-loss investigation above. Once the census says what the figure is made of, show the app's own measured size, and the browser's estimate only as a labelled extra.
- **12. Drive cleanup on a busy phone.** A busy device finishes cleanup (tested: 200 versions, 3 s per read, a version every 2 minutes). Still open: verified summaries live in memory, so a page the phone reloads reads them again; keep them across reloads only if the phone's diagnostics show reloads cutting cleanup off. Confirm the Drive version count falls back to about 30.
- **14. Drive requests are slow on the phone:** 1–4 s each, about six in a row per upload, so a 10 KB upload takes 15–20 s; the catch-up after a bring-in downloaded the same 8 files again. Part of the Drive speed work below.
- **15. Background work on phones** (decided for now): a backgrounded mobile page is frozen and no service worker can help (Drive sign-in lasts an hour without a server). No background service; any device that completes Drive cleanup tidies it for all.
- **16. The app feels slow overall** (owner, 2026-11-05). Measure on the phone and iPad first (start-up, tab switches, Library, Plan, Execute, typing, dialogs, sync in the background), then fix the worst. Last among the bugs; includes observation 7.
- **26. Editor mount and unmount lifecycle** (owner, 2026-11-16: wanted; after F28 is confirmed on the devices, as its own pull request). One clear owner of when an editor mounts, stays and goes, in place of the runtime, the lifecycle step and each view each deciding part of it. F28 closed the gaps that showed (item 28); more may remain, such as the diary editor or a note open through a date change or a restore.
- **A full local safety copy before every bring-in** (seen in the item 25 traces, 2026-11-16 and 17: `local-safety-capture` 478,780 and 955,832 bytes, attachments included). That work grows with the library, for every sync, even one that changes one note. To weigh with the Drive speed work.

### Fixed, to confirm on real devices

Each fix shipped in the build named, or in F25 if none is (the reports were seen on F18; F25 also changed a format, so update every device at about the same time).

| # | Fixed | Confirm on the devices |
|---|---|---|
| 25 | The download count is what is fetched, not attachments already here (F30) | a sync after another device changed a note: the panel shows a few KB, not the attachments' size |
| Sign-in (open 28) | Signing in again goes straight to the profile's account (no account chooser, also after a reload); the card shows the sign-in and closes instead of "Checking Google Drive…" for up to 20 minutes; changes made while signed out go up at once; another account is refused before Drive is used; Disconnect signs only this device out, and pressed during a sync stops it safely instead of doing nothing (F30) | sign in again after the hour on the iPad and the Mac; Disconnect on one device leaves the others signed in. If a sign-in still hangs on Safari, Copy diagnostics at once (a pop-up that never answers keeps the request pending for 2 minutes) |
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
| Notes menus | Support Activities and Recently deleted rows open the app's menu on right-click and long press, never the browser's or a text selection: Support Activities New note inside, Export and Print, a deleted note Restore and Delete forever; the open drawer's arrow points up (F30, [notes.md](areas/notes.md)) | right-click and long press on both, on the iPad and the Mac |
| Notes inside Support Activities | New note inside from its menu; such notes have the ordinary menu; a work block's Area can't be "Support Activities" or inside it, and support blocks keep any Area (F30, [notes.md](areas/notes.md)) | a note inside Support Activities on the iPad; the Plan editor refusing a work block with that Area |
| Typing goes up after a pause | A note or a reflection being typed uploads 10 s after its last save, never while typing (the 20-minute limit still holds); a reflection typed on a day with no session no longer uploads every few seconds (F30, [backup-and-sync.md](areas/backup-and-sync.md)) | type a note on one device, see it on another within about 20 s |
| Sync now in the profile panel | The Google Drive row has Sync now while signed in, beside a quieter Disconnect (F30, [status-indicator.md](areas/status-indicator.md)) | the iPad and the Mac |
| Paste from Word, Apple Notes, Mail | Lists, quotes and tables at the start of a paste stay whole; Word's lists, bold and italic; `•` bullets; task lists as checklists; `###` as level 2 (F30, [notes.md](areas/notes.md)) | paste a list from Word, Apple Notes and Mail on the Mac and the iPad |
| Review card readable in Director Light | The dark Review card's light text, written as plain rules; the heading names the day under review, not today (F30, [ui.md](areas/ui.md)) | Review in Director Light on the Mac and Android Chrome; a reflection for yesterday shows yesterday in the heading |
| Insights opens with the entrance | A first Insights open now arrives with the same entrance as a reopen and every other pane, in every look, once its view replaces the loading panel (F30, [ui.md](areas/ui.md)) | open Insights first thing after starting the app, in Director, on the Mac and the phone |
| Second window: attachments | A tab or window without control (the app open as a PWA and again in a Chrome tab) opens attachments instead of "Attachment operation failed: App ownership is unavailable before reconciling the active session" (F30, [data-and-storage.md](areas/data-and-storage.md#canonical-only-storage)) | the PWA in control and a Chrome tab: open an attachment in the tab |
| Practice Pacer on a new day's Review | Review shows only the day's own Practice Pacer runs; yesterday's run no longer appears after a rollover and a new plan (F30, [study-session.md](areas/study-session.md)) | the phone the morning after a day with a Pacer run |
| Day end with a day still loaded | A device that slept through 04:00 saves nothing and closes a covered day quietly (no "Study day auto-saved", no second version); a copy with only the plan is kept quietly, never saved or asked about; a live one never re-saves a covered day or overwrites another device's Saved Day, and keeps a plan-only day as an empty day (F30, [study-session.md](areas/study-session.md)) | leave the laptop's app open overnight after Save Today: no "auto-saved" notice, no kept version on the phone; begin a plan on the phone, work on the laptop: next morning no empty day against the real one |
| Morning question after a hand-off | The question about a previous day comes after startup; signed in, a sync comes first; signed out, "Check Google Drive first" signs in and syncs, and a copy the other device's save covers clears; Apply never replaces an unsaved previous day unasked; "Study day auto-saved" is news, not the "Unsaved work needs attention" banner (F32, [study-session.md](areas/study-session.md)) | begin the day on the phone and let it sleep; continue and save on the laptop; next morning on the phone, tap Check Google Drive first: the copy clears, nothing kept for review |
| Notes D | Support Activities stored under its own name and a fixed id, every copy converted (note, kept versions, browser copy, older backups and versions); backup files v26 and Drive versions 11, so older builds wait for an update; "Format cleanup" also checks the newest Continue Here claim (F29, [notes.md](areas/notes.md#how-notes-and-areas-fit-together)) | every device on F29 at about the same time; Support Activities reads normally; then Copy diagnostics, "Format cleanup" on each device |
| Obs. 2 | Catch-up when Drive connects: a looping failed catch-up fixed (`2eaf3fe`), faster Drive backups (`5bbc008`), a Connect card showing each step on every tab (`eb8601d`; [status-indicator.md](areas/status-indicator.md#connect-google-drive-card)) | the iPad connecting Drive |

## Order of work (2026-11-12)

1. **Data loss on the phone** (top of this page, with item 11): the current build on the phone, then Copy diagnostics after the next loss, before answering the notice. The fix follows the evidence.
2. **Drive speed** (item 14, with the backup and sync review below): fewer requests per upload first.
3. **The remaining bugs:** item 12 if the phone shows it, item 16 (measure first).
4. **Test programme:** resume at step 4a.
5. **The new backup machinery:** the review, options and requirements below, Device Folder included.

## F30: canonical-only storage, on `refactor/background-coordination`

The owner approved it on 2026-11-17: every device runs F29, and F30 reads only the current formats, F29's data included. The rules are in [data-and-storage.md](areas/data-and-storage.md#canonical-only-storage); the history is in git.

- **What it reads.** Backup files v26, repository manifests v11, ownership claims v4 and the current local records. Older data is refused or held untouched; no converters, historical imports, folder moves or old theme names ship. The inert F29 `dailyRecordMigration` marker is ignored.
- **Checked.** A real F29 database and F29 exports (encrypted too), a v11 manifest, F29's Drive markers and a Device Folder moved by F29 all open in F30. The release audit (2026-11-21) found two regressions from the strict readers and fixed both with tests: a sync or restore bringing in a session failed its read-back, and one whose attachments were already on the device failed. Fast suite, smoke and the six Drive journeys pass. Also in F30: items 25 and Sign-in in the table above.
- **Before shipping.** Every device shows Format cleanup `ready` (Drive still held one older version on 11-17; otherwise remove that version from Version history after the update). After the update, the Profiles diagnostics line reads `observed` and the Device Folder shows no old folder.
- **Not run.** The full promotion suite and real-device certification.

## Owner's observations (noted 2026-10-25)

Status checked against the code and git history and confirmed by the owner on 2026-11-02. Done: 2 (to confirm, in the table above), 6 (the notes audit, 2026-11-13; its open findings are under Notes below) and 9 (the migration code, removed in F30; see F30 below).

| # | Item | Status | Evidence / what is left |
|---|---|---|---|
| 1 | **Seamless first start with Drive.** A new phone install, with data already on the laptop, showed the name form and "Connect Google Drive". Can connecting Drive come first and offer the profiles found there, so a second device needs no name and no setup? | Open | Joining a library from the first-start form already takes its name and settings, and a new device's start-up settings are no longer kept for review (`5bbc008`). Picking the profile from Drive before the form is not built. |
| 4 | Audit the backup system again (report only). | Partly | Drive backup speed and the kept-for-review loop were audited and fixed on 2026-11-01. A full backup audit has not been done since. |
| 5 | Audit the background services twice more (report only). | One of two done | An independent audit and fix programme (21 findings, P0–P6) finished on 2026-11-01 ([history.md](history.md)). The second pass is open. |
| 7 | **Performance check** on a slow, throttled profile: start-up, tab switches, Library, Insights, typing in notes. | Partly | Insights now opens from an idle pre-computed model (`c24fc30`). The other surfaces have not been measured on a slow profile. |
| 8 | **Backup speed and safety** for both Drive and the Device Folder. | Partly | Drive backups measured and made faster on 2026-11-01. Device Folder speed and restore speed not measured again. |
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
- **An unreadable Continue Here claim stops hand-overs** (audit, 2026-11-21; F29 behaves the same). Unreadable upload markers and Device Folder locks age out after a day since F30; a claim cannot, because each new claim is numbered from the newest readable one. Unlikely (a claim is one small file written whole). Seen as Continue Here failing with "could not be verified safely". A fix changes how claims are numbered, so it needs its own design and the hand-over journeys.
- **Large orchestration modules** (`backup-provider.js`, `backup.js`, `app.html`): no splitting by size alone; consolidate only proven duplication.

## Not yet checked

CI and simulated devices cover the code paths; these need a person and real hardware ([workflow.md](workflow.md#real-device-acceptance)).

- Real Google Drive: sign-in, long and interrupted transfers, paginated inventory, slow maintenance, two real devices handing a session over.
- Device Folder permission revoked and granted again on desktop Chromium; iPad and iPhone fallback without folders.
- Android and desktop suspend, kill and reopen; storage pressure and eviction; idle battery and heat.
- Safari and iPad OPFS iterator behaviour during cleanup.
- The status indicator, notification stack and profile panel: in every skin and theme, with a screen reader, and the new sounds on phone speakers.
