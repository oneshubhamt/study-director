# Handoff

Status of the work on this branch (`refactor/background-coordination`, PR #1, ready for review). Read sections 1 and 5 first; sections 2 to 4 are closed summaries.

**Current state (2026-10-25):** the backup and data work is finished. The notes plan in `docs/NOTES.md` (items 1 to 16) is fully built, all five steps, including the measurement at 2,000 notes. The background services are mapped and held to one standard (section 4). Drive sync and profiles (section 5) are done: the small items (5.5), sync (5.1), merge rules (5.2), profiles and device names (5.3, 5.3a), the first-start form (5.4), the removal of what section 5 made redundant, and a fresh audit of the backup system with its fixes (5.6). Release B (removing the readers of older backup formats) waits until "Format cleanup" reads ready on every device in use (5.3a). Wordgard is now 0.6.2 and its own module (section 6, done 2026-10-25). The editor toolbar is in its new order, and the notification sounds are made in code (no sound files ship).

---

## 1. How we proceed (agreed 2026-10-06)

**Philosophy.** The app is clean, lean, efficient, elegant and reliable. No extravagant or unnecessary features. Everything works rock solid within the range it is meant for. Do the simple things very well; do not over-engineer.

**Order, and when the session ends.**
1. Finish refining the backup system to its best shape. **Done.**
2. Audit it and report to the user what I think. **Done.**
3. Hold a brainstorming session with the user to understand how to improve notes. Discuss first; build only after agreement. **Done.**
4. Then the background services (section 4). **Done.**
5. Then Drive sync and profiles (section 5, decided 2026-10-17). **Done.**
6. Then Wordgard as its own module (section 6). **Done** (2026-10-25).
7. The session concludes only once all four — backup, notes, background services, sync — are as good as we can reasonably make them.

**Migration (user's rule, 2026-10-10).** Older data is read once, converted into the current canonical form, verified and retired, never used again. Only the compatibility host (`compatibility-host.js`, plus repository adapters where a transaction requires it) reads old forms; the ordinary runtime reads only current forms. Every conversion is listed in `contracts/compatibility.mjs` with its retirement condition, so the whole migration machinery can be deleted later, leaving one clean canonical data structure.

**Not deployed (user, 2026-10-18).** This branch has never been released. Production still runs the old version from before this branch. Formats, identities and backups that existed only on this branch need no migration or compatibility; new changes simply replace them.

## 2. Done: backups and data (closed)

There is nothing to re-read here; the designs live in `docs/BACKUP-ENGINE.md`, `docs/BACKGROUND-OPERATIONS.md`, `docs/ARCHITECTURE.md` and `docs/AUDIT-DATA-AND-BACKUP.md`. In short:
- **One backup engine** (`backup-provider.js`) runs every operation for the Device Folder and Google Drive. The app draws all three rows (Device Folder, Drive, portable file) the same way.
- **Data is lean and canonical.**
  - Older stored data is read once by the compatibility host, converted and retired.
  - Stored names are plain: notes are `notes` everywhere (store, records, backups) and the Device Folder settings are `deviceFolder`; the old "area note" and "automatic device backup" names are converted on first start (table in `docs/ARCHITECTURE.md` §2). Backup files are version 22 and checkpoints version 7; an older build refuses them until it updates.
  - The compatibility layer is isolated, so it can be deleted in one step later (`tests/architecture/storage/compatibility-isolation.mjs`).
- **Every audit finding is closed** (status table in the audit), along with #45 and #46.
- **Retention:** 15 versions per location (latest, 6 daily, 4 weekly, 4 monthly). No tier shares a week or a month with the one before it, so the history reaches four to five months back. On top of those, up to 10 Hourly versions from the last 24 hours, only where the notes changed (2026-10-17).
- **Dropped from the backup wish list:**
  - a "backup health" summary, because each location's row already shows its last backup and any problem;
  - streaming verification during restore, because every downloaded piece is already checked against the version's manifest before anything is written.
- **Left for later on purpose:**
  - encryption, to come as end-to-end encryption with a sign-in-first experience (data in the browser is not encrypted; see 5.8);
  - measuring restore of a very large library;
  - deleting the compatibility layer once no older data can remain.

## 3. Done: notes

Every decision is in `docs/NOTES.md` (items 1 to 15), with the order of work. All five steps are built; step 5 measured the app at 2,000 notes and fixed what was slow (results in `docs/NOTES.md`).

## 4. Done: every background service, mapped and held to one standard

**History.** The background services began as a patchwork: one broke another, and they did not give way to what the person asked for. Earlier sessions rebuilt them as state machines with one job model, shared priorities and preemption (section 6, "Background operations"). This pass (2026-10-17) mapped every service against the standard below. Most already met it; the gaps are closed.

**The standard for each job:**
1. Bounded work per run, with a work budget or progress watchdog.
2. Gives way at once to foreground work, resuming from a durable checkpoint.
3. Intent persisted when it must survive a reload; idempotent when repeated.
4. One retry policy: backoff with a cap, and a user notice only when a person can act.
5. Runs only while this tab owns writes; pauses during restores, updates and browser-data clears.
6. Visible in one diagnostics view (Library → Data → Copy diagnostics) with state, next run and last outcome.
7. Tested on a fake clock, plus a browser test for the real lifecycle.

**The map.**

| Service | Meets the standard | Changed in this pass |
|---|---|---|
| Canonical data maintenance | Yes: 20 s budget, yields to foreground, durable pending record, 24 h cadence (defined once, in the repository) | Uses the shared gate. Keeps running through a browser-data clear, because it is the recovery path. Each completed day also empties notes past 30 days in Recently deleted, then starts attachment cleanup. |
| Attachment cleanup | Yes: 5 s / 128 files a pass, strict reference proof | Shared gate. Waits while a clear is unresolved and stops at once when one is detected. Images in Recently deleted notes are kept (now tested). Runs after each daily upkeep and soon after a file falls out of use; it no longer keeps its own browser-storage record (the two old keys are removed at start-up). |
| Attachment verification | Yes: 5 s / 128 files, saved progress, daily | Shared gate; waits during a clear. After giving way to the person it resumes when they finish, not 10 minutes later. |
| Backup scratch files | Yes: lock per file, pinned files kept | Shared gate: now the writing tab only, and waits during a clear. |
| Automatic backups, retention cleanup, integrity (Device Folder and Drive) | Yes: one engine, shared priorities (integrity < maintenance < automatic < convergence < foreground), leases, journals | Shared gate (it already paused for clears). A file backup or import the person starts now holds this work, so it never waits behind an integrity hash in the shared file worker. |
| App update checks and the safe update | Yes: own timer with capped backoff, writing tab only; an update waits for backups (up to a minute) and for the applied plan to end | Diagnostics now show the next check, the last check and failed attempts. |
| Service worker caches | Yes: a fixed file list and at most 3 release caches, nothing cached at runtime | None; no size budget is needed. |
| Workers | Search: let go after 2 quiet minutes. Export: stops after each job. Image and Insights: one per use. | Attachment worker: now let go after 2 quiet minutes, like search. |
| Deletion records | Yes: bounded, trimmed by canonical maintenance | None. |
| Storage health and quota | Persistent storage requested at launch; warnings at 80% and 92% | The estimate was measured only at launch; it is now refreshed on returning to the app, at most hourly, so a tab left open for days still warns. |
| Notices, editor clean-up, debounced saves | Foreground UI, not background work | None. |
| Drive sync: catch-up, turns, copies between locations (inside the automatic backup job) | Yes, since the 2026-10-25 audit | A failed or cancelled catch-up is tried again on the backoff (30 s, 2 min, 10 min, 30 min), not at the next 20-minute check, and after four failures says "Syncing with Google Drive keeps failing". Waiting for another device's turn backs off (15 s, 1 min, 5 min); this device's own leftover upload marker no longer makes it wait. A version this app cannot read makes it wait for an update: no retries, no upload over it. Copy diagnostics has a Drive sync row. |
| Drive sign-in expiry, kept across reloads (`drive.js`) | Yes | None. |
| Removed profiles' data deleted at start (`Profiles.collect`) | Yes, by design: it runs in any tab, and only for profiles no tab holds | Copy diagnostics has a Profiles row (profiles, removals waiting). Waits while the profile list comes from a newer version. |
| Device Folder preparation and the one-time move (`prepareInBackground`) | Yes, since the 2026-10-25 audit | Behind the shared gate, in the writing tab only, and under one lock across tabs, so two tabs opened together move the folder once with no error. A tab that starts writing later prepares it then. |

**The one shared gate.** `backgroundBlocker()` in `app.html` answers "may background work start?" for every job: start-up has finished, this tab owns writes, and, for housekeeping, no browser-data clear is unresolved. Each job adds only its own condition (storage support, encryption unlocked). When a clear is settled, every job is woken. The one job outside it is the deletion of removed profiles' data at start, which must run in whichever tab opens and touches only profiles no tab holds. While this device holds data from a newer version, local upkeep waits too (`unsupported-data`) and Drive takes no upload (`ARCHITECTURE.md` section 2). `tests/architecture/storage/background-work-contract.mjs` keeps it that way.

**One way to wait.** Local upkeep (canonical maintenance, attachment cleanup and checks, scratch files) asks `upkeepBlocker()`: the shared gate, plus "is the person busy?". While they are, each job waits under the named reason `foreground-busy` with no timer of its own, the same way backup jobs wait under a held reservation. One watcher checks back every 15 seconds and wakes every job the moment the work ends; notices, backup status and the end of an app update check at once. Local upkeep keeps its own gate rather than joining the backup reservation, because the backup busy signals include automatic backups, which would then block themselves. Copy diagnostics names every waiting and waking reason.

**Considered and left out.**
- *Run upkeep only while the page is visible.* A desktop tab left in the background all day would never run it. Upkeep already runs at background priority (`scheduler.postTask`) and yields to anything the person does.
- *Move the app-update timer under the shared job.* It already meets the standard; moving it would touch the update-safety flow for no visible gain.
- *One reservation for local upkeep and backups.* See "One way to wait": the backup busy signals cover automatic backups too.
- *New or merged services.* None is missing, and none duplicates another: the Device Folder and Drive already share every job.

**Audited again** (2026-10-25), after sync and profiles: `docs/AUDIT-BACKGROUND-SERVICES.md`. Nothing lost data. Found: a failed sync catch-up waited for the next 20-minute check (M1); four smaller gaps (L1–L4); docs, wording and tests. All are fixed (the report's "Status" section). The user's answers: D1, keep Remove in Version History and make the app keep working, whatever data it meets that it cannot read (`ARCHITECTURE.md` section 2, "Data this version cannot read"); D2, after a failed sync the sidebar says "Last synced <time>".

## 5. Next: Drive sync and profiles (decided 2026-10-17)

Build this next, before Wordgard (section 6). The decisions below are the user's, settled over several rounds; do not reopen them. Take it slowly and thoroughly: the user expects edge cases to be many, and robustness must not be traded for convenience.

**Goal.** Every device stays fully local and works on its own, exactly as now. Whenever a Drive connection happens to be open, the device syncs: it brings in what other devices changed, merges it with its own changes, then uploads. Drive is where a person's devices meet and holds the shared library and the shared Version History. It never overwrites an edit a device has not yet synced. Apart from Drive backup and restore becoming sync, and profiles, the app behaves exactly as it does now. The app is meant mainly for one device; two or three devices per person is the most it must handle well.

**Why.** Drive today is explicit handoff: back up the device you leave, then choose Combine or Replace on the other. If that step is skipped, the keep-15 rule (newest version per day, over all devices together) can drop one device's versions from Drive, so its edits then live only on that device (audit finding #1, 2026-10-17). Sync removes the manual step, and with it the risk.

### 5.1 Sync

**Done** (2026-10-17). Design and rules: `docs/BACKUP-ENGINE.md`, "Sync through Drive" and "One history". What was built, against the table below:
- Catch up first, then upload; an upload that finds Drive moved on stops and the device catches up; another device's recent publication marker makes it wait its turn.
- The shared base (v3) also holds one fingerprint per Saved Day and one of the Active Session, so Saved Days and the session merge three-way. Only Drive moves it.
- Sync never asks: anything that needs a choice leaves the data untouched and shows "Needs review" (sidebar and Drive row); Review opens Combine on Drive's version, after the study session if one runs. Making review marks that do not stop the rest of the sync is 5.2.
- The running session waits ("hold") while everything else merges.
- Sign-in kept across reloads for the rest of its hour.
- **Changed from the table (user, 2026-10-17):** the Device Folder and Drive keep one history. A version is made once and copied to the other location under the same id, so both show the same versions. The Device Folder is still not a sync channel.
- **Study session across devices (user, 2026-10-18).** The session names the device running it (ActiveSession v10, `runningOn`); only that device runs the timer. Another device shows "Running on another device" and edits notes and everything else freely; notes from it reach the running device without stopping its session. Suspend hands the session over (uploads at once; the other device offers Continue here). Continue Here on a device whose copy still runs elsewhere asks first; the device taken over from stops at its next sync and keeps its unsynced progress for review. "Needs review" opens during a running session and leaves the session as it is.
- Known limit: a fresh device whose plans and settings differ from Drive's keeps Drive's for review on its first sync (5.4 settles this).

| Part | Decision |
|---|---|
| When | Whenever a Drive sign-in is open. Google gives this app about an hour, renewed only by a tap; that is accepted, and sync simply happens during those windows. A sync runs on sign-in, on opening the app, on returning to it, every 20 minutes while it is open, and on going to the background |
| Upload cadence | Changes upload 20 minutes after the first one, as now. The user chose not to shorten it |
| Order | Catch up first, then upload. A device never uploads over a Drive version it has not merged |
| Upstream conflicts | Uploads take turns through the existing publication lease. If Drive moved on after this device caught up (another device uploaded in between), the upload is refused, and the device catches up again and retries, without asking anything |
| Common ancestor | Each device remembers the Drive version it last synced with (the existing reconciliation base). That is the ancestor for three-way merging, however long the device was offline |
| Two devices open together | No device lock: a Web Lock only works inside one browser, and a lock on Drive would stop the other device. Catching up on return to the app shows the other device's edits before you type |
| Three devices | Each device merges only with Drive, which already holds the others' changes, so a choice is always between two versions |
| Running session | Restore is blocked while a session runs, because it replaces or combines today's session (`hasBlockingActiveSession` in `app.html`; the blocked actions are `ACTIVE_SESSION_BLOCKED_CLICK_ACTIONS`). Sync must not be blocked. While a session runs, everything else merges as usual. Incoming changes to the running session itself (the Active Session and today's plan) wait until it ends or is suspended, then merge by the same rules. Uploads carry on and include this device's session as it is |
| Sign-in expiry | The existing dismissible "sign-in expired" toast stays exactly as it is. No other prompts to sign in |
| Sign-in across reloads | Keep the Drive sign-in for the rest of its hour across reloads; phones often close and reopen the app. Today it lives only in memory (`drive.js`) |
| Status | A small status by the name tag in the left sidebar and in the Drive row of Library → Data: "Synced 10:42", "Syncing…" or "Changes since 10:42"; after a sync that failed, "Last synced 10:42" while it keeps trying (user, 2026-10-25); "Needs app update" when Drive's newest version or data on this device comes from a newer version |
| Combine and Replace | Leave everyday Drive use. They stay for backup files and Device Folder versions. Restoring a Drive version from Version History applies to all devices, with a safety version kept first |
| Device Folder | Unchanged: a local safety copy of this device (of the active profile). After a sync it holds the shared library anyway. It is not a second sync channel; two masters would mean conflicts |
| First sync with no shared history | For example two devices that backed up separately to the same Drive. Two-way merge: anything on one side only is added, anything different on both is kept for review |

### 5.2 Merge rules

**Done** (2026-10-18). Design and rules: `docs/BACKUP-ENGINE.md`, "Kept for review". What was built, against the table below:
- A sync never stops for a choice. Smart merge joins notes changed in different paragraphs; everything else changed on both sides shows the newer and keeps the other as a `PendingReview` record (contract `PendingReview.v1`, appMeta `pendingReview:<id>`).
- Kept versions are synced data: backup v23 and manifest v8 carry them (released v20 files and v5 manifests read with none; v21, v22 and manifests 6, 7 came only from unreleased builds and are refused), every device gets them, a resolved one wins everywhere, and at most 2000 may wait (more stops the write; nothing is dropped). Their images are kept.
- Review: a quiet "Needs review" mark on the note, a count in Library → Data, and "Needs review" in the sidebar. Choices first (titles, deletions, Saved Days, plans and settings, the session), then note texts in `reconciliation-ui.js` with Smart merge from what both last shared. Each choice is an ordinary edit that syncs; nothing that changed while the person chose is overwritten. A kept session waits while a session runs here and comes back suspended.
- A takeover no longer stops the sync: the device taken over from shows the running session and keeps its own progress for review.
- "Needs review" on Drive's version itself now appears only for what a sync cannot keep (an older backup format, or more than 2000 waiting).
- Version History (5.5): each version made after a sync holds the kept versions, so they are in the history too.

The person's data is never lost. Merging is automatic wherever it is lossless; only genuine conflicts are shown, and never as a pop-up during study.

| Case | Result | Asked? |
|---|---|---|
| Changed on one side only since the last sync | That change is taken | No |
| Note changed on both, edits in different paragraphs | Smart merge, applied automatically. `mergeThreeWay` (`rich-text/reconciliation.ts`) already returns `safe: true` when no paragraph changed on both sides, and treats fuzzy matches as conflicts | No |
| Note changed on both, in the same paragraph | The newer edit shows for now; the other version is kept with the note and marked "Needs review" | Once, whenever the person chooses |
| Note title renamed on both | The newer title shows; the other is kept for review | Same |
| Note edited on one device, deleted on the other | The note stays; the review offers to delete it | Same |
| Saved Day, plans and settings, or the Active Session changed on both | The newer one shows; the other is kept; the review lets the person pick one | Same |
| Attachments | Added on either side are kept (they are content-addressed); deletions follow the deletion records | No |

- Timestamps never settle a genuine conflict. They only decide what shows until the person reviews it.
- A kept version is synced data: it can be reviewed on any device, never expires, and goes only when resolved. This needs a new "pending review" record in the library and in backups.
- The review uses the existing dialog (`reconciliation-ui.js`): Smart merge, Append additions, keep either side, or Custom. It opens from a quiet "Needs review" mark on the note and from a count in Library → Data.
- Each kept version is also in Version History (hourly versions, 5.5).
- This replaces the rule agreed earlier the same day ("the newer edit wins and the other text goes to Recently deleted").

### 5.3 Profiles

**Done** (2026-10-18), with device names. Design and rules: `docs/BACKUP-ENGINE.md`, "Profiles". What was built, against the table below:
- **Profiles** (`core/profiles.js`). The device list is one browser-storage key (`studyDirector.profiles.v1`): the active profile and, for each, its id, name, Google email and Drive folder. A profile id is `prof_<name>_<time>_<random>`. It follows the name only until the first start is finished and no Drive library knows it; after that it never changes.
- **Storage per profile.** The first profile keeps every current storage name, so nothing moved. A later one adds `~<scope>` to each name: database, browser-storage keys, attachment and scratch folders (the workers check the folder they are given), locks, channels, the Drive sign-in and the Device Folder repository. The scope is fixed when the profile is made. Device-wide: the device ID, the install notice, the update check and the profile list.
- **Profile panel.** Name, Google Drive (email; connect, change, disconnect), backup password (set, change, remove), the profiles on this device (Switch, Add profile) and this device's name. Opened from the name tag in the sidebar (desktop) and from the letter circle on phones. Library → Data keeps the password and Drive controls, and has Remove this profile (shown with two or more).
- **Switching** reloads every tab into the chosen profile. With two or more profiles, each start asks for that profile's password ("Not now" keeps sync and encrypted backups waiting). With one profile, the kept key opens it.
- **Drive library tied to its profile.** The folder carries the profile id. Once per sign-in the app is told the account email and what the folder holds and settles it: its own folder continues; a folder from before profiles is claimed; a library from another device is offered as "Continue with your library?" (only within 5 minutes of tapping Connect) and its id taken over; a library or email of another profile on this device is refused without touching it, and the sign-in is forgotten so Connect offers the choice of account again. A new folder means a first, two-way sync.
- **Password per profile** (record `BackupProtection.v3`): the key is kept as a non-extractable key with the record. A password set, changed or removed on another device: the next sync shows "Needs password" (sidebar and Drive row); entering it continues the sync and keeps that password here. A plain version built on an encrypted one removes it here.
- **Removing a profile** asks first: when it is fully synced, it says Drive keeps everything; otherwise, that its data is deleted from this device for good. Its data is deleted once no tab holds it. Deleting a profile everywhere, and the last profile on a device, came later (5.3a).
- **Device names.** As in the table: `inst_<type>_<browser>_<time>_<random>`, named from the ID alone. Older IDs are replaced once.
- **Correction:** on phones the section bar is a floating bar at the **bottom** (glass presentation; the Director presentation keeps a top bar). The letter circle sits at its start.
- Known limits: Drive flows are tested against a simulated Drive (`tests/integration/backup/drive-profile-binding.mjs`), not real Google. Two people on one Google account are refused by design. A profile removed from one device stays on others (Delete everywhere, 5.3a, removes it from all).

| Part | Decision |
|---|---|
| What a profile is | A name, an optional backup password and an optional Google account. The three belong together. Drive and the password can be added later, or changed, in the Profile panel (primary) or in Library → Data |
| Profile panel (user, 2026-10-18) | One panel is the primary home for who you are: name, backup password (set, change, remove), Google account (shown by its email; connect, change, disconnect), the profile list (switch, Add profile) and this device's name (read only). Opened from the name tag on desktop and from the letter circle on phones. In-place editing of the name tag goes away. Library → Data keeps the password and Drive controls too, as the same actions, because backups need them; the name is edited only in the panel |
| Profile ID (user, 2026-10-18) | Like the device ID: made once from the name plus a unique part (for example `prof_<name>_<time>_<random>`) and never changed when the name changes. The display name is not unique and there are no usernames: two people with the same name on one device are separate profiles, told apart in the list by their Google account email when connected. Two or three people per device is the expectation, not a limit |
| Name (user, 2026-10-18) | One name per profile, synced with the library: changing it on one device changes it everywhere |
| Several people on one device | Supported, though rare. Each profile has its own local data: database, browser settings, attachments and Device Folder |
| Existing data | Becomes the first profile under its current storage names. Nothing moves, so there is no migration. New profiles get their own names, resolved from the identities already centralised in `contracts/` |
| Device-wide | Only what belongs to the device: app updates, the service worker and the profile list itself. Decide key by key |
| Switching | In the Profile panel. One profile is active at a time; switching reloads every open tab into it and asks for that profile's password (below) |
| Phones (user, 2026-10-18) | On phones the sidebar becomes the section bar (a floating bar at the bottom in the glass presentation), and the name and sync status are hidden (`.sb-head` at 900px and below), so phones show no sync status today. A small circle at the start of that bar shows the first letter of the name in the accent colour, with a small dot only for "Needs review" or a sync problem; tapping it opens the Profile panel |
| Dialogs (user, 2026-10-18) | The Profile panel, the first-start form (5.4) and Add profile (which opens the same form) are one family: the same size, layout and style. Uniform, consistent, professional; nothing janky |
| Design quality (user, 2026-10-18) | The name tag in the sidebar, the letter circle on phones and the Profile panel are designed with care on both desktop and phone: intuitive, plainly interactive (they look clickable, with clear hover, focus and pressed states), well proportioned and in the app's own design language. Checked with screenshots at desktop and phone widths before the pass is done |
| Google account (user, 2026-10-18) | Shown by its email, read with one small Drive request when connecting |
| Drive link | The Drive library records its profile's id. Connecting a Google account whose library belongs to another profile is refused, so two people's data can never mix. Changing the account uploads the whole library to the new account and leaves the old copy alone |
| Password | With one profile on the device, its backup key is remembered on the device (a non-extractable key, never the password) and not asked again. With several, each person is asked for their own when switching in, which unlocks their sync; "Not now" keeps working locally with sync paused. It is not a privacy lock, because browser data is not encrypted (5.8). No version or backup uses a password yet, so there is no old-password handling to build (user, 2026-10-18). Removing the password is allowed, with a warning that later versions upload unencrypted. A forgotten password cannot be recovered, by design; nothing more is built for that now (5.8) |
| Removing a profile from a device | From Library → Data, only after confirming its data is synced, or with a clear warning |
| Device names (user, 2026-10-18; build in the 5.4 + 5.3 pass) | Nobody types a device name. The device ID itself says what the device is: `inst_<type>_<browser>_<first-use time>_<random>`, e.g. `inst_iphone_safari_mgk3x9p2_a8f3k2q1`. Type and browser are read from the browser when the ID is made (with a touch-screen check, since some iPads report themselves as a Mac); the random part keeps two alike devices apart. The name is read from the ID alone, so any device can name any other: "iPhone · Safari", with "(since 12 Oct)" added only when two devices would otherwise look the same. No new fields or store: versions and the session already carry the ID. Shown in "Running on … (last update …)", the Continue here question and Version History rows ("from …" or "This device"). Browsers give no model names, so it is type and browser only; a cleared or different browser is a new device. No compatibility: IDs made earlier on this branch are simply replaced |

Design sync around profile ids from the start; build the per-profile storage after sync.

### 5.3a Backup folders, one format, deleting a profile

**Done** (2026-10-24; user, 2026-10-19: "fresh backup folders named by profile and device, retire the old ones; one pure canonical format; a deletion marker for profiles; anything can be deleted"). Design: `docs/BACKUP-ENGINE.md`, "Profiles" and "One format".

| Part | What was built |
|---|---|
| Drive folder | Named "Study Director – <profile name>" and renamed to follow the name, once per sign-in. It stays the same folder: the profile id in its properties says whose it is, never the name. A new Drive folder was not made, because devices mid-sync would race to it and one could lose changes; old-format versions retire in place instead (below) |
| Device Folder | Each profile and device has its own folder inside the chosen folder: "Study Director - Ana - iPhone Safari" (plain ASCII: a name with other characters was found to land in the chosen folder itself in Chromium's browser storage), found by its marker file (`repository.sdscope` version 2: profile id, profile scope, device id). The single folder of earlier versions is copied in, every file checked (size, and contents for versions and markers), then deleted; an interrupted move continues in the same new folder and the old folder is kept until the copy is complete. A folder chosen after a browser data clear offers to continue the earlier backup folder or start a new one; another profile's folder on this device is never offered |
| One format (release A) | Once a location holds a version in the current format (manifest 8), older-format versions leave Version History and the next cleanup removes them (`selectRepositoryRetention`). Nothing old is rewritten. Copy diagnostics has a "Format cleanup" row: ready when this device's data is canonical (`verifyCanonicalInstallation`), the Device Folder's old folder is gone and every connected location keeps only current versions (per location: current and older counts) |
| Release B (later, separate) | Removes the code that reads older formats (compatibility entries `backup-repository-v1-v4` and `device-folder-single-repository`). Only when "Format cleanup" reads ready on every device in use |
| Delete a profile | Library → Data → Delete this profile…: **Remove from this device** (as before; its backups stay) or **Delete everywhere**: its Drive library goes to the Drive Trash (recoverable there for 30 days), after a deletion marker is left in Drive (a small folder "Study Director – Ana (deleted)" carrying the profile id, appProperty `studyDirectorDeletedProfile`); this device's Device Folder backup folder for it is deleted; its data here is deleted |
| Other devices | At the next Drive sign-in, before the library is used or made again, the marker is found. With nothing on the device that Drive did not have, the profile is removed there without a question; otherwise the person chooses Delete here too, or Keep on this device (the profile takes a new id, leaves the Google account and stops syncing; connecting Drive again starts a new library) |
| Last profile | Can be deleted too: a new, empty profile replaces it and starts with the first-start form |
| Single items | Already deletable, and deletions sync (deletion records for notes, Saved Days and attachments; edits for the rest): notes (Delete, Recently deleted, Delete forever), Saved Days (Delete Saved Day), reflections (Delete in Diary), attachments (Library → Data → Attachments), saved plans (Delete). Nothing new was built for these |

- Known limits: a device that never signs in to Drive again keeps a profile deleted elsewhere. Device Folder backups of a deleted profile on other devices go when those devices remove it. Deleting everywhere needs Drive signed in when the profile has a Drive library.

### 5.4 First start

**Done** (2026-10-18). Someone new (no data on this device) sees the form below; existing data becomes the first profile with no form. Skip leaves the name empty and keeps the profile. The typed password is set before Drive is used; connecting to a library from another device takes its name and settings. Add profile opens the same form, with Cancel going back to the profile it was added from. The old name prompt and its skip date are gone (`nameSetupSkippedDate` is cleaned up as an obsolete key).

One form, an upgrade of the name dialog:

```
Personalise Study Director
Name             [ Your name           ]
Backup password  [ Optional            ]   (a confirm box appears once you type)
[ Connect Google Drive ]  Keeps your devices in sync. You can connect later.
                                            [ Skip ]  [ Continue ]
```

- The password is set before the first upload, so no unencrypted copy reaches Drive. Minimum 12 characters, as now.
- Connecting to an account that already has a library offers "Continue with your library (412 notes, synced yesterday)" and downloads it. The typed password unlocks it, or is asked for again.
- The name comes from the library, not from Google (no extra Google request).
- Existing users see no form; their data and name become the first profile.
- Without Drive, Library → Data shows a quiet "Not synced · Connect Drive" line. No pop-ups.
- Add profile opens this same form, in the same dialog family as the Profile panel (5.3).

### 5.5 Small items (step 1)

| Item | Decision |
|---|---|
| Hourly versions | **Done.** Up to 10 more from the 24 hours before Latest, one per local hour, and only where the notes changed (the user's refinement: so Version History is not crowded). Same rules at Drive and the Device Folder (`selectRepositoryRetention`). Before this, only the newest version of the current day survived |
| Combine and Replace colours | **Done.** Combine is the primary (accent) choice; Replace and its confirmation are amber (`caution`). Dialog buttons marked primary had no style at all, which is why Combine looked muted; `.interaction-action.primary` and `.caution` now exist |
| Audit finding #3 | **Done.** The restore journal label is `RestoreJournalPayload.v5` |
| Audit finding #4 | **Done.** The Device Folder info popover says to use a folder only this device uses, not one synced by Dropbox, OneDrive or iCloud |

### 5.6 Order of work

1. The small items (5.5). **Done.**
2. The sync engine and merge rules (5.1, 5.2), with sync designed around profile ids. **Done.**
3. The first-start form (5.4) and profiles (5.3), in one pass, with device names (5.3) folded in. **Done.**
4. Remove what section 5 made redundant, then a cleanup pass. **Done** (2026-10-24):
   - Formats only unreleased builds of this branch wrote are refused, not read: portable backup v21 and v22, manifests 6 and 7, last-backup record version 2 and verification state version 6. Released formats (v20 and older, manifest 5 and older) still read. The compatibility entry `backups-before-pending-reviews` is gone.
   - Restore from a notice opens the one Version History whenever a backup location is connected.
   - Unused exports removed from the backup modules (capture, repository, background scheduling).
   - **Audited again** (2026-10-24): `docs/AUDIT-BACKUP-AFTER-CLEANUP.md`. The user answered D1 (no device ran a branch build against real backups) and D2 (show an unreadable version, with Remove). Every finding is fixed; its Status section says how.
5. Audit the backup system and app behaviour again (noted by the user, 2026-10-18). Drive went from a manual handoff (back up, then Combine or Replace on the other device) to automatic sync, so much has changed. Check whether everything is still in its best shape, and what can be improved, refined or corrected:
   - Device Folder and Drive backups end to end, after sync and one history.
   - Version History: one history now shared by both locations, with keep-15 plus up to 10 hourly versions. How each location keeps, copies and prunes them.
   - A note's earlier-versions list gathers Drive and Device Folder versions separately; with one history this may now be redundant.
   - Every app behaviour built for manual handoff: restore flows, Combine and Replace, wording, reminders, status and notices.
   - Report findings to the user first, as with the earlier audits.
   - **Audited** (2026-10-24): `docs/AUDIT-BACKUP-AFTER-SYNC.md`.
   - **Decided** (user, 2026-10-24): one Version History list; one safety version per device on Drive; drop the Primary and Optional labels (phones and iPads may have no Device Folder).
   - **Done** (2026-10-24): every finding fixed. See the Status section of the audit report.

For each build step: make all the changes, build, test with two simulated devices in a real browser, fix, document, commit.

### 5.7 Edge cases to settle while building

| Case | Direction |
|---|---|
| A device whose browser data was cleared | The existing guards hold: a device with an unresolved clear never uploads; it downloads again |
| A device offline for months | Merges normally; deletions older than the kept deletion records may reappear |
| Device clocks differ | Clocks only choose what shows before review; they never decide a conflict |
| A note open in the editor when a change arrives | It updates in place if nothing was typed since the last save; otherwise it is a both-changed case |
| Password added or changed on one device | Other devices ask for the new one at their next sync |
| Wrong Google account, or the account changed | Refused, or a full upload, as in 5.3 |
| Drive full or unreachable | Sync pauses, the app carries on locally, with the existing toasts |
| Restoring a Drive version | Applies to all devices; pending reviews are kept |
| Large attachments on mobile | Downloaded only when missing, as now |
| Data from a newer version, or two versions that disagree on how data is laid out | **Decided** (user, 2026-10-25): what this build cannot read is held untouched and shown read-only; nothing is converted, merged or deleted. A database another profile or version holds offers "Open <other profile>" or "Start a new profile", as now. No side copies through Needs review. |

### 5.8 Later (noted, not planned)

- **Encryption at rest.** Data stored in the browser (IndexedDB, browser storage, attachments) is not encrypted. Backups are, when a password is set: Device Folder, Drive and backup files, attachments included. Note exports are not. Profiles on one device are therefore separate, not private. Already on the list: end-to-end encryption with a sign-in-first experience (section 2). That work, which extends encryption to the whole data topology, also decides how passwords are managed: recovery, changes and the rest (user, 2026-10-18).
- **Fully silent background sync** would need a small server to hold Google refresh tokens. Not planned; sync during sign-in windows is the accepted design.
- **Better Smart merge of notes** (`mergeThreeWay`). It works decently, with a lot of room to improve. The user will come back to it later; until then, do not audit it or suggest changes (noted 2026-10-18).

---

## 6. Done: Wordgard as its own module (decided 2026-10-11, built 2026-10-25)

| What | Where |
|---|---|
| Upstream source, exact | `vendor/wordgard` is Wordgard 0.6.2, checked against `build/wordgard-metadata.mjs`. |
| Wordgard's own module | `source/external/wordgard.js`: readable (not minified), the parts of each Wordgard package the editor uses, on `globalThis.StudyDirectorWordgard`. Entry `rich-text/wordgard-module.ts`. |
| Study Director's editor | `source/external/rich-text.js` reads Wordgard from that global (`wordgardGlobalPlugin` in `build/wordgard-bundle.mjs`); it holds no Wordgard code. |
| How they ship | Development and the plain deployment load both as one script, Wordgard first (`rich-text` has two sources in `build/module-manifest.mjs`). The minified deployment (`stage:firebase:minified`) ships the lean build instead: the editor and only the Wordgard code it reaches, tree-shaken and minified together. |
| Our changes to Wordgard | Build-time rewrites (`build/wordgard-source-patches.mjs`) and runtime additions behind `rich-text/wordgard-adapter.ts`, unchanged in kind. |
| New version | Replace `vendor/wordgard`, run `npm run build:richtext`; a rewrite whose upstream text moved fails by name. Record the snapshot in `build/wordgard-metadata.mjs`. |
| Tests | Tests that load the editor read both files through `tests/helpers/rich-text-runtime.mjs`. |

**Checked with 0.6.2: still needed.**

| Workaround | Why it stays |
|---|---|
| `inert-html.ts` and the two parsing rewrites | Wordgard still creates a Trusted Types policy on every HTML parse, which the app's policy list refuses. |
| `cut.ts` | Copy and cut still read the selection without first reading the DOM, and `deleteByCut` still maps to no command. |
| `Node.slice` rewrite | Still spelled in a way esbuild rejects. |
| History menu trim | Upstream history still ships undo/redo menu buttons. |

**Changes for 0.6.**
- Position sets come from `wordgard/set`; `create` takes `[value, pos]` and `[value, from, to]`.
- Pastes arrive as `beforeinput` `insertFromPaste` (an `InputEvent` with `dataTransfer`). Browser tests send the paste the way the browser does (`pasteInPage` in `tests/helpers/browser-harness.mjs`).
- Wordgard hands a paste to its paste handlers only when the paste lands on its own selection. In an empty editor focused from the keyboard the browser's caret can sit outside that, so a pasted image is taken from the `paste` event itself.
- `Decoration.Tag.shape.dynamic` is now `.derived`.
- Wordgard re-renders an atom's attributes from its shape. Audio is therefore drawn with its loaded address and status, as images are, and the editor no longer marks the player with its own attributes.
- Key bindings carry descriptions from Wordgard's phrase table, so the module includes it (about 120 lines).
- Size: the lean deployment build grew from 112.2 KB to 115.8 KB Brotli.

**Also noted with it (2026-10-17).** Both done (2026-10-25).

| Item | What to explore |
|---|---|
| Sounds made in code | **Done** (2026-10-25): the 13 cues are made in `audio-engine.js` from the same recipe, matching the old WAV files sample for sample (three samples one step apart). The WAV files (about 525 KB) and `build/compose-sounds.py` are gone; nothing about sound is precached. |
| Editor toolbar order | **Done** (2026-10-25): undo/redo · text · bullets, numbers, checklist · block quote · link, table, horizontal rule · attachment · focus. |

---

## 7. Record of work on this branch (reference only)

Commits since `main` (newest first), grouped:

### Backups (this and recent sessions)
- The commit after `ebb49fa`: sync through Drive (5.1) and one history for the Device Folder and Drive.
- `ebb49fa` Hourly versions where notes changed; Combine blue, Replace amber; audit fixes (5.5).
- `d8000e4` and the commit after `9afe06d`: the Device Folder runs through the shared backup engine. It was saved mid-move, then finished, with the due-time, lease-renewal and aborted-maintenance fixes.
- `d27570f` Prepare the backup engine to host the Device Folder (hosted locations, server-digest receipts, operation views, protected safety API).
- `f71a941` Check runs of small attachments with one read (`checksum.ranges`).
- `9696df4` Skip backups that would duplicate the newest version.
- `d03d0ce` Let the Drive cleanup test wait for background hashing (CI flake fix).
- `5e199b0` Describe standalone backup files in the backup design.
- `cae38d9` Encrypt and decrypt backup frames four at a time.
- `d597287` Save backup files where you choose, verified, with progress from the first click.
- `7b3db98` Back up when the app goes to the background and before an update.
- `3c57544` Hash files three to four times faster.
- `976c982` Back up to Google Drive automatically, every 20 minutes at most:
  - opt-in;
  - one dismissible expiry toast with Reconnect;
  - one 7-day reminder rule.
- `66977b9` Add a Device Folder storage adapter for the shared backup engine.
- `9614004` Describe the target backup engine.
- `16adda3` Restore attachments from this device instead of downloading them again.
- `68662cf` Add only what's missing from Drive and backup files.
- `eb54715` Use one forward-only change clock for every save.
- `d2c6bba` Cut two sequential Drive round trips from every backup.
- `0da44c1`, `7af933d`, `258e51a`, `8aa1275` Single-note restore: only the note's data is read, its images come back, and it works during a study session.
- `b68b9f0` Keep 15 backup versions through any gaps in backup history.

Measured on 200 MB of attachments:

| Operation | Before | After |
|---|---|---|
| File backup | 10.2 s | 2.5 s |
| Encrypted file backup | 17.1 s | 5.3 s |
| Save through the dialog, then verify | — | 4.6 s |
| Check before restore | 4.9 s | 1.1 s |
| SHA-256 in the worker | about 38 MB/s | about 135 MB/s |

### Notes and Library
- `b30da47`, `5034bdf`, `368d8b6` Notes step 1: permanent note ids, the combined earlier-versions list, the rename tick box; conversions only in the compatibility block.
- `c08935f`, `b331580` Notes step 2: "Notes" everywhere, strikethrough, the Library in Notes · Days · Data, sorting, search landing on matches, Print….
- `908bf5c` Notes step 3, the linked-notes bar at the bottom of each note (Library and Execute), the one note picker, `[[` and Link → Note links in the text, and "Linked from".
- `d172a94` Notes step 4, tags (chips in the text, the tag list with counts and an all-of filter, `#` suggestions in the shared picker, rename everywhere) and Import of .txt and .md files. The pickers now open after the keystroke that triggers them, so `[` or the first letter no longer lands in the picker's field.
- The commit after `d172a94`: Notes step 5, measured at 2,000 notes (2.3 million words). Each note's text is now checked once instead of on every read: start-up went from 8.0 s with a 2.9 s freeze to 2.5 s with none over 0.1 s, and the 2.5 s of background freezes after start-up are gone. Typing and tag rename no longer rebuild the title list. `notes-at-limit` (extended browser tier) guards it, and the release search test now runs at 2,000 notes.
- `042254b`, `90f0f7b` and `ccca88c`: resizable notes list; restore settles by itself only what cannot lose anything on this device (the handoff record keeps note titles and text and a plans-and-settings fingerprint), asks once for the rest ("All remaining" in the note review, one Replace question for what the backup lacks), and deleted notes go to Recently deleted.
- `546fbf2`, `26f862b`, `db1824a` Notes tree, Recently deleted, note menu, breadcrumb, editable title.
- `691a83d` One save engine for notes, Diary and Review reflections.
- `ff69680` Rename or move with children; merge only when asked.
- `941174c` Recently deleted for 30 days.
- `731c5c1` 20,000 words and 10,000 notes behind one count.
- `0244dae`, `a79d528`, `269e6e1` Save straight to the database with one safety copy; conflict-copy store removed.
- `e067b7b`, `f3f6602`, `7a482ce` Keep a clash's losing version; Recently deleted yields at the limit; bounded deletion ledgers.
- `397458f` Wordgard customisations behind the adapter.

### Browser data clearing and recovery
- `6c34bd7`, `cf8725c`, `52797b6`, `0ca95cb`:
  - restore what a clear removed, or let the person choose;
  - the decision stays on screen until made;
  - restore from what the person has;
  - pause backups until resolved;
  - carried across reloads.
- `ae93201` Keep Ongoing Notes and recovery intact across overlapping saves and clears.

### Background operations (earlier sessions)
- `abe12ff`, `8a85212`, `205b3b2`, `2c0fc8d`, `01a0995`, `e254fc6`, `a64f45d`, `cf4de02`, `a84a60d`, `707653f`, `38ef8c5`, `739b3db`:
  - one background job ownership model;
  - bounded, preemptible maintenance and integrity with preserved progress;
  - Drive publications resume across sign-in expiry;
  - verified Drive history inventory.

### Study session
- `6109402`, `4837fef` Away time counted only while the running block's study time lasted; the inactive-gap dialog is released when its timer already stopped.

### Review fixes (Codex, 2026-10-25)
- A backup note that takes this device's id (same title, made separately) keeps every link to it: other backup notes' linked-notes bars and `#note=` text links follow it (`alignByTitle`).
- Moving the old Device Folder backup folder checks every copied file by contents, stored objects included; a same-size object left by an interrupted move is copied again, and the old folder stays until all match.

### Tests and QA
- `8891f6c`, `eb77264`, `3d91713`, `8338f5b`, `7105b02`: fixtures, suite policy, native visibility in browser tests, de-duplicated harnesses.
- The commit after `ddb7e1d`: the pwa-update flake had two causes. A read-only secondary window that briefly held control kept waiting for its session state to settle, so it never reloaded onto the new release; it now reloads, and finishing a session-state change re-checks a waiting update at once. A window whose service worker has already moved to the new release retries every 5 seconds instead of every 5 minutes, which also covers the hidden window taking control while the visible one reloads. The test clicked Skip on the first-start form before the form had opened; `skipFirstStart` in the browser harness now waits for it.

---

## 8. Working notes

- **Testing rhythm (user's rule, 2026-10-10).** Make all the app changes for a piece of work first, then build once and run the suites once. Fix what fails, then rerun only the failing tests. Do not rerun tests after each small edit.
- **Chromium for browser tests:** `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. On a fresh profile, preset `localStorage` user defaults so the name dialog does not block clicks.
- **Rebuild the worker bundles** after changing `portable/`: `node build/wordgard-bundle.mjs --write`.
- **Fake-clock tests** that hash or encrypt must wait for real background work (`realWorkSettled` in `repository-checkpoint.mjs`).
- **Shell heredocs mangle backticks.** Use quoted heredocs or small Python edit scripts with exact-match assertions.
- **No model names in commits.** Commit messages end with the Co-Authored-By and Claude-Session lines.
