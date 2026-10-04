# Background coordination: source correction and assembled verification

4 October 2026. Branch: `refactor/background-coordination`. This assessment covers canonical maintenance, Drive/Device repository maintenance and integrity, their shared lifecycle/priority owner, neighboring data-protection boundaries, and diagnostics. No PWA/UI interaction redesign is included.

## What was wrong

The previous 120-second change concerned transfer **inactivity** and integrity's cooperative work allowance. Drive cleanup still used a separate **30-second aborting deletion timer**. Successful protection/metadata reads could consume that timer before the first deletion. Raising a number would merely move the starvation boundary.

Canonical maintenance's caller also measured 20 seconds from attempt start, while the executor had no phase continuation. A slow successful Notes read caused every attempt to repeat preparation. Drive integrity propagated but failed to inspect the adapter's `ignored` inventory count, allowing an unreadable marked entry to disappear from a supposedly complete clean scan.

The repeated failures were missed interactions: isolated components legally yielded/retried, but the assembled workload could make no useful progress; two consumers interpreted the same uncertainty signal differently. Earlier green tests did not prove these cross-component properties. This is a verification and contract-consistency failure, not evidence that naming more states would solve the problem.

## Objectives and final implementation

1. **Every healthy bounded attempt can advance despite slow preparation.** `operation-lifecycle.createWorkBudget` now owns a small shared cooperative allowance for canonical maintenance, repository cleanup and integrity. The first productive protected unit can finish; elapsed time then yields before further work. Progress cannot renew/enlarge the allowance. Foreground checks are independent and always apply, including before that first unit. Existing per-request, worker and stream inactivity watchdogs still bound stalled IO.
2. **Canonical work continues under current proof.** A private six-phase cursor retains successful fallback, Notes load/flush, rescue, session and deletion reconciliation phases. Strict canonical epoch, raw local rescue values, live Notes revision, session mutation revision and ownership fence continuation. Any source change, including a completed repair or a change during a later awaited phase, revalidates earlier proof; idempotent repairs converge. Raw string comparison avoids repeatedly parsing/stringifying potentially large rescue payloads. Durable pending/completion metadata remains the existing version-6 contract; reload safely reruns proof rather than trusting an old in-memory cursor. Unknown reads/writes cannot commit completion. Deletion reconciliation also uses the owned allowance between individual transactions and saves its confirmed prefix before yielding. Its completion retires only exact serviced timestamps, preserves a newer request for the same item and verifies that no outstanding request remains. The previous key-only retirement race was reproduced before correction.
3. **Cleanup yields at confirmed work boundaries.** The shared managed-repository engine checks the allowance between incomplete artifacts, checkpoint pairs and objects. A checkpoint pair is one productive unit, with foreground/protection checks retained between its physical IO calls. Both Drive and Device pass the owned allowance through the same engine. Drive still inventories under renewable immutable maintenance protection; renewal's awaited fresh proof replaces the redundant immediate second assertion. No safety check, reclamation grace, reference rule, count cap or lease expiry protocol was weakened.
4. **Physical request time is measured separately from safety preparation.** Drive's 45-second metadata watchdog starts after pre-request protection checks, covers the request and JSON body, and stops before final protection/source checks. Those checks perform their own bounded IO. Byte transfer inactivity remains 120 seconds. Cancellation is subscribed across preparation, transport/body and final proof. Timer disposal is idempotent.
5. **Unknown inventory cannot publish clean verification.** Integrity now gates on ignored entries as well as overflow, invalid, uncommitted and orphan state. Its normal unavailable result preserves quarantine, cursor, scan identity and the previous full completion date, and retains the availability retry. Developer diagnostic completion is true only when explicitly confirmed; yielded maintenance reports retained pending work. Review's study-only report is untouched.
6. **Consolidate the changed contracts.** Aborting scope budget timers and `startBudget` handoffs are removed. Integrity's saved-progress predicate is shared by scheduled and direct Device verification. Device read-only inventory no longer carries unused total-deadline parameters; per-read timeouts and cancellation remain. No extra scheduler, persistent status store, general state-machine framework or historical test file was added.

## Verification design

Existing domain suites were strengthened:

- The shared allowance exercises 64 workload/preparation/unit-latency combinations, with conservation, finite completion and foreground protection before the first unit.
- Canonical maintenance runs the actual host job, lifecycle and complete AppData module. Its 20 store/latency combinations cover 0, 1, 19.999, 20 and 35 seconds on Notes, session, metadata and combined reads. Stable source advances monotonically and completes within six phases. Additional cases cover ownership changes, durable epoch changes, unsaved Notes, rescue arrivals, unavailable canonical/local reads, reload, and mutation during a later awaited phase. Six additional assembled recovery cases conserve individual transactions across 19.999/20/35-second latency, budget yield and foreground preemption; each row is consumed once.
- Assembled Drive scenarios use the actual adapter, provider, scheduler and cleanup engine. Successful metadata/protection responses taking 1, 3, 6 and 11 seconds reclaim a finite orphan backlog; foreground arrival after a deletion stops the next unit, retains intent and later resumes. Existing cold history failure, slow paginated inventory and larger backlog scenarios remain.
- A newer deletion request inserted during an older recovery batch remains pending, continues hiding the affected saved record, and completes through subsequent recovery. Eight incomplete-inventory combinations use the actual adapter, integrity scheduler and production host result projector: checkpoint/commit entries, renamed/undownloadable metadata, and empty/nonempty usable history. All remain unavailable, preserve prior warning/progress/full-completion state, retry promptly, and perform no repair publication or deletion.
- Existing strict persistence failure, publication/restore, reference/GC safety, worker lifetime and diagnostic suites provide neighboring regression checks. The cold Device scrub fixture now emits the same progress callback as production; its old timer-only model could not exercise the new completion boundary.

Repository checks on GitHub include these authoritative existing suites. Full promotion/browser acceptance remains separately invoked.

## Verification results

The clean local run passed **34 targeted suites**: three unit, 24 integration and seven architecture suites. It used the guarded hermetic runner on Node 24.19.0 without npm installation. The routine GitHub workflow uses Node 22 and now includes the four existing lifecycle, canonical maintenance, Device and assembled repository suites alongside its previous checks.

```sh
node tests/helpers/run-category.mjs targeted \
  tests/unit/app/operation-lifecycle.mjs \
  tests/unit/backup/repository-background.mjs tests/unit/backup/mutation-coordinator.mjs \
  tests/integration/storage/data-maintenance.mjs tests/integration/storage/background-gc-reliability.mjs \
  tests/integration/storage/attachment-integrity-audit.mjs tests/integration/storage/integrity-continuation.mjs \
  tests/integration/storage/repository-integrity-state.mjs tests/integration/storage/attachment-reference-recovery.mjs \
  tests/integration/storage/repository-journals.mjs tests/integration/storage/deletion-recovery.mjs \
  tests/integration/storage/strict-durability-boundaries.mjs tests/integration/storage/managed-provider-backup-pending.mjs \
  tests/integration/backup/device-backup.mjs tests/integration/backup/pending-provider-recovery.mjs \
  tests/integration/backup/repository-checkpoint.mjs tests/integration/backup/drive-security.mjs \
  tests/integration/backup/capture-safety.mjs tests/integration/backup/repository-restore.mjs \
  tests/integration/backup/file-lifetimes.mjs tests/integration/exports/scratch-gc.mjs \
  tests/integration/library/library-clear.mjs tests/integration/attachments/worker-client-lifetime.mjs \
  tests/integration/attachments/worker-behavior.mjs tests/integration/search/search-worker.mjs \
  tests/integration/rich-text/attachment-busy-lifecycle.mjs tests/integration/ui/background-diagnostics.mjs \
  tests/architecture/storage/background-work-contract.mjs tests/architecture/storage/managed-recovery-contract.mjs \
  tests/architecture/app/runtime-boundaries.mjs tests/architecture/app/internal-module-boundary.mjs \
  tests/architecture/test-suite/suite-governance.mjs tests/architecture/test-suite/suite-structure.mjs \
  tests/architecture/test-suite/suite-policy.mjs
```

The same application source also passed the following in a disposable build worktree:

```sh
node build/build.mjs
node build/verify-build.mjs
node tests/architecture/build/generated-syntax-check.mjs
```

Generated verification covered 111 development files, 112 deployment files, 130 JavaScript files and eight inline scripts. `git diff --check` passed. The current source audit found no further confirmed defect in the reviewed paths after these corrections; the practical limits below still apply.

## Code-quality assessment and practical limits

The coordination design remains small: a job owns its scheduling opportunity and attempt; the repository gate owns priority and actual settlement; an executor owns the storage proof and resumable work. These responsibilities now share the same productive-work rule at the affected handoffs. Provider-specific IO and proof remain explicit because a local directory, Drive and attachment reachability have different safety requirements.

Completion assumes the page runs, source eventually stabilizes, control/access remains available and required protection can be renewed. Work cannot bypass an expired/unverifiable exclusion marker to improve liveness. The existing bounded marker protocol is deliberately unchanged; extreme latency that prevents safe renewal remains an unavailable-protection condition, retaining work for retry. Uncancellable native mutations retain their exclusion until actual settlement. The source review and targeted matrices establish their exercised contracts; they do not certify physical device/browser/network behavior or every possible fault.

Retention remains 15 ordinary versions plus one temporary protected safety snapshot. Browser smoke, live Drive/CORS/device acceptance, full Promotion QA and the separate Insights timing acceptance are not claimed. Main is not merged.
