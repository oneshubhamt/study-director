# TypeScript conversion — execution control record

**Current checkpoint: main merge re-verification VERIFIED — TARGETED locally, 2026-11-09 (Asia/Calcutta); hosted CI verification BLOCKED by environment API access.** Production `main` through `2638619` is merged and published on `TS-Conversion` at [`0564e8e`](https://github.com/oneshubhamt/study-director/commit/0564e8e0b6e240371507ad35c728501f503c9fe2). Full certification remains Phase 7. Original conversion baseline: Phase 4 is implemented and verified within its recorded targeted scope at [`4136ba5`](https://github.com/oneshubhamt/study-director/commit/4136ba513479f0e0e0c01e0cef2495bcf61e0a2e): 34 Phase 4 modules, 126 files admitted to strict checks, zero unchecked existing TS. This is not whole-application certification. **Phase 5 is ACTIVE: P5.0 is VERIFIED — TARGETED.** Next is P5.1; strict feature conversions remain unstarted.

## Read first and document ownership

1. [AGENTS.md](AGENTS.md), this current record and its active worklog below.
2. [Binding decisions](docs/typescript/DECISIONS.md) and the assigned rows in the [Phase 5 scope/status register](docs/typescript/PHASE-5.md).
3. Relevant current [architecture](docs/ARCHITECTURE.md), [TypeScript boundaries/tooling](docs/TYPESCRIPT.md), source consumers and [verification procedure](docs/VERIFICATION.md).
4. [Preparation and Phases 1–4 history](docs/typescript/HISTORY-PREPARATION-PHASE-4.md) only as needed for rationale. It preserves the previous execution record in full.

This file owns current program state, active findings and the durable working scratchpad. The Phase 5 register owns its objective scopes/statuses; DECISIONS owns policy; architecture documents describe implemented behavior; history owns old observations. Update the owning location and link to it instead of copying another status table. The [docs index](docs/README.md) routes the wider documentation.

## Program state

| Stage | Recorded state | Evidence / next action |
| --- | --- | --- |
| Preparation | Canonical-only conversion complete | `512fc9c364ff007ea9e74b5391ac10a9349696a9`; historical details and follow-up fixes in the archive |
| 1 — Pipeline/pilot | Complete in its recorded scope | Archive: Phase 1 implementation and verification |
| 2 — Contracts/existing TS | Complete in its recorded scope | Archive: Phase 2 implementation and verification |
| 3 — Leaves/codecs | Complete in its recorded scope | Archive: Phase 3 implementation and verification |
| 4 — Persistence/orchestration | VERIFIED — TARGETED | `4136ba5`; archive's final Phase 4 completion records exact scope and deferred QA |
| 5 — Host/features | ACTIVE — P5.0 verified | [P5.0 onward](docs/typescript/PHASE-5.md); convert host portions with their owning features |
| 6 — Tooling/tests | NOT STARTED | Before starting, bound build/contracts, shared fixtures/loaders, test layers and transitional-bridge retirement into explicit units |
| 7 — Certification | NOT STARTED | Fresh whole-application source reconciliation plus complete correctness, coverage, mutation, browser, release and performance gates |

A phase is a scope, not a session estimate. Targeted completion does not imply full regression freedom, independent review, physical-device coverage or release authorization.

## Execution cycle — required for every implementation subpass

1. **Establish the baseline.** Check branch, HEAD, local changes and fetched `origin/TS-Conversion`. Preserve unexplained user edits. Record the fixed starting SHA; do not compare against a moving `main`. Fetch/read main when needed under existing authorization; incorporate only relevant reviewed changes, record their SHAs, and remain on this branch.
2. **Inspect and bound.** Read the assigned source, callers/consumers, adjacent flows and runtime tests. Record objective IDs, current behavior, file/function anchors, invariants, hazards and exclusions in this worklog **before editing**. Every affected host responsibility gets an owner in the Phase 5 register.
3. **Choose and implement.** Record the chosen approach and material alternatives/tradeoffs concisely. Keep mechanical extraction, strict typing and intentional behavior fixes distinguishable in the diff/commits. Preserve runtime checks and current canonical contracts. Record discoveries and course corrections during work, not only at the end.
4. **Reconcile objectives against source.** Check each objective independently against the fixed baseline and current implementation, including callers and adjacent flows. Explain every semantic difference. Iterate repairs when needed. A new type annotation, green test, prettier UI or old completion label alone cannot establish preserved behavior.
5. **Run targeted QA.** Select meaningful existing tests; add positive/negative/failure-path regressions where coverage is missing. Do not create tests merely to mirror the implementation. Typecheck/lint typed changes; build/syntax/browser checks follow affected boundaries. Separate malformed-input behavior, cancellation, recovery, persistence and UI evidence. Do not weaken assertions/floors to obtain a pass. Full QA remains Phase 7 unless the owner changes scope.
6. **Close and hand off.** Update every objective, actual commands/results, affected files, remaining uncertainty, next action and commit/publication evidence. Commit/push only within the owner's existing authorization. Verify remote identity before claiming publication. A checkpoint with unfinished objectives stays ACTIVE or IMPLEMENTED — QA PENDING, never complete.

Run the next necessary authorized steps without repeated confirmation. New requirements discovered outside the bounded pass go into the findings table with an owner; blocking regressions are repaired or explicitly block closure. No extra approval workflow is introduced by these documents.

## Status and evidence rules

- **NOT STARTED:** scope only; no implementation implied.
- **ACTIVE:** inspection or implementation underway; name unfinished objective IDs.
- **IMPLEMENTED — QA PENDING:** source changes exist; required reconciliation/checks remain.
- **VERIFIED — TARGETED:** all assigned objectives reconciled and required targeted checks passed; list actual limits.
- **BLOCKED:** identify the concrete blocker, preserved work and unblocking action.
- A finding may be **ACCEPTED DIFFERENCE** only with an explicit applicable owner decision and stated consequences. It is not a substitute for fixing an accidental regression.

Policy says what must hold; current source says what exists; executed checks say what was observed. Keep those separate. Record whether a finding is a confirmed source defect, reproduced behavior, suspected risk or verification gap. A conflicting source observation reopens a previous completion claim. Do not call self-review independent review, planned tests executed, a local pass CI success, or Chromium evidence Safari/device coverage.

Evidence must identify the tested revision (commit or start SHA plus exact changed paths), command, outcome, environment when relevant, and limitations. After further edits, rerun only checks invalidated by those edits and explain reuse of unaffected evidence. Raw logs may be temporary; durable summaries and reproducible commands must remain here. Record CI URLs/status only when actually inspected.

## Open findings and verification obligations

These are process/verification gaps identified during documentation review, **not newly established application bugs**. Keep IDs stable. Add actual discoveries as F-004 onward.

| ID | Kind / status | Owner and closure condition |
| --- | --- | --- |
| F-001 | P5.0 allocation CLOSED; intake refresh REQUIRED before P5.1 | The historical P5.0 register accounts for 117 ranges / 1,005 statements. Main intake changes host positions/responsibilities; retain feature owners, refresh current statement anchors before conversion, and never present old ranges as current |
| F-002 | Assembly verified in P5.0; new readers adapted in intake; retirement OPEN | Preserve the original 42-reader evidence. Imported readers use composition/TS erasure as appropriate; Phase 6 owns retirement of transitional text/VM bridges and authored coverage reconciliation |
| F-003 | Whole-program verification gap — OPEN | Phase 7: reconcile all remaining authored runtime code, whole-app behavior and current canonical formats; execute the full gates and record failures/repairs. Record unavailable manual/device evidence separately, without claiming it passed |

## Two scratchpads and recovery after interruption

**Durable scratchpad:** the active worklog below. Keep source observations, decisions, objective state, commands/results, changes and the exact next action here throughout each pass. It must survive loss of `/tmp` and chat context. It is an engineering worklog, not private chain-of-thought or a transcript dump.

**Temporary scratchpad:** one file outside the repository per pass, e.g. `/tmp/study-director-P5.0.md`, for a short task checklist, command queue, experiments and local artifact paths. Promote every material decision, failure and remaining task into the durable record promptly. No private user data or credentials in either pad. Losing the temporary pad must never require inventing what happened.

On resume, read the current docs and inspect actual Git/source state before acting; verify claimed commits, local changes and pending checks. Mark stale evidence rather than carrying it forward silently. Do not redo an unaffected completed check simply because a session changed.

Keep only the active pass and recent handoff here. At a natural phase boundary, move closed worklogs intact to one phase history file and retain commit/evidence pointers; never create competing per-pass plan, acceptance and scratchpad documents. Preserve original observations and corrections instead of rewriting history into uninterrupted success.

## Recent closed worklog — DOC-2026-10-30

**State: VERIFIED — TARGETED, completed 2026-10-31 (UTC).** Start HEAD `4136ba513479f0e0e0c01e0cef2495bcf61e0a2e`; clean `TS-Conversion`; fetched remote matched; main `9afbda7d1e18310d5e847662504cf057f363fb65`. Temporary checklist: `/tmp/ts-documentation-pass.md`. Phase 5 application implementation is not part of this pass. The owner subsequently expanded scope to all application documentation, product purpose/design, long-term architecture and implementation guidance.

**Inspection:** read Practice Desk `overhaul` at `b75d85c971d9bdf4988c993586b3155271393aed`: AGENTS, docs index, active source audit including Section G, policy register, current architecture/data contracts and historical-record organization. This is a review of documentation modality, not an independent audit of that app. Local Study Director inspection found a growing mixed historical/current execution file, stale `.js` references in current architecture, a Phase-3-only tooling summary, and generic branch/QA prose needing an explicit TS-Conversion override.

**Decision:** adapt the source-first cycle, stable objectives, persistent in-pass scratchpad, per-objective closure and archive separation. Reuse Study Director's existing architecture and verification documents. Add fixed-baseline/evidence provenance, explicit resumption rules, single ownership of status, and a complete Phase 5 allocation check. Do not import Practice Desk product policies, branch rules, mandatory per-pass new tests or an assumption that its process proves correctness. See [process provenance](docs/typescript/DECISIONS.md#process-provenance).

| Objective | Status | Evidence / remaining action |
| --- | --- | --- |
| DOC-01 | VERIFIED — TARGETED | Reference reviewed at fixed SHA; adapted process/provenance recorded, with no imported product requirements |
| DOC-02 | VERIFIED — TARGETED | Archived payload byte-matches the full execution record at `4136ba5`; no prior observations removed |
| DOC-03 | VERIFIED — TARGETED | 17 planned work units, all 24 remaining authored JS files and five inline scripts accounted for at inventory level; local document links resolve. Full host-range reconciliation remains F-001/P5.0 |
| DOC-04 | VERIFIED — TARGETED | AGENTS, README, CONTRIBUTING, HANDOFF, TYPESCRIPT and VERIFICATION route to one current record; existing architecture filenames corrected; persistent/temporary scratchpad and evidence rules aligned |
| DOC-05 | VERIFIED — TARGETED | Expanded document/link/path, preservation and scope checks passed; build, generated-build verification and deployment contract passed for served copy changes |
| DOC-06 | VERIFIED — TARGETED | Added PRODUCT and DATA-CONTRACTS; reconciled current identities, limits, profiles, data authority and security descriptions with their source owners |
| DOC-07 | VERIFIED — TARGETED | Reworked architecture, backup/background, notes, notifications and verification guidance; corrected stale migration, path and QA claims; README and contribution/agent guidance aligned |
| DOC-08 | VERIFIED — TARGETED | Preserved twelve original product records byte-for-byte in one archive; retired five redundant audit files; updated documentation navigation and source-backed privacy/security copy |

**Source reconciliation and changes:** the expanded pass separates durable product purpose, implemented architecture/data/feature contracts, active conversion control and historical evidence. The original conversion record and twelve original product/engineering documents are preserved byte-for-byte. Source checks covered canonical identities/authority/limits, note identity, repository retention/publication, backup protection and image preparation. They exposed incorrect served privacy descriptions: images can be resized/re-encoded and their bytes live in OPFS; a non-extractable derived backup key is stored and can be reused in the single-profile case. Corrected those factual descriptions, protected-point wording and obsolete format references in privacy/security copy. No application logic, schema, vendor, dependency, workflow, release identity or licence/terms changed. This was a documentation reconciliation, not a complete application/security audit.

**Checks actually run against `4136ba5` plus this pass's 28 changed paths:**

- `python3 /tmp/verify-ts-documentation.py` passed: 24 current Markdown documents/prefaces, 152 local links, 43 explicit source paths, byte-identical preservation of the execution record and twelve original product documents; 17 unique NOT STARTED work units cover 24 authored JS files (20,739 lines) and five inline scripts. HTML tag/attribute structure is unchanged in both served pages. The script is temporary, not a new repository test dependency. Historical embedded links retain their original tree context. This checks inventory consistency, not complete host-function ownership or runtime behavior.
- `git diff --check` passed. Changed-path review confirms Markdown plus the two served HTML copy edits only. Vendored source, executable code, toolchain, tests, workflows, licence, terms and release identity are unchanged. Test/adapter README changes are documentation only.
- In a disposable copy of this working tree, with Node 26.12.1: `node build/build.mjs`, `node build/verify-build.mjs` and `node tests/architecture/build/deployment-contract.mjs` all passed. Build/verification reported 98 development and 99 deployment files; deployment checks confirmed self-contained Firebase output, cache-header merging, consistent PWA manifests and the Trusted Types candidate. This is local build/deployment-contract evidence, not deployment or inspected CI success. Only Markdown changed after these checks, so their served-source evidence remains applicable.

Initial narrower checks were superseded by the expanded checks above. Full runtime/browser QA was not run for this documentation/copy pass; full conversion certification remains Phase 7. No new regression-free, device, legal or security certification is claimed.

The preservation check is reproducible without the temporary script:

```python
from pathlib import Path
from subprocess import check_output
archive = Path('docs/typescript/HISTORY-PREPARATION-PHASE-4.md').read_bytes()
assert archive.split(b'<!-- BEGIN PRESERVED EXECUTION RECORD -->\n\n', 1)[1] == check_output(
    ['git', 'show', '4136ba5:TS-CONVERSION-EXECUTION.md'])
```

**Handoff:** DOC-01–DOC-08 are closed within the documented scope. F-001–F-003 remain open. Next application action: P5.0 inspection and mechanical extraction, beginning with its baseline and full host-consumer allocation. The completion commit is the documentation commit containing this worklog (resolve with `git log -1 --format=%H -- TS-CONVERSION-EXECUTION.md`); publication is checked against `git ls-remote origin refs/heads/TS-Conversion` before reporting the push. Phase 5 has not begun. No changes were made to the Practice Desk reference or either main branch.

## Recent closed worklog — P5.0

**State: VERIFIED — TARGETED.** Baseline `8d9c525550d652e391c58f6fbd3db87160cf25fa`, clean `TS-Conversion`, 2026-10-31 UTC. Remote identity verified with `ls-remote` and an explicit branch refspec (origin's configured fetch maps only main); fetched `origin/TS-Conversion` now matches. Main remains `9afbda7`. Temporary pad: `/tmp/study-director-P5.0.md`.

**Bounded objectives:** P5.0-A extract all five scripts without executable changes; P5.0-B route build and affected source readers through manifest-backed composition/erasure; P5.0-C complete host range/function ownership and consumer inventory (F-001/F-002); P5.0-D reconcile baseline/output and targeted build, source-reader and browser startup/core-flow evidence. All four objectives are closed below; no strict feature conversion or behavior change assigned.

**Inspection/design:** `app.html` contains install capture, profile scope, presentation kernel, presentation metadata and the main IIFE. Early scripts must run synchronously at exactly their existing DOM positions. Extract their complete bodies to `source/host/*.js` and replace bodies with unique manifest markers. Build-time reinsertion preserves delivered inline script bytes, lexical scope, CSP, precache and first-paint behavior without adding requests or changing defer/module semantics. The shared reader will compose authored HTML for existing source-text tests, using the same classic-script erasure helper as the build. Test assertions remain intact. Runtime module splits/typing belong to later owners. No dependency, vendor, workflow, release or hosting-policy changes planned.

**Implementation checkpoint:** five bodies moved verbatim into `source/host/`; the manifest-backed `build/host-source.mjs` composes them at their original inline positions. Build inventory/source hashes include them. All 42 source-reading tests use this shared path; assertions retained. Added composition tests for missing/duplicate/reordered/unknown markers, changed script attributes, closing-script injection and literal dollar sequences. Exact baseline comparison passed for reassembled authored HTML and every one of the 197 generated files (including CSP/cache identities). Host allocation now covers 9,284 lines / 1,005 top-level statements in 117 contiguous ranges plus all action entries; the Phase 5 register owns the map and consumer inventory. This is ownership accounting, not whole-host behavioral certification.

**Failures and repairs:** three source-reader failures reproduced against unchanged `8d9c525`: `internal-module-boundary` looked up retired `attachments.js` (now resolves the manifest path); `data-architecture` sent portable ESM through the classic parser (now uses `eraseTypes` for non-core source, retains the core parser guard, and scans `.ts` as well); `persistence-boundary` rejected whitespace left by erased types/generic arguments (three patterns now allow whitespace, preserving transaction stores, durability and epoch requirements). Main's corresponding files were inspected; its JS-era readers were not suitable for direct port. No runtime defect established or application semantics changed. One baseline reproduction initially lacked copied external sources; completing that disposable fixture reproduced the actual parser failure. One rerun initially used a stale copied test; the final validated copy contains the repair.

| Objective | Closure evidence |
| --- | --- |
| P5.0-A | All five script bodies byte-identical to their original inline bodies; composed authored HTML equals baseline exactly; no added requests/scope/timing changes |
| P5.0-B | Canonical inventory/source hashes include five host files; shared build/test composer; 42 existing readers adapted; malformed-marker/closing-tag/literal-replacement regressions pass |
| P5.0-C | Phase 5 register owns exhaustive 117-range / 1,005-statement map, all action entries and full source-reader inventory; F-001 closed, F-002 assembly closed with Phase 6 retirement retained |
| P5.0-D | All 197 output files byte-identical; 44 targeted fast checks, build/source/generated syntax/deployment checks and two Chromium workflows passed; limits below |

**Executed QA — baseline plus this pass's changed paths:** Node 26.12.1, Chromium 154.0.8037.57 on Debian. Disposable validation/build copies under `/tmp`; no generated outputs committed.

- Exact-output proof: before extraction, hash every value in `renderBuild().development` and `.deployment` using SHA-256; after extraction compare both filename→hash maps. All 98 development + 99 deployment files match. `readHostHtml()` equals `git show 8d9c525:source/app.html` byte-for-byte. Build-manifest source hashes intentionally change because authored files moved; runtime output, CSP and PWA identity do not.
- Targeted runner: `node tests/helpers/run-category.mjs targeted <paths>` with the 42 paths in the Phase 5 consumer table plus `tests/architecture/build/host-source.mjs` and `tests/architecture/test-suite/suite-governance.mjs`. **44 unique tests passed** (2 unit, 18 integration, 24 architecture). The first run stopped at the first baseline reader failure; subsequent selections resumed the affected architecture subset. Unaffected unit/integration checks were not rerun. Logs: `/tmp/p5-targeted.log`, `/tmp/p5-targeted-architecture.log`, `/tmp/p5-targeted-architecture-rest.log`, `/tmp/p5-targeted-architecture-final.log`; durable failure/repair details above.
- `node build/build.mjs`, `node build/verify-build.mjs`, `node tests/architecture/build/syntax-check.mjs`, `node tests/architecture/build/generated-syntax-check.mjs`, `node tests/architecture/build/deployment-contract.mjs` passed. Source syntax covered 332 files / 52 rendered templates; generated syntax covered 134 JS files and 10 inline scripts across both targets. Subsequent test-reader fixes do not alter generated output; the changed tests themselves executed successfully.
- `node tests/browser/app/core-flow.mjs` and `node tests/browser/pwa/pwa-offline.mjs` passed serially. Evidence includes clean startup, plan/timer/review persistence/reload, saved-day backup/re-export, offline cold reload/lazy features, corrupt update rejection and multi-tab update settlement. Log: `/tmp/p5-build-browser.log`.
- New composition regression checks and suite governance pass. Final checks passed: 153 local documentation links; exact five-body/authored-HTML/output comparison; parsed the documented 117 ranges and proved every one of 1,005 AST statements is wholly assigned with no line gaps/overlaps; `git diff --check`. Protected source, vendor, canonical contracts, dependency/workflow/release configuration and preserved history are unchanged.

No TypeScript admission count changed: this is mechanical preparation, not new strict typing. Full QA, authored-host coverage, repeated pre-merge browser reliability runs, manual/device and whole-app certification were not performed; Phase 7 remains required. Later edits were documentation/test-reader repairs only, so unchanged runtime/build/browser evidence remains applicable.

**Handoff:** P5.0 complete within targeted scope; next is P5.1 foundation modules and their allocated host adapters. Establish a fresh baseline and bounded objectives before editing those implementations. Preserve the current canonical model and immutable Wordgard. Commit containing this worklog identifies the completion revision (`git log -1 --format=%H -- TS-CONVERSION-EXECUTION.md`); verify `git ls-remote origin refs/heads/TS-Conversion` before claiming push. No main/Practice Desk edits or deployment.

## Recent closed worklog — MAIN-2026-11-08

**State: VERIFIED — TARGETED.** Published merge [`0564e8e`](https://github.com/oneshubhamt/study-director/commit/0564e8e0b6e240371507ad35c728501f503c9fe2); branch-only publication verified against GitHub. Owner requested integration of latest production main before P5.1; explicitly excludes all migration/compatibility code and assumes every installation already uses the latest canonical topology. Baseline TS `d36c32e97506324f7305b22f0bb3c4bcdb1778a3`; fetched main `26386198a5c5b283d8adb97cf60aabeb8f6ebb9c`; last inspected main `9afbda7`; actual shared Git ancestor `a3c94d9`. Temporary pad `/tmp/study-director-main-intake/WORKLOG.md`.

**Objectives:** MAIN-A inventory all production deltas and exclusions; MAIN-B integrate untouched runtime/features and port overlapping implementation into strict TS, preserving host extraction; MAIN-C adopt current-only topology (backup24, PendingReview2 and corresponding manifest/claim/metadata), never historical converters; MAIN-D reconcile source and run affected strict/build/behavior checks; MAIN-E update current docs/ownership and commit/push only TS-Conversion.

**Inspection/design:** main has 932 commits since last inspected production checkpoint, touching 238 paths across history. Use fixed endpoints, not commit-by-commit replay. Storage/sync/handoff, notifications, Markdown, Insights and UI changes require coordinated integration. Preserve immutable Wordgard, compiler/lint admission, canonical-only policy and existing conversion history. Include incoming production release/build metadata as part of the requested main integration; retain stronger TS CI gates. Compatibility source/contracts/tests are explicitly excluded. Record every overlap resolution and validation limit before closure. P5.1 remains unstarted.

**Integration checkpoint (in progress):** merge from fixed `2638619` is open (`MERGE_HEAD`); initial 95 conflicted paths. Untouched runtime sources, styles, host production changes and new tests/docs have been brought in. Host re-extracted into the existing five authored files; compiler/lint projects and vendor remain protected. Current format-ledger contains one row only. Main's three historical compatibility modules/contracts and compatibility/upgrade tests are excluded. Production release identity is F24 as part of this intake, with no deployment.

**Overlap method/correction:** token-assisted application was tried for typed overlaps; syntax checks exposed unsafe partial matches at changed function boundaries, so that attempt was discarded for overlapping files. Rebuilt overlapping ports from three-way line merges against reviewed production endpoint `9afbda7`, retained typed module factory boundaries, and restored 313 existing signature/declaration annotations from their unchanged AST owners. Non-overlapping ports retain their typed implementations. Current compiler diagnostics are actively being resolved; no implementation or QA completion is claimed. New production capabilities require additional precise types, rather than suppressions or permissive JS fallbacks. Three-way conflicts that carried old backup readers were replaced with current-only codec behavior plus the new attachment-recoverability API. Repository-manifest version is 9; legacy retention/reader guards are excluded.

**2026-11-08 resumed checkpoint:** device-folder storage and managed-repository now compile under the unchanged strict browser project. Backup orchestration/provider contracts remain active (372 diagnostics after this checkpoint); this is not a passing type gate. Reconciled publication continuation/unchanged-version bookkeeping, typed semantic ancestry ports and kept current capability checks. Removed stale legacy/ignored-tombstone preview fields and compatibility import-summary references, rather than recreating historical-report helpers. Attachment completeness already exists in the imported capture implementation; added its missing type contract. The initial data regression batch exposed a retired-key reference in the imported harness; repaired the canonical harness, with rerun pending.

**2026-11-09 validation checkpoint:** unchanged `npm run check:types` passes all five projects (126 checked files; zero unchecked existing TS) and typed lint. Regenerated editor/portable bundles through the authored build pipeline; Wordgard vendor has no diff. The first broad affected-data selection ran 40 files: 16 passed and 24 failed, predominantly imported fixture readers/ports still expecting retired JS paths or compatibility APIs. Reconciled those fixtures using the same fixed-endpoint three-way merge as runtime source, preserving new production regressions and TS/canonical-only fixture behavior; rerun is active. No runtime compatibility shims added to satisfy old tests. Build, negative type gates, semantic reconciliation and browser evidence remain pending.

**2026-11-09 source and QA reconciliation:** 75 explicitly selected affected unit/integration/architecture files passed hermetically (40 data paths + 35 other affected checks). Nine Chromium checks passed: core flow; Markdown paste/copy; sync/profiles; Kept Versions; session/plan sync; six three-device handoff journeys; populated Insights; unsupported-data preservation; offline/update. No full suite, coverage run, full mutation run, physical-device certification or deployment is claimed.

**Material repairs:** restored profile cleanup's pending-intent fencing and browser recovery-key deletion while excluding its old-directory migration; moved live-session normalization back after current write metadata is stamped (the premature exact sanitizer rejected real timer/review saves). Core-flow now awaits the durable Plan apply, then verifies real session writes and reload. Metadata-only history can use its identity-fenced verified current manifest cache and bounded opaque current listing metadata without adding an old-format reader. Per-field ancestry rejects an array pretending to be a saved-plan hash; focused positive/negative cases added. Source comparison found four unchanged TS functions despite incoming edits: current backup manifest/item/completion readers and retention. Their incoming differences concern historical versions; current metadata/schema constants already supply v24/v2/v9 and the current-only implementations remain deliberate.

**Coverage finding and correction:** the retained post-restore Saved-Day verification mutant initially survived while the incoming immediate commit-receipt mutant was killed. Added a real later canonical-read mismatch after a correct commit receipt, checking stage, verified rollback and canonical final state; the unmutated test passes and both selected mutants are now killed. A first assertion compared the append-only fixture write log rather than the latest canonical record per date; corrected the assertion and disregarded that invalid mutation experiment. Full coverage/mutation certification remains deferred.

**Documentation/scripts:** the four [pre-intake TS programme documents](docs/typescript/snapshots/main-intake-2026-11-08/README.md) are preserved byte-for-byte from `d36c32e`, as explicitly requested. Existing programme decisions, objectives and archives remain separate from production feature guides. Consolidated incoming notes, backup/sync, background and notification guides into their current owning files; archived main's history/test-programme as provenance, retained its backlog as context, updated canonical storage docs and links. The old host ranges are explicitly historical; refresh is a bounded prerequisite to P5.1. Imported journeys and current-data tests/scripts remain; historical acceptance tests became unsupported-input preservation tests. Retained TS-aware coverage mapping/targeted selection and stronger floors; incorporated main's raw-coverage retention, branch helpers and new commit-verification mutant. Strong TS CI remains; brought in main's isolated Insights performance sampling only for manually requested browser promotion, with reviewed pinned actions/toolchain.

**Final validation checkpoint:** strict compiler and typed lint pass all five projects; source syntax (355 files), generated syntax (268 JS files / 20 inline scripts), negative type/lint/declaration gates, build verification, deployment contract, local minified staging and minified-release verification pass. Local staging did not deploy. Targeted ancestry coverage is 99.04% lines / 75.91% branches / 86.21% functions for `reconciliation-baseline.ts` only; `--keep-raw` was exercised and no floors were lowered. Two selected restore-verification mutants are killed with the unmutated regression passing. In the final 75-file rerun, 73 passed: retention's incomplete synthetic manifests needed the current version marker after removing the old-format diagnostic counter; the busy-backlog simulation failed under concurrent build/test load, then passed alone unchanged. The corrected retention test and repository test are now being rerun hermetically in isolation. No timeout/budget/assertion was relaxed.

**Final isolated evidence:** both affected failures now pass hermetically with `--jobs 1`: current-version retention fixtures and the unchanged busy-backlog integration test. Across the selected 75 files, all now pass after repairs/reruns. The timing-sensitive backlog case required isolation from concurrent build/test load; no product budget or assertion changed. The targeted ancestry-coverage command also verified the imported raw-V8 retention option, with one raw report written outside the repo.

| Objective | Closure evidence |
| --- | --- |
| MAIN-A | Fixed endpoint comparison, production delta inventory and explicit converter/test exclusions reviewed |
| MAIN-B | Production features/host integration ported; all 126 admitted TS files remain checked; targeted source/behavior reconciliation and Chromium evidence above |
| MAIN-C | Current backup24 / manifest9 / claim4 / PendingReview2 and metadata topology; one ledger row; unsupported-input preservation retained; no historical converters or folder movement |
| MAIN-D | 75 selected files passed after targeted reruns; nine Chromium files; strict/type/lint/negative/build/deployment/minified checks; two selected mutants killed; one explicitly scoped coverage run |
| MAIN-E | Programme snapshot, current guides, imported history/backlog/tests/journeys/scripts reconciled; current links and immutable archives/vendor verified; published merge `0564e8e`, remote verified; main unchanged |

**Publication:** merge `0564e8e0b6e240371507ad35c728501f503c9fe2` has parents `81ecdd8` (TS preparation checkpoint) and `2638619` (production endpoint). `git push origin HEAD:TS-Conversion` succeeded; `git ls-remote` confirmed TS at that merge and main unchanged at `26386198a5c5b283d8adb97cf60aabeb8f6ebb9c`. This closing documentation checkpoint records that verified publication; its containing commit is discoverable with `git log -1 --format=%H -- TS-CONVERSION-EXECUTION.md`. No deployment, PR, history rewrite or vendor edit occurred.

**Handoff:** main intake MAIN-A–MAIN-E is closed within the recorded targeted scope. All earlier TS programme documents remain active in their original roles, with four exact pre-intake snapshots and the prior archives preserved. P5.1 is unstarted; begin its eventual implementation by refreshing the explicitly historical host anchors under F-001, while retaining the existing objective owners. This intake does not revise the pass schedule or start another conversion phase. Full suite/coverage/mutation/release-performance/physical-device certification remains Phase 7; local generated-build checks and selected Chromium journeys are not that certification. Temporary evidence remains under `/tmp/study-director-main-intake/` and `/tmp/main-*.log`.


## Active worklog — MERGE-VERIFY-2026-11-09

**State: VERIFIED — TARGETED locally; VERIFY-D hosted verification BLOCKED.** Owner requests ordered re-verification: application parity, documentation preservation, imported tests/scripts, then CI repair. Start/remote TS `b678dd3ff4a10d00dd307d62043f555bd67fbc1e`; fetched main `26386198a5c5b283d8adb97cf60aabeb8f6ebb9c` (already an ancestor); clean start. Explicit refspec fetch was required because the default remote fetch did not refresh tracking refs. Temporary pad: `/tmp/study-director-merge-verification/WORKLOG.md`.

| Objective | State / next evidence |
| --- | --- |
| VERIFY-A | VERIFIED — TARGETED: four-way current source reconciliation against production base `9afbda7`, pre-intake TS `d36c32e`, production endpoint `2638619`, and start HEAD; no newly established runtime defect; affected checks passed |
| VERIFY-B | VERIFIED — TARGETED: four snapshots byte-match `d36c32e`; prior archives/tooling intact; production guides mapped to current owners; stale migration/encryption prose corrected |
| VERIFY-C | VERIFIED — TARGETED: imported suite inventory/assertion review; repaired typed discovery, regression policy, Node preflight and three mutation paths; restored omitted production assertions and runner guidance |
| VERIFY-D | VERIFIED — TARGETED locally: npm bootstrap, strict checks, exact automatic CI selection, build and generated checks pass. Hosted log/result BLOCKED by environment API allowlist |

**Runtime review so far:** all 51 changed production paths inventoried (including generated artifacts). AST/type-erased four-way comparison checks named functions and nested callbacks, plus normalized current-vs-main diffs with pre-existing TS differences separated. Host composition retains incoming runtime edits; missing compatibility facade/codecs, claim upgrades, old repository retention and legacy folder handling are deliberate exclusions. Current format versions and notification storage changes match main. Wordgard matches both endpoints byte-for-byte. The temporary printer needed AST-safe property normalization (text replacement corrupted template literals); that preliminary report was discarded, never used to change source. Targeted runtime confirmation follows before documentation review.

**Runtime closure:** all production source paths exist (with `.js`→`.ts` mapping) except the three deliberately retired compatibility modules. Composed host markup outside inline bodies matches main exactly. Normalized runtime deltas reconcile to existing TS boundaries/canonical-only policy and recorded intake fixes (session save stamping, Kept Versions variables, verified history cache and ancestry validation). Eleven selected hermetic tests passed (`--jobs 1`, 13.6 s): sync-shared-base (30 merge rules, 11 preflight variants), backup-persistence, reconciliation-baseline-v2, device-folder-storage, current-canonical-roundtrip, pending-reviews, profiles, managed-recovery, repository-retention, repository-background and format-ledger. No newly established runtime defect. Prior nine Chromium journeys remain evidence for unchanged behavior at `b678dd3`; this pass does not claim they were rerun.

**Documentation findings/fixes:** production area docs were consolidated rather than dropped; old production plans remain explicitly historical. Corrected stale v5 maintenance migration/fallback-migration and historical encrypted-reader claims; corrected two obsolete source comments. Current maintenance is v6 and replays only canonical rescue records; encryption is current-only. These edits change descriptions only.

**Suite defects confirmed:** the imported parallel runner and simplified governance enumerated only `.mjs`, silently excluding the existing `canonical.mts` test; its targeted invocation reproduced `Unknown fast-test path`. The bug-regression policy also rejected `.mts`. A focused governance run then found the runner had also lost the branch’s native-TS-capable Node preflight; restored it from `d36c32e` without weakening the test. Restored shared JS/TS discovery, independent taxonomy-to-runner reconciliation and typed regression-policy coverage. Restored main’s notification-storage/claim and passive-permission assertions that adaptation had lost. Removed an unreferenced retired feature-contract helper, and merged main’s generated-case, raw-coverage reuse and isolated-performance runner documentation with the branch’s TS sections and stricter existing browser-repeat rule. Main’s historical-format tests remain intentionally replaced/excluded.

**Additional suite finding:** the three incoming generated-case mutants still named retired `.js` sources. A targeted invocation reproduced `ENOENT` before any mutation ran. Their unchanged anchors exist in the `.ts` implementations; all three paths are now corrected. All three behavioral owners pass without mutation and kill their respective mutant. VERIFY-C is closed within this targeted scope.

**CI diagnosis:** `actions/setup-node@v7.1.0` source defaults automatic package-manager caching on and detects this package’s pinned npm; cache lookup calls `npm config get cache` before the next `Use pinned npm` step. Reproduced that exact command under Node 26.12.1/npm 11.9.0: `EBADDEVENGINES`, required npm 12.2.1. Main already disables that automatic cache. Added `package-manager-cache: false` to the two jobs missing it; the three performance jobs already had it. Added governance assertions for every setup-node step without changing versions or strict engine requirements. This is a locally reproduced failure path, not an inspected hosted log. `gh run list` is blocked by proxy CONNECT 403 for `api.github.com`; private web Actions returns 404. Saved an additive network-only environment draft for that hostname, requiring user save/publication; no credential request or bypass.

**Suite reconciliation:** inventoried 282 main test/build paths: 100 identical, 172 adapted, ten intentionally absent historical-format tests/helpers. New sync/handoff journeys remain intact; source-reader and current-format adaptations preserve their intent. Assertion-level review restored 29 additional production session/recovery boundaries across runtime-boundaries, cleer-integration and managed-recovery-contract, in addition to storage/permission assertions. Initial restored checks exposed missing test bindings and whitespace differences after type erasure; those test adaptations are fixed without changing runtime behavior or weakening the checked operations/order.

**Final checks against `b678dd3` plus this pass's changed paths (Node 26.12.1/npm 12.2.1/TypeScript 7.0.2):**

- Global npm 12.2.1 bootstrap into a temporary prefix succeeded from npm 11.9.0; the installed npm can query its cache. `npm ci --ignore-scripts` and `npm run check:types` passed: five projects, 126 files, zero unchecked existing TS, typed lint clean.
- The exact 18-file `qa-fast.yml` targeted command passed at its default four jobs (40 s). This includes managed-recovery and all three suite contracts. Earlier six-file tooling/storage selection passed; final five-file selection passed for timer-engine-logic, runtime-boundaries, cleer-integration, data-architecture and backup-recovery-ux-contract. The eleven runtime tests listed above also passed. No full suite was run.
- `node tests/helpers/mutation.mjs sync-keeps-the-other-edit hourly-keeps-only-changed-notes clock-jump-rebases-timer-start`: all three killed by their intended behavioral tests. This is targeted mutation evidence, not the full mutation gate.
- `node tests/helpers/coverage.mjs --test tests/unit/app/canonical.mts --file source/core/canonical.ts --keep-raw <external-empty-directory>` passed; the selected canonical module reports 100% V8 lines/branches/functions and raw data is retained. This proves typed discovery/coverage integration only, not whole-app coverage. The full AST branch report was not run against this intentionally partial sample.
- `node build/build.mjs`, `node build/verify-build.mjs`, and `node tests/architecture/build/generated-syntax-check.mjs` passed: 98 development/99 deployment files; 335 generated JS files/25 inline scripts. No deployment performed.
- Current Markdown filesystem targets: 29 files/201 links, no missing targets (preserved historical payloads excluded). All four pre-intake snapshots byte-match `d36c32e`; original programme archives and tooling guidance remain intact. Wordgard is unchanged against both pre-intake TS and main. `git diff --check` passed.

**Handoff:** application parity review found no additional missing production feature within the inspected scope; test/tooling and stale documentation omissions were real and are repaired. Remaining VERIFY-D action: after the environment permits `api.github.com`, inspect the branch's hosted workflow run and repair any remaining failure. The final local `gh run list` still returned Forbidden; no hosted CI success is claimed. Remote heads checked before publication remain TS `b678dd3` and main `2638619`. The repair revision is the commit containing this worklog, published only to `TS-Conversion`; confirm using `git log -1 --format=%H` and `git ls-remote origin refs/heads/TS-Conversion`. P5.1 remains unstarted, and F-001 host-anchor refresh is still required before conversion resumes.

**Constraints:** canonical-only behavior and strict TS preserved; vendor immutable; no P5.1 implementation. The owner's explicit CI repair request authorizes needed workflow edits. Existing targeted QA policy remains; source review and local tests are not whole-app certification or proof of mathematical equivalence.

## Worklog template — replace the active block when starting the next pass

```text
PASS / objective IDs / date / status:
BASELINE: branch, start SHA, fetched remote SHA, existing local changes, temporary pad.
INSPECT: source + consumers + adjacent flows; observed facts vs risks; file/function anchors.
DESIGN: chosen approach, material alternatives, invariants, exclusions and behavior changes.
IMPLEMENT: exact changed paths/commits; incremental discoveries and corrections.
OBJECTIVES: each ID -> status + current-source reconciliation + evidence + remaining work.
QA: actual command | tested revision/changed paths | result | limits; planned checks separate.
HANDOFF: unfinished IDs, next concrete action, unresolved risks, commit + verified publication.
```
