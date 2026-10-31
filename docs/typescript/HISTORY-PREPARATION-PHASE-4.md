# Archived TypeScript preparation and Phases 1–4

Archived on 2026-10-30 from `TS-CONVERSION-EXECUTION.md` at commit `4136ba513479f0e0e0c01e0cef2495bcf61e0a2e`. The complete previous text follows unchanged. Dated status, plan and pending/complete claims describe their original checkpoints; they are not current instructions or new certification. Old relative links and temporary paths are retained as historical text.

For current work use [the execution control record](../../TS-CONVERSION-EXECUTION.md), [decisions](DECISIONS.md) and [Phase 5 register](PHASE-5.md). Phase 4's completed code is at [4136ba5](https://github.com/oneshubhamt/study-director/commit/4136ba513479f0e0e0c01e0cef2495bcf61e0a2e).

<!-- BEGIN PRESERVED EXECUTION RECORD -->

# TypeScript conversion execution record

**Current status (2026-10-30): Phase 4 complete.** All 34 persistence/orchestration modules are converted; 126 files are admitted to strict checks. Targeted QA and the export browser journey pass. Full certification remains deferred to Phase 7. Phase 5 has not started.

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
4. **Persistence and orchestration (complete):** storage/repositories, ownership, sessions/timers, attachments, backup and recovery in dependency order.
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

## Phase 4: persistence and orchestration (complete)

Start `7bb2695`, verified against GitHub `TS-Conversion`; main remains `9afbda7`. Scope: persistence and metadata, canonical record/backup codecs, repositories and journals, ownership and mutation coordination, session/timer state, attachments, backup and recovery in dependency order. Temporary pass record: `/tmp/ts-phase4-scratch.md`.

**Initial owner instruction (superseded by the seventh checkpoint below):** run **full QA this time**, superseding the normal targeted-only phase completion policy. Use focused checks while implementing slices, then complete full correctness, coverage, mutation, browser, release and performance verification for the finished phase. Preserve immutable Wordgard, current canonical formats and all current recovery/protection behavior.


### Phase 4 implementation checkpoints

- First slice: converted session lifecycle, IndexedDB/local storage persistence, app metadata, host metadata and canonical record codecs. Database/JSON reads remain `unknown` until validation; transaction callbacks preserve success/result relationships. Added canonical daily/note/session/practice/personal-data contracts and compile-time rejection fixtures. Browser registry contracts keep DOM types out of the portable graph. At this checkpoint, five compiler/lint projects pass with **68 admitted files**, zero unchecked TS.
- Verification so far: **11 targeted hermetic executables passed** across durability, topology retirement, installation identity, session/import lifecycle, metadata, canonical baseline/schema separation, canonical backup round-trip, reflection/session codecs and note-text caching. These are slice checks, not full Phase 4 certification.
- Large codec factories expose their inferred checked API through type-only exports and a definition-only registry contract. This avoids duplicating derived-view signatures or creating circular consumer types. The classic loader erases those exports; build/source-shape checks remain pending. Raw property bags contain only `unknown`; they do not assert that unvalidated records are canonical.
- Backup codec conversion in progress: correlated entity/value results, processing operation/result contracts, unknown-valued decoded input and typed binary attachment frames. Preserve wire-value validation/coercion and existing proof checks; remove stale comments describing already-retired compatibility. No vendor files changed. Remaining repositories, ownership/mutation, timers, attachments and backup/recovery orchestration are still part of Phase 4. Full QA remains required before completion.


Second slice checkpoint (still in progress): **13 modules converted**, including backup codec, timer state, mutation coordination, recovery journals, attachment ingest/storage/maintenance and ownership in addition to the initial five. Compiler/lint pass at **84 admitted files**. Canonical metadata/decoded journal payloads retain unknown wire values where runtime validators permit coercion; transaction writes and created canonical results have explicit types. Timer/ownership controller accessors are checked directly; freezing preserves the intended timer setters while methods and read views stay immutable. Added typed worker result decoding before attachment metadata publication, with malformed-result rejection/reuse tests pending this checkpoint.

Checks completed since the first slice: **13 additional distinct targeted hermetic tests passed** (24 distinct total through ownership), plus binary backup capacity with 64 MiB of unique attachment payloads. Subsequent focused maintenance/loader checks also passed (three selected executables). Preserve the exact test/log scope when recording final totals. A backup identity assertion caught a conversion mistake that copied validated checkpoint metadata; corrected the validator to preserve original object identity and reran all five backup/timer checks successfully. Reader failures after renames were test-loader assumptions and are being corrected to use the shared erasure path. The first broad fast run in a disposable copy stopped at one such loader failure; it is **not** a full QA pass. Repositories, practice/timer execution and higher backup/recovery orchestration remain unfinished; full certification remains pending.


Third checkpoint (still in progress): **15 modules converted and checked, 88 admitted files**. Notes now distinguish editable drafts from stored canonical notes; the main repository exposes typed transaction results, session save/load/clear outcomes, deletion ledgers, backup preparation stamps and maintenance continuation state. Metadata reads use a family-keyed boundary behind the existing gateway validators; coercive operational fields remain unknown until normalized. Added a revision-counter regression: an accepted numeric string now advances numerically through the existing normalizer instead of concatenating. No healthy canonical numeric-counter behavior changes.

Validation: four notes/recovery executables passed; five repository executables passed (canonical mutation epochs, deletion recovery, maintenance, pending reviews, Library clear). The earlier worker malformed-result and canonical-link regressions also passed. Compiler and typed lint pass for all five projects. The broader fast run passed its unit and integration categories, then stopped on architecture source-reader/assertion assumptions. Build and generated-build verification passed in the disposable copy. Updated erased-source readers and corrected the governance assertion to require the locked compiler toolchain already installed by CI; no workflow was changed. **Full architecture/coverage/mutation/release/browser certification remains pending**, as do practice/timer execution and higher backup/recovery modules. Managed recovery and resumable integrity verification are the next slice, currently being typed. No Phase 4 commit/push yet.


Fourth checkpoint (still in progress): **19 modules checked, 96 admitted files** after managed recovery, resumable integrity verification, Practice Pacer and timer execution. Timer ports now preserve field-specific task evidence and read/write runtime types; live gap/break state is distinct from persisted timer payloads. Registry typing retains timer-engine registration/contract version 2. Hash snapshots permit read-only state/tail arrays, matching frozen integrity checkpoints. Managed recovery keeps safety verification, revision fencing, cancellation and automatic-backup resumption in their existing order.

Focused verification passed: managed recovery + integrity continuation + recovery architecture (three executables); Practice Pacer + timer logic + PWA build identity (three); timer state/Pacer/execution + ownership hydration + reflection/session codecs (five). Build/verify passed at the 18-module checkpoint. The subsequent broader run found a missed repositories filename in the build manifest; fixed it and passed the PWA build-identity regression. File export/encryption conversion is underway: compiler passes at 98 files and five export/scratch/encryption/integrity tests pass; one exhaustive-switch lint correction remains. Full Phase 4 certification and the remaining backup/provider/attachment orchestration are still pending; no Phase 4 commit/push yet.

Fifth checkpoint (still in progress): **26 modules checked, 110 admitted files**. Completed export/encryption, backup capture, reconciliation and its stored baseline, Device Folder storage/controller, and diagnostic recording. Full logical captures and incremental inventories have separate types; incremental preparation results correlate unit identity with payload. Reconciliation models record/deletion candidates explicitly, while baseline JSON stays unknown until its existing validators accept it. Folder transport distinguishes whole-file and range downloads, with typed leases, verified write receipts and permission state. Removed stale comments and an unreachable `movedFrom` reference left behind by the already-retired folder migration; current folder claim/recovery remains intact. Diagnostic fields still pass the existing privacy allowlists.

New checks: export malformed-reply regression passes (truthy non-boolean verification, malformed chunk/hash/file results, resource release, successful retry); four backup-capture executables pass; three reconciliation/shared-base executables pass; two Device Folder storage/restore executables pass; controller and recovery-UX architecture checks pass. All five compiler/lint projects pass. Diagnostic focused tests are next. Remaining Phase 4 work includes managed repository/provider/backup composition, background coordination, recovery host, attachments and Library clear; full correctness/coverage/mutation/browser/release/performance certification remains pending. No Phase 4 commit/push yet.

Sixth checkpoint (still in progress): **28 modules checked, 114 admitted files**, adding Pomodoro and Library clear. Timer execution now consumes the checked Pomodoro API, including its actual false-or-break result. Library clear distinguishes stored rollback envelopes from canonical entities; it checks rollback container shapes before any restoration and delegates entity validation to the existing repositories. The active-session save boundary now accepts unknown input explicitly and returns the existing codec-validated result. Added malformed-journal regressions proving invalid note/day/attachment/session containers perform zero writes.

Diagnostics unit/live-report/label checks passed (three executables). Library planning, transactional rollback/reference handling, timer logic and persisted integrity-state tests passed; after correcting a whitespace-sensitive erased-source extraction, the study-cue test and Library clear regression both passed. A broad fast run passed the unit category and stopped during integration on a stale dynamic `.js` reader for integrity continuation; corrected that reader and passed its targeted test. A fresh broad run is underway. These are not full Phase 4 certification results; the remaining orchestration modules and full QA gates remain outstanding.


Seventh checkpoint (in progress): **30 modules checked, 118 admitted files**, adding attachment orchestration and repository background scheduling. Attachments now type archive manifests, reference rollback, staged file lifetimes and preview cleanup; new malformed-manifest regressions reject wrong field types while retaining accepted manifest identity. Shared lifecycle jobs accept their scheduler’s opaque timer handles without pretending they are browser timer numbers. All five strict compiler/lint projects pass. Five attachment executables and the lifecycle/background unit tests pass; the background architecture contract passes after allowing whitespace left by type erasure. The 28-module broad snapshot passed all unit and integration tests, then stopped on the now-corrected architecture assertion; it was not a full QA pass.

**Latest owner steering:** skip full QA for now and finish this pass. Continue targeted checks on affected surfaces; defer full correctness/coverage/mutation/release/browser certification. This supersedes the earlier Phase 4 full-QA request. Recovery host and the remaining managed-repository/provider/backup layers are still being implemented. Vendored Wordgard remains untouched; no Phase 4 commit or push yet.


Eighth checkpoint (in progress): **31 modules checked, 120 admitted files**, including recovery host and Version History. Pending-provider writes remain serialized; recovery still verifies drafts, notes, deletions and active-session read-back before applying a backup. History models distinguish note-version fields from whole-backup fields and retain cross-location fallback reads. Focused recovery-host, pending-backup and UX checks passed. Version History architecture needed its reader changed from raw TS to erased runtime source; that corrected check and managed-recovery tests passed. Corrected suspension release typing to reflect the actual synchronous boolean return, while the coordinator continues to await it safely. Managed repository contracts are being drafted; repository/provider/backup orchestration remains unfinished. Full QA remains deferred by the owner's latest instruction. No Phase 4 commit/push yet.


Ninth checkpoint: **32 modules converted and checked, 122 admitted files**. Managed repository now types retention/commit metadata, preparation inventories, reusable structured objects, publication continuations, transport receipts and resumable integrity work. Reconstructed payloads remain unknown until canonical backup validation; verified byte identity does not imply validated domain records. Manifest metadata rejects malformed deletion containers and non-string checkpoint identities/timestamps; five regression cases cover those boundaries. Removed stale historical-reader comments without removing unsupported-version protection.

Verification: all five strict compiler and typed-lint projects pass. Four focused executables pass (repository checkpoint/publication, incremental preparation, restore, integrity continuation). The checkpoint executable passes again with the new regressions; background-work and managed-version-history architecture checks pass. Build and generated-build verification pass (98 development / 99 deployment files). All **90 vendored Wordgard files match the starting commit byte-for-byte**. Full QA is deferred per the owner. GitHub `TS-Conversion` still points to `7bb2695`; `main` remains `9afbda7`. This record accompanies the first Phase 4 implementation checkpoint commit; publication status is reported in chat and verified against GitHub. **Phase 4 remains in progress: `backup-provider.js` and `backup.js` are the two remaining orchestration implementations.**


### Phase 4 completion — 2026-10-30

Completed the final `backup-provider.ts` and `backup.ts` implementations, bringing Phase 4 to **34 converted modules and 126 admitted files**, with zero unchecked existing TypeScript. The earlier checkpoints above remain historical records. Checkpoint 9 was committed and pushed as `0250523`; this final pass started from that commit. A fresh GitHub fetch before publication confirmed `origin/TS-Conversion` still at `0250523` and `origin/main` still at `9afbda7`; there were no new main changes to incorporate. Work remained exclusively on `TS-Conversion`.

Implementation and decisions:

- Provider transports now distinguish whole-object/range reads, leases, publication receipts, verified history and cleanup proofs. Reduced retention proofs cannot be used as full restore manifests. Cache entries preserve checkpoint/commit identity; recovery specifications distinguish sync from operations requiring an external safety checkpoint. Existing mutation protection, cancellation, source-revision fences, retention, quarantine and automatic backup ordering remain in place.
- Backup orchestration types canonical captures, inspected candidates, private candidate/provenance maps, journals, restore choices, export progress and module ports. Pending reviews correlate each subject with its payload; saved-plan arrays are read-only in the model and retain runtime freezing. Wire/storage values remain unknown until existing validators accept them. Negative compile fixtures reject fabricated candidates, cleanup proofs used for restore, incomplete ranges, missing cancellation and mismatched review payloads.
- A single-note repository read projects a validated protected manifest with empty deletion ledgers. It remains restricted to that note and cannot authorize whole-app Combine or Replace. Restore tests cover note-only reading and preservation of unrelated days, notes, preferences, Library data and reconciliation state.
- Fixed two existing export defects exposed by the typed ports: removed a call to the nonexistent `renderPortablePresentation` (the presentation update already notifies subscribers), and connected the required `Exports.cancel` port through host composition. Integration regressions exercise progress updates and cancellation while save selection is pending. A real-browser regression cancels an active standalone backup worker, checks its cancelled outcome, and verifies no worker or active export remains.
- Removed the residual historical `before-clear-archive` safety-purpose alias; only the current `before-clear-library` purpose remains. This does not remove current safety checkpoints, rollback journals, unsupported-input rejection or current-format recovery. Small guards handle an invalid reused repository snapshot and integrity hooks becoming unavailable during an awaited operation.
- Updated manifest/registry entries, typed admission, test readers and coverage/mutation source inventories for the final renames. Architecture assertions retain their ordering/boundary requirements while allowing whitespace left by type erasure and the explicit typed recovery specification. Extracted-function fixtures now include the production unknown-field reader. Removed a duplicate test helper import. Full test/tool conversion remains Phase 6.

Final validation used Node **26.12.1**, npm **12.2.1**, TypeScript **7.0.2**:

| Check | Result and scope |
| --- | --- |
| Strict compiler and typed lint | PASS: all five environment projects, 126 admitted files, zero unchecked existing TS; negative type fixtures included |
| Focused behavior and architecture | PASS: **23 distinct executables** across pending-review codec/storage, backup persistence, repository restore, restore assets, shared-base sync, checkpoint publication, incremental preparation, automatic backup, pending recovery, persisted integrity, notification lifecycle, host/export ports, recovery/UI/background/retention contracts, governance and the TS pipeline |
| Final focused batch | PASS: 15 hermetic executables, including reruns of backup persistence/restore and the corrected fixture/architecture checks; the other checks above passed in earlier closeout batches |
| Compiler/declaration gates | PASS: strict negative gates, reproducible Wordgard declarations and detection of declaration/vendor tampering |
| Build and syntax | PASS: development/deployment verification (98/99 files), source syntax (325 files, 49 rendered templates), generated syntax (268 JS files, 20 inline scripts) |
| Browser | PASS: the exports journey, run alone; real worker failure/cancellation including the new standalone backup case, native save/download fallback, attachment export, import/restore, corrupt and historical input rejection, Markdown parity and responsiveness |
| Immutable vendor | PASS: all 90 `vendor/wordgard/**` files match Phase 4 start `7bb2695` byte-for-byte; the generated Wordgard bundle has no tracked changes |

Initial closeout failures were stale source-text assertions and extracted test functions missing the newly introduced field reader; corrected checks pass. Final runtime-diff review restored one accidentally removed array freeze and retained malformed-list guards before the last validation/build. Environment interruptions did not discard the working tree. No unresolved failure remains in the targeted scope above. **Full correctness, aggregate coverage, mutation, broader browser, minified release and performance certification were not run** in this closeout, per the owner's instruction to finish the pass and defer full QA.

The durable record is this file; the temporary execution checklist and detailed logs are outside the repository at `/tmp/ts-phase4-scratch.md` and `/tmp/ts-phase4-*`. The completion commit includes all final changes and is pushed only to `TS-Conversion`; its identity is reported in chat and checked against GitHub after pushing.

Next: **Phase 5 — host and features**, beginning with mechanical host-script extraction before typed UI/composition work. Do not begin Phase 5 automatically as part of this closeout. Full program certification remains Phase 7.
