# Audit: the background services after sync and profiles (2026-10-25)

This is a read-only audit. It checks every background job and timer against the standard in `HANDOFF.md` section 4 (bounded work, gives way to the person, durable intent, one retry policy, writing tab only, visible in Copy diagnostics, tested). The last full map was made on 2026-10-17, before sync and profiles, so this audit looks hardest at what came after it:
- Drive sync (catch-up, taking turns, copies between locations);
- the Drive sign-in kept across reloads;
- profiles (removal at start, the password asked at start);
- the Device Folder's per-profile folders and the one-time move.

Smart merge is out of scope (`HANDOFF.md` 5.8), and decisions already in section 5 are not reopened.

## Verdict

The background services are in good shape, and nothing found loses data. The ten services from the 2026-10-17 map are unchanged and still meet the standard. Sync was built into the existing automatic-backup job, so it inherits its priorities, the shared gate, the password wait and its diagnostics row.

The gaps are all in the new parts:
- **M1.** A failed sync catch-up is tried again only at the next 20-minute check, not 30 seconds later as the code intends. Confirmed with a fake-clock run.
- **L1.** An upload cut off by a closed page makes the same device wait up to 15 minutes for itself, asking Drive every 15 seconds.
- **L2.** The Device Folder's one-time folder move runs in every tab at start, outside the shared gate.
- **L3.** A version written by a newer app version stops this device's sync, and the notice gives advice that doesn't help.
- **L4.** Copy diagnostics has no row for sync or profiles.
- Docs, wording and tests.

## The services today

| # | Service | Mapped | Meets the standard | Gap |
|---|---|---|---|---|
| 1 | Canonical data maintenance | 10-17 | Yes | — |
| 2 | Attachment cleanup | 10-17 | Yes | — |
| 3 | Attachment verification | 10-17 | Yes | — |
| 4 | Backup scratch files | 10-17 | Yes | — |
| 5 | Automatic backups, cleanup and integrity (Device Folder and Drive) | 10-17 | Yes | — |
| 6 | App update checks and the safe update | 10-17 | Yes | — |
| 7 | Service worker caches | 10-17 | Yes | — |
| 8 | Workers (search, attachment, file, Insights) | 10-17 | Yes | — |
| 9 | Deletion records | 10-17 | Yes | — |
| 10 | Storage estimate (hourly on return) | 10-17 | Yes | — |
| 11 | Drive sync: catch-up, turns, copies between locations (inside job 5) | New | Mostly | M1, L1, L3, L4 |
| 12 | Drive sign-in expiry, kept across reloads (`drive.js`) | New | Yes | — |
| 13 | Removed profiles' data deleted at start (`Profiles.collect`) | New | Yes, by design | Not in diagnostics (L4) |
| 14 | Device Folder preparation and the one-time move (`prepareInBackground`) | New | No | L2 |

Write ownership (heartbeat and mutation lease), the clocks, notice timers and debounced saves are infrastructure or foreground work, not background jobs, as in the 10-17 map.

## What is solid

Each point below was checked in the code.

- **Sync has no scheduler of its own.** The check, the catch-up, turn waits and copies all run from the location's one convergence job (`backup-provider.js:1075`). So they share the priorities, the gate (writing tab, start-up finished, no unresolved clear) and the password wait: with "Not now", every backup and sync job waits as `locked` (`app.html:8307`).
- **The check cadence matches the decisions** (`syncCheckDue`, `backup-provider.js:951`):
  - on sign-in and at start;
  - on a return to the app, at most once a minute;
  - every 20 minutes;
  - when going to the background with changes waiting (the upload checks Drive first).
- **Every wait is bounded:**
  - the Device Folder wait is at most 2 minutes;
  - a turn wait is at most 15 minutes;
  - copies go one version per run, 5 seconds apart, never newer than Drive's newest;
  - a failed copy is skipped, not retried.
- **The catch-up gives way correctly.** It runs as a foreground engine operation, so:
  - cleanup and integrity give way to it;
  - local upkeep waits;
  - an app update waits for it (`pwaUpdateBlockReason`);
  - the person can cancel it from the Drive row.
- **An older version is never merged against a newer base.** The shared base is used only when the incoming version descends from it (`lastSharedBase`, `backup.js:673`). Otherwise the merge is two-way and keeps differences for review, so nothing is silently reverted.
- **Sign-in expiry is one timer.** It is re-armed whenever a sign-in is adopted, including from another tab. `connected()` checks the clock itself, so a late timer in a sleeping tab cannot leave a stale sign-in. Waiting changes back up 5 minutes before the sign-in ends.
- **Diagnostics name every new reason.** These include `turn`, `behind`, `spine`, `catching-up`, `in-sync`, `needs-review`, `copied` and `copy-skipped`. So the convergence row already gives state, next run and last outcome for sync.
- **Profile removal deletes only removed profiles' scoped names**, never the page's own, and is safe to repeat. It runs at start, when no tab of a removed profile can be open (every tab follows a switch), so it needs no gate.

## Findings, most important first

### Medium

**M1. A failed or cancelled catch-up is tried again only at the next sync check.**
- What happens:
  - A failed catch-up asks for a retry on the backoff ladder (30 seconds, then 2, 10 and 30 minutes) (`backup-provider.js:968`). A cancelled one asks for 15 seconds (`:977`).
  - The retry run asks `syncCheckDue`, which says no: the check time was set just before the catch-up, and a retry trigger needs 20 minutes (`:951`).
  - With nothing to upload, the run ends at once (`:1076`), so the next try is the 20-minute check.
- Confirmed on a fake clock against the production engine: a catch-up failed at 6 s and was tried again at 20 min 41 s.
- What the person sees:
  - "Syncing with Google Drive will retry."
  - Another device's changes then arrive up to 20 minutes late, unless they leave and return to the app or make a change themselves.
  - Meanwhile the sidebar reads "Synced" with the old time.
- A successful catch-up does not reset the retry count (`:978`). A "keeps failing" notice raised by earlier failures stays until the next completed check.
- Suggested:
  - After a failed or cancelled catch-up, mark the location as behind, as an upload refused for being behind already does. The retry then looks again.
  - Reset the retry count when a catch-up succeeds.
  - Test T1.

### Low

**L1. An upload cut off by a closed page makes this device wait for itself.**
- Each Drive upload leaves a publication marker while it runs. Markers carry no device id, and the device knows its own only in memory (`ownPublications`, `backup-provider.js:572`). After a reload, its own leftover marker counts as another device's.
- It then waits up to 15 minutes and retries every 15 seconds. Each retry creates and removes a marker and lists the library (`:725`), about 60 rounds in all.
- The person sees "Another device is saving to Google Drive; this backup goes next."
- This is likely on phones: going to the background starts an upload, and the browser may close the page mid-way.
- The comment at `:570` says this cannot happen.
- Separately, Drive cleanup treats any marker younger than 24 hours as a running upload (`:560`). A leftover marker therefore holds cleanup for up to a day. Versions only pile up; nothing is lost. This was already so before sync.
- Suggested:
  - Record the device id on the marker. A marker from this device that this page did not start counts as left over once this page owns writes.
  - Back off the turn retry: 15 seconds, 1 minute, then 5 minutes.
  - Test T2.

**L2. The Device Folder's preparation and one-time move run in every tab, outside the shared gate.**
- `prepareInBackground()` runs at start and on every return to the app (`device-backup.js:160`, `203`, `212`, `214`). It:
  - creates this profile and device's folder;
  - rewrites the folder's marker file;
  - once per device, moves the old single folder: it copies and checks every file, then deletes the old folder (`device-folder-storage.js:294`).
- It never asks `backgroundBlocker()`. So:
  - a read-only second tab does it too;
  - it can start before start-up finishes and during a browser-data clear;
  - no lock keeps two tabs apart.
- When an app update reloads two tabs together, both may move at once. The result is still right:
  - the first tab completes and checks the copy;
  - the second fails and shows "…could not be prepared" in its Device Folder row;
  - the next start finishes with what was copied.
- Found by reading.
- Every person with a Device Folder meets this once, at the first start of this release: production keeps the single folder.
- Suggested:
  - Start it only when `backgroundBlocker()` is clear, so it runs once start-up has finished, in the writing tab.
  - Hold a Web Lock around the move.
  - Tests T3 and T5.

**L3. A version from a newer app version on Drive stops this device's sync, and the notice doesn't help.**
- The case: another device updates first and writes a format this build cannot read. `sharedAhead` still counts that version as Drive's newest (`backup-provider.js:946`). So:
  - every catch-up fails;
  - every upload is refused as behind.
- The device retries on the capped ladder. After four failures it says "Backing up to Google Drive keeps failing. Open Google Drive settings and choose Back up now, or reconnect." Neither helps; updating the app does.
- Version History lists the version as "Can't be read by this app" with Remove (D1).
- Nothing is lost: the changes stay on this device and merge after the update.
- Suggested: when Drive's newest is in a newer format (the listing already carries it, `sdHistoryFormat`), sync:
  - stops retrying;
  - checks for an app update;
  - says "Google Drive has changes from a newer version of Study Director. Update this app to keep syncing."

**L4. Copy diagnostics has no row for sync or profiles.**
- The convergence row shows the job. It does not show:
  - when this device last synced or last checked;
  - whether it waits for a review or a password;
  - whether it waits its turn or for the Device Folder;
  - when the sign-in ends;
  - how many kept versions wait for review;
  - whether a removed profile still waits to be deleted.
- These are the first things to read when a real device does not sync, and live Drive acceptance is still ahead.
- Suggested:
  - a "Drive sync" row: synced at, checked at, review, password, behind, catching up, sign-in ends at;
  - a "Profiles" row: count, removal pending, password waiting.
  - Times and flags only, as for the other rows.

### Cleanup

| # | What | Where | Suggested |
|---|---|---|---|
| C1 | The map titled "every background service" predates sync and profiles. It has no rows for services 11–14 above | `HANDOFF.md` section 4 | Add the four rows |
| C2 | "Every job first asks one shared gate" is not true of L2 or profile removal. "Checked on … going to the background" happens only when changes wait | `BACKGROUND-OPERATIONS.md:41`, `:51` | Fix with L2, and say "with changes waiting" |
| C3 | "See the current audit and evidence" links the 4 October report, which still says "one temporary protected safety snapshot" | `BACKGROUND-OPERATIONS.md:108`, `BACKGROUND-AUDIT.md:46` | Call it the 4 October record, or fold its timings table into `BACKGROUND-OPERATIONS.md` |

### Wording

| # | Now | Suggested |
|---|---|---|
| W1 | During a sync, Back up now and Version History are greyed out with no reason (`app.html:3033`) | A tooltip: "Syncing with Google Drive…" |
| W2 | A sync that keeps failing reuses the backup notice: "Backing up to Google Drive keeps failing. … choose Back up now, or reconnect." | "Syncing with Google Drive keeps failing. It keeps trying; reconnect if this stays." |
| W3 | After a failed sync the sidebar still says "Synced 10:42" | D2 |
| W4 | "Another device is saving…" also when the marker is this device's own leftover | Goes with L1 |

### Tests

| # | Missing | Would catch |
|---|---|---|
| T1 | Fake clock: a catch-up that fails or is cancelled is tried again within a minute, and its retry count resets on success | M1 |
| T2 | A reload during a Drive upload: the next page does not wait for its own marker | L1 |
| T3 | Two tabs start together with the old single Device Folder: one move, no error, and a read-only tab never writes to the folder | L2 |
| T4 | A browser lifecycle test for sync and profiles. No browser suite covers a sign-in kept across a reload, the check on return, a profile switch or a removal; standard point 7 asks for one. A simulated Drive behind Playwright routes could carry it | Standard point 7 |
| T5 | `background-work-contract.mjs` also rejects a Device Folder writer outside the gate | L2 coming back |

## Your decisions

| # | Question | Why it matters |
|---|---|---|
| D1 | For a version made by a newer app version (another device updated first): keep Remove (D2 of the last audit), or show "Made by a newer version of Study Director. Update this app to open it." without Remove (recommended)? | It is not damaged. It is the other device's newest shared version, and removing it is never what the person needs |
| D2 | After a sync fails, keep "Synced 10:42" in the sidebar, or show "Not synced · retrying" until it succeeds? | "Synced" reads as up to date while this device is behind (M1, L3). Section 5.1 lists three labels; this would add a fourth |

## Suggested order

| Step | What | Size | Needs your decision |
|---|---|---|---|
| 1 | M1 with T1 | Small | No |
| 2 | L4 | Small | No |
| 3 | L2 with T3 and T5 | Small | No |
| 4 | L1 with T2 | Small | No |
| 5 | L3 | Small | D1 |
| 6 | C1–C3 and W1–W4 | Small | D2 (for W3) |
| 7 | T4 | Medium | No |
