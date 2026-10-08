# Living World

Living World is an optional external subsystem with its own pane. This port uses
only the Living World sources from the supplied Clean Planetary source archive.
No other subsystem or dependency package from that build is imported.

Primary navigation uses the same order on desktop and phone: Plan, Execute,
Review, Library, Insights, Living World, Guide.

The port preserves the original WebGPU planet renderer, camera, natural world,
atmosphere, wildlife and ecology engines. A browser and device with a usable
WebGPU adapter are required for the visual scene. Unsupported devices receive a
clear message in the pane. There is no alternate renderer.

## Boundaries

The plugin retains only the host's tab-registration function. It does not read
or write application records, plans, notes, active sessions, timers, backups or
Execute state. Its behaviour input is an empty private timeline, dated by the
browser calendar. Study-history controls and behavioural metrics are absent.
Ecology therefore represents a neutral baseline, not the user's study activity.

Seed, camera, focus, view preferences and encountered discoveries belong to
`studyDirector.plugin.living-world.v1.*`. This state is device-local and separate
from canonical application storage and backups. Transient planet and ecology
data stay in bounded memory caches. No application storage bridge is added.

## Packaging and compatibility

`build/module-manifest.mjs` registers `world` as an on-demand external runtime and
`world-worker` as a worker. The twelve original supporting engines are scoped
inside those bundles, with no global engine exports or private app-registry
access. A small worker adapter permits only the exact generated same-origin
worker asset through the module's own Trusted Types policy.
Minified packaging rewrites the worker reference before computing the pane asset
hash, so its worker URL also matches the packaged offline cache.

The host changes are limited to tab placement, lazy registration, the route
allowlist and reviewed asset identities. Existing design tokens are reused.
The old lifecycle callbacks are adapted to the current render hook and pane
visibility. Leaving the pane aborts pending work and releases rendering resources;
page visibility pauses periodic work and drawing. Late results cannot replace a
newer visit's scene.

Initial generation uses the original engine's level 4 setting (5,120 cells),
instead of its costly level 6 default (81,920 cells). Generation and ecological
work stay in the worker; detailed terrain still uses the original streaming
renderer. No new npm dependency is required.

## Validation

- `tests/integration/world/isolated-planet-worker.mjs` verifies narrow host access,
  independent generation, neutral input, fingerprints and restricted worker URLs.
- `tests/browser/world/standalone-world.mjs` verifies actual navigation under
  Trusted Types, storage isolation, persistence and cleanup. Set
  `SD_WORLD_GPU_TEST=1` to exercise software WebGPU rendering and camera movement.
  Add `SD_WORLD_MINIFIED_TEST=1` to exercise the packaged minified deployment.
- The navigation unit suite includes Living World History traversal; the PWA
  browser suite checks loading the pane and its worker offline.

## Starting the next development session

Use the existing `living-world` checkout and Node.js 26 (the exact version is in
`.nvmrc`). Run `npm ci`, `npm run build` and `npm run verify` to prepare and check
the build. Python 3 is required for minified staging; browser checks also need
Chromium, selected through `CHROMIUM_PATH` when it is not discovered automatically.

The branch includes the earlier ownership, appearance and library reliability
fixes, timer accounting and stale-dialog fixes, guarded note recovery, and the
Node 26 migration. Those form the working baseline for further Living World
development. Main and the background refactor branch are separate and were not
modified for this work.

Keep further World work in `source/external/world.js` and
`source/external/world/`. Preserve the neutral input and private storage boundary
until a separate integration is explicitly requested. Do not add timer, Execute
or canonical-history connections as part of World development.

The baseline passed 134 hermetic fast tests, 10 browser smoke journeys and 56
accessibility/theme/layout combinations, plus standalone isolation and original
WebGPU rendering checks. WebGPU validation used Chromium software rendering;
physical GPU hardware still needs device testing.

Useful checks for changes:

```bash
npm run test:targeted -- tests/integration/world/isolated-planet-worker.mjs tests/unit/app/navigation.mjs
node tests/browser/world/standalone-world.mjs
SD_WORLD_GPU_TEST=1 node tests/browser/world/standalone-world.mjs
node tests/browser/ui/populated-accessibility.mjs
```

For minified packaging, run `npm run stage:firebase:minified` followed by
`npm run test:release:minified`; the standalone browser test accepts
`SD_WORLD_MINIFIED_TEST=1` to use those packaged assets. Run builds before fast
tests, and keep QA logs outside the checkout so the hermetic runner's repository
preservation checks remain meaningful.
