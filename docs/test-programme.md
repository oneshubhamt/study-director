# Test suite programme

The owner approved this programme on 2026-11-02. It makes the suite faster, tests behaviour instead of source text, groups files by subject and adds tests for the study features. This page is the full plan and its live status. When step 8 is done, its lasting rules move to [tests/README.md](../tests/README.md) and this page is deleted.

## Status (2026-11-03)

Steps 1–3 and part of step 4 reached `main` through PRs #12 and #13. The owner merged #13 on 2026-11-03, before step 8, so the bug fixes below could ship. The rest of the programme continues on a new branch from `main`.

**Paused; resumes after the bug hunt that starts on 2026-11-07** (owner, 2026-11-04). The owner paused the programme on 2026-11-03. Start where step 4 stopped ([Step 4 remaining](#step-4-remaining)); the first item is 4a, mutant-proving the post-restore backup test in `tests/integration/backup/repository-restore.mjs` and deleting the source checks it replaces. After it comes the new backup machinery ([backlog.md](backlog.md), order of work).

**Done meanwhile, outside the programme** (bugs from the owner, on the same branch): Drive cleanup no longer blocked by abandoned upload markers (bug 10, with tests in `repository-checkpoint`, `drive-security` and `device-folder-storage`); the safe area at the top on iPhone and iPad (bug 7); stale Verification wording (bug 8). The Device Folder test helper now stamps a shared folder with the latest clock of the pages using it.

| Step | Contents | Status |
|---|---|---|
| 1 | A: speed | Done (`main`) |
| 2 | E1: trim the tests about tests | Done (`main`) |
| 3 | D2–D4: sync merge, retention, timer rules | Done (`main`, PR #13) |
| 4 | B and C for backup and storage | In progress, paused until about 2026-11-10 (see [Step 4 remaining](#step-4-remaining)) |
| 5 | B and C for app, interface and PWA | Not started |
| 6 | B and C for the editor and browser tests, plus C3 | Not started |
| 7 | D1, D5, D6 (D7 already done) | Not started |
| 8 | E2, E3 | Not started |

| Measure | Start | Now | Target |
|---|---|---|---|
| Fast suite, locally | 4 min | about 33 s | about 1 min |
| Promotion | 24.5 min | not re-measured | about 12 min |
| Fast-suite files | 152 | 153 | about 95 |
| Browser tests | 50 | 50 | about 31 |
| Source-text checks in `tests/architecture` | about 1,300 | 985 | about 200 |
| Source-text checks in `storage/` | 782 | 462 | only the structural keepers |
| Permanent mutants (`tests/helpers/mutation.mjs`) | 8 | 11 | about 20 |
| Insights, sync merge, retention, timer | examples only, or none | sync merge, retention and timer have generated-input rules | all four |

## Ground rules

These hold for every step.

1. **The owner's data stays protected.** A data-safety check is removed only once a behaviour test is proven to catch the same breakage.
2. **Proof before deleting.** Break the code a check pins, using the mutation harness on a temporary copy (never the working tree), and confirm a behaviour test fails. The most important of these breakages become permanent mutants.
3. **Merging changes files, not what is checked.** A merged file keeps every scenario and every assertion. A merged browser test passes 3 runs on its own, then one full release-tier run. The `alone` rules stay.
4. **Coverage never drops** for safety modules. Every mutant in `tests/helpers/mutation.mjs` stays killed.
5. **Fix the app, not only the tests** (owner, 2026-11-03; this replaced the original "the app defines correct behaviour; report, don't change" rule). A bug, dead code or a clear improvement found along the way is fixed in the app in the same step, with a test that would have caught it, and named in the step's summary. Ask first only when the right behaviour is unclear or the change is large. Never weaken a test to make it pass.
6. **Release bump once.** The branch raised `release` once, to `SDVB75F20`, when step 4 first changed the app. Later steps keep it.
7. **Workflow changes need the owner's OK.** A6 and D7 were approved and are done.

## A. Speed — done

| # | Change | Result |
|---|---|---|
| A1 | `largefile-behavior`: test timers instead of a real 2-minute idle wait | Done |
| A2 | `indexeddb-topology-retirement`: a fast test clock instead of real 2.5 s waits | Done |
| A3 | `repository-checkpoint`, `repository-restore`: wait for each operation's finish signal, not busy polling | Done |
| A4 | Parallel runner: 4 files at a time, each in its own process and temp folder; every failure reported with its time; repo-unchanged check with a one-at-a-time rerun; `--bail` | Done |
| A5 | One coverage pass gives correctness, line and branch reports; branch coverage reports with the same floors | Done |
| A6 | CI: Promotion runs the suite once with coverage; Repository checks run the whole fast suite instead of 19 hand-picked files | Done (owner approved) |

## B. Behaviour over source text

**Scope.** 17 architecture files held about 1,100 checks that search source text (about 1,300 counting every architecture file).

- **`app/`:** `runtime-boundaries`, `workspace-contracts`, `presentation-contracts`, `protected-mutation-ui-contract`.
- **`storage/`:** `background-work-contract`, `backup-recovery-ux-contract`, `cleer-integration`, `compatibility-contract`, `managed-recovery-contract`, `managed-version-history-contract`, `persistence-boundary`, `runtime-authority-contract`, `attachment-aware-reconciliation`, `data-architecture`.
- **Others:** `reconciliation-ui-contract`, `pwa-updater-contract`, `export-hash-boundary`.

**Method, for each check.** Write down what it claims, from its own failure message, then sort it:

| Kind | Action |
|---|---|
| The structure is the requirement: security, build, module boundaries, the diagnostics privacy allow-list, the storage-key register | Keep |
| A behaviour test already catches it (mutant killed) | Delete |
| Wording people see | Move the check to a UI or behaviour test where the text is shown, then delete |
| Nothing catches it | Write a behaviour test at the lowest faithful layer, prove it with a mutant, then delete |
| A ban on a retired name | Delete (the name cannot come back by accident) |
| An absence check that guards a live boundary | Keep |

**Keep these files as they are:**

- **`build/`:** all 9 files.
- **Security and boundaries:** `security-policy`, `internal-module-boundary`, `wordgard-adapter-boundary`, `wordgard-upstream-integrity`.
- **Small wiring checks:** `image-policy`, `diagnostics-labels`, `compatibility-isolation`, `backup-limits-wiring`, `host-export-port`, `file-worker-bundle`.

**Also in B.** Integration tests that cut functions out of `app.html` by text markers load the module file instead, wherever the code lives in a module. Code that lives only in `app.html` keeps the current approach unless moving it is a clear improvement (rule 5).

**Example.** Backup retention used to be "protected" by regexes over `managed-repository.js`. D3 added rule-based retention tests (`tests/unit/backup/repository-retention.mjs`); the regexes then went.

## C. Consolidate

### C1. Browser tests: 50 → about 31

| New test | Merges | Tier |
|---|---|---|
| editor-core | rich-editor-interactions, rich-editor-completion, paste-sanitization, link-context, typography-refinement | smoke |
| editor-images | image-persistence, image-bridge, image-controls, image-resize-toolbar | smoke |
| editor-mobile-overlays | mobile-rich-editor, native-overlays, workspace-overlay, table-resize-controls | feature |
| editor-performance | rich-editor-hotpath, image-memory, readonly-maintenance, table-capacity | extended, runs alone |
| study-day | core-flow, session-draft-edit (and the D5 journey) | smoke |
| notes-library | notes-management, library-selection | smoke |
| app-shell | interactions, profile-panel | feature |
| notifications-and-sounds | notification-stack, app-sounds | feature |
| two-device-sync | sync-and-profiles, sync-kept-reviews | feature |
| encrypted-backup | encryption, complete-library. First find out why `encryption` must run alone. | feature |
| insights | insights-populated-ui, insights-maximum-import | feature |

- **Unchanged:** session-plan-sync (alone), site-data-clear (alone), insights-performance (alone), notes-at-limit (alone), and the rest.
- **Merge rule:** only tests that share a setup and fail in the same way. Every assertion stays as a named check; coverage tags are combined.
- **Time saved:** fewer browser and server start-ups; measure it, don't guess.

### C2. Fast-suite files: 152 → about 95

One file per behaviour area, each holding a table of scenarios.

| Folder | Now → target | Grouping |
|---|---|---|
| backup | 27 → about 14 | capture; codec and formats; encryption; repository (checkpoint split into publication, retention, integrity, cleanup); restore; Device Folder; Drive; sync |
| storage | 27 → about 12 | persistence and durability; notes repository; journals and recovery; references; maintenance; profiles and identity; unsupported data |
| attachments | 9 → 3 | storage and integrity; library lifecycle; workers |
| ui | 7 → 3 | notifications; sounds and cues; outcomes and diagnostics |
| rich-text | 7 → 3 | — |
| pwa | 5 → 2 | — |
| app | 5 → 2 | — |
| insights | 4 → 2 (plus D1) | — |
| search | 2 → 1 | — |

The two monoliths are split by subject: `repository-checkpoint` (201 KB) into 3–4 files, `sync-shared-base` (94 KB) into 2.

### C3. Migration tests in one place

A new `tests/migration/` folder (the runner and browser manifest pick it up) holds the 11 files that exist only for old formats:

- `compatibility-host`, `compatibility-retirement`, `indexeddb-topology-retirement`;
- `active-session-recovery-migration`, `legacy-attachment-cleanup`, `reconciliation-baseline-v2`, `current-canonical-roundtrip`;
- `compatibility-contract`, `compatibility-isolation`, `retirement-readiness`;
- the browser test `upgrade-renamed-names`.

When the migration code is removed, the folder goes in the same pull request.

### C4. Names by subject, not history

- `cleer-integration` becomes `session-ownership`.
- The single-use helpers `session-ownership-claim-regression`, `current-codec-fixture` and `baseline-roundtrip` are renamed for what they do, or folded into the file that uses them.

## D. "Must always hold" tests

**Tooling.** `tests/helpers/generated-cases.mjs`: a small seeded random-number helper, a fixed number of generated cases, and the seed printed on any failure so a run can be repeated exactly. No new dependency.

| # | Area | Hand-worked cases | Rules over generated inputs | Status |
|---|---|---|---|---|
| D1 | Insights numbers | 5–10-day histories with totals, completion, outcomes, streak, kinds and start-delay buckets worked out by hand | Record order doesn't change results. Totals equal the sum of their parts. Rates stay between 0 and 1. A streak never exceeds the number of days and breaks on a gap. A no-study day doesn't change study totals. A window covering all days equals the full history. Same input, identical result. Change detection finds a planted step change and none in flat data. | Step 7 |
| D2 | Sync merge (`createPlan`/`resolvePlan`) | Two devices, small examples | Identical sides: no conflict, no change. One side changed: it wins without a review. Both changed differently: nothing lost; one text live, the other kept for review. Resolving twice equals once. Swapping sides keeps the same texts. | Done (`sync-shared-base`) |
| D3 | Retention, through the repository engine | A week of versions | Never more than the limit. The newest is always kept. Never under-filled when enough versions exist. At most 10 hourly versions from the last 24 hours, only where notes changed. Cleanup twice deletes nothing more. Nothing a kept version needs is deleted. | Done (`repository-retention`) |
| D4 | Timer | One study block | For any order of start, pause, resume, time away and clock jumps: work + pause + away = elapsed. Nothing goes negative. A backward clock jump leaves totals unchanged. A restore never lowers recorded time. | Done (`timer-engine-logic`) |
| D5 | Plans and Review | Schedule parsing: overlaps, crossing midnight, invalid lines | Browser journey: work, support and fixed blocks; pause and time away; save the day; edit the reflection and quality; reopen; the saved day matches. | Step 7 |
| D6 | Note links | Links inside text; rename and delete of a linked note | Combining two devices keeps both sides' links. Tested through modules where possible, otherwise in the notes-library browser test. | Step 7 |
| D7 | Insights speed gate | — | Judge on the median of 3 samples, budget unchanged | Done (`insights-performance` uses `SAMPLES=3` and the median) |

## E. Simpler rules

**E1. Trim the tests about tests — done.** Kept: every test runs exactly once, the browser manifest is complete, tests stay offline with no child processes and no writes to the repo. Deleted: the word-similarity duplicate detector and its exceptions register, the bans on historical words, and `feature-contracts.mjs`. Still to go: the code-snippet anchors in `tests/helpers/coverage-risk.mjs`, replaced by mutants in steps 4–6.

**E2. One rule for when to add a test** (step 8), in `tests/README.md` and `AGENTS.md`:

1. Add a test only for new behaviour, a bug fix (CI already requires one) or a data-safety path.
2. No tests for wording, layout, colour or one-off UI tweaks, unless they protect the owner's data or accessibility.
3. Add a scenario to the area's existing file before creating a new file.
4. Test through module APIs or the UI. Never check source text, except for security, build and boundary rules.
5. Never change app code only to make it testable without the owner's OK. (Fixing a bug or improving the app is covered by ground rule 5.)

**E3** (step 8). Shorten `tests/README.md` to match and update `docs/workflow.md`. Move the lasting rules from this page there, then delete this page.

## Step 4 remaining

Backup and storage. Done so far: covered checks deleted with mutant proof; 31 retired-name bans deleted (14 live boundary guards kept); wording checks moved to UI tests (Version History list, restore choices, safety copy, Guide); behaviour tests for restore without a version, Forget, and backups after a restore; one unreachable app branch removed from the Version History list.

| # | Work | Status |
|---|---|---|
| 4a | Mutant-run every backup/storage source-text check | Mostly done. The post-restore backup test in `repository-restore` still needs its mutants run; then its source checks go. |
| 4b | Behaviour tests for unproven data-safety checks | In progress. About 110 checks remain uncovered or partly covered, mostly backup-provider scheduling (`background-work-contract`) and recovery (`managed-recovery-contract`). |
| 4c | Delete covered checks; keep structural ones; delete retired-name bans | Done |
| 4d | Consolidate backup/storage files (C2 rows, the checkpoint split, C3, C4) | Not started |
| 4e | Classify the remaining structural keepers (declaration pins, absence checks, unlocated checks) | Not started |
| 4f | Replace the backup/storage `coverage-risk.mjs` anchors with mutants | Not started |
| 4g | Docs, full checks, push, PR #13 body | Not started |

## Expected result

| Measure | Start | After (estimate) |
|---|---|---|
| Fast suite, locally | 4 min | about 1 min (already 33 s) |
| Promotion | 24.5 min | about 12 min |
| Fast-suite files | 152 | about 95 |
| Browser tests | 50 | about 31 |
| Source-text checks | about 1,300 | about 200 |
| Permanent mutants | 8 | about 20 |
| Insights, sync merge, retention, timer | examples only, or none | hand-worked cases and rules over generated inputs |

## Risks

- New D tests may find app bugs, especially in Insights. Under rule 5 they are fixed in the same step with a test, or raised with the owner first when the right behaviour is unclear or the fix is large.
- Removing text checks could weaken protection. Every deletion needs a behaviour test proven to catch the same breakage.
- Merged browser tests can become flaky under load. Each must pass 3 runs alone; an `alone` test is never run beside another.
