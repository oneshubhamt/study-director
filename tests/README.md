# Study Director QA

Tests are organized by **method** and then by the product domain that owns the contract:

```text
tests/
  unit/<domain>/
  integration/<domain>/
  browser/<domain>/
  architecture/<domain>/
  fixtures/
  helpers/
```

## Layers

- `unit` — deterministic logic and state-machine invariants.
- `integration` — real module/storage/worker/lifecycle behavior across controlled boundaries.
- `browser` — Chromium interaction and end-to-end behavior, tiered by risk/cost in `helpers/browser-tests.mjs`.
- `architecture` — source/build/security/boundary contracts where structure itself is the requirement.
- `fixtures` and `helpers` — immutable evidence and shared infrastructure; not executable tests.

Release cadence is metadata in `helpers/release-tests.mjs`, not a separate test layer.

## Reading authored host code

`source/app.html` is the shell template; five script bodies live in `source/host/`. Use `readHostHtml` from `build/host-source.mjs` for tests that inspect composed authored HTML, and `readScript` from `build/source-script.mts` for individual classic scripts. Both follow the production manifest/erasure path. Portable ES-module source readers use `eraseTypes`; do not send runtime imports through the classic-script parser. Keep assertions about source contracts tolerant of whitespace left by type erasure, without relaxing required operations or ordering.

The browser harness and generated-output checks continue using built HTML. Substring/VM host tests do not prove whole-file authored coverage; do not attach an invented host source map. Later feature passes own their affected readers and Phase 6 owns their complete replacement where appropriate.

## Commands

The fast correctness suite is npm-free, offline and hermetic:

```text
node tests/helpers/run-category.mjs fast
node tests/helpers/run-category.mjs unit
node tests/helpers/run-category.mjs integration
node tests/helpers/run-category.mjs architecture
```

`npm test` and the `test:unit|integration|architecture|fast` scripts are thin aliases only.

Browser QA is deliberately separate:

```text
npm run test:browser            # smoke journeys
npm run test:browser:feature    # deeper feature contracts
npm run test:browser:extended   # expensive capacity/performance/accessibility
npm run test:browser:release    # every browser journey
```

Non-browser release certification is `npm run test:release`. Full promotion is `npm run qa:promotion`.

## Test design

1. One executable should represent one coherent production contract. Closely coupled scenarios may share it; unrelated failure domains should not.
2. Strengthen the existing authoritative test for a regression before adding another file. Never create tests named after a release/pass/bug era.
3. Prefer exact invariants—conservation, monotonicity, idempotence, bounds, reference preservation, transaction atomicity—over arbitrary thresholds or example-only assertions.
4. Behavior belongs at the lowest faithful behavioral layer. Static source assertions belong in `architecture` only when source shape is itself the contract.
5. Browser smoke is intentionally small; feature and extended tiers remain separate when their cost or failure mode is materially different.
6. Capacity/stress certification that distorts fast coverage belongs in release/extended cadence rather than ordinary correctness runs.
7. Fast tests may not use network modules, installed packages, child/shell processes, repository writes, arbitrary sleeps, or prior-test state. Each test gets an isolated process and temporary environment.
8. Failure injection must be explicit and deterministic. A failed scenario must not contaminate the next scenario.
9. Every browser test appears exactly once in the browser manifest. Every release-gated test appears exactly once in the release manifest.
10. Generated QA evidence belongs outside the repository unless explicitly requested through the artifact path helper.

## Browser test reliability

A browser test that sometimes fails is a defect, either in the test or in the app. These rules keep the browser tiers trustworthy:

1. **Tests marked `alone` run with no other browser test running.** The manifest (`tests/helpers/browser-tests.mjs`) gives each one a written reason. Never start one in parallel with another browser test, whether through the runner or by running the file directly.
   - `pwa-update` drives real service-worker activation across tabs. Its wait used to message the old worker in a loop, which delays activation; it failed about 5 times in 12 with four copies running at once. It now watches the registration and passed 12 of 12 under the same load. It still runs alone, as a safeguard.
   - `site-data-clear` reopens the database right after wiping site storage. The app tries to open IndexedDB twice, 2.5 seconds each, before it stops, and under CPU load that reopen can take longer.
   - `backup-encryption` failed only under concurrent load and passes alone. Its reason starts "Not yet diagnosed": it needs a root cause, and once fixed it may run concurrently again.
2. Other browser tests run concurrently. `npm run test:browser*` runs up to two at a time, then the `alone` tests by themselves. `BROWSER_TEST_JOBS=N` changes the limit; `BROWSER_TEST_JOBS=1` runs everything one at a time.
3. A failure seen only while tests run concurrently is not yet evidence of a bug. Rerun that test alone first. If it passes alone but fails under load more than once, diagnose it like any other failure. Fix the cause when the test can avoid it. Otherwise, or until it is diagnosed, mark it `alone` with the reason.
4. A failure seen in a test running alone is real until diagnosed. Decide whether the test, the app or the browser is at fault, and fix that. Never add a retry loop, raise a timeout or skip an assertion just to get green.
5. Wait for observable state (a DOM value, a stored record, a service-worker registration state), never for a fixed sleep. A sleep is acceptable only when the elapsed time is itself the contract, such as a debounce or a re-check interval. A wait must not disturb what it watches. For example, messaging a service worker in a polling loop delays its activation. Wait for the outcome, not the first event on the way to it. A blocked database delete completes once the old connection closes. The first save after a storage clear may abort and be retried. A file can exist before it is fully written.
6. A new or changed browser test must pass 5 consecutive runs before it is merged.
7. Report a run as one summary: the totals plus each failure. Do not report passing tests one by one.
8. When a test times out, its failure message must say what it was waiting for and the last observed state, so a single failure can be diagnosed without a rerun.
9. Quarantine is the last resort, follows the governance rules below and never applies to the smoke tier.

## Coverage and mutation

`node tests/helpers/coverage.mjs` uses V8 coverage over the hermetic unit/integration runtime. Global percentages are diagnostic; enforcement is risk-based through `helpers/coverage-risk.mjs`, which combines conservative floors for safety-critical modules with explicit critical-path anchors and named owners for production code exercised only outside the fast runtime.

`node tests/helpers/mutation.mjs` applies a small curated set of safety-critical mutants to temporary repository clones. Existing behavioral tests must kill every mutant; the working tree is never mutated.

Promotion-only branch coverage and browser runtime coverage use the installed release/browser toolchain.

## Governance

The architecture governance tests enforce the suite itself:

- canonical semantic paths and one execution route per test;
- no exact duplicate tests, orphan tests, release-era filenames or active historical QA tokens;
- semantic-overlap and structural-containment detection, with explicit rationale for intentional overlap;
- durable feature contracts mapped to authoritative behavioral owners;
- browser tier/manifest integrity, bounded timeouts and semantic coverage tags;
- release-manifest/package entrypoint consistency;
- hermetic source and runtime restrictions;
- browser-only, time-bounded quarantine rules;
- repository-clean execution and external QA artifacts.

The goal is not the largest suite. It is the smallest suite that preserves all material contracts with clear ownership, deterministic evidence and appropriate depth.


## TypeScript coexistence

`npm run check:types` runs the pinned compiler and typed lint on explicitly admitted implementations. `npm run test:release:types` proves that deliberate type/unsafe-value/promise errors fail those gates. Both are part of release QA; fast execution stays dependency-free.

Fast discovery/governance accepts `.mjs` and `.mts`; `canonical.mts` exercises native typed-test execution. Classic `.ts` modules and their VM tests use `build/source-script.mts`: erasure preserves offsets and line breaks, so V8 ranges map directly to authored source without a separate source map. AST branch coverage parses that same erased text and inventories `.ts` alongside `.js`. Pilot coverage floors and mutations prevent converted implementations disappearing from QA. Mutants edit authored `.ts` and tests freshly erase them; no cached build is used.

See [the checking boundary](../docs/TYPESCRIPT.md) before admitting more files. Existing authored editor/worker TypeScript has been admitted since Phase 2; Phase 4 also admits persistence/orchestration. Remaining authored JavaScript is still unchecked until converted. Use the [execution record](../TS-CONVERSION-EXECUTION.md) for current status.


During TypeScript passes, run targeted QA on affected surfaces; full QA is reserved for final certification. Coverage supports repeated `--test <test-path>` and `--file <source-path>` arguments together. It runs only those tests, measures only those files, retains their risk floors, rejects unobserved requested sources and clearly labels the report as targeted. Unselected floors remain part of the unchanged full-certification mode.
