# Backlog

Open work, decisions still to make, and what has not been checked yet. Nothing here is started without the owner's go-ahead. When an item is done, remove it and record any lasting decision in its area's doc.

## Bugs reported by the owner (2026-11-03)

**Bugs come first** (owner, 2026-11-03). Fix every bug in this section before any new feature, performance work or other improvement in this file. The test programme below is the one exception: it finishes first. Each fix comes with a test that would have caught it. None of these has been investigated yet.

1. **Plan opens in editing mode after Continue here.** Taking over an active session from another device with Continue here leaves the Plan board in editing mode. The handed-over plan should simply be applied, with no edit in progress.
2. **Repeated "earlier day not saved" notices after a handoff.** A session started on device A is continued and saved on device B. Afterwards, notices keep saying the earlier day was not saved on both devices, especially on A, which did not save it. But that day was saved, by B. Find why A (and B) still think the day is unsaved, and stop the repeated notices.
3. **Major: items to review appear everywhere, with nothing saying what they are.** On the phone, the laptop and the iPad, sync keeps leaving items to review, two at a time this time. Opening one offers only "Keep current" or "Use kept version"; nothing says what was kept, from which device, or what differs, so there is no way to choose sensibly.
   - Diagnostics from the iPad (release SDVB75F18, 2026-11-03) show `keptVersions=2`, and the catch-up there reported `activeSessionConflicts=1`, so at least one item is an Active Session the two devices disagreed on. Diagnostics give only the count, not what each item is.
   - To settle: why sync keeps producing these (for example, whether a handed-over session should ever count as a conflict); whether each one is needed; what the review must show (what it is, which device, when, what differs); and a diagnostics line per item (kind, origin and reason, never the content).
4. **Major: first sync on the iPad stuck on "Bringing in what's on Google Drive".** The first sign-in on the new version showed the sync notice stuck at that second stage for a long time, with the ring by the profile spinning and never settling. Closing or backgrounding the app and opening it again let the sync finish, and the data then arrived as expected. The first experience was not deterministic.
   - The diagnostics were taken after the restart, so they don't show the stuck run: trace history starts at that launch. Make sure a stuck stage leaves evidence, for example a trace that survives a reload, or a stage that has run too long being recorded.
   - What the later run shows: the first upload attempt waited 5.2 s, then reset the repository generation and found this device behind. The catch-up then took 4.8 s. Drive cleanup listed 112 versions and 241 objects in 29.6 s, then waited more than 3 hours because another device's publication was in progress. Drive verification gave way twice to other work and checked nothing. "Verified external copies" read as unavailable, and "google-drive formats" read as unknown with 0 versions.
   - To find: what the first sync waits on, why it doesn't time out or recover by itself, and why a restart unblocks it.
5. **The Plan draft is emptied when a session continues on another device.** When a session is continued elsewhere, the draft plan on this device's Plan board is cleared. The owner thinks this is not wanted. Decide whether the draft should stay, together with item 1 (the plan opens in editing mode after Continue here).
6. **The sync progress bar doesn't move on iPad Safari.** In the "Syncing with Google Drive" notice at sign-in, the three steps and the spinner showed, but the progress bar under them didn't. In a screenshot taken during the stuck "Bring in what's on Google Drive" step, the bar shows only a short fixed segment. Check how the bar is drawn and animated in Safari (iPadOS), including when its progress is unknown. Investigate together with item 4.
7. **The top of the screen is hidden under the status bar and camera cut-out on iPhone and iPad.** In Safari on iPad, the page's top edge sits under the system status bar (time, battery). The page title ("Plan", "Library"), the Library's Notes/Days/Data tabs and the sidebar's "Study Director" label are clipped or faded under it. On iPhone the Dynamic Island or notch does the same, and the notification stack and dialogs at the top are affected as well. Respect the device's safe areas (`viewport-fit=cover` with `env(safe-area-inset-*)`) for the page, the sidebar, the notification stack and dialogs. Check in Safari and as a Home Screen app, in portrait and landscape (side insets), on iPhone, on iPad, and on MacBooks with a notch in full screen.
8. **Plan board fields out of line on iPad Safari.** In a block's editor, the start-time field ("5:30 AM") is taller than the duration field next to it, and the two overlap.
9. **Stale wording in Library → Data → Verification.** The Google Drive line ends "Active sessions and historical reflection drafts are excluded". Reflection Drafts were retired, so the wording should drop them (`source/app.html`, the Drive verification summary).

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

The suite is slow, pins source text and misses the study features. Eight steps, in this order. The work stays on `refactor/background-coordination` and the owner merges it once, after step 8 (decided 2026-11-03); remove each line when its step is done.

Steps 1–3 (speed, governance, data-safety rules) are done.

4–6. **Behaviour over source text, and consolidation,** area by area (backup and storage; app, interface and PWA; editor and browser): about 1,300 source-text checks down to about 200; about 95 fast files and 31 browser tests; migration-only tests in `tests/migration/`; names by subject. The code-snippet anchors in `coverage-risk.mjs` go once mutants replace them.
7. **Study features.** Insights numbers (hand-worked cases and generated-input rules), the plan-to-review browser journey, note links, and a median-of-three Insights speed gate.
8. **Rules and docs.** When to add a test, in `tests/README.md` and `AGENTS.md`.

Cautions that hold throughout:

- A source-text check is deleted only after a behaviour test is shown to fail when the code it pinned is broken (mutation harness on a temporary copy, never the working tree); the most important become permanent mutants.
- Merged files keep every scenario and assertion; merged browser tests pass 3 runs on their own; `alone` rules stay.
- Coverage of safety modules never drops; every mutant in `tests/helpers/mutation.mjs` stays killed.
- Improve the app, not only the tests (owner, 2026-11-03). A bug, dead code or a clear refinement found along the way is fixed in the app code in the same step, with a test that would have caught it, and named in the step's summary. Ask the owner first only when the right behaviour is unclear or the change is large.
- The branch raises `release` once, the first time it changes the shipped app.

## Owner's requests (noted 2026-11-03)

**Notes: images.** Enlarge an image, pan and zoom it, and focus on it (a full-view mode).

**Notes: interface review and redesign.** Tags, links and other note features may be buried: someone could use the app and never find them, or never get their full use. Review how each is discovered and used, and whether the rest of the app makes the most of them. Then propose a redesign. Not started; after the test programme.

**Backup and sync review.** Questions to settle first, as a report, before any building. In this order:

1. **Is the repository design right, from first principles?** The point of the repository is that unchanged large files are never uploaded or downloaded again, which makes transfers faster and safer. Does it upload and download only what changed, and does each upload and restore land whole or not at all? Is it well optimised overall? The owner thinks the repository principle is good; propose a better one only if there is one.
2. **Handoff or live sync?** Today one device runs the session and "Continue here" hands it over. It sends few requests but feels slow and heavy: Continue here takes a while, and a pause may reach the other device only at the next check, about every 2 minutes. The alternative is live sync, the way a messaging app works: the same session runs on several devices, and a note edit, a timer pause or an added block reaches the other devices on its own. Compare the two.
3. **Constraints any answer must meet.** Local-first: nothing in the app waits for the internet or Drive. Drive sign-in lasts about 1 hour and there is no server. Full end-to-end encryption, at rest and in transit, comes later and must fit.
4. **Then speed.** Drive backups take over 20 s and Device Folder backups 2–3 s. Make Drive faster first (backup, then restore), then make handoff feel seamless and quick, then make the Device Folder (about 2 s) faster still. Rows 4 and 8 above and the Drive items under "Noted for later" belong to this work.

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
