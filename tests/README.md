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
