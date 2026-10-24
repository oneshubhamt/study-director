# Audit: backups and app behaviour after sync (2026-10-24)

Read-only audit asked for in `HANDOFF.md` 5.6, step 5. Drive went from a manual handoff (back up, then Combine or Replace on the other device) to automatic sync, with one history shared by the Device Folder and Drive. This checks whether everything around backups is still in its best shape after that change.

Scope:
- Device Folder and Drive backups end to end.
- Version History: one history, keep-15 plus up to 10 hourly, and how each location keeps, copies and prunes.
- A note's earlier-versions list.
- Every behaviour built for the manual handoff: restore flows, Combine and Replace, wording, reminders, status and notices.

Smart merge (`mergeThreeWay`) is out of scope (`HANDOFF.md` 5.8).

## Status

Report only. Nothing has been changed. Findings wait for your decisions.

## Verdict

The engine is in good shape after sync. Nothing loses data:
- sync never overwrites an unsynced edit;
- every person-started restore keeps a safety version;
- what a sync cannot settle is kept for review.

The weak points are what was left from the handoff era:
1. **Wording.** Restore still says "this device" though a restore now reaches every device. Many texts still describe two separate histories.
2. **Two of everything.** There are two Version History lists, two "Versions" buttons and two "Back up now" buttons, for versions that are now the same.
3. **Unreachable code.** Two version pickers from the manual handoff are still there.

One timing gap was found by reading (S2). It should be confirmed with a test before fixing.

## What is solid

Each point below was checked in the code.

- **Combine of an older version cannot silently revert.** The shared base is used only when the version descends from it (`handoffBase`, `backup.js:671`). Any other version merges two-way, so anything different on both sides becomes a choice.
- **No ping-pong between devices.** A catch-up with nothing new uploads nothing. A version whose content matches Drive's newest is recognised as unchanged and not written (`repositoryUnchangedVersion`, `managed-repository.js:1081`). This also applies to copies.
- **Sync stays cheap.** A quiet sync makes no safety version. A person's restore, Combine or review always does (`backup-provider.js:1188`).
- **Retention is the same on every device.** The hourly window follows the newest version, not the clock. A copy is only made of a version the location would keep, so copying and pruning never fight.
- **A failed copy never stops history.** That location makes its own version instead.
- **Restoring keeps reviews.** A version restore keeps this device's kept-for-review records and the version's own (`backup.js:1339`).
- **Each version is complete.** Every version still carries everything: notes, Saved Days, session, settings, attachments and kept-for-review records.
- **Urgent moments upload at once.** Suspend, Continue here and Finish today are marked urgent. Drive uploads within seconds, after the Device Folder.

## Findings, most important first

### High

**S1. Restore says "this device", but a restore now reaches every device.**
- What the person sees:
  - "Replace current data: Make this device match this backup." (`backup-presentation.js:21`)
  - "This device will match this backup." (`backup.js:1826`)
- What happens: with Drive connected, the next sync uploads the restored state and every other device takes it in. This is the decided behaviour ("Restoring a Drive version applies to all devices", 5.1 and 5.7). The person is just never told.
- Where it applies: restoring from Drive, from the Device Folder or from a file.
- After restoring an older Drive version, the outcome line says "Google Drive backup state is verified". Drive does not hold that state as its newest until the next upload.
- Suggested: when Drive is connected, Replace and Combine say "Your other devices get this at their next sync", and the outcome line says the same.

### Medium

**S2. "Upload at once when the app goes to the background" can wait 20 minutes on a device with both locations.**
- Normally, going to the background (or before an update) pushes waiting changes to Drive at once.
- When the Device Folder also has those changes waiting, Drive first gives way to it (`spineLeader`). That is correct, so Drive can copy the folder's version.
- The Device Folder then backs up and hands back to Drive (`placedSpine` → `scheduleAutomaticBackup`), but without the urgency. Drive waits for its usual 20-minute slot instead (`backup-provider.js:862`, `1034`).
- Phones have no Device Folder, so they are not affected. Suspend and the other urgent moments are not affected.
- Effect: on a desktop with both locations, closing the tab can leave another device without the latest changes until this one opens again. Nothing is lost.
- Found by reading. Confirm with a test (T2), then pass the urgency on.

**S3. Version History is still two lists, though both locations hold the same versions.**
- Each location has its own "Versions" button, list and title ("Device Folder backups", "Google Drive backups"). It also has its own "Back up now".
- With one history, the lists show the same versions. Small differences remain:
  - versions made while Drive was signed out;
  - other devices' versions the Device Folder would not keep;
  - each location's own safety version.
- Suggested, for your decision:
  - one Version History that lists each version once and reads it from the Device Folder when it holds it, otherwise from Drive;
  - one "Back up now".
- Rows would show where a version is kept only when it is in one location.

**S4. A note's earlier versions are read from every location, then duplicates are dropped.**
- `collectNoteVersions` (`backup-recovery-host.js:282`) reads the whole history from each connected location in turn, then removes repeats by text.
- On a device with both locations, every Drive read repeats one the Device Folder already made.
- Suggested: read the Device Folder first, then from Drive only the versions it lacks. This fits naturally with S3.

**S5. Two version pickers from the manual handoff are unreachable.**
- Drive's own picker, "Combine from Drive / Replace from Drive" (`drive.js:1121`, `1158`). It is built outside the app's dialog family.
- The Device Folder's "Restore Device Folder version / Combine from Device Folder backup" picker (`app.html:9410`, wired at `device-backup.js:186`). Its wording is older ("Saved Dates / Reflections").
- The engine branch that calls both (`backup-provider.js:1148`).
- Every path now passes a chosen version: Version History, sync, add-what's-missing after a clear, and recovery at start. So none of these can open.
- Two architecture tests pin them: `cleer-integration.mjs:156` and `backup-recovery-ux-contract.mjs:51`.
- Suggested: remove them in step 4 (cleanup).

### Low

**S6. After taking in another device's changes, the Device Folder makes its own version.**
- The catch-up does not mark Drive's newest version as the one to copy. The Device Folder therefore saves the merged state under a new id.
- Drive sees the same content and writes nothing, which is correct.
- The two locations then hold identical content under different ids. Nothing is lost, and retention keeps one of them.
- It matters only for S3: one list must treat these as the same version, or the Device Folder should copy Drive's version.
- Found by reading. Confirm with T2.

**S7. Drive keeps one safety version for all devices.**
- Only the newest unexpired safety version is kept per location (`managed-repository.js:265`, protected for 7 days).
- On Drive, a restore or review on another device within those 7 days replaces the first device's safety version. The ordinary versions around it remain.
- Suggested: keep one per device on Drive, or accept and say so.

**S8. Texts that still describe two separate histories.**

| Where | Text now | Why |
|---|---|---|
| Device Folder (i) (`app.html:1091`) | "Versions shows only Device Folder checkpoints and never opens Google Drive." | It now also holds versions from your other devices |
| Backup model (`app.html:1073`) | "Google Drive keeps the same managed checkpoint model off-device." | Both now keep the same versions |
| Retention note (`app.html:1085`) | "Each location keeps 15 versions…" | "Both locations keep the same versions…" |
| Drive row (`app.html:1125`) | "Back up now" | It syncs: "Sync now" |
| Drive settings (`app.html:1134`) | "Automatic backup: While signed in" | "Sync: While signed in" |
| Location badges (`app.html:1090`) | Device Folder "Primary", Drive "Optional" | On phones the Device Folder is unavailable and Drive is where devices meet. Your call |
| Device Folder settings | Shows the chosen folder only | Could also name the backup folder inside it ("Study Director - Ana - Chrome on Mac") |
| 7-day reminder (`app.html:3889`) | "Create a Study Director backup… Open Library -> Data" | For someone who uses Drive, the action is to sign in again |

**S9. Engine terms in what people read.**
- "Checkpoint":
  - the dialog title "Backup checkpoints";
  - "Restore or combine checkpoint";
  - "Verified backup checkpoint from…";
  - "the next automatic backup checkpoint";
  - "Included in a complete checkpoint".
- "External backup verified in Google Drive." and "External backup is verified; newer changes are queued." appear in the location rows.
- In file restore: "…does not carry current capture-authority proof for authoritative replacement." (`backup.js:1965`)
- Suggested: "version" and plain sentences.

**S10. "Handoff" names in code for what is now the shared base.**
- `handoffBase` and its comments in `backup.js`.
- The test file `checkpoint-handoff.mjs`.
- Suggested: rename in the cleanup.

### Tests

**T1. No test that a restore reaches the other devices.**
- 5.7 says restoring a Drive version applies to all devices and keeps pending reviews.
- Suggested: on device A, restore an older version. Device B then takes it in at its next sync, and both devices' reviews survive.

**T2. No test runs two devices that each have both locations, with automatic backups on.**
- That is copying, sync and filling in missed versions working together.
- S2 and S6 were found by reading because no such test exists.

## Suggested order

| Step | What | Size | Needs your decision |
|---|---|---|---|
| 1 | S1 wording and T1 test | Small | No |
| 2 | T2 test, then fix S2 (and S6 if confirmed) | Small–medium | No |
| 3 | Step 4 cleanup: S5 and S10, with the S8 and S9 wording | Medium | No |
| 4 | S3 + S4: one Version History and one Back up now | Medium | Yes: one list or keep two |
| 5 | S7: safety version per device on Drive | Small | Yes: per device or accept |
| — | S8 badges ("Primary" / "Optional") | Small | Yes |
