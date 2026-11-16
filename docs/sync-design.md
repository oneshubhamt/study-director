# Sync engine design

Status: a design for the owner's review, agreed in conversation on 13–16 November 2026. No code exists yet. This branch (`Sync`) will hold the full build; nothing moves to it until it is finished and proven. The rest of `docs/` describes the shipping app and is left as it is.

The engine serves two apps: Study Director, and Practice Director (a second app by the same owner; its requirements document, "What Practice Director needs from the new sync engine", 15 Nov 2026, is folded in here — appendix A maps its 17 needs to sections).

## 1. What this is

Today one mechanism, the repository version, does two jobs: it is the backup, and it is how devices sync. Syncing by whole versions is why devices take turns (markers, renewals, refusals, cleanup coordination) and why taking in a change runs a full restore (rebuild, compare the whole library, safety copy, rollback journal). This design splits the jobs:

- **Sync** moves through small per-device files that each device overwrites in place. One request to send, one to check.
- **Backup and Version History** keep today's repository: immutable, verified, content-addressed versions, with today's retention.
- **Files** (attachments, clips, PDFs) keep the repository's content-addressed pieces, and gain resume across reloads and a per-kind fetch policy.

The engine is generic: it is given a table of kinds by the app and has no built-in knowledge of either app's data. Study Director's session, hand-off, note merging and review queue are separate modules that Practice Director does not load.

## 2. Decisions already made (owner)

- One device runs the timer; everything else syncs live. Hand-off stays explicit (Continue Here).
- Continue Here starts the timer once Drive confirms one small write.
- Version History keeps today's shape: 25 recovery points overall (15 ordinary + up to 10 hourly) plus one safety version per device, written on the 20-minute rule and at Finish Today / Save Today.
- Session changes are sent at once; other changes about a minute after editing stops.
- Change files are overwritten in place (the owner's idea), not an append-only log.
- A CRDT for note text is noted for later; note merging stays Smart merge with a true ancestor.
- No old-format readers in the new code. The owner exports one backup file (current format v24) from today's app and imports it as the first version; the v24 file reader is the one reader carried over.
- Local-first, no server, Drive scope `drive.file`, the ~1-hour sign-in accepted, Device Folder is this device's own copy and never a second sync channel.
- Clean, lean code: no duplicated or dead logic, each module separable.

## 3. What stays from today, unchanged

- The retention table: Latest, 6 Daily, 4 Weekly, 4 Monthly, spare slots widest-gap-first, up to 10 Hourly where notes changed, one protected safety version per device for 7 days (now supplied to the engine as configuration, §8).
- The merge decisions: one side changed → taken; both changed → the kind's rule; timestamps never decide a Study Director conflict, they only order what shows until review.
- The deletion principle: absence never means deletion; only a deletion record deletes.
- The portable backup file (export, verify, import) and its worker.
- The day starts at 04:00; Area names are shared vocabulary (Study Director already owns both).
- Backups encrypted when a password is set — extended to the sync files (§17).

## 4. Drive layout

Each app has its own folder, found by appProperties markers (never by name), carrying the app id, library id and profile id. Each device writes only its own files; each app writes only inside its own folder. Nothing is ever edited by a device that did not write it, so there are no turns, upload markers, renewals or refusals.

```
Study Director – Ana/            (appProperties: app, library, profile)
  sync/
    <device>.changes             overwritten in place: records changed recently
    <device>.session             overwritten in place: the session and its claim (Study Director only)
  versions/
    <checkpointId>.manifest      immutable
    <checkpointId>.commit        immutable
  objects/
    <objectId>.obj               immutable, content-addressed: shard packs, month packs, file pieces
  studydirector.exchange         overwritten in place: the cross-app bulletin (§13)

Practice Director – Ana/
  sync/  versions/  objects/     same shapes, that app's kinds
  practicedirector.exchange
```

| File | Mutability | Written by | Read by |
|---|---|---|---|
| `sync/*` | Overwritten in place | Its device | Every device |
| `versions/*`, `objects/*` | Immutable | Any device | Every device |
| `*.exchange` | Overwritten in place | Its app | The other app |

Every overwritten file carries a SHA-256 of its content in appProperties; a reader that gets bytes not matching it re-reads (a torn read, §16). Immutable files carry the digest too, as today.

## 5. The engine and the table of kinds

An app constructs the engine with a configuration object; the engine learns everything about the app's data from it.

```js
createSyncEngine({
  app: {id: 'study-director', folderLabel: name => `Study Director – ${name}`},
  storage,            // the app's database port (§14)
  kinds: [...],       // the table below
  fileKinds: [...],   // §9
  retention: {...},   // §8
  timing: {...},      // §15
  locations: [...],   // Drive, Device Folder, OPFS adapters (§8)
  modules: [...]      // session, notesMerge, review, exchange — only what the app loads
})
```

Each kind in the table:

| Field | What it says | Example |
|---|---|---|
| `name`, `version` | The kind and its record format version | `note`, 1 |
| `key(record)` | The record's stable key | a note id; `YYYY-MM-DD` for a day |
| `codec` | encode / decode / validate the payload | |
| `fingerprint(record)` | Content fingerprint, for the no-duplicate-version rule and cross-checks | |
| `shard` | How the kind is cut into repository packs: `{mode:'hash', scale}` (count grows with the library, §8), `{mode:'month', from(key)}`, or `{mode:'single'}` | days and facts by month; notes by hash; the session single |
| `conflict` | What happens when both devices changed one record: `'laterWins'`, `'review'`, or a function `(local, incoming, context) → {take | keep | review}` | notes use the Smart-merge function; Practice Director kinds use `'laterWins'` |
| `deletions` | Whether the kind uses tombstones, and the bounded count kept | notes, days, files: yes |
| `send` | `'immediate'` or `'settle'` (about a minute after editing stops) | session: immediate |

A kind with `conflict: 'laterWins'` never enters the review queue: the change-counter vectors still detect that both sides changed (§6); the later change time, then the device id, breaks the tie deterministically. This is Practice Director's rule for every one of its kinds; Study Director keeps `'review'` (or its custom functions) exactly as today, where timestamps never decide.

**Study Director's table (summary):** `settings` (per item, review), `planDraft` (one record, review), `savedPlan` (per plan, review), `note` (Smart merge then review), `savedDay` (per day, month shards, review), `activeSession` (single, the session rule in §10), `pendingReview` (per record, resolved-wins merge as today), `attachment` entries (laterWins on the entry; content by pieces).

**Practice Director's table (from its document):** `record` kinds (settings, exam dates, ticked topics, marking points, lessons — laterWins), `fact` (write-once, month shards, laterWins on correction), `file` entries (clips eager, PDFs on-open). No session, no review, no note merge.

## 6. Change tracking and merging

**Counters.** Each device keeps one change counter per app, persisted in the database and increased per save batch. Every synced record carries a small vector: the counter value of each device whose edits it includes, e.g. `{laptop: 7, phone: 3}`. Editing a record sets its own entry to the device's next counter and keeps the others. With two or three devices per library the vector is a few entries; entries for a device removed or dead 30 days are dropped the next time the record is edited.

**Dominance.** When a record arrives: if its vector includes everything the local copy's does, it is taken; if the local vector includes everything the incoming one does, it is ignored; if neither, both devices changed it and the kind's `conflict` rule applies. This is the "true ancestor" merge: detection is exact, never guessed from clocks.

**Tombstones.** A deletion is a record whose value is a tombstone, carrying the same vector. It merges by the same rules, so a deletion travels, and an edit concurrent with a deletion is a conflict for the kind's rule (Study Director's notes: the note stays, review offers the deletion — as today). Tombstones are bounded per kind as today's ledgers are; a device offline past the bound may see the oldest deleted items return, as today.

**The to-send list.** Every save writes its change record to a to-send list *in the same database transaction* (§14), so a saved change cannot be missed. "Synced" means: the to-send list is empty, and every other device's sync files are applied. The 20-minute version remains a whole-library cross-check: manifests carry logical fingerprints, so two devices can detect a divergence that sync somehow missed.

**Invariant.** A record may leave a device's changes file only once a committed, verified version's vector covers it (§7–8). The newest version's vector only grows, so **Latest always covers everything that has ever left any changes file**: a device syncs completely by reading Latest plus the sync files, however long it was away.

**Counter regression.** If Drive holds this device's own changes file with a counter higher than the device's local counter, this device's storage was rolled back (an OS restore, a cleared database). It then takes a fresh device id, re-syncs as an away device, and never reuses the old counter line. This closes the one way a counter vector can lie.

## 7. Sync files

**The changes file** (`<device>.changes`) is overwritten in place and holds the *current value* of each record this device changed recently — a theme switched ten times appears once. "Recently" means: records whose own-device counter is above the vector of the newest committed version that covers them (in practice, roughly the last two version windows, ~40 minutes of editing). Older records live in the repository. There is no log and nothing to prune.

```json
{"format": "sync-changes", "version": 1, "app": "study-director",
 "device": "inst_phone_chrome_…", "counter": 412, "writtenAt": "…",
 "records": [
   {"kind": "note", "key": "n_…", "rev": {"inst_phone…": 412, "inst_laptop…": 365},
    "value": {…}},
   {"kind": "savedDay", "key": "2026-11-15", "rev": {"inst_phone…": 410}, "value": {…}},
   {"kind": "attachment", "key": "att_…", "rev": {…}, "tombstone": true}
 ]}
```

**The session file** (`<device>.session`, Study Director only) holds this device's current copy of today's session and the ownership claim (§10). Immediate sends to one file are coalesced to at most one write every few seconds (Drive throttles frequent updates to a single file — a real-Drive check, §20); a pause followed within the window by a resume collapses into the final state, which is correct because the file holds state, not events.

**Receiving** is one `files.list` of the app's `sync/` folder (names, digests, modified times): one request tells whether anything changed; only changed files are downloaded, each a few KB. Cadence: every 10 s while a session is open on a visible screen (Study Director); otherwise on opening the app, on returning to it, and every 20 minutes — today's rhythm, and Practice Director's "no polling" need.

**Applying** a batch is one database transaction: each incoming record is decided by §6, and the records, the review entries and the applied-vector bookkeeping are written together, completely or not at all. No safety copy, no rollback journal: nothing is replaced wholesale. The journalled safety copy remains only for Restore / Replace / Combine of a chosen version, as today.

## 8. Versions (backup and Version History)

The repository mechanism is kept: checkpoint manifests, commit markers, immutable content-addressed objects, verification before a version is accepted, incremental preparation (only changed units are written), shard packs for small records, and the no-duplicate rule (a device writes no new version when the newest already holds the same logical state).

Changes against today:

- **A manifest records the vector it covers** (per device), which is what lets changes files shrink (§6) and lets an away device know exactly what Latest already contains.
- **No publication markers, turns or leases.** Two devices may publish versions concurrently; both land; both are valid restore points; retention prunes. A manifest's commit still re-verifies that every object it references is listed (so a concurrent cleanup cannot have removed one), and unreferenced objects keep today's 48-hour grace before deletion.
- **Retention is configuration**, not constants: an ordered list of tiers `[{period, slots, onlyIf?}…]` plus the per-device protected rule. Study Director supplies today's exact table (§3). Practice Director supplies its own: latest, one a day for a week, one a week for a month, one before anything large.
- **One history, 25 overall** (Study Director's setting). Every device computes the same retained set from the same listing. **A device deletes only files it wrote itself**; a version that fell out of retention but was written by a device not currently open stays on Drive, hidden from Version History, until that device next opens — except that any device may delete the files of a device unseen for 30 days (adoption). No cleanup markers, no coordination.
- **Sharding scales.** Hash shards grow with the library (e.g. ~64 records per shard, count a power of two), so one changed note re-sends one small pack, not a quarter of all notes. Month shards (`savedDay`, Practice Director's facts) mean a finished month is never re-sent.
- **Locations are adapters** with today's interface (list, download, upload, delete, ranged read): Google Drive, the Device Folder, and a third, OPFS "On this device", for an owner with neither connected (Practice Director's need: the last three daily versions). An OPFS location does not survive the loss of the site's storage; it protects against mistakes, not against storage loss, and the app says so.
- **Version History UI, single-note earlier versions, restore scopes, the integrity scrub and the protected safety version** keep their behaviour; they read the one shared history as today.

## 9. Files (attachments, clips, PDFs)

File content is stored as fixed-size content-addressed pieces (2 MiB) in `objects/`, named by fingerprint; a file's entry record lists its pieces and the whole-file hash. Only missing pieces move; every piece is verified on arrival.

- **Resume across reloads.** Uploaded pieces are discovered by listing (they are content-addressed), so an interrupted upload continues from what is already there after a reload or on another day, with no sensitive session state persisted. Downloads resume the same way from pieces cached in OPFS.
- **Per-kind fetch policy**: `eager` (fetch when the entry arrives) or `onOpen` (fetch when the person opens it). Study Director's attachments stay effectively today's behaviour; Practice Director sets clips eager and PDFs on-open.
- **Droppable**: a kind may allow dropping the local copy of a file that Drive verifiably holds (digest re-checked against the listing at drop time). The entry stays; reopening fetches.
- **On the other device** the entry appears with the next sync (seconds); content follows as pieces complete, shown as still arriving until whole and verified.
- Garbage collection: a piece is removable when no kept version and no live entry references it, under the delete-own/adoption rule and the 48-hour grace (§8).

## 10. Session and hand-off (Study Director module)

The session is one record; the session file carries it with the ownership claim (`runningOn`, claim vector, claimedAt). The timer is stored as "running since T", so a running timer causes no writes; the other device computes elapsed time.

- **Continue Here** on a device that is following along (it already has the session from the 10-second checks) is **one write**: it writes its session file with a claim whose vector includes the old owner's current session. The timer starts when Drive confirms that write — if the write never lands, the other device would never learn and both would run; one confirmed request removes that case. Estimate: 1–4 s on the phone, under a second on the laptop (to be measured). A device opened cold first reads the sync files (one listing plus small downloads), which runs while the person answers "Continue here?".
- **Letting go.** The old owner sees the claim at its next 10-second check, stops and holds its clock at that moment, writes its final session state to its own session file (one write — nothing to wait turns for), and the new owner's next check merges it by the session decision rule (§3, unchanged: time alone is never a review; a copy holding every decision of the other, and more, is taken in).
- **Two claims at the same moment**: neither vector includes the other; the tie is deterministic on every device — later claimedAt, then device id — so all devices, both claimants included, settle on the same owner within one check.
- **Cost**: the 10-second check stays one request (the `sync/` listing, §7); it now also carries ordinary changes, so the separate notions of claim check and new-version check disappear.

## 11. Notes (Study Director module)

For each note the engine keeps the base text: the note as it stood before this device's unsent edits (updated whenever the note's record is sent or an incoming one is taken). When both devices changed a note and the other device's edit started from this same base, Smart merge (`mergeThreeWay`, only when `safe`) joins them with the true ancestor; otherwise the note is kept for review with both texts and the base, exactly today's review. A merge made on one device carries a vector including both sides, so the others simply take it. The record format reserves room for a per-note CRDT body later (noted for later, owner); nothing in the first build depends on it.

## 12. Review queue (module)

Kept-for-review records work as today: they are synced records themselves (resolved wins every merge, two identical opens merge into one, bounded at 2000, images they reference are kept). The queue is a module; an app whose kinds all say `laterWins` (Practice Director) does not load it, and the engine enforces that a kind without the module cannot declare `conflict: 'review'`.

## 13. Two apps (exchange module)

Each app lives in its own folder and syncs only its own data. The owner wants three links (a finished study block ticks a topic; practice time offered to the day's plan; a topic opens the note of the same name), served by two bulletin files on the changes-file principle — each app overwrites only its own; the other only reads:

| File | Written by | Holds |
|---|---|---|
| `practicedirector.exchange` | Practice Director | Practice minutes due today, recall load for 14 days, exam dates, paper slots, topic names |
| `studydirector.exchange` | Study Director | Study blocks finished in the last few days (Area, date, minutes), note titles |

This requires that both apps, as two origins with two OAuth clients **in one Google Cloud project**, see each other's `drive.file` files. That is expected (the scope is per project, not per client) but unverified — real-Drive check §20. If the check fails, the exchange module is deferred; nothing else in the design depends on it.

## 14. Local anatomy

**The app owns the database and the write.** The engine never opens a database of its own. The app passes a storage port exposing the engine's stores (to-send list, counters, applied vectors, note base texts, repository bookkeeping) inside the app's own transactions, and calls `changes.record(tx, kind, key)` from within the very transaction that saves the record. Study Director keeps `persistence.js`, profiles and upgrades; Practice Director implements the same small port over its own store. This is the answer to "who owns the database write": the app does; the engine joins its transaction.

**Outside the database**, the engine keeps one small recovery marker per app in localStorage: data existed here, the library id, the device id, the counters at the last good write. A start that finds a fresh database but a marker behaves as Study Director's clear-detector does today: it never uploads the empty state, and once Drive is connected it pulls Latest plus the sync files by itself (the §6 invariant makes that a complete recovery). This generalises the existing behaviour and is Practice Director's need 13.

## 15. When things move

| What | When |
|---|---|
| Session changes sent | At once (coalesced to one file write every few seconds) |
| Other changes sent | ~1 minute after editing stops; at once on going to background and before an update applies |
| Changes received | Every 10 s with a session open and visible; else on open, on return, every 20 min |
| A version written | 20 min after the first change it does not hold; at once on Finish Today / Save Today; before any restore (safety) |
| Retention cleanup | After a version commits, by the delete-own rule |
| File pieces | Background, resumable, whenever signed in |

Nothing waits for the network: the to-send list simply waits while signed out or offline, and the app is whole without Drive.

## 16. Failure paths

| Failure | Behaviour |
|---|---|
| Torn read of an overwritten file | Digest in appProperties does not match the bytes: re-read; never applied |
| Write of a sync file fails | The to-send list still holds the records; retried on the next cadence |
| App killed mid-apply | The batch transaction never committed; nothing half-applied; re-applied next check |
| App killed mid-version | Uncommitted manifest is invisible; objects wait under the 48 h grace; next publication reuses them |
| Two versions published concurrently | Both land and are valid; retention prunes; no coordination existed to break |
| Two Continue Here at once | Deterministic tie (§10); settled on all devices within one check |
| Wrong device clock | Vectors drive everything; clocks only break `laterWins`/claim ties and order display |
| Device restored from an OS backup | Counter regression detected (§6): fresh device id, full resync |
| Database lost, browser storage kept | Recovery marker (§14): no upload of empty state, automatic full pull |
| Whole site storage lost | As a new device: sign in, full pull; deletions older than tombstone bounds may return |
| Drive full / unreachable / signed out | Sync pauses, app carries on; to-send waits |
| A sync file from a newer format | Held, nothing uploaded over the library, "update the app" — today's rule, applied to sync files and manifests alike |

## 17. Encryption

When the library has a password, everything that reaches Drive is encrypted from the first build, sync files included: each changes file, session file, exchange file and object is an independently encrypted AES-GCM blob under the existing key machinery, with the digest in appProperties computed over the ciphertext. (Today only versions reach Drive and they are encrypted; sync files must not weaken that.) Full end-to-end encryption with a sign-in-first experience, and keyed object ids that do not leak content equality, remain the later, separate decision already noted in the backlog.

## 18. Migration (Study Director)

A clean cut, not incremental:

1. The owner exports one portable backup file (current v24) from today's app and keeps it.
2. The new app starts de novo: a new Drive folder marker (the old folder is left untouched; the owner may delete it by hand later), imports the v24 file as its first version — one version, not many.
3. Every device moves at about the same time, as with any format change.
4. The new code reads no old formats; the v24 backup-file reader is the single carried-over reader, and today's export machinery is not being changed.

## 19. Modules and size

| Module | Serves | Budget (lines, target not promise) |
|---|---|---|
| Core: kinds, counters, vectors, merge, to-send, sync files | Both apps | ~2,000 |
| Drive adapter (auth, folder, list/upload/download/delete, ranged reads) | Both | ~1,200 |
| Repository: versions, retention, GC, verification | Both | ~2,500 |
| Files: pieces, resume, fetch policy, drop | Both | ~1,200 |
| Device Folder adapter · OPFS location | Both (optional) | ~800 |
| Session + hand-off | Study Director | ~600 |
| Notes merge (base text + Smart merge bridge) | Study Director | ~300 |
| Review queue | Study Director | ~500 |
| Exchange | Both (optional) | ~200 |
| Recovery marker | Both | ~150 |

Practice Director carries core + Drive + repository + files (+ exchange): roughly 8–9 k lines against today's ~30 k-line backup source — and none of the session, review or note code is loaded or running there. The engine is plain TypeScript-consumable ES modules with no dependence on Study Director's module registry or `app.html`.

## 20. To verify on real Google Drive, before code is committed to

1. **Atomic overwrite**: a reader never gets a half-overwritten sync file (the digest guard covers it regardless; this check decides how often re-reads happen).
2. **Per-file update rate**: how often one file can be overwritten before Drive throttles (sets the session-file coalescing window).
3. **One Google Cloud project, two origins/clients**: files created by one app are visible to the other under `drive.file` (gates the exchange module only).
4. **Listing freshness**: how quickly a new file or new revision appears in `files.list` (sets expectations for the 10-second check).

## 21. Tests

The merge layer decides what happens to the owner's data, so it is tested exhaustively; everything else follows today's layers.

- **Unit, the merge matrix**: every kind × every conflict rule × two and three devices × every order of arrival, including tombstone/edit races, counter regression, and vector pruning. Deterministic, no browser.
- **Unit**: retention as configuration (both apps' tables), shard scaling, the §6 invariant (Latest covers every record that left a changes file) as a property test over random edit schedules.
- **Integration, simulated Drive**: sync files end to end, torn reads, concurrent publications, delete-own cleanup, adoption, 48 h grace, file-piece resume, recovery marker.
- **Browser journeys** (two and three devices, today's harness): live edits both ways, hand-off under every timing (claim races, offline, killed mid-apply), notes both-changed with and without a shared base, a database removed while closed, migration import.
- **Real devices**: hand-off speed on the phone, the §20 checks.

## 22. Build order

1. Core merge layer + sync files against simulated Drive, with the merge matrix.
2. Repository (versions, retention-as-config, delete-own cleanup) and the Drive adapter.
3. Files with resume and fetch policy.
4. Session + hand-off; then notes merge and the review queue.
5. Recovery marker; migration import; encrypted-with-password payloads.
6. Exchange module, after check §20.3 passes.
7. Study Director wired on, full journey suite, real-device measurements; only then the owner decides the move.

## Appendix A: Practice Director's needs

| # | Need | Where | Status |
|---|---|---|---|
| 1 | No built-in app knowledge; table of kinds | §5 | Adopted |
| 2 | Importable TS modules | §19 | Adopted |
| 3 | Who owns the DB write | §14 | Decided: the app; engine joins its transaction |
| 4 | Own Drive folder per app | §4 | Met |
| 5 | Unused parts cost nothing | §5, §19 | Adopted: modules |
| 6 | Month shards for facts | §5, §8 | Met via the kind table |
| 7 | laterWins, opt out of review | §5, §12 | Adopted |
| 8 | Fetch on open; drop verified local copies | §9 | Adopted (drop only after digest re-check) |
| 9 | Deletion records for any kind | §6 | Met: tombstones are generic |
| 10 | Sync without a session, no polling | §7 | Met |
| 11 | Whole without Drive | §15 | Met |
| 12 | Retention as app settings | §8 | Adopted |
| 13 | Lost-storage marker and self-recovery | §14 | Met (generalised from Study Director) |
| 14 | On-device version location | §8 | Adopted, with the stated caveat |
| 15 | One Google project, both origins | §13, §20 | To verify; exchange gated on it |
| 16 | Two exchange files | §13 | Adopted |
| 17 | 04:00 day, shared Area names | §3 | Met; app-level, nothing to build |

None refused. The caveats: 8 (a drop requires a verified remote copy), 14 (OPFS versions do not survive site-storage loss), 15 (cannot be promised until checked; only the exchange depends on it).

## Appendix B: Practice Director's six questions

| # | Question | Answer |
|---|---|---|
| 1 | Who owns the database write? | The app. The engine never opens its own database; it joins the app's transaction through a storage port, and `changes.record(tx, kind, key)` is called inside the save (§14). |
| 2 | Can an app choose how a kind is cut into shards, including by month? | Yes: each kind declares `shard` as `hash` (count grows with the library), `month`, or `single` (§5, §8). |
| 3 | Can a kind of file be fetched only when opened? | Yes: per file kind, `eager` or `onOpen`, and a verified local copy may be dropped (§9). |
| 4 | Can a kind opt out of review, with "later wins"? | Yes: `conflict: 'laterWins'`. Vectors still detect both-changed; the later change, then the device id, breaks the tie. Without the review module, no kind may declare `'review'` (§5, §12). |
| 5 | Do two web addresses under one Google project see each other's files? | Expected under `drive.file`, which is granted per project, but not yet verified. It is check 3 in §20; only the exchange module depends on it (§13). |
| 6 | How much code does an app carry with no session, attachments or encryption? | Core, Drive adapter and repository: roughly 5–6 k lines (target, §19). Session, review and note merging are separate modules, neither loaded nor running. Files and encryption are separate too. |
