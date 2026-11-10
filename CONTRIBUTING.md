# Working on Study Director

This is a private, source-available project. Contributions require the copyright holders' authorisation; the existing [licence](LICENSE) applies.

## Development

Use the pinned Node.js 26.12.1 and npm 12.2.1 toolchain, plus Python 3. Run `npm ci --ignore-scripts` and `npm run check:types` for typed changes; see [TypeScript tooling](docs/TYPESCRIPT.md). See the [README](README.md) for building and running the app. Source belongs at the repository root; generated `dist`, installed dependencies, personal backups and QA output do not belong in commits.

For the TypeScript program, work only on `ts-exp` and follow [AGENTS](AGENTS.md), the [execution control record](TS-CONVERSION-EXECUTION.md) and [documentation map](docs/README.md). Keep the persistent scratchpad current during each pass; record source reconciliation and actual QA before closure. Do not create another branch or a PR unless the owner asks. Outside that program, use a separate branch for coherent changes and obtain the owner’s instructions before opening a PR. Describe the resulting behaviour and the checks actually run. Keep runtime changes separate from unrelated formatting or repository maintenance.

## Changes and verification

Audit the affected contract, state its invariants, implement the smallest coherent change, then run targeted QA. Strengthen the existing test at the appropriate layer before creating another file. Test unknown/read-failed state, retry, cancellation and foreground preemption when relevant.

```bash
npm run test:targeted -- tests/integration/storage/background-gc-reliability.mjs
```

Select additional affected tests as needed. Full regression, coverage, mutation and browser checks are explicitly invoked; do not describe skipped checks as passed. Keep relevant product/architecture/data-contract documentation aligned with implemented changes, and update the active worklog during execution. Use [the documentation map](docs/README.md) to find the owning document rather than creating redundant pass reports. [QA design](tests/README.md) and [verification procedure](docs/VERIFICATION.md) define the existing contracts.

If build inputs change, run `node build/build.mjs`, `node build/verify-build.mjs` and the relevant generated-syntax checks in a disposable checkout. Keep QA evidence outside the working tree.

Change first-party code in `source`, `portable` or `rich-text`. Regenerate external bundles through their build scripts, and preserve reviewed dependency notices. `release.config.mjs` is the only release-identity source. The root `LICENSE` mirrors `source/legal/LICENSE.txt`; keep both texts identical when an authorised licence change is made.

## Automation

`Repository checks` runs on pushes and pull requests: pinned dependency installation, strict TypeScript/typed lint, selected safety/governance tests and build/generated-output verification. It needs no deployment credentials or browser.

`Promotion QA` runs only from GitHub Actions' **Run workflow** button. It runs the existing full non-browser gates; browser coverage requires an explicit checkbox. Neither workflow deploys the app.

Use the `repository` job from `Repository checks` as a required status check if you enable branch protection in GitHub settings. Review branch-protection rules with the repository owner before enforcing them.
