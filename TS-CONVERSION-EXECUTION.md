# TypeScript conversion execution record

## Working agreement

- Work exclusively on `TS-Conversion`; never modify or merge into `main` as part of this program.
- Keep this document current after each phase: decisions, implementation, checks, remaining work and corrections must be sufficient for another session to resume.
- Use a second, temporary scratchpad outside the repository for individual passes. Never put private reasoning, credentials or user data in this record.
- Vendored `vendor/wordgard/**` is immutable. Do not edit upstream source or the generated Wordgard bundle by hand. Our editor, adapters and customizations may change.
- During implementation passes, run targeted QA on affected surfaces and add meaningful tests/coverage as needed. Reserve full, thorough QA for Phase 7; do not repeat broad suites for each pass or minor correction. This owner instruction supersedes the earlier broad per-pass verification approach.
- Use strict TypeScript to improve the application's actual contracts. Preserve canonical application behavior, data integrity, ownership, recovery, timers, workers, offline operation and UI behavior.
- This branch supports one current canonical data model. Historical backups, record shapes, storage topologies and upgrade/migration adapters are deliberately unsupported. Reject unsupported input without silently converting or deleting it.
- Current-format backup/restore, interrupted-operation recovery, fallback saves, journals and malformed/newer-data protection remain required. These are not historical compatibility.

## Program plan

0. Canonical-only preparation (completed through `512fc9c`; follow-up evidence below supersedes the initial incomplete checkpoint).
1. **Pipeline and pilot (complete):** pinned compiler, strict environment configurations, typed lint, mixed JS/TS build/test/coverage/mutation tooling, and a small canonical/save-lane pilot.
2. **Contracts and existing TS (complete):** module ports, records, worker messages, platform adapters and accurate Wordgard declarations; strictly check existing authored TS.
3. **Leaves and codecs (complete):** foundational domain/time logic, portable primitives, codecs and isolated state machines.
4. **Persistence and orchestration:** storage/repositories, ownership, sessions/timers, attachments, backup and recovery in dependency order.
5. **Host and features:** mechanically extract host scripts, then complete typed composition, UI, workers and service worker.
6. **Tooling and tests:** finish first-party build/contracts/test conversion and remove transitional bridges/source-text extraction.
7. **Certification:** full correctness, browser, coverage, mutation, release and performance gates; inspect generated deployment.

This restores the original audit's seven conversion phases after preparation; the previous summary combined phases 3/4 and 6/7.
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

## Pass 0 follow-up: ported fixes and canonical-only audit

The owner confirmed that every device will run the latest background-refactor build before this branch goes live. Anything kept only for older builds is therefore removed.

| Change | Commit(s) |
| --- | --- |
| Ported from `main`: the Device Folder integrity range read returns `{blob,totalBytes,version}`, the background coordinator announces released slots, and a slow IndexedDB open gets one fresh attempt | 167ed8a, eadf3f2 |
| A failed transaction while opening is a storage error, not an unsupported database | 85dc8bc |
| Insights and overlay browser tests seed current DailyRecord v16 data and the profile registry | 6f2a9ac |
| Removed old theme aliases, the `legacy` maintenance reason and legacy wording in Review and Insights | ed658db |
| Drive accepts only version-2 maintenance markers. Other versions are counted as ignored, and the old age/margin policy is no longer read | this pass |
| Service worker: a cache without release metadata is an incomplete install and is deleted unless an install is still running. The bridge for old builds' unlabelled caches is gone | this pass |
| Ownership recognises only the version-2 lease `{version,tabId,pageId,claimId,expiresAt}` | this pass |
| Removed an unused diagnostics label (`oldFolder`) and an unused code (`STUDY_DIRECTOR_LEGACY_BACKUP`), a journal-history comment, and the "historical reflection drafts" integrity text | this pass |
| Tests: an ownership regression for the old lease shape (fails before, passes after); Drive version-1/3 markers rejected; fixtures that seeded retired keys now use neutral data | this pass |

Kept as current behaviour:
- schedule-edit progress remapping;
- fallback-record replay;
- the generic guards for unsupported or newer data;
- current editor table-size ranges (stored notes may use them);
- architecture tests that stop retired domains from coming back.

The policy's `maintenanceMaxAgeMs`/`maintenanceAssertionMarginMs` stay because the Device Folder uses them.

| Check (this pass) | Result |
| --- | --- |
| `node build/build.mjs`, `node build/verify-build.mjs` | PASS: 99 deployment files |
| `node tests/helpers/run-category.mjs targeted` on 32 tests touching the changed files, plus `suite-policy` and `suite-structure` | PASS |
| Browser, each run alone: `pwa-update`, `pwa-offline`, `core-flow`, `pwa-device-backup`, `sync-and-profiles`, `site-data-clear` | PASS: 6 of 6 |

`pwa-update` covers the PWA multi-tab reload scenario that left the earlier smoke run incomplete. It passes now, after the `pwa-update` fix carried over from `main`. The full browser smoke, extended-browser and coverage gates were not rerun in this pass. They remain gates for the TypeScript program.


## Phase 1: pipeline and pilot (complete)

Starting commit verified directly against GitHub: `512fc9c364ff007ea9e74b5391ac10a9349696a9` on `TS-Conversion`. The local checkout was fast-forwarded before implementation. Pass 0 follow-up reports the previous PWA reload case passing; Phase 1 will verify the generated app again.

Owner requires the latest published npm and TypeScript. Registry versions at this pass: npm 12.2.1 and TypeScript 7.0.2. Tooling must use these exact pins and must not substitute an older compiler to satisfy a lint dependency.


### Phase 1 implementation and decisions

- Restored the original seven-phase sequence after Pass 0. The owner specifically requested current npm/TypeScript: installed npm **12.2.1**, pinned TypeScript **7.0.2**, and updated the complete dependency/license inventory. Typed lint uses Oxlint **1.89.0** with its TypeScript 7 backend **7.0.2005**; typescript-eslint 8.72.0 only supports compilers below 6.1 and was not installed or forced past its peer requirement.
- Pinned local Node **22.23.4**, matching Node 22 declarations and npm's supported engines. Verified the new gates, pilot tests and build on the existing CI runtime **26.12.1** too: generated deployment hashes match Node 22 exactly. Workflows were not edited; the lightweight repository job still does not run installed compiler/lint gates. Release/promotion scripts now run them.
- Added five strict projects (browser, portable, dedicated worker, service worker, Node), environment/negative type fixtures, zero-error type/lint commands and an admission inventory. The 25 existing authored editor/worker TS files remain explicitly unchecked until Phase 2. Worker/portable projects currently establish boundaries, not converted implementations. No `allowJs`, `skipLibCheck`, production type suppression or explicit `any` was introduced.
- Converted **canonical** and **save-lane**, plus the shared script reader and a canonical behavioral test. The closed pilot module map relates IDs, versions, exports, generic lane values/results and current flush options (including backup capture). The JS registry and existing JS callers remain unchecked; the narrow declared seam is documented and runtime contract validation remains. Normalized executable ASTs for both converted app modules are identical to `512fc9c`; only types, comments and filenames changed.
- Build and VM tests share synchronous, cache-free Node type erasure before output hashes/CSP/precache generation. Erasure preserves UTF-16 offsets and line counts; coverage uses this direct mapping to authored TS. Classic scripts reject runtime imports/exports and non-erasable syntax. `.mts` test discovery, governance and syntax validation are included. Existing bundled editor/worker coverage remains a separate Phase 2/later boundary.
- Coverage inventories and AST parsing include TS; pilot floors require actual execution. Two added mutations alter authored TS and execute fresh erasure. Ten compiler/lint probes prove rejection of wrong types, unchecked indexing, invalid optional fields, unsafe values/calls, floating/misused promises and non-exhaustive switches. Build/test equivalence, erased import behavior, stack line positions and fresh mutation inputs have executable checks.
- The first full coverage run exposed missing pilot startup-rejection tests and existing baseline gaps. Added absent/incompatible-registry tests; strengthened Device Folder tests to verify destructive deletion disconnects and preserves unrelated folder contents, plus unsupported cancellation. Assigned the existing note-links and immutable Wordgard runtimes to their actual browser/release tests. Existing coverage floors were not lowered. No application behavior changed in these corrections.
- `docs/TYPESCRIPT.md` records checking scope, reviewed boundary assertions, toolchain commands, host-extraction route and remaining CI/vendor obligations. Wordgard's 90 vendor files and generated bundle remain byte-for-byte identical to the starting commit, including after bundle regeneration in the disposable release checkout.


Owner course correction during Phase 1: subsequent passes must use targeted QA on affected surfaces, with additional regression tests/coverage where useful. Full and thorough QA is reserved for final certification. The last repeated aggregate coverage run was stopped on that instruction; completed checks remain evidence, but the stopped run is not a pass. Phase 1's remaining verification is focused on its changed pilots and tooling.


### Phase 1 verification and handoff

The initial broad checks below were run before the owner's targeted-QA correction. Subsequent corrections used only focused checks. Logs/JSON remain outside the repository under `/tmp/ts-phase1-*`; the outcomes below are the durable record.

| Check | Result and scope |
| --- | --- |
| Clean `npm ci --ignore-scripts`, compiler and typed lint | PASS with npm 12.2.1 / TS 7.0.2; five environment projects, 10 admitted files including fixtures/contracts, 25 pre-existing TS files explicitly deferred |
| Compiler/lint rejection probes | PASS: all 10 positive/negative probes; incorrect types and unsafe/promise/exhaustiveness cases produce real diagnostics |
| Behavioral/architecture regression | PASS: initial 142-test fast run; final 24 unit + 90 integration tests during coverage, plus 29 architecture executables (143 total). Later test/helper changes passed their targeted checks |
| Pilot focused coverage | PASS: canonical and save-lane both have 100% line/function coverage in the focused report; existing branch floors pass |
| Device Folder focused coverage | PASS: four relevant integration executables; 97.29% lines and 91.07% functions, above the unchanged floors. Tests include denied permission, deletion preserving unrelated contents, unsupported wake/cancellation and current backup flows |
| Coverage/mutation pipeline | PASS: AST branch coverage observed both TS implementations; all 10 mutations killed, including authored-TS canonical ordering and save-lane superseded-retry faults |
| Full release check (before QA correction) | PASS: dependency audit (0 vulnerabilities), capacity/performance, reproducible bundles, syntax/build/CSP/precache verification, minified output and budgets |
| Browser smoke (before QA correction) | PASS: 11 journeys, zero quarantines, one browser test at a time |
| Runtime compatibility | PASS: compiler/lint and four relevant executable tests on Node 26.12.1; generated deployment hashes identical to Node 22.23.4 |
| Vendor/source boundary | PASS: 90 vendor files plus generated Wordgard bundle identical to `512fc9c`; app/build/contracts sources match the disposable release certification |
| QA selection/governance | PASS: focused coverage requires explicit tests and source files, rejects invalid selection and unobserved requested sources, keeps applicable floors and labels its scope; three affected governance/policy checks pass |

The last completed aggregate coverage run reported the existing Device Folder function floor at 89.29% against 90%. Focused regression tests now clear that floor without changing application code. Its broad rerun was stopped on the owner's instruction; do not report aggregate coverage as finally certified. Exhaustive browser/coverage/release certification remains Phase 7.

Added `--test` / `--file` selection to the existing coverage runner so later passes can verify affected modules without rerunning the entire suite. Default full mode and its thresholds remain available for final certification. Strengthened save-lane tests verify pending/writing status, retained failures, tail completion and settlement as well as the existing persistence behavior.

Next: **Phase 2 — contracts and existing TypeScript**. Bring existing authored editor/worker TS into the strict projects, establish accurate Wordgard declaration and platform boundaries, and expand checked module/record/message contracts. Keep vendor immutable. Work in small slices with targeted QA and update this record after each slice; do not advance into Phase 2 automatically as part of this checkpoint.


## Phase 2: contracts and existing TypeScript (complete)

Start: `d00c1dc`, verified against GitHub. Owner authorizes updating CI actions and the named dependencies, using Node 26.12.1/npm 12.2.1, and selectively porting working fixes from `main` (`9afbda7` reference) while modifying only `TS-Conversion`. Verified published action tags: checkout v7.0.1 and setup-node v7.1.0. Existing targeted-QA policy remains in force.

Dependency slice: port the accessibility fixes from c644aa5, 06e46a3, 4c0cf41, cef50af and 6cab2bd using only relevant authored code/tests. Do not bring back main's historical migration paths. Rebuild generated bundles through the builder; the authorized style-mod update changes the generated Wordgard bundle, while all vendored Wordgard source remains immutable. Standardize local/tooling Node on 26.12.1 and enable strict checking in the lightweight CI workflow now that workflow edits are explicitly authorized.

### Phase 2 implementation and decisions

- Admitted all **25** previously unchecked authored TS files. The five strict projects now cover **41** authored files/contracts/fixtures, with **zero** entries left in the unchecked inventory. Browser, worker and ES-only portable graphs stay separate. Every admitted implementation passes typed lint without suppressions or explicit/unsafe `any`.
- Added reproducible Wordgard declarations (87 files) with a manifest of all 90 immutable vendor files, compiler, configuration and generator. Upstream package imports resolve within the upstream declaration graph. `noCheck` is used only to emit the upstream declarations; first-party implementations and declaration consumers remain strictly checked with `skipLibCheck: false`. Compile fixtures detect key APIs silently becoming `any`; isolated negative tests detect edited declarations and changed vendor inputs. Vendor source is unchanged.
- Exported editor asset/attachment/note/overlay/mounted-editor contracts and the inferred public API. Added current WG1, attachment/search/image request/reply, progress and error contracts. Message inputs remain `unknown` until checked; generated worker replies and image requests are checked against their protocols. Current data validation, cancellation, hash verification and recovery remain intact. Shared image resizing now uses a narrow canvas port with separate browser and OffscreenCanvas adapters; original bytes remain untouched for images already within budget.
- Removed authored `any` in editor traversal, JSON transformations, Markdown, typography, worker handlers and the detached Trusted Types helper. Narrowed node unions, optional values and DOM events. Index assertions are restricted to bounded loops/matrices or validated nonempty document structures; executable AST comparison confirms reconciliation and tags are unchanged. Schema JSON assertions enter the existing runtime validator rather than replacing validation.
- Kept truthful, temporary JS consumer declarations for SHA-256, the processing dispatcher, integrity segments and production limits. Processing/integrity relay results remain `unknown`; precise operation/result maps will accompany their implementation conversion in Phase 3. Broader storage records and JS composition remain for their implementation phases. This is not a claim that the remaining JS application is typechecked.
- Standardized Node **26.12.1** and Node declarations **26.6.5**, keeping npm **12.2.1** and TS **7.0.2**. Updated acorn **8.19.0**, axe-core **4.14.0**, style-mod **4.1.4**, their lockfile and complete license inventory. Both workflows use checkout **v7.0.1**, setup-node **v7.1.0** and explicitly install pinned npm. Lightweight CI now installs dependencies and enforces compiler/lint gates. Node 26's type-erasure API declaration no longer accepts the redundant `sourceMap: false` option in strip mode; omitted it, preserving the tested default/offset behavior.
- Rechecked `main` at **9afbda7** after the owner expanded port authorization. Session-save/plan-sync, Execute header, background fixes and browser reliability work are already present or equivalent here. Selectively ported the five accessibility commits named above. The 64 MiB backup-fixture correction is already equivalent. Remaining substantive differences preserve this branch's canonical-only cleanup; no broad merge or old-format code was introduced.
- Rebuilt all six generated editor/vendor/worker bundles through the builder. Updated adapter provenance assertions and coverage inventory: declaration-only files are not runtime coverage targets; shared worker validation is explicitly owned by emitted-worker/browser tests until authored bundle mapping is introduced. No coverage floor was lowered.

### Phase 2 verification and handoff

QA ran with Node 26.12.1/npm 12.2.1. Build/release/browser checks used a disposable copy at `/tmp/ts-phase2-validation`; logs are outside the repository under `/tmp/ts-phase2-*`.

| Check | Result and scope |
| --- | --- |
| Clean install, strict compiler and typed lint | PASS: clean `npm ci --ignore-scripts` with pinned Node/npm; five projects, 41 admitted files, zero unchecked existing TS; current WG1/API/protocol positive and negative fixtures |
| Compiler/lint and declaration gates | PASS: 10 original diagnostic probes; reproducible vendor emission, declaration-tamper rejection and vendor-input drift rejection |
| Targeted hermetic behavior/architecture | PASS: 19 distinct executables covering reconciliation, tags/import, image processing, editor persistence, attachment lifecycle/API/worker, search, export, integrity continuation, adapters, upstream integrity, build pipeline and QA governance |
| New regression coverage | PASS: resize dimensions and original Blob identity, cleanup after missing context/invalid output/encoder failure, early/late cancellation; malformed attachment operations, successful read-back verification, hash mismatch and removal; limits declaration/runtime shape agreement |
| Worker test correction | Initial integrity test awaited the return of `self.onmessage`; strict DOM event handling returns void. Updated the harness to wait for the correlated reply, as a browser host does. The corrected integrity test passes; real-worker export tests also pass |
| Focused emitted-worker coverage | PASS: two selected tests observe both requested attachment/search bundles, 90.74% combined functions and 67.76% branches before the additional verify/remove assertions. These minified-runtime metrics are not authored TS coverage; there are no per-file risk floors for these two bundles |
| Browser checks | PASS: 10 journeys, run serially: editor completion, typography, image bridge, image lifecycle/memory, table resizing, paste sanitization, links, notes management, populated Insights and strict Trusted Types/runtime boundary. Includes axe 4.14 accessibility and real image/search/export workers |
| WG1/build/dependencies | PASS: codec runtime parity; all six reproducible bundles; source/generated syntax; development/deployment build and verification (98/99 files); complete dependency audit, 65 packages and zero vulnerabilities |
| Source boundary | PASS: all 90 vendor files unchanged; final generated bundles identical to tested disposable outputs; reconciliation/tags executable ASTs unchanged; whitespace checks pass |

Phase 2 is complete. Full fast/browser/coverage/mutation/release certification was deliberately not rerun; it remains Phase 7. GitHub-hosted workflow execution is separate from the local verification above. Next is **Phase 3 — leaves and codecs**, starting with the portable JS implementations behind the temporary declarations and foundational domain modules. Keep checked caller/result relationships and runtime rejection tests together as those bridges are removed. No Phase 3 implementation has begun.

## Phase 3: leaves and codecs (complete)

Start `f2ae545`, confirmed equal to GitHub `TS-Conversion`; `main` remains `9afbda7` with no newer commits to port. Begin by replacing the portable JS declaration bridges with checked implementations and operation/result contracts, then convert foundational domain/time logic, isolated state machines and canonical codec leaves. Keep the pinned Node 26.12.1/npm 12.2.1/TS 7.0.2 toolchain, immutable vendor source and targeted-QA policy. Per-pass factual scratchpad: `/tmp/ts-phase3-scratch.md`.


### Phase 3 implementation and decisions

- Converted **11** JS implementations: domain/time/completion/outcomes, operation lifecycle, repository policy, and all eight portable SHA-256/checkpoint/file-output/encryption/integrity/processing/ZIP modules. Removed the three temporary portable declarations. Five strict projects now admit **55** authored files/contracts/fixtures with zero unchecked TS; Node/npm/TS remain 26.12.1/12.2.1/7.0.2.
- Added operation/input/result maps, discriminated schedule parsing, typed job outcomes and construction dependencies, narrow cancellation/file writer ports, and ArrayBuffer-backed crypto bytes. Parsing arbitrary JSON still returns `unknown`. No first-party `any`, production suppression, compiler exemption or caller-selected result assertion was added.
- Processing handlers are checked individually against their operation contracts. Worker transport requests are validated before dispatch, including checkpoint state, files, numeric bounds and Markdown structure. Existing cryptographic/domain validation remains. Wrong reader/writer session operations reject without deleting the valid session. Correct canonical requests retain their behavior; malformed messages now receive deliberate errors rather than accidental property-access failures.
- Preserved encryption magic/framing/KDF/authentication, bounded streaming, OPFS identities, integrity checkpoint flushing and read-back verification. WebCrypto errors are narrowed structurally to preserve cross-realm authentication errors. Domain and repository-policy executable ASTs match the baseline after erasure (ignoring inert empty statements).
- Shared erasure now supports ESM coverage while the classic build/VM wrapper still rejects runtime imports/exports. Core test loaders use the production manifest for filenames; direct portable imports use `.ts`. Type-only contracts live outside the runtime coverage inventory. Existing coverage floors and mutation intent stay intact.
- **Sequencing refinement:** Phase 3 covers the portable codecs and independent domain/lifecycle leaves. Record and backup codecs depend on session/timer/storage contracts; convert these together in **Phase 4**, rather than invent permissive temporary facades. Host feature composition remains Phase 5 and build/test conversion Phase 6. Canonical-only topology and immutable Wordgard requirements remain unchanged.

### Phase 3 verification and handoff

Targeted checks used Node 26.12.1/npm 12.2.1. Build/browser validation used `/tmp/ts-phase3-validation`; evidence and the per-pass scratchpad remain outside the repository. No full QA suite was run.

| Check | Result and scope |
| --- | --- |
| Strict compiler and typed lint | PASS: five environment projects, 55 admitted files; new negative fixtures reject mismatched operation payload/results, unchecked JSON access, missing domain dependencies and invalid job outcomes |
| Targeted behavior/architecture | PASS: **43 distinct hermetic executables** covering domain/lifecycle, hashing and new transport/session tests; encryption, folder/portable/canonical backups, restore/checkpoint/sync, exports, attachments, integrity continuation, maintenance and changed test readers; build pipeline, responsibility boundaries and QA governance |
| Focused authored coverage | PASS: seven requested sources observed. Encryption 100% lines, 83.33% branches, 100% functions clears unchanged 90/80/90 floors; lifecycle 100% lines and 97.6% functions. Domain coverage is 76.7% lines; identical executable AST plus existing behavior/browser checks support its mechanical conversion. This is not aggregate certification |
| Focused mutations | PASS: all three killed — settlement deadline cleanup, partial integrity remaining unfinished, password verifier enforcement |
| Browser checks | PASS: four journeys run serially — core-flow, exports, backup encryption, strict runtime boundary. Includes real worker messages, cancellation/retry, OPFS output, encrypted read-back and Trusted Types |
| Build and source boundary | PASS: development/deployment verification (98/99 files), source/generated syntax, binary backup capacity, all six reproducible bundles. Final bundles match browser-tested outputs; all 90 vendored Wordgard files and the generated Wordgard bundle are unchanged |
| New regression evidence | PASS: 11 SHA padding/chunk sizes and checkpoint resume; corrupt checkpoints and malformed transport rejected; gzip/plain streaming round trips; cross-mode session mistakes preserve the live session; emitted-worker rejection followed by successful reuse |

Initial test failures were loader/source-shape assumptions following renames and dispatcher conversion; corrected loaders and boundary assertions pass. Two disposable-build setup attempts failed (wrong working directory, then an overbroad copy filter omitting dependency `dist` folders); corrected setup built successfully. No application regression was identified by the completed targeted checks. Full correctness/coverage/mutation/browser/release certification remains Phase 7.

Next: **Phase 4 — persistence and orchestration**, including the record/backup codecs and their session/timer/storage dependencies. Do not start Phase 4 automatically at this checkpoint.
