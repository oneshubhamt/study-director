# TypeScript conversion execution record

## Working agreement

- Work exclusively on `TS-Conversion`; never modify or merge into `main` as part of this program.
- Keep this document current after each phase: decisions, implementation, checks, remaining work and corrections must be sufficient for another session to resume.
- Use a second, temporary scratchpad outside the repository for individual passes. Never put private reasoning, credentials or user data in this record.
- Vendored `vendor/wordgard/**` is immutable. Do not edit upstream source or the generated Wordgard bundle by hand. Our editor, adapters and customizations may change.
- Use strict TypeScript to improve the application's actual contracts. Preserve canonical application behavior, data integrity, ownership, recovery, timers, workers, offline operation and UI behavior.
- This branch supports one current canonical data model. Historical backups, record shapes, storage topologies and upgrade/migration adapters are deliberately unsupported. Reject unsupported input without silently converting or deleting it.
- Current-format backup/restore, interrupted-operation recovery, fallback saves, journals and malformed/newer-data protection remain required. These are not historical compatibility.

## Program plan

0. Remove historical migration/compatibility code and establish the canonical-only baseline (current pass).
1. Establish a pinned compiler, strict project configurations and TypeScript-aware build/test/coverage/mutation tooling; complete a small pilot.
2. Type module ports, records, worker messages and platform adapters; bring existing authored TypeScript under checking without modifying Wordgard.
3. Convert foundational domain logic and codecs, then persistence, repositories, sessions/timers and backup/recovery in dependency order.
4. Complete typed host composition, UI features, workers and service worker.
5. Complete first-party tooling/tests, remove transitional bridges, and certify correctness, browser behavior, coverage/mutation and output budgets.

Each slice stays runnable. Separate mechanical extraction, typing and behavior fixes. Preserve runtime validation at all external/storage/message boundaries. A renamed file is not proof its implementation is checked.

## Pass 0: canonical-only baseline

Status: canonical-only implementation checkpoint; PWA browser certification remains incomplete. Starting commit: `a3c94d9275785446a298304ae4cc28fe4761bff1`.

Scope: remove legacy live-data conversion, retired store bridges, historical backup/checkpoint readers, retired metadata identities and compatibility startup/verification orchestration. Update the authoritative inventories, tests and documentation with the implementation. Keep current recovery and strict canonical validation.

Checks planned: meaningful canonical-only rejection and roundtrip tests; current recovery/storage/backup suites; full fast suite; build/generated syntax/deployment checks; browser smoke. Verify Wordgard byte hashes and clean generated/source boundaries.

Decisions:

- The owner's current instruction retires the earlier audit's historical-read compatibility requirement for this branch. Older data is unsupported; it must never be silently upgraded, erased or accepted as current.
- Runtime topology/version/shape checks must fail safely for unsupported stores. Do not reset databases or user data as part of removal.
- Schedule-edit progress remapping and current fallback-record replay are functional recovery, not historical migrations; retain their behavior.

Implementation and focused recovery verification are complete. The owner requested an immediate checkpoint push with the unresolved PWA issue documented for a later commit. TypeScript implementation has not started.

## Earlier work and audit findings

- Environment onboarding: installed a local Node 22.23.4 toolchain and frozen npm dependencies, built/staged the PWA, checked local responses/security headers and server restart. At that checkout, 149 fast tests and 10 browser smoke tests passed. Browser secondary-tab update QA required a Chromium wrapper disabling background throttling. Reusable install/start instructions were saved in the environment draft; publication was left to the owner. These results are historical evidence, not proof that subsequent changes pass.
- Branch creation: fetched `main` and created/pushed `TS-Conversion` at `a3c94d9`. No conversion, audit or planning occurred during branch creation. Only this branch is authorized for subsequent repository work; no PR/merge was requested.
- Audit: inspected architecture, source/build inventories, contracts, tests, existing TS, workers and vendor boundaries. The repository remained unchanged during the audit. Three targeted suites passed (operation lifecycle, capture safety, background GC). An isolated TypeScript 6.0.3 probe under prospective strict settings found 127 authored browser diagnostics and 8 worker-graph diagnostics; these include configuration/boundary issues and are not counts of confirmed runtime bugs. Applying the same rules directly to vendor source produced 1,000 diagnostics; changing vendor is excluded.
- Size at audit: 59 core JS files (26,303 physical lines); 6 authored external JS files (12,996); one service worker (219); 8 portable JS files (331); five inline HTML scripts (9,988); 25 authored TS files (1,916). Approximately 49,837 authored application JS lines total. Tests/helpers: 244 JS files, 26,830 lines. Generated bundles and vendored Wordgard are excluded from implementation-conversion counts.
- Main difficulty: `app.html` has a roughly 9,500-line host script and earlier bootstrap scripts whose execution order controls profile scope, presentation and storage startup. Extract mechanically before splitting responsibilities; preserve timing and behavior.
- Existing TS was transpiled/stripped but had no compiler dependency, tsconfig or typecheck gate. Build uses esbuild; tests also use Node type stripping. Neither proves type correctness.
- Tests require pipeline work: 45 files refer to app.html, 54 use VM execution and 131 contain source/*.js literals (overlapping text-scan counts). Branch coverage inventories .js only; coverage-risk/mutation rules use paths and source anchors. Update them with the implementation so conversions cannot disappear from QA.
- Build/security: compilation must precede output fingerprints, CSP hashes and PWA precache identities. Replace untyped build placeholders through typed inputs later; retain deterministic output validation and offline/update tests.
- Environment boundaries: separate browser, dedicated worker, service-worker, portable and Node projects. Insights currently spans UI/worker roles; image processing spans DOM/OffscreenCanvas. Type our adapters against accurate vendor declarations without changing vendor or granting DOM globals to every worker.
- Valuable type targets: store/key/value relationships; validated incoming unknown values; closed module/port contracts; request/result/progress/error worker protocols; explicit lifecycle outcomes; selected branded IDs/units. Preserve runtime validation, Object.freeze, cancellation, authority checks, transaction barriers and read-back integrity.
- Strictness target: strict, checked indexing, exact optional properties, explicit overrides, exhaustive handling and unsafe-value/promise lint rules. No blanket suppressions or permissive global declarations. During coexistence, track checked implementations and truthful legacy bridges, not just .ts file counts.
- Toolchain drift discovered: docs say Node 22, CI requests 26.12.1, prepared toolchain is 22.23.4 and an unactivated shell defaults to 24.19.0. Resolve and verify a reproducible supported runtime in the TS foundation phase.
- First planned TS task: mixed build/test support, typed registry seam and canonical/save-lane pilot, then calibrate effort. No date promised from line counts. Full correctness/release/browser/coverage/mutation/budget certification is required at completion.
- Earlier full audit is available locally at `/workspace/TS-CONVERSION-AUDIT.md`; this repository record is the durable handoff. The owner's latest canonical-only requirement supersedes its historical-format preservation proposal. Preserve current data behavior; intentionally discontinue historical import/upgrade behavior.

## Pass 0 implementation and decisions

The upgrade path existed in the starting commit: `compatibility.createFacade.migrateLive` orchestrated identity, Plan, session, note/recovery, daily-record, deletion and metadata conversion. It checked the canonical baseline before retiring stores; persistence bridged older DB versions and the compatibility host verified topology. This verifies an implemented upgrade mechanism, not telemetry proving every installation ran it. The owner explicitly assumes migration completed everywhere. That assumption authorizes retiring the converters without introducing another migration.

- Removed the three compatibility implementations, runtime registration/loading, live-conversion namespace/facade and historical compatibility contract. Removed obsolete/renamed identity registries, old stores and retired migration metadata rather than leaving empty placeholders.
- Database creation now opens v9 atomically with the six canonical stores. Older-version upgrades abort without mutation. Current-version store/key shapes are checked. An already-newer database is inspected without downgrading; existing unsupported-data protection explains incompatible newer topology and preserves unknown records.
- Portable backup reading/writing now uses current metadata v23 and the existing binary framing exclusively. Managed checkpoints use v8; protected manifests use v3. Removed historical JSON/chunked readers, note-name/record/reflection conversion, old protected manifests and version-dependent creation/restore branches. Current canonical identities and physical binary magic remain stable.
- Removed historical attachment/folder migration and old service-worker install/recovery bridging. Unknown input/folders stay untouched. Removed obsolete “Format cleanup” retirement UI and diagnostics. The current client-acknowledgement cache remains under its existing physical name; it protects live clients during shell-cache retirement.
- Retained current-format restore, bounded processing, emergency rescue, fallback saves, rollback/deletion/clear journals, ownership, strict durability, integrity, retention and cancellation. Schedule-edit progress remapping remains current behavior. Full snapshot fencing and fallback replay were renamed to distinguish recovery from historical conversion.
- A generic bounded JSON worker parser was initially mistaken for a historical-only operation because of its labels. Current managed checkpoints use it too; it remains with neutral labels. Current presentation identifier aliases and conservative recognition of opaque operational coordination markers do not convert stored domain/backup shapes and remain part of existing behavior.
- Regenerated our rich-text/search/image/export bundles only through their build functions to remove retired limit metadata. Vendored Wordgard and its generated bundle remain byte-for-byte unchanged. The build contains 98 development / 99 deployment files after removing the compatibility modules.
- Replaced old-format acceptance tests with current roundtrip and unsupported-input rejection tests. Retired eight migration-only test executables and the unused shipped-baseline fixture. Current recovery, failure injection, concurrent ownership, cancellation and deletion assertions remain. The governed fast-suite count is 141. Browser canonical reload coverage replaces the historical store-upgrade case. Browser profile/export fixtures now write preferences through the current UI rather than relying on retired default migration.
- Updated contracts, inventories, constructors, diagnostics, README and architecture documentation. Historical audit/handoff documents point here for the current policy. AGENTS.md requires future sessions to read and update this record and use a separate temporary scratchpad.

## Verification findings and corrections

- Intermediate runs caught obsolete constructor ports/static assertions and test worlds that still accepted historical formats. Those fixtures now model current formats or explicit rejection; current behavior assertions were retained.
- PWA smoke exposed a secondary-tab update timing problem. A new behavioral regression fails before and passes after allowing a settled, read-only external follower to retry a boot-version mismatch. Primary and transitioning guards remain. The browser fixture additionally waits for the existing public startup-ready signal. A failure-only diagnostic reads whitelisted lifecycle/ownership statuses, without app content. An isolated archive of this branch's starting commit was used for comparison; no other branch was changed.
- Browser-data-clear verification exposed an over-broad census check: summaries use `summaryVersion`, whereas other stores use `version`. The census now respects that field, preserving the restored Saved Day and its summary across reload. Added current/older/newer census and unchanged-input regression assertions. Removed the obsolete two-stage compatibility census/settle distinction.
- A strict note flush interrupted by confirmed storage recreation now retries the retained edit before reporting it as unsaved. A fault-injection regression failed before and passes after the correction. Ordinary failures without confirmed recreation retain their existing handling.
- Future-topology inspection remains available to the existing startup protection so a missing store in a newer database gets the correct explanation. Added an unchanged-topology regression. Device Folder reconnect is asynchronous; the browser test waits for its observable connected state before checking remembered-folder behavior.
- Disposable release certification initially used symlinked dependencies, which made bundle input paths resolve outside its inventory root. Copying the installed dependencies into that disposable checkout fixes the setup without changing the test or dependency code.
- A smoke run hit the export fixture’s ad hoc 10-second deadline during optional storage inspection. The fixture now uses the shared readiness timeout; the export journey passed with all original behavior assertions.
- The staged local server was restarted after output refresh so security headers matched current inline scripts; local response/CSP checks passed. No deployment or publication occurred.

## Certification and next work

Checks used Node 22.23.4. Release checks ran in a disposable copy of this branch's final sources; browser checks used the prepared Chromium wrapper. Raw logs/artifacts stay outside the repository.

| Check | Result |
| --- | --- |
| `node tests/helpers/run-category.mjs fast` | PASS: 141 executables, hermetic |
| `node tests/helpers/run-category.mjs architecture` | PASS: 28 suites; also included in fast |
| `node tests/helpers/mutation.mjs` | PASS: all 8 critical probes killed, no survivors |
| `npm run test:release` | PASS: full lockfile audit (0 findings), 64 MiB attachment capacity, search performance, bundle reproducibility, source/generated syntax, development/deployment build verification, minified staging/verification, budgets and compression contracts |
| `node tests/helpers/browser-suite.mjs smoke` | INCOMPLETE: six journeys passed, then the PWA multi-tab reload scenario failed; later journeys were not run in that attempt. An earlier intermediate build passed all 10; that does not certify this checkpoint. |
| `node tests/browser/storage/canonical-storage.mjs` | PASS: canonical topology and note survive reload |
| `node tests/browser/storage/site-data-clear.mjs` | PASS: 15 recovery checks, including folder restore/reconnect and two-tab handoff |
| `node tests/browser/storage/unsupported-data.mjs` | PASS: all 7 newer/unsupported-data preservation scenarios |
| Wordgard / source boundaries | PASS: 90 vendor-file hashes and generated Wordgard bundle unchanged; regenerated app bundles match certified output; no certified source drift |
| Local environment / whitespace | PASS: refreshed server response and all five inline CSP hashes; `git diff --check` |

Fast, release and focused storage checks passed. Browser certification remains incomplete: both controlled tabs receive the activated worker, but the second tab can remain on the old page without reloading. The narrow follower retry correction passes its regression test but has not resolved every browser timing case. A temporary diagnostic copy is investigating ownership/update state; no further diagnostic instrumentation is part of the app source. The owner requested pushing this checkpoint immediately and handling the issue in a later commit.

Remaining before declaring preparation fully certified: diagnose/fix the PWA multi-tab reload issue and rerun browser smoke. Exhaustive extended-browser and full coverage certification were not run in this preparation pass; they remain final TypeScript-program gates. No compiler/configuration migration or JavaScript-to-TypeScript conversion has begun.

Next planned program phase is the TypeScript foundation/pilot described above. Do not treat generated/transpiled TS or renamed files as typechecked implementation. Complete pinned compiler/environment configurations and mixed build/test/coverage/mutation support before broad conversion. Continue only on `TS-Conversion`, maintaining this record and the temporary per-pass scratchpad.
