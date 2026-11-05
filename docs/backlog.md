# Backlog

Open work, decisions still to make, and what has not been checked yet. Nothing here is started without the owner's go-ahead. When an item is done, remove it and record any lasting decision in its area's doc.

## Bugs reported by the owner (2026-11-03)

**Top priority (2026-11-05): local data disappears by itself on the phone and the iPad.** On F20, the phone lost its study data on 2026-11-05 (and probably on 2026-11-04) without browser data being cleared, and the iPad lost its data the same way, though Safari's data was never cleared. Syncing with Drive brought everything back. It did not happen before multi-device sync and profiles. An offline-first app must never lose local data by itself: deep audit first, before other bugs.

- **Suspects to check, in this order:**
  1. Profiles and per-profile storage: the app opening a different or new profile's (empty) storage, for example after a change of device id or a profile registry read that fails, so the data is still there but not shown.
  2. Start-up and update paths: database upgrades, read-once migrations, and the compatibility removals, which might drop records an update no longer reads.
  3. Code that clears or replaces local data: the storage-reset flow, Library clear and its recovery journal, restore rollback, sync apply or handoff ("Continue here") replacing local data with an empty or older state.
  4. Browser eviction: Safari's 7-day limit on storage for sites used in a tab and not added to the Home Screen; whether persistent storage was really granted on each device.
- **Phone snapshot, 2026-11-05 02:56 UTC (F20), taken after the data was found missing and synced.** Everything device-local was gone too, not only study data: no Drive verification history, no format counts, Device Folder permission unknown, and usage was about 10.7 MB, the same as the phone right after its site data was cleared on 2026-11-04. Trace history starts at the 02:51 launch. Persistent storage reads granted. So the whole storage looks emptied or replaced, rather than one record lost: suspects 1 (another profile's storage) and 2 (start-up deleting or recreating the database) come first; Chrome evicting persisted storage is unlikely.
- **Evidence to capture next time, before syncing:** Copy diagnostics (Local storage health, Profiles, journals, Unsupported data); a screenshot of what the app showed (an empty app, the first-start form, or "No local study data found"); and, for each device, the browser and whether the app runs from the Home Screen or a browser tab.
- **Then:** a test for each path found, at the right layer, and a guard so that no automatic path can leave local data emptier than it found it without the person's choice.

**Bugs come first** (owner, 2026-11-03). Fix every bug in this section before any new feature, performance work or other improvement in this file. The test programme below is the one exception: it finishes first. Each fix comes with a test that would have caught it. None of these has been investigated yet.

1. **Plan opens in editing mode after Continue here.** Taking over an active session from another device with Continue here leaves the Plan board in editing mode. The handed-over plan should simply be applied, with no edit in progress.
2. **Repeated "earlier day not saved" notices after a handoff.** A session started on device A is continued and saved on device B. Afterwards, notices keep saying the earlier day was not saved on both devices, especially on A, which did not save it. But that day was saved, by B. Find why A (and B) still think the day is unsaved, and stop the repeated notices.
3. **Major: items to review appear everywhere, with nothing saying what they are.** On the phone, the laptop and the iPad, sync keeps leaving items to review, two at a time this time. Opening one offers only "Keep current" or "Use kept version"; nothing says what was kept, from which device, or what differs, so there is no way to choose sensibly.
    - Screenshot (owner, 2026-11-03), the "Kept versions" dialog: one item, **Personal and display settings**, "Changed on both devices; the other version was kept for review", with **Keep current settings** (selected, no description) or **Use kept settings** ("The kept name, theme, text size and other preferences"), then Later / Apply choices. It does not say which settings differ, what each side holds, which device or when; settings sync seems to flag a clash even for small or identical-looking changes. Settle whether settings need a review at all (for example newest wins per setting), and if one remains, show the actual differences.
   - Diagnostics from the iPad (release SDVB75F18, 2026-11-03) show `keptVersions=2`, and the catch-up there reported `activeSessionConflicts=1`, so at least one item is an Active Session the two devices disagreed on. Diagnostics give only the count, not what each item is.
   - To settle: why sync keeps producing these (for example, whether a handed-over session should ever count as a conflict); whether each one is needed; what the review must show (what it is, which device, when, what differs); and a diagnostics line per item (kind, origin and reason, never the content).
4. **Major: first sync on the iPad stuck on "Bringing in what's on Google Drive".** The first sign-in on the new version showed the sync notice stuck at that second stage for a long time, with the ring by the profile spinning and never settling. Closing or backgrounding the app and opening it again let the sync finish, and the data then arrived as expected. The first experience was not deterministic.
   - The diagnostics were taken after the restart, so they don't show the stuck run: trace history starts at that launch. Make sure a stuck stage leaves evidence, for example a trace that survives a reload, or a stage that has run too long being recorded.
   - What the later run shows: the first upload attempt waited 5.2 s, then reset the repository generation and found this device behind. The catch-up then took 4.8 s. Drive cleanup listed 112 versions and 241 objects in 29.6 s, then waited more than 3 hours because another device's publication was in progress. Drive verification gave way twice to other work and checked nothing. "Verified external copies" read as unavailable, and "google-drive formats" read as unknown with 0 versions.
   - To find: what the first sync waits on, why it doesn't time out or recover by itself, and why a restart unblocks it.
   - **Fixed on this branch: one cause, seen on the phone on 2026-11-04 after its site data was cleared** (the phone had backed up to Drive before, so it came back as a new, empty device). A device with no study data never looked at Drive: the automatic check left the look to the upload, and the upload stopped because there was nothing to upload. The card waited on "Bring in what's on Google Drive" for good, with nothing running (so the bar only animated). The check now looks at Drive whenever the upload is skipped; test in `tests/integration/backup/automatic-provider-backup.mjs`. The iPad case may be a different one, since that iPad held data and its later run did upload: confirm on the next first sign-in.
5. **The Plan draft is emptied when a session continues on another device.** When a session is continued elsewhere, the draft plan on this device's Plan board is cleared. The owner thinks this is not wanted. Decide whether the draft should stay, together with item 1 (the plan opens in editing mode after Continue here).
6. **The sync progress bar stays still on iPad Safari.** In the "Syncing with Google Drive" notice at sign-in, the three steps, the spinner and the progress bar all showed, but the bar stayed at a short fixed segment and never moved while "Bring in what's on Google Drive" was stuck. Find whether it stopped because no progress arrived (item 4) or because Safari doesn't animate it, and make the bar show real progress or visibly indicate work in progress. Investigate together with item 4.
7. **Fixed on this branch: the top of the screen sat under the status bar and camera cut-out on iPhone and iPad.** In the floating-bar layout (Glass and Aurora at phone and iPad-portrait widths) and in every wide layout (iPad landscape, a notched Mac in full screen), the main area now starts below the top safe area, so the Library tabs, page titles and notices no longer sit under Safari's blurred status strip; the side insets apply in landscape. Checked by measurement with a simulated 24 px inset in Chromium (it has no notch); confirm on the iPad and iPhone. Content scrolled up still passes under the status strip, as in any iOS app.
8. **Fixed on this branch: stale wording in Library → Data → Verification.** The rows no longer mention the retired reflection drafts.
9. **"Recheck Google Drive" seems to do nothing, and "Recheck Device Folder" is unclear.** In Library → Data → Verification, pressing Recheck Google Drive shows no visible result; on the iPad the line read "Google Drive: Paused for foreground work". In the same session's diagnostics, each Drive verification gave way to other work and checked 0 versions. On the laptop it is unclear what Recheck Device Folder does. Each button should start a check that finishes or says why it can't (and when it will try again), then show its result, and the row should say plainly what is checked.
    - Second laptop snapshot (SDVB75F18, 2026-11-03 11:13 UTC), taken after pressing both buttons. Both rows then read "Recheck requested" (Device Folder) and "Paused for foreground work" (Google Drive). Last full scan stayed at the morning's time for both.
      - **Google Drive.** One check started at 11:11:25 and finished all 38 of 38 in 52 s with no damage, yet the row's "Last full scan" and `completedAt` did not change. The checks started just before and just after it each gave way within about 6–7 s (`yielded`, `reason=preempted`) having checked 0. The state then read `recheck-pending`, so the result the owner saw was the yield, not the finished check.
      - **Device Folder.** The check gave way after 0.7 s with 4 of 20 checked (`reason=unclassified`) and was rescheduled.
      - To find: why a finished check is not recorded as the latest result, what keeps preempting checks during a study session, and why the yield reason is unclassified.
   - Phone snapshot (SDVB75F20, 2026-11-04): Drive verification was "running" for 58 s, then 31 minutes (the app in the background), each time with 0 checked of 0 total, then gave way. It seems to wait on something before it even counts the versions; find what, and whether a running check holds the background slot meanwhile.
10. **Fixed on this branch: Google Drive versions were not being pruned.** One abandoned upload marker (an upload cut off by a closed or frozen page) held all Drive cleanup back for 24 hours, while a study session added a version every 2 minutes. Upload markers now renew, and cleanup removes one left unrenewed for 15 minutes ([backup-and-sync.md](areas/backup-and-sync.md)). To confirm on the devices once every device runs the new build: the Drive version count falls back to the retention limit. Still open: whether a session needs a full new version every 2 minutes.
11. **The storage figure may be wrong.** Library → Data → Local storage shows "Browser storage estimate: 21.9 MB of 10 GB" on the laptop. On mobile it showed about 4 GB, which the owner says is impossible, and 21.9 MB also looks unlikely to them.
    - The figure is `navigator.storage.estimate().usage` (`inspectStorageCapability` in `source/app.html`, about line 3411; also used in `source/core/backup.js` and `source/core/attachment-ingest.js`). It is the browser's estimate for the whole site, not a count of study data. It includes the offline copy of the app (Cache Storage), IndexedDB, OPFS backup scratch files and attachments. Browsers round and pad it: Chrome pads cached cross-origin responses, and Safari on iOS is known to be coarse.
    - To find: on each device (which phone and browser showed 4 GB?), measure what the app itself stores, by store (IndexedDB records, attachments, OPFS scratch, app caches), and compare with the estimate. A real 4 GB would mean leftover files (for example backup scratch or attachment copies that are never freed); a false one means the label must say what it is. Show the app's own measured size, and the browser estimate only as a labelled extra if it is useful.
12. **Drive cleanup starts but doesn't finish on a busy or mobile device** (phone diagnostics, 2026-11-04). The abandoned-marker block (item 10) is gone: both runs read "not blocked". But with about 200 versions, listing and reading them took over a minute on the phone, and each run gave way to a sync or upload before deleting anything (0.6 s, then 65 s in). Giving way to foreground and sync work is intended. To do: let an interrupted cleanup carry on from what it already read (verified version summaries), not list everything again, so each run moves forward. Check first whether an open laptop finishes it; once versions are back to about 30, runs are short.
13. **A bring-in repeated its safety step.** On the phone, the add-what's-missing bring-in that ran by itself after the site-data clear uploaded its Drive safety version, then stopped just before applying because local data changed during that 17 s upload, and started again (a second safety upload). Stopping is the intended safe behaviour; find what wrote to local data during the upload (nothing was being edited). Empty devices no longer upload a safety version, so this case is gone; it can still cost a device with data an extra upload.
14. **Drive requests are slow on the phone.** Each takes 1–4 s and an upload makes about six in a row (marker, safety check, scan, files, commit, release), so even a 10 KB upload takes 15–20 s. Look at which steps can overlap or be skipped. The catch-up that followed the bring-in also downloaded the same 8 files again.
15. **Background work on phones and iPads.** A backgrounded mobile page is frozen, so nothing runs there (the phone's Drive verification sat "running" 31 minutes with nothing checked); a service worker can't help, since Drive sign-in lasts about an hour without a server and Device Folder access needs the open app. A laptop's open window keeps working, slowed. Decided for now: no background service; any device that completes Drive cleanup tidies it for all.
16. **The app feels slow and lags overall** (owner, 2026-11-05): the interface and the rest. Likely needs intensive optimisation, so it comes last among the bugs. Measure first on the phone and iPad (start-up, switching tabs, Library, Plan, Execute, typing in notes, opening dialogs, sync running in the background), find what blocks the page, then fix the worst first. Row 7 of the observations table (the throttled performance check) is part of this.

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
| 9 | Remove the migration code (compatibility layer and Release B). | Waiting | Only once "Format cleanup" reads ready on every device in use ([backup-and-sync.md](areas/backup-and-sync.md#one-format)). |
| 10 | **Optional size work.** The plain deployment build is not minified; a minified one exists (`stage:firebase:minified`). | Deferred (owner, 2026-11-02) | Later: deploy the minified build, or minify only `wordgard.js`, with a full test run. |
| 11 | **Whole-app quality pass.** Is the app clean, lean, elegant, efficient and reliable after this round of work? Is the notes system first-class? Measure memory over a long session and CPU and battery while idle and studying, then propose where to trim. | Open | Report only. |

## Test suite programme (approved by the owner on 2026-11-02)

The full plan, its rules and live status are in [test-programme.md](test-programme.md). Steps 1–3 are done; step 4 (backup and storage) is in progress and, with everything after it, paused by the owner until about 2026-11-10. Work so far is on `main` (PR #13 merged early, 2026-11-03); the rest continues on a new branch. The programme finishes before the bugs above.

## Owner's requests (noted 2026-11-03)

**Notes: images.** Enlarge an image, pan and zoom it, and focus on it (a full-view mode).

**Notes: interface review and redesign.** Tags, links and other note features may be buried: someone could use the app and never find them, or never get their full use. Review how each is discovered and used, and whether the rest of the app makes the most of them. Then propose a redesign. Not started; after the test programme.

**Notes: paste Markdown as formatted text.** Text copied from the web or from chat tools often arrives as Markdown, so the note shows `#`, `**`, `-` and the like instead of headings, bold and lists. Pasting it should turn it into formatted text, the way many editors do, and the result stays fully editable with Wordgard's own controls. Strip anything a note cannot hold. The Markdown file import already converts Markdown and passes it through the paste cleaner ([notes.md](areas/notes.md), import of text and Markdown files), so the paste could reuse it. To settle when building: how to detect Markdown in plain pasted text without mangling ordinary text, and a way to paste as plain text. Noted 2026-11-04; not started.

**Backup and sync review.** Questions to settle first, as a report, before any building. In this order:

1. **Is the repository design right, from first principles?** The point of the repository is that unchanged large files are never uploaded or downloaded again, which makes transfers faster and safer. Does it upload and download only what changed, and does each upload and restore land whole or not at all? Is it well optimised overall? The owner thinks the repository principle is good; propose a better one only if there is one.
2. **Handoff or live sync?** Today one device runs the session and "Continue here" hands it over. It sends few requests but feels slow and heavy: Continue here takes a while, and a pause may reach the other device only at the next check, about every 2 minutes. The alternative is live sync, the way a messaging app works: the same session runs on several devices, and a note edit, a timer pause or an added block reaches the other devices on its own. Compare the two.
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

### Order of work (from Saturday 2026-11-07)

1. Bug hunting: the open bugs above, the major ones first.
2. Test suite refinement: resume [test-programme.md](test-programme.md) at step 4a.
3. The new backup machinery: the options and requirements above, Device Folder included.


## Decided, not yet scheduled

- **Better Smart merge** (`mergeThreeWay`). The owner will come back to it; until then, do not audit it or suggest changes.
- **Math equations in notes.** Later. Code formatting can be switched on in the editor if wanted.

## Noted for later

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
