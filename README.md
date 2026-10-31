# Study Director

Study Director is a local-first progressive web app for planning study, running focused sessions, reviewing the day, keeping long-form notes and attachments, and understanding study patterns. Its core working data lives in the browser. Device Folder backups and Google Drive backup/sync are optional.

Start with the [product guide](docs/PRODUCT.md) for the app's purpose and workflows, or the [documentation map](docs/README.md) for engineering references. Browser storage can be cleared or lost; recovery copies in that same browser are not independent backups.

## Working on this branch

All TypeScript conversion work stays on **`TS-Conversion`**. Read [AGENTS.md](AGENTS.md), the [execution control record](TS-CONVERSION-EXECUTION.md) and the assigned [Phase 5 objectives](docs/typescript/PHASE-5.md) before implementation. The control record owns current status, evidence and the durable scratchpad; history is preserved separately. Current canonical formats are supported; historical data/topology migration code is retired on this branch.

## Build and run locally

Use the pinned Node.js **26.12.1**, npm **12.2.1** and lockfile. Python 3 is used by the local hosting launcher. [TypeScript tooling](docs/TYPESCRIPT.md) describes the compiler/linter and environment boundaries.

```bash
git clone --branch TS-Conversion https://github.com/oneshubhamt/study-director.git
cd study-director
npm ci --ignore-scripts
npm run check:types
npm run build
npm run verify
```

To serve a staged local app with the intended hosting headers:

```bash
npm run stage:firebase
python3 dist/firebase-project/serve-local.py
```

Open <http://127.0.0.1:8765/> and leave the launcher running. Localhost has separate browser data from the hosted app. Staging prepares files; it does not deploy. Google OAuth credentials/origin configuration and browser capabilities are separate from a source checkout.

For a source-only build using reviewed checked-in runtime bundles, `node build/build.mjs` and `node build/verify-build.mjs` do not require npm installation. That path does **not** regenerate authored bundles or prove strict type correctness.

## Source map

| Location | Responsibility |
| --- | --- |
| `source/app.html`, `source/host/`, `source/core/` | HTML shell, authored inline host scripts, feature controllers and private modules |
| `source/external/` | Authored integrations/presentations plus generated editor/worker bundles; see [architecture](docs/ARCHITECTURE.md) before editing |
| `source/platform/`, `source/styles/`, `source/legal/` | PWA runtime, visual system and served legal/security documentation |
| `portable/`, `rich-text/` | Authored codec/file/worker and editor sources |
| `contracts/`, `types/` | Executable identities/limits/data architecture and TypeScript contracts |
| `build/`, `tests/` | Build/staging/verification tooling and governed QA |
| `vendor/wordgard/` | Immutable upstream editor source for this program |
| `docs/` | Current product/engineering guides, active conversion plan and clearly separated history |

## Verification and contribution

Use targeted checks for affected surfaces, for example:

```bash
npm run test:targeted -- tests/integration/storage/background-gc-reliability.mjs
```

[CONTRIBUTING.md](CONTRIBUTING.md) defines the implementation workflow. [Verification](docs/VERIFICATION.md) owns check selection and release gates; [the test guide](tests/README.md) owns test design and browser reliability. Full conversion certification remains Phase 7 unless the owner changes scope. Documentation and historical test results are not a current QA certificate.

Push/PR **Repository checks** install the pinned toolchain, run strict checks, selected safety/governance tests and a source build. **Promotion QA** is manually invoked; its browser coverage is optional. Neither workflow deploys. Do not infer CI success without inspecting its run.

## Packaging and release

`release.config.mjs` is the sole release-identity source. `npm run stage:firebase:minified` prepares the minified Firebase project under `dist/`; generation is not deployment authorization. Never hand-edit generated output.

Keep installed dependencies, generated `dist`, personal data/backups, credentials and raw QA artifacts out of commits. Retain current documentation and consolidated historical records needed for traceability; avoid duplicate per-pass reports. A deployment package contains only the generated deployment payload/support files, not the source history.

## Licence

Study Director is source-available, **not open source**. [LICENSE](LICENSE), copyright and third-party notices apply. [Privacy](source/legal/privacy.html), [security](source/legal/security.html) and [terms](source/legal/terms.html) ship with the app; keep factual descriptions aligned with implemented behavior without treating a documentation edit as legal or security certification.
