# Study Director

Study Director is a local-first PWA for planning, focused study sessions, review, long-form notes, insights, attachments, and durable backup/recovery.

## Source layout

- `source/` — application source, styles, service worker, workers and external runtimes.
- `portable/` — portable data and compatibility primitives shared by backup/import paths.
- `rich-text/` — authored rich-text source and bundle inputs.
- `contracts/` — durable architecture/data contracts used by source and tests.
- `tests/` — governed unit, integration, architecture and browser tests.
- `build/` — deterministic build, Firebase staging, minification and verification tooling.
- `vendor/` — reviewed vendored dependencies that are intentionally shipped from source.
- `docs/ARCHITECTURE.md` — current runtime/data architecture and invariants.
- `docs/VERIFICATION.md` — current verification results and release procedure.
- `docs/NOTIFICATIONS.md` — app-wide producer inventory and delivery contract.

Historical per-pass plans, closure notes and measurement logs are intentionally not retained in the canonical source package. The source should describe the application as it exists now rather than preserve an implementation diary.

## Current architecture

Study Director keeps its authoritative working data locally. Structured records live in IndexedDB and attachment bytes live in OPFS. Application modules are private registry modules composed by the host through explicit capability ports.

The backup system uses immutable managed repositories for Google Drive and Device Folder providers. Checkpoints reference verified logical objects; restore is journaled and protected by a Before-restore checkpoint. Foreground publication/restore has priority over bounded background maintenance. Provider state is scoped to the actual repository generation so deleting and recreating a Drive repository does not inherit stale history or maintenance assumptions.

Background settlement, current-state snapshots and attempt outcomes share one lifecycle contract. Diagnostic traces retain concurrent jobs independently, distinguish deferred/unavailable/partial work from completion, and include current cleanup, worker, repository and updater states when copied.

Compatibility code remains isolated from current canonical data handling. Live-install migration may be retired only when its explicit retirement contract says it is safe; historical backup readers may remain independently for recovery value.

Notifications share one presentation coordinator for visual notices, app sounds and device alerts. A separate playback engine plays the bundled original Quiet Wood acoustic-style cues. Full / Minimal / Off is a portable preference, initially Full. Execute provides an inline Pomodoro rhythm panel and a separate Focus & Alerts panel, available before a session begins.

The sound family uses lean 22.05-kHz mono PCM. Device Folder and Drive share compact verification/progress labels and completion ticks. Execute note titles and Area context use the same baseline in Director and Glass.

See `docs/ARCHITECTURE.md` for the full current-state summary.

## Get started

Prerequisites: Node.js 22 (the test runner supports 20+), npm for dependency rebuilding, and Python 3 for the local launcher.

```bash
git clone https://github.com/oneshubhamt/study-director.git
cd study-director
node build/build.mjs
node build/verify-build.mjs
```

This builds from the reviewed, checked-in runtimes without installing packages. It creates separate development and deployment output under `dist/`.

To launch a staged local copy with the app's hosting headers:

```bash
node build/stage-firebase.mjs
python3 dist/firebase-project/serve-local.py
```

Open <http://127.0.0.1:8765/> and keep the launcher running. Localhost has its own browser data, separate from the hosted app. Python may be called `python` on Windows.

## Rebuild dependencies and bundles

To regenerate the rich-text bundle and build with the reviewed lockfile:

```bash
npm ci --ignore-scripts
npm run build
npm run verify
```

The project does not commit `node_modules` or generated `dist` output.

## Deployment preparation

```bash
npm run stage:firebase
# Or prepare minified output:
npm run stage:firebase:minified
```

The Firebase project is generated under `dist/`; do not hand-edit it. These commands prepare files and do not deploy them. Hosting credentials and Google OAuth origin configuration are separate from source checkout; no GitHub workflow deploys the app automatically.

## Verification

Use the smallest QA set that fully covers the changed surfaces. For substantial architecture or release changes, run the broader governed suite and release checks. Browser tests and external/network dependency checks should only be claimed when their required environment is actually available.

Useful commands include:

```bash
npm run test:unit
npm run test:integration
npm run test:architecture
npm run test:targeted -- tests/integration/storage/background-gc-reliability.mjs
npm run test:release:syntax
npm run test:release:generated-syntax
npm run verify
npm run test:release:deployment
```

See `docs/VERIFICATION.md` for the current QA policy and release gates.

## Release

Release identity is defined only in `release.config.mjs`. Build and staging tools verify that source and generated deployment identity remain consistent.

Current release: **SDVB75F10**.

## Packaging policy

A source release should contain canonical source, contracts, tests, build tooling, current documentation and reviewed vendored code only. It should not contain:

- `node_modules/`;
- generated `dist/` output;
- historical per-pass plans/closure reports;
- temporary QA output or local measurement artifacts;
- obsolete deployment packages.

A deployment package should be generated from the canonical source by the build system and should contain only the Firebase project/support files plus the exact public deployment payload.

## Repository workflow

Use branches and pull requests for coherent changes to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md). Pushes and pull requests run selected safety/governance checks and build verification. Full promotion QA is manual, with browser checks off unless explicitly selected.

## Licence

Study Director is source-available, **not open source**. The existing [licence](LICENSE), copyright and third-party notices are retained.
