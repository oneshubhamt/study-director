# Backup, sync and recovery

Device Folder and Google Drive are two transports for one managed backup engine. Standalone files are a separate portable representation using the same canonical capture/codec services. This branch supports **current formats only**; old Release A/B migration plans and folder converters are retired. See [data contracts](DATA-CONTRACTS.md) for exact versions and authority rules.

## Responsibility map

| Responsibility | Source owner |
| --- | --- |
| Logical capture and incremental preparation | `source/core/backup-capture.ts` |
| Portable encoding, validation and protected manifest | `source/core/backup-codec.ts`, authored `portable/` |
| Repository objects, manifests/commits, retention and integrity | `source/core/managed-repository.ts` |
| Location operations, history, safety publication and automatic backup | `source/core/backup-provider.ts` |
| File export/import, candidate provenance, restore/reconciliation and rollback | `source/core/backup.ts`, reconciliation/journal modules |
| Recovery/history host and coordinator | `source/core/backup-recovery-host.ts`, `managed-recovery.ts` |
| Device Folder permission/selection and transport | `device-backup.ts`, `device-folder-storage.ts` |
| Google authorization/network transport | `source/external/drive.js` |
| Job policy, scheduling/priority and diagnostics | `repository-policy.ts`, `repository-background.ts`, `operation-lifecycle.ts`, `backup-operation-diagnostics.ts` |

The host supplies frozen capability ports. Transport adapters list/read/write/delete repository artifacts and manage provider-specific leases/permissions; they do not implement competing restore, retention or backup business logic. Whole-object and bounded range downloads have different contracts. Verified transport bytes still require manifest/domain validation.

## Capture and publication

A complete capture settles canonical writers and deletion recovery, records provenance/source revision, and is fenced against source changes and browser-data clearing. Incremental preparation reuses unchanged verified logical units when their identity and remote availability permit it. Missing/uncertain proof triggers safe fallback or refusal, not an assumed empty object.

Repository objects are immutable. A checkpoint becomes committed through the verified manifest/commit protocol; listing a file alone is not publication success. New versions upload only unavailable/changed objects. One logical history can be copied between connected locations under the same identity, with verified-copy fallback when a location cannot supply it. Matching logical data avoids echo versions.

Pending external completion stays distinct from verified local mutation. A successful restore can leave convergence pending; UI and diagnostics must report that truthfully.

## Standalone files

Export opens the native picker from the user action where supported, captures/packages/verifies the file, optionally encrypts it, writes it and verifies native read-back. Without a save picker, the browser downloads the prepared file. The app records a user export for reminder purposes in both cases; **only successful native read-back marks the destination copy verified**. It cannot prove that a started browser download reached durable storage.

File progress/cancellation flows through the shared export worker and declared host ports. Scratch files are operation-scoped and collectible only when their leases/journal references permit it. Encryption covers backup contents, not live browser storage or ordinary note exports; [DATA-CONTRACTS.md](DATA-CONTRACTS.md) explains stored-key behavior.

Imports validate current framing, checksums, canonical payloads and authority before offering the supported choices. A rescue/partial capture cannot silently authorize complete replacement. Unsupported historical formats are rejected, not converted.

## Restore, Combine and sync

Managed restore selects a verified version explicitly. Operations requiring external safety first publish/verify the protected safety checkpoint, coordinate mutation/settlement and apply through journaled canonical paths. Revision fences detect concurrent edits while choices are open. Rollback must be verified before the recovery journal can retire. Sync and unchanged/no-op/note-only cases have explicit narrower rules; “every read creates a safety copy” is not the contract.

- **Combine** reconciles explicit records/deletions using a valid shared ancestor where available. Absence alone is not deletion; unresolved differences follow the existing choice UI.
- **Replace** applies the selected version under its authority/safety rules, including the existing keep/remove choice for extra local content and preservation of required trash/recovery state.
- **Add only what's missing** restricts scope, preserves ongoing work and returns a decision requirement before conflicting changes.
- **One-note recovery** reads only that note and required assets, always uses the note comparison, and cannot authorize whole-app replacement or unrelated tombstones.
- **Quiet Drive sync** merges through the canonical reconciliation engine. Unresolved concurrent alternatives are kept as `PendingReview` records; they are not silently discarded. Explicit review uses the same protected write paths and skips stale choices.

A shared Active Session names its running installation. Suspend/Continue Here coordinate explicit handoff; another device does not silently start the timer. Drive upload checks the remote head/base and current publication ownership before proceeding; a moved head requires catch-up, not blind overwrite. Password changes on another device can pause sync until the appropriate key is supplied.

## Automatic work and history

Policy constants live in `repository-policy.ts`: the quiet backup window is 20 minutes from the first waiting change, urgent opportunities use three seconds, and expiring authorization can trigger an earlier opportunity. Later wake-ups must not postpone existing deadlines. Reconnect/start discovery considers current canonical data; an empty or unsupported local view must not overwrite a fuller remote library.

History combines verified copies across locations and falls back to another readable copy before mutation when possible. Unreadable-version content is distinct from failed I/O or locked encryption. A newer/unreadable remote head can block sync/upload; unknown inventories cannot authorize cleanup. Connection loss, permissions and profile/repository generation retain distinct states.

Drive tokens last only for their authorization lifetime and are discarded on expiry/rejection/disconnect. Folder handles retain permission identity separately from repository identity. Current named per-profile/device folders are selected or claimed through current marker rules; the retired old-folder move converter is not part of this branch. Profile deletion markers and current missing-folder recovery remain functional coordination, not historical migration.

## Retention — one policy for both locations

| Tier | Retained points | Rule |
| --- | ---: | --- |
| Latest | 1 | Newest ordinary committed checkpoint |
| Daily | 6 | Newest checkpoints from earlier days that contain a backup |
| Weekly | 4 | Earlier Monday-based weeks below the oldest selected Daily's week |
| Monthly | 4 | Earlier months below the oldest selected Weekly's month |
| Remaining ordinary slots | Up to 15 total | Fill unused ordinary slots from remaining days using the governed time-gap selection |
| Hourly | Up to 10 extra | Earlier local hours within 24 hours of Latest where note fingerprints change |
| Protected safety | 1 extra per device | Newest unexpired protected checkpoint, normally protected for seven days |

Periods use the local calendar captured with the version; changing the evaluator's timezone must not reinterpret history. Gaps in backup activity do not consume empty tier slots. A newly committed version may temporarily make physical files exceed these retained-history limits until safe maintenance finishes.

Cleanup first proves history completeness and retained-object reachability under current repository protection. Unknown history blocks deletion. A known unreadable checkpoint is preserved and prevents unsafe object reclamation; explicit user removal follows fresh verification. Grace, leases, cancellation and bounded units remain mandatory. [Background operations](BACKGROUND-OPERATIONS.md) owns retry and settlement behavior.

## Verification and limits

Relevant suites cover capture safety, publication/checkpoint, incremental preparation, restore/assets, shared-base sync, provider recovery, integrity continuation, export/encryption and backup history UI. Use [verification](VERIFICATION.md) to select exact tests; [execution records](../TS-CONVERSION-EXECUTION.md) say what actually ran. Prior export timing measurements and old release-step checkmarks are in [history](history/PRODUCT-DEVELOPMENT.md), not current performance guarantees.
