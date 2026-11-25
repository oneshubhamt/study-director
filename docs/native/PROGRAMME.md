# Tauri native programme — scope and acceptance

**Authority:** owner-authorized experimental work on `tauri-spike` only. Read [AGENTS](../../AGENTS.md), [native architecture](../areas/native-platform.md), [execution register](../../TAURI-EXECUTION.md) and affected area/test docs. Pinned JavaScript F33 baseline: `d69f2053629a7e24d106a969f0d69eac65b4996b` (tree `7ae2c068f2964f8e1eac58536e885ab14532eff4`). Read-only TS discipline comparator: `e7ade70c22718d7e56e0b333ee889e0561dde3ab`. Do not import TS conversion machinery or rewrite the UI in Dioxus.

## Outcome register

The roadmap is not a mandatory number of chat sessions. Complete each coherent end-to-end outcome, including owners, callers, UI composition and failure paths; combine or subdivide checkpoints with stated dependency reasons without losing gates. **OPEN** = not qualified; **PARTIAL** = some outcomes verified; **VERIFIED — TARGETED** = every pass outcome and required witness passed, not full certification; **AUDITED — CERTIFIED** = overall independent review/full gate passed. Later adverse required results reopen a pass. Current evidence resides in the execution register.

| ID | Outcome | Dependency / status |
|---|---|---|
| P0 | Baseline, threat/data/platform inventory, qualification environment | Partial: source census, historical CI; independent baseline reproduction open |
| P1.A | Packaged shell and platform boundary | VERIFIED — TARGETED; five fresh Windows samples passed |
| P1.B | Native Drive auth and transport, same managed library | Active; intake and implementation |
| P1.C | Native Device Folder, same repository protocol | After A; open |
| P1.D | Native OS/lifecycle and file/media affordances | After A; integrate B/C; open |
| P1.E | Signed independent native updater and settlement | After D; open |
| P1.F | Windows packaging/security | After B–E; open |
| P1.G | Full Phase 1 qualification and review | After A–F; open |
| P2.A | Rust domain/SQLite transactions, IPC and fixtures | After G; open |
| P2.B | Bounded non-authoritative differential verification | After P2.A; open |
| P2.C | Domain authority transfer and interruption recovery | After B; open |
| P2.D | Content-addressed native attachments and scratch | After C foundations; open |
| P2.E | Rust managed repository, canonical protocol | After C/D; open |
| P2.F | Rust sync/network/background coordination | After E; open |
| P2.G | Mixed PWA/Windows interoperability and Android feasibility | After E/F; open |
| P2.H | Retire superseded native IDB/OPFS and shadow paths | After G and cutover proof; open |
| P2.I | Full failure-injection and architecture certification | After A–H; open |

## Invariants and execution

- PWA remains first-class. Same JavaScript UI/domain semantics, immutable platform selection at composition; no user-agent guessing. Phase 1 retains native WebView IDB/OPFS; Phase 2 changes local implementation, not shared model.
- One canonical write owner per domain/profile/operation. No permanent dual write, LWW substitution for causal merge, or stale fallback after cutover. Fence original operation, profile/session generation, authority and attempted canonical revision at asynchronous commits, rollback, cleanup and feedback. Unknown read is not absence. Preserve verified safety checkpoints, journals and successors.
- Portable format authorities: `contracts/canonical-identities.mjs`, `contracts/format-ledger.mjs`, actual codecs/transports. F33 metadata/manifest/claim/personal = 26/11/4/2; DailyRecord/Note/ActiveSession/SessionSnapshot/PendingReview = 16/3/11/6/2; protected manifest 3, commit 1, scope 2. Preserve magic, encryption, IDs, timestamps, content hashes, deletion ledgers, appProperties, immutable repository object/commit/pointer and recovery semantics. Equal version numbers do not prove parity. No historical readers; bounded native P1→P2 cutover is not a second portable protocol.
- Least privilege: no arbitrary SQL/path/shell/HTTP/token IPC; validate caller, command payload, scope, ownership and lifetime; native refresh tokens OS-protected, never JS/logs. Stable app ID/origin/data path. Bound memory, streaming, concurrency and dependency footprint. No external configuration, credentials, release/deployment or production data without explicit approval.
- Audit → analyze → implement → verify each objective against actual source and shipped callers → targeted QA. Document numbered scope, invariants and negative cases before editing; compare affected paths against F33, and inspect relevant TS findings (stale rollback, failed verification, lost/reacquired authority and conditional absence) without blindly porting fixes. Reproduce defects at their actual owner; distinguish source-only, simulated, packaged hosted and physical-device evidence. Record exact SHA/artifact and results; no retry-to-green, assertion weakening, or erasure of adverse results. Full audits at P1.G/P2.I and substantial cumulative changes; no routine planner signoff between passes.

## Dependency and toolchain policy

Use current stable supported versions, reviewed for compatibility and security, never unpinned upgrades. At pass intake compare direct native dependencies, compatible resolved transitive crates, Rust/Cargo and Node LTS against official releases; record relevant advisories and intentional exceptions. Review lockfile changes, origin/checksum/feature and dependency footprint; do not force each transitive crate to its individual newest version. Pin the tested Rust toolchain and Node version for dedicated native QA, retain locked Cargo and npm dependencies. Record installed WebView2 version in actual tests; use supported evergreen runtime, not beta or an arbitrarily fixed older engine. Upgrade in coherent checkpoints and rerun affected qualification, including PWA behavior when shared build tooling changes. No routine changes to other branch workflows or deployment. As of 2026-11-25 Tauri 2.12.7 and tauri-build 2.7.6 are current stable; Rust/Cargo 1.100.0 was verified on the P1.A runner. Node 26.12.1 was the baseline; Node 26.13.1 LTS (2026-11-11 security release) is the next dedicated native QA pin. See [Tauri releases](https://tauri.app/release/tauri/v2.12.7/), [Rust release](https://blog.rust-lang.org/releases/latest/), [Node release](https://nodejs.org/en/blog/release/v26.13.1). Registry checksums are not a vulnerability audit; the full native dependency/security review remains P1.F/G and P2.I.

## Shared check matrix

| Layer | Checks |
|---|---|
| Source and contracts | `node tests/helpers/run-category.mjs targeted <affected-files>`, new sensitive-path regression, actual owner/caller review; Repository checks fast suite |
| Build | Rebuild worker/editor bundles with `node build/wordgard-bundle.mjs --write` if inputs change; `node build/build.mjs`, `node build/verify-build.mjs`, `node tests/architecture/build/deployment-contract.mjs`, generated syntax and affected minified checks; `node build/stage-tauri.mjs`, inventory, hashes, CSP and unaffected web target |
| Rust | Record toolchain, commit lock, fmt check on touched Rust, `cargo test --manifest-path src-tauri/Cargo.toml --locked --features custom-protocol`; `cargo clippy --manifest-path src-tauri/Cargo.toml --locked --features custom-protocol --all-targets -- -D warnings`; `cargo build --manifest-path src-tauri/Cargo.toml --locked --release --features custom-protocol`; dependency/security review |
| Packaged and browser | Actual packaged-origin `node tests/helpers/tauri-smoke.mjs` on disposable Windows runner; relevant existing browser journeys and tiers (see tests/README). New/changed witnesses: five independent clean-profile samples once stable, retain every result. Native repeats use fresh disposable runner/profile, not reused data. Never share load with an `alone` test |
| Transport | Real disposable authorized provider/repository, two-way PWA/native and record/hash/revision proof; simulated ports prerequisite, not actual interoperability |
| Certification | Full promotion QA per workflow docs, native package, update, mixed-client, physical OS/restart/sleep/power-loss, resources and failure matrix at G/I. Hosted Windows is real WebView2 but not physical-device certification |

Read actual test manifests before choosing exact paths. Preserve earlier evidence only when provenance and source/test equivalence are established; never override later failures. Record required skipped/failed/pending checks. Use Git history, not redundant journals.

## P0 — audit and baseline

Owners: app host/module manifest, storage/backup/session/ownership/background, worker/editor, platform APIs, build/format contracts and tests. Freeze SHA/assets, enumerate shipped source→owner→asset, platform assumptions, data identities, filesystem/DB/network/lifecycle/security risks and test map. Establish Windows/disposable environment and reproduce pinned F33 web build, fast and core/offline journeys independently (hosted exact checkout acceptable; do not modify main). Keep missing evidence explicit. Recheck inventory before changing each domain.

## P1 — native host, existing JS data authority

### P1.A — shell and boundary
Owners: build renderer/staging, early host selection, native-capabilities, Rust shell/config, native smoke. Stable isolated ID/origin/path, native shared asset hashes, no GIS/SW/install manifest, CSP/Trusted Types, no remote popup/navigation or broad IPC. Locked build/test/clippy. Actual profile, Notes, Diary/Review, saved/live Plans, Wordgard keyboard, attachment hash and sync OPFS worker, paused timer, strict IDB/OPFS, checkpoint/Combine into isolated second profile, switch-back and exact canonical reads after normal close and kill. Verify offline packaged boot and fonts/workers/editor load, denied capabilities without side effects, invalid platform and PWA core/notes/offline/update regression. Wordgard fixture failures resolved with actual editor input; all five independent fresh samples passed (see native area and execution register). No installer or physical power-loss claim here.

### P1.B — installed-app OAuth and Drive
Owners: external/drive.js, backup/provider/repository and profile/status UI, new native auth/transport. Audit GIS, drive.file, private appProperties and discovery queries; authorized desktop client in appropriate same project and prove existing library visibility before creation. No invented credentials, scope widening or duplicate library. PKCE S256/system browser/ephemeral loopback/state; cancel, timeout, wrong/duplicate callback, wrong account, token expiry/revocation, coalesced refresh, OS-protected credential store, explicit profile binding and local disconnect vs revocation. Narrow authorized Drive operations, bounded streams/retries/cancel, no native tokens in JS. Offline local boot/write unaffected, real first-start and background provider integration; GIS unchanged on web. Hermetic auth/transport plus drive-security and repository journeys; real PWA publishes→native discovers same IDs/appProperties→native reconciles/publishes→PWA reconciles, conflicting edits/deletion/session/attachment hash, 401/403/429/interrupted upload. If project/consent unavailable keep actual interoperability open, no premature creation.

### P1.C — Device Folder
Owners: device-folder-storage/device-backup, repository coordination/recovery, picker UI and Rust path adapter. User-selected root, scope identity, containment/reparse points/links, names, permission/removal; no arbitrary filesystem bridge. Preserve immutable blobs/manifests/commits, expected generation, scope marker, publication/maintenance locks/expiry/renewal, verified durable writes/readback and conflict semantics. Test wrong/missing/unknown scope, failed reads, permission loss, partial inventory, interrupted write/rename, stale owner, concurrent writer, cleanup race, cancel, disk full/removable drive. Actual Windows folder and independent PWA read/write same bytes in both directions, retention/dedup/restore/lock proof. Shared JS engine authoritative.

### P1.D — OS and lifecycle
Owners: platform ports, ownership/session/timer/save lanes, notifications/audio, export/import, attachments/navigation, native window. Useful native notifications and permission fallback, single-instance activation, safe external links in system browser, file picker/save/download, PDF/audio/image/clipboard, accessible keyboard/window. Keep PWA behavior; honest unavailable capability. Separate close/visibility/sleep from reset; settle editors/session/repository under original authority and reservation; refuse unsafe close, recover forced interruption, no timer duplication. Real Windows close/reopen, dirty edits, pending backup/attachment, deny/cancel, second instance, stale callback, unsafe link, actual media/save readback, suspend/resume; physical sleep where necessary. Verify actual adapters.

### P1.E — signed updater
Owners: shared update-preparation and lifecycle reservation, native updater. One settlement contract, web SW unchanged. Signed metadata/binary, authorized channel and expected target/version, verified download, cancel/progress, wrong signature/target/downgrade/stale rejection; release own reservation only. Install/restart only after verified preparation and no intervening edits/authority transfer; preserve data/origin, recover failure. Actual signed disposable update with dirty editor, timer, backup/restore, cancel/offline/timeout, tampered package, install failure and reopen. Keys/channel/config/distribution require explicit approval.

### P1.F — package and security
Owners: Tauri config/capabilities, installer, resources/toolchain/update/OS ports. Stable application ID/path, WebView2 prerequisites, standard-user access, dependency/license/advisory and IPC/CSP/permissions review. Disposable install/upgrade/uninstall/reinstall (document data retention; never silently delete), offline prerequisites, spaces/non-ASCII paths, downgrade and failed install/update. Signing only authorized. Actual installer evidence, not raw executable proof; no release claim.

### P1.G — de-novo Phase 1 certification
Trace all A–F shipped entrypoints, owners, platform boundaries, F33 behavioral/portable parity, security, dead code and failure paths. Full fast/integration/architecture, generated/minified, promotion browser/release QA, actual package and two-way Drive/folder PWA↔native. Multi-profile, conflicting edits/restore/handoff, encryption, large attachments, interrupted cleanup, quota/disk full, committed-but-unverified writes, recovery journal, sleep/OS restart/offline/reconnect, controlled physical power-loss, accessibility and idle resources. Keep inaccessible physical tests open. Exact final head, builds, all evidence/limitations and independent audit handoff before P2 authority work.

## P2 — Rust native authority, unchanged portable protocol

### P2.A — Rust domain and SQLite contract
Owners: canonical codecs/repositories, scope, metadata/deletion/recovery, ownership, IPC. Map every JS read/write/caller, key, revision/time, validation, query ordering, profile, isolation and recovery. Domain operations only, explicit schema/version/transactions, measured WAL/checkpoint/durability and integrity; committed/verified/unknown distinct. Threat model caller/path, corruption/newer schema, process kill/disk full, conditional writes including explicit absence and loss of authority. Canonical F33 fixtures and Rust validation/codec/query/transaction/rollback tests; no migration.

### P2.B — bounded differential verification
Native adapters on copied synthetic data and operation sequences with JS authoritative; native comparison non-authoritative, no conflicting dual writes or shadow fallback. Compare results/queries, ordering, revisions, serialization, Unicode/numeric/time edges, deletion/recovery, invalid/unknown input, failed/committed-unverified writes. Bound storage/time, no private payload diagnostics; define mismatch and retirement criteria. Generated cases, fault injection, actual adapter parity, no auto-promotion.

### P2.C — domain cutover and recovery
Dependency audit determines coherent order (profiles/meta, plans/preferences, Notes, DailyRecord/Diary, ActiveSession/timer/pending reviews/deletion/restore journal). Freeze mutation, inventory/validate source, stage native transaction, verify exact semantic representation/bytes/references, durable versioned cutover marker under original authority, then switch composition. Never clear source before verified durable switch; no stale IDB fallback after native writes. Resume/rollback only if marker/revision/authority permit; ambiguous state preserves both and blocks destructive work. Kill each boundary, repeated restart/idempotence, wrong profile, quota/full, source changed/lost owner, corrupt/newer/partial/mismatch, readback failure and rollback successor. One writer at all times. Only local experimental native P1 data; PWA and portable formats unchanged.

### P2.D — attachments/scratch
Owners: attachment-ingest/asset-storage/exports, workers, rich-text references and native filesystem. Content-addressed bytes, portable ID/hash/size/label unchanged; physical location local. Bounded stream stage/verify/durable file then metadata transaction, atomic publication, reader leases/references/dedup/verified GC. Migrate native OPFS under fencing, preserve backup scratch journals/lifetimes; actual media and reference adapters. Large/duplicate/invalid, cancel, partial write, metadata failure, corrupt/missing, live reader, concurrent import/delete, link escape, restart/kill. No cleanup of referenced/staged authority; cross-client archive/backup and hash readback.

### P2.E — Rust managed repository
Owners: managed-repository, backup-capture/codec/provider/recovery, reconciliation/contracts and native transports. Port actual protocol operations; exact encoding/hash/protected/encrypted envelope, immutable publish order, scope/pointer/commit, lock/claim/maintenance, verified inventory, rollback, retention/deletion. Golden byte/semantic fixtures (account for encryption nondeterminism), JS↔Rust reader/writer proof. Interrupted publication/restore/cleanup, partial listing, corrupt/newer objects, conflicts, cancel/timeout, stale leases/concurrent clients, no blind delete/LWW. One actual native engine through callers, not duplicate proxy.

### P2.F — Rust sync/network/background
Owners: provider runtime, repository-background, mutation/operation coordination, handoff/timer, native transport. One scheduler/owner, bounded concurrency, retry/cancel, refresh/network/profile/lifecycle; JS UI consumes status, no duplicate jobs. Preserve merge/ancestry/deletion/pending review, claims and restore journal. Offline/online, auth expiry, delayed callback, account switch, stale revision/lost and reacquired lease, publication/maintenance overlap, failed verification, restart transfer, cancel, session handoff and large bounded streaming. Actual mixed-client status and privacy-safe diagnostics; PWA unchanged.

### P2.G — mixed clients and Android feasibility
Independent disposable Windows and installed PWA profiles; real Drive and supported folder, both directions concurrently, same IDs/bytes/claims/deletion/retention, conflicting edits/kept reviews, restored versions, encryption, large/dedup attachments, interrupted cleanup/restore/offline/handoff, full export/import. Compare actual canonical records, revisions and hash. Assess Android WebView/Tauri, secure credentials, sandbox/FS, lifecycle/background, packaging/update; document feasibility/blockers; no Android implementation or support claim absent approval. Gate native retirement on proof.

### P2.H — retire superseded authority
Audit all shipped owners, composition, native conditional paths, storage/worker/dependency inventory and marker. Prove no native legacy canonical write/read fallback, duplicate scheduler/engine or shadow authority. Remove only superseded native routes/temporary verification after proof; preserve web IDB/OPFS and bounded recovery until safe. Verified rollback backup, no silent deletion. Negative native legacy-write witnesses, current-store cold/restart and PWA regression; corrupt/unknown fail closed.

### P2.I — de-novo certification
Audit P0–P2 source and actual entrypoints/authority graph, F33 behavior, portable protocol/asset/dependency/security inventory, intentional changes. Full hermetic/risk/mutation/branch coverage, generated/minified/release/browser promotion, locked package/update, mixed PWA/native providers, cutover faults at every commit boundary, DB/file corruption/full/missing, owner interleavings, crash/power loss, interrupted restore/cleanup/update, multi-profile, large resource/idle/performance, credentials/IPC and recovery procedures. Exact SHA/artifacts/results and independent handoff. No release or propagation without owner approval.
