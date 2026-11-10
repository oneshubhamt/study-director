# Verification and release procedure

This document owns check selection and evidence policy. The [test guide](../tests/README.md) owns executable-suite design and browser reliability; [TypeScript tooling](TYPESCRIPT.md) owns strict checking; the [execution record](../TS-CONVERSION-EXECUTION.md) owns results actually run. There is no undated blanket “all QA passed” claim.

## During implementation

Inspect source/consumers → record scope/invariants → implement → reconcile every objective against source → run targeted QA → record evidence and handoff. Maintain the durable worklog throughout, with a separate temporary pad outside the repo. Distinguish implementation, verification and full certification.

On `ts-exp`, the implementor performs targeted affected-surface QA during passes. Independent review happens after Phase 5 overall; full correctness/coverage/mutation/browser/release/performance certification remains Phase 7 unless the owner changes scope. Add meaningful positive, malformed-input, failure and adjacent-flow regressions where existing tests miss a changed contract. Mechanical/Markdown changes do not require tests that merely mirror the edit.

| Changed boundary | Select checks for |
| --- | --- |
| Persistence/codecs | Canonical validation, unsupported-input rejection, save/recovery and current-format import |
| Backup/providers | Capture, publication, retention/integrity, transport failures, restore/rollback and sync |
| Sessions/timers | State transitions, reload/handoff, ownership, cancellation and restore |
| Plan/Review/Library/editor | Feature behavior plus affected persistence, references, input/focus and accessibility |
| Build/host/module boundaries | Source/generated syntax, manifest/order, CSP/cache identity, build and deployment inventory |
| PWA/workers | Protocol validation, cancellation/stale results, offline/update/client settlement |
| Documentation | Local links, source paths/commands, current-versus-historical claims and archive preservation; build/deployment verification when served pages change |

A failing check requires diagnosis: determine whether implementation or test assumptions are wrong. Do not relax invariants, coverage floors, timeouts or assertions merely to turn a result green. Unchanged prior evidence may be reused with its source revision and limits; later edits require rerunning checks they invalidate.

## Commands

Install the pinned toolchain as described in the root README. Typed changes:

```bash
npm run check:types
npm run test:release:types
```

Select explicit affected executables through the hermetic runner, for example:

```bash
npm run test:targeted -- tests/integration/storage/background-gc-reliability.mjs tests/integration/library/library-clear.mjs tests/integration/backup/capture-safety.mjs
```

Fast category commands (`test:unit`, `test:integration`, `test:architecture`) are broader choices, not required after every small edit. `tests/helpers/release-tests.mjs` identifies checks with separate release cadence; do not pass those as fast-targeted paths. Focused coverage uses paired repeated `--test` and `--file` selections; see [the test guide](../tests/README.md).

When source/build inputs change, use appropriate checks in a disposable validation checkout where practical:

```bash
node build/build.mjs
node build/verify-build.mjs
npm run test:release:syntax
npm run test:release:generated-syntax
npm run test:release:deployment
```

Use `npm run build` when authored bundle inputs changed and must be regenerated. Never hand-edit `dist` or checked-in generated bundles. Staging prepares a local Firebase project; it does not deploy it.

Before full-app browser QA, rebuild the current source and verify the generated output. `startReleaseServer()` serves existing `dist`; it does not rebuild. A pass against stale output is not evidence for the current implementation. Verify Node/npm/compiler versions against the repository pins, since a prepared cloud workspace's default shell may select a different installation.

## Final certification

`npm run qa:promotion` runs the repository's complete promotion chain. `npm run test:release` is the non-browser release chain; browser tiers and built-runtime coverage are separate documented commands. Source reconciliation across the whole application remains required in Phase 7 alongside those automated gates, including behavior not adequately covered by prior fixtures.

The push/PR [Repository checks workflow](../.github/workflows/qa-fast.yml) installs dependencies, runs strict compiler/lint, selected safety/governance tests and build/generated checks. [Promotion QA](../.github/workflows/qa-promotion.yml) is manually dispatched and adds full correctness, risk/branch coverage, mutations and release checks; its complete browser run is selected separately by input. Neither workflow deploys. These descriptions come from workflow source, not a claim about a particular CI run.

Run browser tests marked `alone` without another browser test. Follow the [browser reliability rules](../tests/README.md#browser-test-reliability), including repeated-run requirements before merge. A local targeted browser pass does not certify every browser/device or satisfy unexecuted merge/release checks.

## Evidence and environment honesty

Record exact command, tested commit or fixed base plus changed paths, tool/browser environment, actual outcome and unresolved limits. Preserve failed attempts and their resolution. CI success requires an inspected run/link; planned commands are not results. Raw artifacts stay outside the repository, but enough evidence to reproduce the check belongs in the worklog.

Source inspection cannot prove physical Safari/mobile behavior, screen-reader output, OS eviction/force-kill recovery or human visual judgment. Record which of those were actually exercised and which remain unknown; do not invent universal device coverage. Likewise a network-denied check is not a passed dependency/security check.

## Packaging and publication

Source packages retain canonical source, reviewed dependencies, current documentation and consolidated history needed for traceability. Exclude installed dependencies, generated `dist`, credentials, private data/backups and temporary QA outputs. Keep `LICENSE` identical to `source/legal/LICENSE.txt`; do not alter release identity except through authorized `release.config.mjs` changes.

Deployment packages are generated from the verified source revision, with public inventory, CSP/headers and cache identity verified. Do not include source history or Firebase support configuration in the public payload. Inspect the staged/archive inventory. Preparing or verifying a package does not authorize deployment, a PR merge or a release.
