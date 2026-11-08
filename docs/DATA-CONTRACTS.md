# Data contracts and preservation rules

This document owns the app's data-authority and preservation model. Executable identities in [canonical-identities](../contracts/canonical-identities.mjs), [data-architecture](../contracts/data-architecture.mjs) and [production-limits](../contracts/production-limits.mjs) are the source of truth; codecs enforce their accepted values at runtime. TypeScript interfaces do not validate stored JSON or prove a write committed.

## Current canonical topology

After production intake `2638619`, IndexedDB remains version **9** with six stores:

| Store | Key | Record schema | Authority |
| --- | --- | --- | --- |
| `dailyRecords` | `date` | DailyRecord v16 | Canonical Saved Day/Diary content |
| `dailySummaries` | `date` | DailySummary v5 | Rebuildable daily projection |
| `notes` | `key` | Note v3 | Permanent note ID, title/text and optional links |
| `activeSessions` | `id` | ActiveSession v10 | Current portable session and execution evidence |
| `appMeta` | `key` | AppMeta v1 envelope | Heterogeneous canonical, recovery, derived and operational families |
| `assets` | `assetId` | Attachment v2 | Attachment metadata; bytes live in OPFS |

`appMeta` names are stable; individual values have family-specific versions. Do not treat the whole store as disposable metadata. Plans/preferences, deletion ledgers, kept reviews, journals, leases and diagnostic progress have different authority and retention rules. `contracts/data-architecture.mjs` classifies these families; `record-codecs.ts` and `host-metadata.ts` validate them.

Current standalone backup metadata is v24 inside the `SDBK10` binary container; encrypted backup framing is v2 (`SDENC02`); attachment archive framing is v1 (`SDAT01`). Managed repository checkpoint manifests are v9, validated in `managed-repository.ts`. Container framing versions and domain schema versions are different concepts. Do not infer historical-format support from a magic string or a field named `older` in diagnostics.

PendingReview is v2 (including `keptFrom` and `keptChangedAt`), Active Session ownership claims are v4, reconciliation headers are v5 with day rows v2/update specs v4, and restore-journal payloads are v6. The [current format ledger](../contracts/format-ledger.mjs) contains one supported set of formats. [Storage operations](areas/data-and-storage.md) describes their use.

## Canonical-only support and unsupported input

The owner assumes the prior canonical upgrade finished on every supported installation. Its existence was verified during preparation; this is a support assumption, not migration telemetry. Historical topology/record/backup converters are retired. Fresh store creation and **current** journal/recovery replay remain active.

Startup identifies unreadable/newer/unknown records before hydration. Protected data is held rather than rewritten or silently deleted. Strict readers distinguish valid absence from unavailable or unsupported input; cleanup and synchronization must not reinterpret held data as deletion. Current operational families may have explicit replaceable-state policies: use the executable classification, not a blanket rule about all metadata.

An older unsupported topology is refused without migration. A newer database is not downgraded; it is used only through supported stores/keys, and incompatible topology blocks the profile. A newer profile registry is read without rewriting its unknown schema. Current-format validation and explicit unsupported-input rejection are required even after the migration code is gone.

## Profiles, identity and derived state

The early profile-scope script runs before storage consumers. Profile scoping covers IndexedDB, browser-storage keys, OPFS directories, locks/channels and backup locations. The device profile list, installation identity, install notice and update check have explicit device-wide identities. The first profile's empty scope is a current naming choice, not permission to reintroduce legacy topology bridges.

A note's stored `key` is a permanent ID; `label` is its title/path. Rename/move changes title, not identity. Deleted-note prefixes and explicit deletion ledgers preserve identity through trash and recovery. Titles link Areas to notes; other references use IDs. [Notes](NOTES.md) owns feature behavior.

Summaries, search indexes, display state and background caches are projections. They may be regenerated only from complete authoritative inputs. Canonical mutation epochs/revisions fence captures, concurrent saves and incremental preparation; never substitute timestamps or cached UI for the required transaction checks.

## Recovery and deletion invariants

1. **Unknown is not empty.** A failed read, mixed rescue/error result or incomplete inventory cannot authorize deletion, clean status or publication of a supposedly complete snapshot.
2. **Deletion is explicit.** Absence is not a tombstone. Note/day/attachment deletion ledgers travel through backup and reconciliation under canonical limits. Overflow/rejection/pruning must follow the owning codec/repository, not an ad hoc caller.
3. **Preserve acknowledged and newer work.** Save lanes, ownership tokens, mutation coordination and expected-revision checks prevent stale completion/replay from overwriting current edits or clearing newer requests.
4. **Journal before destructive mutation.** Library clear and restore require the complete affected rollback scope. Verify restoration before retiring a journal; retain it and fail closed if read-back is unavailable.
5. **Require complete references before reclaiming bytes.** Attachment cleanup includes current notes, trash, sessions, days and relevant recovery/journal references. Reader/writer leases and source fences remain necessary after a scan.
6. **Capture authority is explicit.** Full managed checkpoints require successful settlement and canonical ledgers. A labelled rescue export does not acquire complete-capture authority. A note-only repository read cannot authorize whole-app replacement or unrelated deletion.
7. **Verified bytes are not validated domain data.** Check size/digest/framing/provenance and then canonical payloads. Cleanup retention proofs cannot be restored as full manifests.
8. **Local completion is not external completion.** A committed restore may leave backup convergence pending. A started download differs from a native file save verified by read-back.

Recovery copies live in the same browser and share its failure boundary. The current local rescue budget is 4 MiB, prioritized across session recovery, notes, deletion recovery and fallback Saved Days; exact ceilings are in production limits. Browser eviction, deliberate data clearing, crashes and unavailable native I/O invalidate any claim of guaranteed lossless recovery or a fixed maximum loss window.

## Backup security and operational state

Backup encryption uses authenticated AES-GCM framing and the current password-derived-key protocol. The password text is not stored. `exports.ts:createProtection` stores a verifier and a **non-extractable derived CryptoKey** in the profile's protection metadata. The host permits automatic reuse with one profile; multiple profiles require an unlock prompt, and cancelling it leaves encrypted backup/sync waiting. This protects backup contents, not live browser storage or an already-compromised device/browser profile.

Drive authorization uses the limited `drive.file` scope. Its access token is retained in memory and profile-scoped localStorage until expiry, disconnect or rejection; no Google password or refresh token is requested. Metadata/names/sizes can remain visible even for encrypted backup content. Keep the served [privacy](../source/legal/privacy.html) and [security](../source/legal/security.html) descriptions aligned with source.

Pending requests, repository generation, maintenance identity and integrity progress are device-local coordination facts. A completion may retire only the exact serviced request. Lost authorization pauses access while retaining appropriate intent. Verification dates record past observations; they do not prove present availability or integrity.

## Changing a data contract

Inspect all writers, readers, exports, restore/journal paths, workers, projections and cleanup consumers before a shape change. Update executable contracts/types/validators together and add focused positive, malformed-input and interrupted-operation tests as needed. A TypeScript conversion must not silently add a schema migration or change durable identity. Record any deliberate policy change in the [decision register](typescript/DECISIONS.md) and the active worklog.
