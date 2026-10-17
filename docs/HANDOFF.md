# Handoff

Status of the work on this branch (`refactor/background-coordination`, draft PR #1). Read sections 1 and 5 first; sections 2 to 4 are closed summaries.

**Current state (2026-10-17):** the backup and data work is finished. The notes plan in `docs/NOTES.md` (items 1 to 16) is fully built, all five steps, including the measurement at 2,000 notes. The background services are mapped and held to one standard (section 4). **Next: Drive sync and profiles (section 5).** Last of all: Wordgard as its own module, with two items to explore alongside it: notification sounds made in code, and the editor toolbar order (section 6).

---

## 1. How we proceed (agreed 2026-10-06)

**Philosophy.** The app is clean, lean, efficient, elegant and reliable. No extravagant or unnecessary features. Everything works rock solid within the range it is meant for. Do the simple things very well; do not over-engineer.

**Order, and when the session ends.**
1. Finish refining the backup system to its best shape. **Done.**
2. Audit it and report to the user what I think. **Done.**
3. Hold a brainstorming session with the user to understand how to improve notes. Discuss first; build only after agreement. **Done.**
4. Then the background services (section 4). **Done.**
5. Then Drive sync and profiles (section 5, decided 2026-10-17). **Next.**
6. The session concludes only once all four — backup, notes, background services, sync — are as good as we can reasonably make them.

**Migration (user's rule, 2026-10-10).** Older data is read once, converted into the current canonical form, verified and retired, never used again. Only the compatibility host (`compatibility-host.js`, plus repository adapters where a transaction requires it) reads old forms; the ordinary runtime reads only current forms. Every conversion is listed in `contracts/compatibility.mjs` with its retirement condition, so the whole migration machinery can be deleted later, leaving one clean canonical data structure.

## 2. Done: backups and data (closed)

There is nothing to re-read here; the designs live in `docs/BACKUP-ENGINE.md`, `docs/BACKGROUND-OPERATIONS.md`, `docs/ARCHITECTURE.md` and `docs/AUDIT-DATA-AND-BACKUP.md`. In short:
- **One backup engine** (`backup-provider.js`) runs every operation for the Device Folder and Google Drive. The app draws all three rows (Device Folder, Drive, portable file) the same way.
- **Data is lean and canonical.**
  - Older stored data is read once by the compatibility host, converted and retired.
  - Stored names are plain: notes are `notes` everywhere (store, records, backups) and the Device Folder settings are `deviceFolder`; the old "area note" and "automatic device backup" names are converted on first start (table in `docs/ARCHITECTURE.md` §2). Backup files are version 22 and checkpoints version 7; an older build refuses them until it updates.
  - The compatibility layer is isolated, so it can be deleted in one step later (`tests/architecture/storage/compatibility-isolation.mjs`).
- **Every audit finding is closed** (status table in the audit), along with #45 and #46.
- **Retention:** 15 versions per location (latest, 6 daily, 4 weekly, 4 monthly). No tier shares a week or a month with the one before it, so the history reaches four to five months back.
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

**The one shared gate.** `backgroundBlocker()` in `app.html` answers "may background work start?" for every job: start-up has finished, this tab owns writes, and, for housekeeping, no browser-data clear is unresolved. Each job adds only its own condition (storage support, encryption unlocked). When a clear is settled, every job is woken. `tests/architecture/storage/background-work-contract.mjs` keeps it that way.

**One way to wait.** Local upkeep (canonical maintenance, attachment cleanup and checks, scratch files) asks `upkeepBlocker()`: the shared gate, plus "is the person busy?". While they are, each job waits under the named reason `foreground-busy` with no timer of its own, the same way backup jobs wait under a held reservation. One watcher checks back every 15 seconds and wakes every job the moment the work ends; notices, backup status and the end of an app update check at once. Local upkeep keeps its own gate rather than joining the backup reservation, because the backup busy signals include automatic backups, which would then block themselves. Copy diagnostics names every waiting and waking reason.

**Considered and left out.**
- *Run upkeep only while the page is visible.* A desktop tab left in the background all day would never run it. Upkeep already runs at background priority (`scheduler.postTask`) and yields to anything the person does.
- *Move the app-update timer under the shared job.* It already meets the standard; moving it would touch the update-safety flow for no visible gain.
- *One reservation for local upkeep and backups.* See "One way to wait": the backup busy signals cover automatic backups too.
- *New or merged services.* None is missing, and none duplicates another: the Device Folder and Drive already share every job.

## 5. Next: Drive sync and profiles (decided 2026-10-17)

Build this next, before Wordgard (section 6). The decisions below are the user's, settled over several rounds; do not reopen them. Take it slowly and thoroughly: the user expects edge cases to be many, and robustness must not be traded for convenience.

**Goal.** Every device stays fully local and works on its own, exactly as now. Whenever a Drive connection happens to be open, the device syncs: it brings in what other devices changed, merges it with its own changes, then uploads. Drive is where a person's devices meet and holds the shared library and the shared Version History. It never overwrites an edit a device has not yet synced. Apart from Drive backup and restore becoming sync, and profiles, the app behaves exactly as it does now. The app is meant mainly for one device; two or three devices per person is the most it must handle well.

**Why.** Drive today is explicit handoff: back up the device you leave, then choose Combine or Replace on the other. If that step is skipped, the keep-15 rule (newest version per day, over all devices together) can drop one device's versions from Drive, so its edits then live only on that device (audit finding #1, 2026-10-17). Sync removes the manual step, and with it the risk.

### 5.1 Sync

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
| Status | A small status by the name tag in the left sidebar and in the Drive row of Library → Data: "Synced 10:42", "Syncing…" or "Changes since 10:42" |
| Combine and Replace | Leave everyday Drive use. They stay for backup files and Device Folder versions. Restoring a Drive version from Version History applies to all devices, with a safety version kept first |
| Device Folder | Unchanged: a local safety copy of this device (of the active profile). After a sync it holds the shared library anyway. It is not a second sync channel; two masters would mean conflicts |
| First sync with no shared history | For example two devices that backed up separately to the same Drive. Two-way merge: anything on one side only is added, anything different on both is kept for review |

### 5.2 Merge rules

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

| Part | Decision |
|---|---|
| What a profile is | A name, an optional backup password and an optional Google account. The three belong together. Drive and the password can be added later, or changed, in Library → Data |
| Several people on one device | Supported, though rare. Each profile has its own local data: database, browser settings, attachments and Device Folder |
| Existing data | Becomes the first profile under its current storage names. Nothing moves, so there is no migration. New profiles get their own names, resolved from the identities already centralised in `contracts/` |
| Device-wide | Only what belongs to the device: app updates, the service worker and the profile list itself. Decide key by key |
| Switching | The name tag in the left sidebar (desktop; the same tag on mobile) opens the profile list and Add profile. One profile is active at a time; switching reloads every open tab into it |
| Drive link | The Drive library records its profile's id. Connecting a Google account whose library belongs to another profile is refused, so two people's data can never mix. Changing the account uploads the whole library to the new account and leaves the old copy alone |
| Password | With one profile on the device, its backup key is remembered on the device (a non-extractable key, never the password) and not asked again. With several, each person is asked for their own when switching in, which unlocks their sync; "Not now" keeps working locally with sync paused. It is not a privacy lock, because browser data is not encrypted (5.8) |
| Removing a profile from a device | From Library → Data, only after confirming its data is synced, or with a clear warning |

Design sync around profile ids from the start; build the per-profile storage after sync.

### 5.4 First start

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

### 5.5 Small items (step 1)

| Item | Decision |
|---|---|
| Hourly versions | Keep the newest version per hour for the last 24 hours, up to 15, on top of latest + 6 daily + 4 weekly + 4 monthly, at Drive and the Device Folder. Today only the newest version of the current day survives (`selectRepositoryRetention`), so a mistake at 3 pm leaves yesterday as the nearest way back |
| Combine and Replace colours | Combine becomes the primary (accent) button, as the recommended choice. Replace becomes amber: it can be undone from the safety copy, and red stays for permanent deletion. Today Combine has no `kind` (gray) and Replace is `danger` (red) in `backup-presentation.js` |
| Audit finding #3 | `contracts/data-architecture.mjs` labels the restore journal `RestoreJournalPayload.v4`; it is v5 |
| Audit finding #4 | A note in the folder picker: use a folder only this device uses, not one synced by Dropbox, OneDrive or iCloud |

### 5.6 Order of work

1. The small items (5.5).
2. The sync engine and merge rules (5.1, 5.2), with sync designed around profile ids.
3. The first-start form (5.4).
4. Profiles (5.3).

For each: make all the changes, build, test with two simulated devices in a real browser, fix, document, commit.

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

### 5.8 Later (noted, not planned)

- **Encryption at rest.** Data stored in the browser (IndexedDB, browser storage, attachments) is not encrypted. Backups are, when a password is set: Device Folder, Drive and backup files, attachments included. Note exports are not. Profiles on one device are therefore separate, not private. Already on the list: end-to-end encryption with a sign-in-first experience (section 2).
- **Fully silent background sync** would need a small server to hold Google refresh tokens. Not planned; sync during sign-in windows is the accepted design.

---

## 6. Last of all: Wordgard as its own module (decided 2026-10-11)

Do this at the very end, after Drive sync and profiles.

**Already so.**
- `vendor/wordgard` is the exact upstream source, checked against `build/wordgard-metadata.mjs`.
- Study Director's few changes are trims applied only at build time (`build/wordgard-source-patches.mjs`) and runtime additions behind `rich-text/wordgard-adapter.ts`.
- Features use Wordgard's own capabilities where they exist (its Strikethrough mark, its decoration API for search matches); a patch or workaround is the last resort.

**To do.**
- Ship Wordgard as its own replaceable module in `source/`, unminified and untouched, separate from Study Director's editor code (`source/external/rich-text.js` currently holds both, already minified).
- Build the lean version only when the minified deployment is made: tree-shaken to what Study Director uses, with the build-time trims applied.
- A newer Wordgard then drops in by replacing that one module; the build names any trim whose upstream text moved.
- At the same time, check whether newer Wordgard versions make the two runtime workarounds (`inert-html.ts`, `cut.ts`) or the build-time trims unnecessary, and drop those that are.
- Ship only what Study Director uses, so the payload stays as small as possible.

**Also to explore with it (noted 2026-10-17; not yet audited or built).**

| Item | What to explore |
|---|---|
| Sounds made in code | The 13 notification sounds ship as WAV files in `source/assets/sounds` (about 525 KB, each 1 to 3 seconds). Explore making them with the browser's Web Audio API instead, so the files no longer ship and the app stays lean. Keep the current sounds as the reference for how each should sound. They are already synthesized from short note phrases by `build/compose-sounds.py`, so the recipe exists. |
| Editor toolbar order | Now: undo/redo · text (Aa, B, I, HL, ⋮) · block quote, bullets, numbers, checklist · link, attachment · table, horizontal rule · focus. Wanted: undo/redo · text · bullets, numbers, checklist · block quote · link, table, horizontal rule · attachment · focus. (The editor has no code-block button; the button meant is block quote ❝.) |

---

## 7. Record of work on this branch (reference only)

Commits since `main` (newest first), grouped:

### Backups (this and recent sessions)
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

### Tests and QA
- `8891f6c`, `eb77264`, `3d91713`, `8338f5b`, `7105b02`: fixtures, suite policy, native visibility in browser tests, de-duplicated harnesses.

---

## 8. Working notes

- **Testing rhythm (user's rule, 2026-10-10).** Make all the app changes for a piece of work first, then build once and run the suites once. Fix what fails, then rerun only the failing tests. Do not rerun tests after each small edit.
- **Chromium for browser tests:** `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. On a fresh profile, preset `localStorage` user defaults so the name dialog does not block clicks.
- **Rebuild the worker bundles** after changing `portable/`: `node build/wordgard-bundle.mjs --write`.
- **Fake-clock tests** that hash or encrypt must wait for real background work (`realWorkSettled` in `repository-checkpoint.mjs`).
- **Shell heredocs mangle backticks.** Use quoted heredocs or small Python edit scripts with exact-match assertions.
- **No model names in commits.** Commit messages end with the Co-Authored-By and Claude-Session lines.
