# Workflow

How changes are made, checked and released. The rules every agent follows are in [AGENTS.md](../AGENTS.md); this page holds the detail.

## How to work

1. **Understand first.** Read the area's doc and the code it points to. The code is the final authority; a doc or a passing test is not proof that the code is right.
2. **Write the objectives down before editing**, numbered, in the conversation and then in the pull request. For data, storage, backup, sync or background-job changes, also name the invariants at risk and the failure paths you will test (unknown or failed reads, retry, cancellation, a second tab or device).
3. **Make the smallest coherent change.** The plan may change as you learn; say what changed and why.
4. **Check each objective against the code**, not only the tests: met, partly met or not met. Then run targeted tests for what changed.

Report exactly what was run, what failed and what was not run. When the app and a test disagree, decide which one is wrong; tests follow correct app behaviour, never the reverse.

**Where things are recorded.** Plans, objectives and QA results go in the pull request description. Lasting decisions, rules and known limits go in the area's doc. Open work goes in [backlog.md](backlog.md). History lives in git and pull requests; there is no implementation journal.

## Choosing tests

Run targeted tests for each affected surface; run the full suites only after substantial change or before a release.

| Change | Tests |
|---|---|
| Persistence or codecs | Repository, migration, recovery and import tests |
| Backup or sync | Backup, Drive and Device Folder transport, managed repository, maintenance and recovery tests. The main fault-injection suites: `backup-persistence`, `pending-provider-recovery`, `repository-checkpoint`, `repository-restore`, `restore-assets`, `device-folder-storage`, `drive-security`, `automatic-provider-backup` |
| Active Session or timer | Session lifecycle, timer state and engine, restore and mutation-protection tests |
| Plan, Review, Library | Their unit and integration tests, plus affected persistence and protection contracts |
| UI | Presentation architecture tests and the relevant browser tests, at laptop and phone widths |
| Build or modules | Syntax, architecture, generated syntax, build verification and the deployment contract |

A pull request titled as a bug fix (`fix: …`) must add or strengthen a regression test at the right layer; CI checks this. Test rules and layers: [tests/README.md](../tests/README.md).

**Testing rhythm (owner, 2026-10-10).** Make all the changes for a piece of work, build once and run the suites once. Fix what fails, then rerun only the failing tests.

## Commands

`package.json` pins npm 12.2.1 (`devEngines`). Where an older npm is installed, as in the Claude Code cloud sandbox, `npm run` refuses to start; run the node command directly.

| Purpose | npm | node |
|---|---|---|
| Fast suite (unit, integration, architecture) | `npm test` | `node tests/helpers/run-category.mjs fast` |
| One category | `npm run test:unit` | `node tests/helpers/run-category.mjs unit` (or `integration`, `architecture`) |
| Chosen files | `npm run test:targeted -- <files>` | `node tests/helpers/run-category.mjs targeted <files>` |
| Browser tiers | `npm run test:browser` (`:feature`, `:extended`, `:release`) | `node tests/helpers/browser-suite.mjs smoke` (`feature`, `extended`, `release`) |
| One browser test | — | `node tests/browser/<area>/<test>.mjs` |
| Build | `npm run build` | `node build/wordgard-bundle.mjs --write && node build/build.mjs` |
| Verify the build | `npm run verify` | `node build/verify-build.mjs` |
| Release checks | `npm run test:release` | — |
| Full promotion | `npm run qa:promotion` | — |

- Browser tests need Chromium; in the cloud sandbox set `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. On a fresh profile, call `skipFirstStart(page)` so the first-start form does not block clicks.
- Never run a browser test marked `alone` (`tests/helpers/browser-tests.mjs`) at the same time as another browser test. Rerun a failure seen under concurrency on its own before treating it as a bug.
- Rebuild the worker bundles after changing `portable/`: `node build/wordgard-bundle.mjs --write`.
- Fake-clock tests that hash or encrypt must wait for real background work (`realWorkSettled` in `repository-checkpoint.mjs`).
- Do not report a check as passed when the environment could not run it (no browser, no network).

## Build, release and deployment

- Change first-party code only in `source`, `portable` or `rich-text`. `dist/` is generated; never edit it or commit it.
- `release.config.mjs` is the only source of release identity. A pull request that changes the shipped app (`source`, `portable` or `rich-text`) raises `release` by one (for example `SDVB75F18` → `SDVB75F19`), once per pull request and only if it is not already above `main`'s.
- `LICENSE` stays identical to `source/legal/LICENSE.txt`.
- `npm run stage:firebase:minified` builds a self-contained, minified Firebase deployment under `dist/`; ship it as generated, never hand-edited.
- **Wordgard.** To take a new version, replace `vendor/wordgard`, run `npm run build:richtext` and record it in `build/wordgard-metadata.mjs`; a build-time rewrite whose upstream text moved fails by name ([notes.md](areas/notes.md#the-editor-wordgard)).
- Remove code only when it is proven dead, with a regression check. Keep compatibility and migration code until the stored-data population no longer needs it ([data-and-storage.md](areas/data-and-storage.md#compatibility-and-migration)).
- Before distributing source: no `node_modules/`, no `dist/`, no QA or coverage output.

## Continuous integration

- **Repository checks** run on every push and pull request: selected safety and governance tests and a source build. No npm install, credentials or browser.
- **Promotion QA** runs from GitHub Actions' Run workflow button: every hermetic test, risk coverage, mutation, branch coverage, release certification and, with its checkbox, every browser journey and the Insights performance samples. It is the full regression gate; Repository checks do not replace it. Neither workflow deploys.
- Read failures by their original step; do not suppress them.

## Real-device acceptance

CI cannot certify real devices. Before trusting a release on them, an operator checks with disposable data and a separate verified backup: desktop Chromium with a Device Folder, an installed Android PWA and iPad or iPhone Safari where used. Cold start; Device Folder permission kept, revoked and granted again; suspend and resume; small and large Drive transfers and a cancelled one; an interrupted restore keeping its Before-restore safety version; an interrupted cleanup; offline to online; an update while a backup runs; idle battery and heat. Compare records and attachments before and after a restore. Mark an unsupported storage API as unsupported, not passed. What has not been checked yet is listed in [backlog.md](backlog.md#not-yet-checked).
