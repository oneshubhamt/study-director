# Handoff

Status of the work on this branch (`refactor/background-coordination`, draft PR #1). Read sections 1 and 3 first; section 2 is a closed summary.

**Current state (2026-10-17):** the backup and data work is finished. The notes plan in `docs/NOTES.md` (items 1 to 16) is fully built, all five steps, including the measurement at 2,000 notes. The background services are mapped and held to one standard (section 4). Last of all: Wordgard as its own module (section 5).

---

## 1. How we proceed (agreed 2026-10-06)

**Philosophy.** The app is clean, lean, efficient, elegant and reliable. No extravagant or unnecessary features. Everything works rock solid within the range it is meant for. Do the simple things very well; do not over-engineer.

**Order, and when the session ends.**
1. Finish refining the backup system to its best shape. **Done.**
2. Audit it and report to the user what I think. **Done.**
3. Hold a brainstorming session with the user to understand how to improve notes. Discuss first; build only after agreement. **Done.**
4. Then the background services (section 4). **Done.**
5. The session concludes only once all three — backup, notes, background services — are as good as we can reasonably make them.

**Migration (user's rule, 2026-10-10).** Older data is read once, converted into the current canonical form, verified and retired, never used again. Only the compatibility host (`compatibility-host.js`, plus repository adapters where a transaction requires it) reads old forms; the ordinary runtime reads only current forms. Every conversion is listed in `contracts/compatibility.mjs` with its retirement condition, so the whole migration machinery can be deleted later, leaving one clean canonical data structure.

## 2. Done: backups and data (closed)

There is nothing to re-read here; the designs live in `docs/BACKUP-ENGINE.md`, `docs/BACKGROUND-OPERATIONS.md`, `docs/ARCHITECTURE.md` and `docs/AUDIT-DATA-AND-BACKUP.md`. In short:
- **One backup engine** (`backup-provider.js`) runs every operation for the Device Folder and Google Drive. The app draws all three rows (Device Folder, Drive, portable file) the same way.
- **Data is lean and canonical.**
  - Older stored data is read once by the compatibility host, converted and retired.
  - The compatibility layer is isolated, so it can be deleted in one step later (`tests/architecture/storage/compatibility-isolation.mjs`).
- **Every audit finding is closed** (status table in the audit), along with #45 and #46.
- **Retention:** 15 versions per location (latest, 6 daily, 4 weekly, 4 monthly). No tier shares a week or a month with the one before it, so the history reaches four to five months back.
- **Dropped from the backup wish list:**
  - a "backup health" summary, because each location's row already shows its last backup and any problem;
  - streaming verification during restore, because every downloaded piece is already checked against the version's manifest before anything is written.
- **Left for later on purpose:**
  - encryption, to come as end-to-end encryption with a sign-in-first experience;
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
| Canonical data maintenance | Yes: 20 s budget, yields to foreground, durable pending record, 24 h cadence | Uses the shared gate. Keeps running through a browser-data clear, because it is the recovery path. |
| Attachment cleanup | Yes: 5 s / 128 files a pass, strict reference proof | Shared gate. Waits while a clear is unresolved and stops at once when one is detected. Images in Recently deleted notes are kept (now tested). |
| Attachment verification | Yes: 5 s / 128 files, saved progress, daily | Shared gate; waits during a clear. |
| Backup scratch files | Yes: lock per file, pinned files kept | Shared gate: now the writing tab only, and waits during a clear. |
| Automatic backups, retention cleanup, integrity (Device Folder and Drive) | Yes: one engine, shared priorities (integrity < maintenance < automatic < convergence < foreground), leases, journals | Shared gate (it already paused for clears). |
| App update checks and the safe update | Yes: own timer with capped backoff, writing tab only; an update waits for backups (up to a minute) and for the applied plan to end | Diagnostics now show the next check, the last check and failed attempts. |
| Service worker caches | Yes: a fixed file list and at most 3 release caches, nothing cached at runtime | None; no size budget is needed. |
| Workers | Search: let go after 2 quiet minutes. Export: stops after each job. Image and Insights: one per use. | Attachment worker: now let go after 2 quiet minutes, like search. |
| Deletion records | Yes: bounded, trimmed by canonical maintenance | None. |
| Storage health and quota | Persistent storage requested at launch; warnings at 80% and 92% | The estimate was measured only at launch; it is now refreshed on returning to the app, at most hourly, so a tab left open for days still warns. |
| Notices, editor clean-up, debounced saves | Foreground UI, not background work | None. |

**The one shared gate.** `backgroundBlocker()` in `app.html` answers "may background work start?" for every job: start-up has finished, this tab owns writes, and, for housekeeping, no browser-data clear is unresolved. Each job adds only its own condition (storage support, encryption unlocked). When a clear is settled, every job is woken. `tests/architecture/storage/background-work-contract.mjs` keeps it that way.

**Considered and left out.**
- *Run upkeep only while the page is visible.* A desktop tab left in the background all day would never run it. Upkeep already runs at background priority (`scheduler.postTask`) and yields to anything the person does.
- *Move the app-update timer under the shared job.* It already meets the standard; moving it would touch the update-safety flow for no visible gain.
- *New or merged services.* None is missing, and none duplicates another: the Device Folder and Drive already share every job.

## 5. Last of all: Wordgard as its own module (decided 2026-10-11)

Do this at the very end, after the background services.

**Already so.**
- `vendor/wordgard` is the exact upstream source, checked against `build/wordgard-metadata.mjs`.
- Study Director's few changes are trims applied only at build time (`build/wordgard-source-patches.mjs`) and runtime additions behind `rich-text/wordgard-adapter.ts`.
- Features use Wordgard's own capabilities where they exist (its Strikethrough mark, its decoration API for search matches); a patch or workaround is the last resort.

**To do.**
- Ship Wordgard as its own replaceable module in `source/`, unminified and untouched, separate from Study Director's editor code (`source/external/rich-text.js` currently holds both, already minified).
- Build the lean version only when the minified deployment is made: tree-shaken to what Study Director uses, with the build-time trims applied.
- A newer Wordgard then drops in by replacing that one module; the build names any trim whose upstream text moved.
- At the same time, check whether newer Wordgard versions make the two runtime workarounds (`inert-html.ts`, `cut.ts`) or the build-time trims unnecessary, and drop those that are.

---

## 6. Record of work on this branch (reference only)

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

## 7. Working notes

- **Testing rhythm (user's rule, 2026-10-10).** Make all the app changes for a piece of work first, then build once and run the suites once. Fix what fails, then rerun only the failing tests. Do not rerun tests after each small edit.
- **Chromium for browser tests:** `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. On a fresh profile, preset `localStorage` user defaults so the name dialog does not block clicks.
- **Rebuild the worker bundles** after changing `portable/`: `node build/wordgard-bundle.mjs --write`.
- **Fake-clock tests** that hash or encrypt must wait for real background work (`realWorkSettled` in `repository-checkpoint.mjs`).
- **Shell heredocs mangle backticks.** Use quoted heredocs or small Python edit scripts with exact-match assertions.
- **No model names in commits.** Commit messages end with the Co-Authored-By and Claude-Session lines.
