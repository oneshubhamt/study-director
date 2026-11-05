# Local data durability — retained risk register

This summary retains the safety boundaries from the BF-C7.4 source audit of 2026-11-05. The [original detailed audit](https://github.com/oneshubhamt/study-director/blob/788a548e335e5f6ca83334efc1b0f1c76ea3059c/docs/BF-C7.4-STORAGE-DURABILITY-AUDIT.md) is preserved in Git history. This is **not a new implementation programme**, and it does not certify physical-device durability. See [Data and storage](areas/data-and-storage.md) for the current contract and [Backlog](backlog.md#not-yet-checked) for unperformed acceptance.

## Failure boundary by domain

| Data | Canonical mechanism | What it does not guarantee |
| --- | --- | --- |
| Ongoing Notes | Shared save lane (~250 ms coalescing); strict IndexedDB transaction for canonical note/deletion data | Hard kill before first commit can lose recent edits. LocalStorage rescue is created on failed write/page exit, **not every keystroke**. |
| Plan working draft | Routine ~300-ms debounce; explicit Apply/Done/Cancel use strict writes and authoring-epoch checks | Uncommitted draft edits can be lost. Displaying an untouched default does not make it a durable authored draft. |
| Active Session and current Review | Snapshot plus periodic/default commits; strict critical handoff, suspension and acknowledgement | Volatile timer/Review edits may be newer than last commit. Rescue-only copy cannot prove execution ownership. |
| Saved Days/Diary | Strict canonical IndexedDB write, exact read-back and deletion-recovery protection | Fallback browser rescue does not authorize a Saved Day success acknowledgement. |
| Personal Data, PendingReview and journals | Strict transaction for portable Plans+preferences, verified review tombstones and retained recovery journals | Aborted writes are not receipts; never delete an uncertain journal to conceal a fault. |
| Attachments | OPFS staged bytes with digest/read-back, followed by strict metadata commit; orphan cleanup | OPFS and IndexedDB cannot share one physical atomic transaction; later disk corruption needs backup recovery. |
| Backups | Managed immutable objects, verified manifests/commits, protected Before-restore checkpoints and independent destination histories | Connection or scheduled work does not equal verified publication; browser-downloaded files cannot automatically be read back after download. |
| Persistent-storage API | Browser persistence request and selective IndexedDB `{durability:'strict'}` with unsupported-browser diagnostics | Does not survive site-data clear, origin/profile/device loss or physical media failure. Strict mode is not a universal fsync guarantee. |

## Rescue and independent backups

Browser rescue is bounded to **4 MiB** combined (`localRescueBytes`), with Note rescue capped at **1 MiB** and fallback Saved Days at **3 MiB**. These are cushions, not full histories; full/inaccessible rescue requires an explicit warning. IndexedDB, OPFS and localStorage share the same origin-loss domain.

A separately verified Drive copy, Device Folder on a genuinely independent failure domain or external standalone backup is necessary for total origin/device loss. Restoring it in a disposable profile is better evidence than a backup timestamp. Current managed retention is **15 ordinary**, up to **10 hourly** and bounded protected-safety copies. Older A/B rotation and independent Reflection Draft stores are obsolete.

## Evidence and unresolved acceptance

The 2026-11-05 audit's failure injection passed [Repository Checks 42004706366](https://github.com/oneshubhamt/study-director/actions/runs/42004706366): 157 fast-suite files plus build/deployment. It checked aborted strict IndexedDB transactions, rescue-only acknowledgement, OPFS hash/staging failures, failed metadata commits and interrupted restore journals. Later branch corrections passed [Repository Checks 42057139422](https://github.com/oneshubhamt/study-director/actions/runs/42057139422).

**Not performed:** actual Safari/macOS, iOS/Android quota, site-data clear, sudden process termination, device loss, physical flush or bit corruption, or byte-for-byte real-provider reconstruction. Use disposable profiles and independent verified backups for those checks; never risk the owner's actual study library.

**Open decision:** Reducing the latest-keystroke crash window requires measurement of write amplification, privacy, rescue capacity and reliability. No blanket strict-write requirement, CRDT, new journal or storage topology is justified by the recorded source evidence alone.
