# TypeScript tooling and checked boundaries

For current program status and implementation workflow, use the [execution control record](../TS-CONVERSION-EXECUTION.md), [decisions](typescript/DECISIONS.md) and [Phase 5 scope register](typescript/PHASE-5.md). This document owns toolchain/checking mechanics, not pass completion status.

## Toolchain and commands

Use Node **26.12.1** (`.node-version`) and npm **12.2.1** (`packageManager` and `engines`). TypeScript **7.0.2**, Oxlint **1.89.0**, its TypeScript 7 lint backend **7.0.2005**, and Node 26 declarations are exact lockfile dependencies. These were the latest stable npm/TypeScript releases when Phase 1 began. Oxlint avoids the older compiler peer requirement of typescript-eslint. No compiler or lint package ships to the browser.

```sh
npm ci --ignore-scripts
npm run check:types
npm run test:release:types
npm run test:targeted -- tests/unit/app/canonical.mts tests/integration/storage/save-lane.mjs
```

Local development and both GitHub workflows use Node 26.12.1/npm 12.2.1. The lightweight workflow installs the lockfile and runs strict checking and typed lint; promotion retains its final certification gates. The dependency-free build/fast runner still works without npm installation.

During each implementation pass, run targeted QA on the affected surfaces and add meaningful regression tests as needed. Full, thorough QA is reserved for Phase 7. For focused coverage, repeat `--test` and `--file` to name the executed tests and measured sources; both are required. Requested files must execute, their existing risk floors still apply, and the output is labelled `targeted-fast-production`.

```sh
node tests/helpers/coverage.mjs --test tests/unit/app/canonical.mts --test tests/integration/storage/save-lane.mjs --file source/core/canonical.ts --file source/core/save-lane.ts
```

Running coverage without selection flags retains the complete final-certification gate.

## Checked boundary

`build/typecheck.mjs` checks every environment project and inventories all first-party `.ts`/`.mts`. New typed files must be admitted explicitly; stale/overlapping entries fail. Phase 2 admitted all 25 existing authored editor/worker TS files; the unchecked inventory is now empty. Generated upstream declarations are separately inventoried and reproduced before compilation.

| Project | Implementation boundary through Phase 4 | Environment |
| --- | --- | --- |
| browser | prior domain/editor modules plus Phase 4 persistence, records/backup codecs, repositories, ownership, session/timer, attachment, export, backup/provider/recovery orchestration and contracts | ES2022 + DOM |
| portable | shared contracts, domain/time, WG1, Markdown, tags and reconciliation | ES2022 only |
| worker | search/image/attachment/export workers, validated processing requests and portable file/codec modules | ES2022 + WebWorker |
| service-worker | boundary assertions; implementation deferred | ES2022 + WebWorker, service-worker scope |
| node | source-script helper and canonical behavioral test | ES2022 + Node 26 |

All projects use strict checking, checked indexing, exact optional properties, override/fallthrough checks, type-only imports and erasable syntax. No first-party `allowJs`, `noCheck` or `skipLibCheck` exemption is used. Type-error expectations are restricted to compile-time boundary fixtures. Production suppressions are rejected. Typed lint rejects explicit/unsafe `any`, floating/misused promises and non-exhaustive switches. Compiler and lint negative probes verify the gates fail for the intended diagnostic.

`types/pilot.ts` is a narrow declaration of the still-JavaScript registry and the checked pilot exports. The module map is closed and return types follow module IDs; callers cannot choose arbitrary result types. Existing JS callers and the registry implementation remain unchecked until later phases. Runtime version/shape/freeze validation stays in place. Assertions at the registry lookup and unknown-property inspection bridge existing JS behavior. Save-lane's retained-value assertion follows its pending invariant; its retry-index assertion follows the bounded nonempty tuple. Preserve these checks and invariants when converting callers.

## Build, tests and coverage

`build/source-script.mts` is the shared synchronous erasure path. It uses Node's strip mode, checks unchanged UTF-16 length and line count, and parses emitted classic scripts. Runtime imports/exports and non-erasable constructs are rejected. The pinned compiler independently proves type correctness. Build erasure occurs before filenames, CSP and precache hashing, with no implicit compilation cache. Generated `.js` filenames, script order, registry loading, storage identities and serialization stay stable in form. Content hashes may change.

Tests use the same helper and authored `.ts` filenames. Offset-preserving erasure is the source mapping: AST branches use emitted syntax at those same offsets, and V8 execution counts refer directly to authored TS. This avoids attaching misleading maps to source-text-extracted functions. New transformed/bundled code must supply an accurate source-map route before claiming authored coverage; current browser coverage remains explicitly built-runtime coverage.

`.mts` tests run through the existing hermetic loader and are included by discovery/governance. The canonical and save-lane mutations alter authored source, then execute fresh erasure. Their coverage floors require observation. No installed compiler is imported inside a hermetic test.

The five authored host scripts now live in `source/host/`, with inline positions declared by `hostScripts` in the module manifest. `build/host-source.mjs` composes them into `source/app.html` through `compileScript`; build and source-text tests share `readHostHtml`. The delivered scripts remain inline, preserving first-paint execution and avoiding new requests. P5.0 is mechanical extraction, not admission to strict checks. Later owners in the [Phase 5 register](typescript/PHASE-5.md) convert these JavaScript bodies and their feature adapters. Raw build-token expressions also need a checked contract before a file can become valid TypeScript; changing an extension alone is insufficient. Runtime imports need a deliberate bundling/loading design; classic-script compilation intentionally rejects them.

For portable ES modules, source-only readers use `eraseTypes`, not the classic-script parser. Erasure preserves spaces where annotations/generic arguments existed; source assertions must allow those spaces while keeping the behavioral/structural requirement intact. Host substring tests remain transitional: composed HTML offsets do not establish authored host-file coverage.

Vendored Wordgard source remains immutable. Generated runtime bundles are rebuilt only through the builder; the owner authorized the Phase 2 style-mod update. Build validation belongs in disposable checkouts; QA output stays outside the repository.


## Vendor declarations and shared contracts

`npm run types:wordgard` emits 87 declarations from the immutable upstream source. Its isolated config uses `noCheck` for vendor declaration emission only, with upstream package resolution preserved. `npm run typecheck` reproduces those declarations in a temporary directory and checks the complete output inventory, compiler/config/generator hashes and all 90 vendor file hashes. Consumers check the resulting declarations with `skipLibCheck: false`. Negative fixtures also catch unresolved imports degrading key APIs to `any`. No vendor implementation is admitted into the application strict projects.

The upstream signatures retain upstream types; our code has no explicit or unsafe `any`. Reviewed assertions are limited to schema validation/serialization boundaries, typed custom-node params after identity checks, DOM capabilities, the upstream widget's erased parameter at decoration insertion, and indices proven by allocated matrix dimensions or validated nonempty document structure. TrustedHTML is opaque and cast only at the detached DOM sink; schema/allowlist cleaning still follows it.

`portable/worker-contracts.ts` defines attachment/search/image requests, replies, progress and errors; incoming structured-clone values remain unknown and are checked before use. Editor asset, attachment, note, overlay and mounted-editor ports are exported, along with the inferred public API. WG1 records represent the current version only; envelope checks do not pretend to replace Wordgard schema validation. DOM-free image resizing uses a narrow canvas port, supplied separately by browser and worker adapters.

Phase 3 removed all three portable `.d.ts` bridges after converting their implementations. `types/portable-processing.ts` maps each operation to its inputs and result; JSON results remain `unknown` until validated. `portable/request-decoder.ts` validates transport shapes before the typed dispatcher, and integrity requests validate checkpoint words/tails before restoration. Opaque CryptoKey and file-handle assertions follow capability checks; WebCrypto and file operations still enforce actual capabilities. Format, size, authentication and read-back checks remain in the operation implementations. Existing JavaScript hosts and registry remain Phase 5 work. Stored input remains unknown until runtime validation; the checked codecs do not establish whole-app type safety. Build-time `.mjs` contracts will be converted in Phase 6; the limits declaration exposes only the current readonly consumer API.


## Portable/domain implementations and test loading

The portable hashing/file-output/encryption/integrity/processing/ZIP implementations and domain, operation-lifecycle and repository-policy modules are checked. The registry contract now links module construction inputs to exports. Lifecycle jobs preserve result types and distinguish completion from outstanding work; cancellation uses a narrow signal port so DOM globals do not leak into the ES-only graph. Binary WebCrypto/writer ports require ArrayBuffer-backed bytes. Bounded SHA/CRC indices retain explicit invariant-based assertions.

Classic build/VM loading still uses `compileScript`/`readScript`, which reject runtime module syntax. Coverage uses the shared offset-preserving `eraseTypes` primitive for both classic scripts and portable ESM; Node executes the portable `.ts` imports directly. Dynamic core-test loaders resolve source filenames from the production manifest. Type-only contracts live under `types/`, outside runtime coverage inventory. No coverage thresholds were reduced.

Record/backup codecs are now checked together with their persistence/session dependencies. The JS host and registry implementation remain transitional boundaries owned by Phase 5; whole-application type safety is not yet established.


## Phase 4 boundary and remaining runtime work

Persistence, canonical record/backup codecs, repositories, ownership/mutation, sessions/timers, attachments, export, provider orchestration and recovery implementations are now admitted to strict checking. The final `backup.ts` and `backup-provider.ts` expose actual checked construction/output contracts; reduced retention proofs are distinct from restore manifests and pending review subjects determine their payloads. Phase 4's exact validation evidence is in the [history archive](typescript/HISTORY-PREPARATION-PHASE-4.md).

Host scripts, UI/feature modules, authored external integrations, registry implementation and service worker remain Phase 5 work. Generated runtime JS is expected; it must map to checked authored entry points. Phase 6 owns remaining first-party build/contracts/tests and transitional-bridge retirement. Do not infer whole-app strictness from the zero unchecked-*existing-TS* count while authored JavaScript still remains.
