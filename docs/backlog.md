# Backlog

Open work, decisions still to make, and what has not been checked yet. Nothing here is started without the owner's go-ahead. When an item is done, remove it and record any lasting decision in its area's doc.

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

The suite is slow, pins source text and misses the study features. Eight pull requests, in this order; remove each line when its pull request merges.

1. **Speed.** No idle timers or busy polling in tests; a parallel runner that reports every failure; one coverage pass; Promotion runs the fast suite once and Repository checks run all of it.
2. **Governance.** Keep one-route, manifest and hermetic checks; drop the word-similarity duplicate detector, the history-word bans and `feature-contracts.mjs`. The code-snippet anchors in `coverage-risk.mjs` go in 4–6, once mutants replace them.
3. **Data-safety rules.** Seeded generated-input tests for sync merge, backup retention and the timer.
4–6. **Behaviour over source text, and consolidation,** area by area (backup and storage; app, interface and PWA; editor and browser): about 1,300 source-text checks down to about 200; about 95 fast files and 31 browser tests; migration-only tests in `tests/migration/`; names by subject.
7. **Study features.** Insights numbers (hand-worked cases and generated-input rules), the plan-to-review browser journey, note links, and a median-of-three Insights speed gate.
8. **Rules and docs.** When to add a test, in `tests/README.md` and `AGENTS.md`.

Cautions that hold throughout:

- A source-text check is deleted only after a behaviour test is shown to fail when the code it pinned is broken (mutation harness on a temporary copy, never the working tree); the most important become permanent mutants.
- Merged files keep every scenario and assertion; merged browser tests pass 3 runs on their own; `alone` rules stay.
- Coverage of safety modules never drops; the 8 existing mutants stay killed.
- A new test that disagrees with the app is reported to the owner, not resolved by changing either side.
- Tests and tooling only; no release bump unless a confirmed app bug is fixed with the owner's agreement.

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
