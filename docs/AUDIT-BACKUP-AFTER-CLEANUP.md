# Audit: the backup system after the step 4 cleanup (2026-10-24)

This is a read-only audit, asked for after the step 4 cleanup (`HANDOFF.md` 5.6). It looks for anything to clean up, refine, correct or improve in the backup system: the Device Folder, Drive, Version History, restore, retention, cleanup and wording. It reviews the last two commits (`4907278` and `578f149`) closely and the rest of the backup modules more broadly.

Smart merge (`mergeThreeWay`) is out of scope (`HANDOFF.md` 5.8), and decisions already in section 5 are not reopened.

## Verdict

The system is in good shape, and nothing found loses data. Each risky path fails safe: it stops and keeps everything.

The main weakness is what happens to a version that cannot be read (M1). Cleanup and the integrity check then stop for that location, quietly and for good. The version stays in Version History but fails when chosen, and "Format cleanup" never reads ready. Step 4 made this more likely for one group: versions written by earlier builds of this branch.

Everything else is small:
- leftovers (C1, C2);
- one display rule that only applies after cleanup (M2);
- a narrow case where a Combine does not move the shared base (L1);
- wording and docs.

## What is solid

Each point below was checked in the code.

- **Every restore names its version.** Version History, sync, review, the password step and recovery at start all pass a version id. Only "add what's missing" finds its own. A call without one is refused before anything is read (`backup-provider.js:1137`).
- **Released formats still open; unreleased ones are refused.** Portable v20 and older and manifests 5 and older read as before. v21, v22 and manifests 6 and 7 get "not supported by this build". The same holds for last-backup record v1 (v2 refused) and verification state v2 to v5 (v6 refused). Tests cover both sides.
- **Cleanup never deletes what it cannot read.** An unreadable version, an incomplete listing or too many files defers all deletion (`managed-repository.js:517`).
- **Safety versions are kept per device.** Selection and removal both go by the version's device (`activeProtectedRepositoryRows`, `activeProtectedProviderRow`).
- **Back up now does not stop at the first failure.** Each location returns false rather than throwing, so a Device Folder failure still lets Drive back up (`app.html:3037`).
- **No other branch-only readers remain** except the folder marker (C1). This was checked against production (`origin/main`, SDVB75F10) for every record:
  - the restore journal;
  - Device Folder settings;
  - maintenance intents;
  - the shared base;
  - the last-backup record;
  - verification state;
  - the backup and manifest formats.
- **Docs match the code by name.** Every identifier named in `BACKUP-ENGINE.md`, `ARCHITECTURE.md` and `HANDOFF.md` exists. There are no TODO markers and no unused functions. No backup style is left unused.

## Findings, most important first

### Medium

**M1. A version that cannot be read stops cleanup and checking for that location, quietly and for good.**
- What happens:
  - Any committed version whose manifest cannot be read defers all cleanup (`backup-provider.js:348`, `managed-repository.js:517`) and the integrity check (`backup-provider.js:1248`). This includes a damaged file, a newer app's format, or manifests 6 and 7 from earlier builds of this branch (refused since step 4).
  - It stays that way until the file is gone, and nothing in the app can remove it.
- What the person sees:
  - Nothing after automatic backups: their status line leaves the warning out (`backup-provider.js:1023`). Only Back up now appends "Repository cleanup was deferred…", in engine words.
  - Version History still lists the version. On the Device Folder it shows as "0 Saved Days · 0 Notes", dated by the file (`backup-provider.js:447`). Choosing it fails with "could not be applied safely".
  - "Format cleanup" never reads ready, so release B cannot start.
- Effect: storage on that location only grows (Drive quota), and scrubbing stops. No data is lost.
- Suggested:
  - Version History says "1 version can't be read" and offers Remove (with a confirmation).
  - Cleanup still removes readable versions that retention drops. It skips only object cleanup while an unreadable version exists, since that version's files are unknown.
  - Your answer to D1 decides how urgent the branch-version part is.

**M2. Version History applies the "one format" rule only after cleanup runs.**
- The rule: once a location holds a current version (manifest 8), older-format versions leave Version History (5.3a).
- Version History picks versions from the listing summaries (`repositoryInventoryHistoryEntries`, `backup-provider.js:438`). These carry no manifest version, so `selectRepositoryRetention` treats every row as current, and older versions stay listed until cleanup deletes them.
- Usually this lasts until the next cleanup. With M1, it lasts for good.
- Suggested: carry the manifest version in the summary:
  - the Device Folder reads it from the manifest it already parses;
  - Drive gets a new property, read as "older" when absent.
- No test covers this rule in Version History (T1).

### Low

**L1. A Combine of Drive's newest version from Version History can leave the shared base behind.**
- A version both locations hold is read from the Device Folder (the list prefers it).
- `sharedHead` needs the version to come from Drive (`backup-provider.js:1166`), so the shared base does not move. The next sync then merges the same version again from the older base. Where the person kept this device's side, the same question comes back as "Needs review".
- It only matters while this device has not caught up yet: sync stopped for "Needs review" or "Needs password", and the person uses Version History instead. A normal sync and Review read from Drive and are not affected.
- Found by reading. Confirm with a two-device test.
- Suggested: a Combine of the version that is Drive's newest moves the shared base whichever location it was read from (or is read from Drive).

**L2. Encrypted Device Folder versions show wrongly while the profile's password waits.**
- The case: with two or more profiles and "Not now" at start, Device Folder manifests cannot be read for the list (`device-folder-storage.js:120`).
- They then show as "0 Saved Days · 0 Notes". They are not matched with Drive's copies, so each version appears twice.
- Suggested: show them as "Locked: enter the password to see this version", or ask once when Version History opens.

**L3. A version both locations hold has no second source.**
- Restore reads from the Device Folder only. If that read fails (a missing or damaged file), it does not try Drive.
- Suggested: on a read failure, try the other location that holds the version.

### Cleanup

| # | What | Where | Suggested |
|---|---|---|---|
| C1 | Folder marker version 1 is read, but only builds of this branch wrote it: production had no marker | `device-folder-storage.js:94` | Remove, as in step 4 |
| C2 | Picker leftovers: a `choices` list built on every restore only to check the id, which line 1163 checks again; "Version restore cancelled." can no longer happen | `backup-provider.js:1154`, `1156`, `1512` | Remove |
| C3 | Version thresholds that now split nothing: 21 and 22 (files), 6 and 7 (manifests). Two compatibility entries (`name-keyed-notes-in-backups`, `area-note-names-in-backups`) describe the same released files | `backup-codec.js:39`, `340`; `managed-repository.js:48`, `56`; `compatibility.mjs` | One "released vs current" line each, one entry. Or leave for release B, which removes all of it |
| C4 | Docs: "at most one" safety version, and Version History "for the connected backup location" | `BACKGROUND-OPERATIONS.md:86`, `96`, `100` | One per device; every location |
| C5 | The four foreground operations (Version History read, note versions, Combine, Restore) repeat the same start, finish and cancel lines | `backup-provider.js` around 412, 1413–1430, 1477–1529 | Optional: one shared wrapper |

### Wording

| # | Now | Suggested |
|---|---|---|
| W1 | "1 Saved Days · 1 Notes" (Version History cards) | "1 Saved Day · 1 note" |
| W2 | "safety backup" (about 24 places) next to "safety version" (retention note, docs) | "safety version" everywhere |
| W3 | Row status "Last verified 10:42" / "Not yet verified", while messages say "Backed up to …"; the button "Turn off Device backup" | "Last backup 10:42" / "No backup yet"; "Turn off Device Folder" |
| W4 | File restore dates use a fixed `en-IN` format; Version History uses the browser's | One format |
| W5 | Recovery at start: "…before replacing local portable data" | "…before replacing this device's data" |

### Tests

| # | Missing | Would catch |
|---|---|---|
| T1 | Version History hides older-format versions once a current one exists | M2 |
| T2 | A location with one unreadable version: what the list, cleanup and "Format cleanup" show | M1 |
| T3 | Two devices: Combine of Drive's newest from Version History while the device is behind | L1 |

## Your decisions

| # | Question | Why it matters |
|---|---|---|
| D1 | Did any device run a build of this branch against a real Device Folder or Google Drive? | If yes, those locations may hold manifests 6 or 7, and M1 applies to them now. They could be removed by hand once instead of in code |
| D2 | For a version that cannot be read: show it with Remove (recommended), or leave it hidden from the person? | M1 |

## Suggested order

| Step | What | Size | Needs your decision |
|---|---|---|---|
| 1 | C1, C2, C4 and the wording (W1–W5) | Small | No |
| 2 | M2 with T1 | Small | No |
| 3 | M1 with T2 | Medium | D1, D2 |
| 4 | L1 with T3, after the test confirms it | Small | No |
| 5 | L2, L3 | Small | No |
| — | C3, C5 | Small | Optional; C3 could wait for release B |
