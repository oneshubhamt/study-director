# History

A short record of past work. Current behaviour is in the area docs; this page explains how the app got there and which ideas were dropped. The full audit reports, ledgers and handoff notes that this page replaces were removed on 2026-11-02. They remain in git: [docs at `1d88e79`](https://github.com/oneshubhamt/study-director/tree/1d88e79/docs). Pull requests and commit messages carry the detail of each change.

## Timeline

| When | Work |
|---|---|
| Before October 2026 | The released app. Its last release is kept on the branch `SDVB75F10`. |
| 4 Oct | Background coordination rebuilt as one job model with shared priorities and preemption. |
| 6–10 Oct | Backups and data: one backup engine for the Device Folder and Google Drive; canonical data with one read-once migration path; stored names made plain (`notes`, `deviceFolder`); an audit of data and backups, every finding fixed. |
| 10–16 Oct | Notes plan (16 decisions, 5 steps): permanent note ids, the Library in Notes · Days · Data, linked notes, links in text, tags, import, and measurement at 2,000 notes (start-up 8.0 s with a 2.9 s freeze → 2.5 s with none over 0.1 s). |
| 17–24 Oct | Sync through Drive, merge rules with kept-for-review versions, profiles and device names, the first-start form, per-profile backup folders, one current format, deleting a profile everywhere; two backup audits, every finding fixed. |
| 25 Oct | Wordgard 0.6.2 as its own module; notification sounds made in code (no sound files); the UI overhaul (Dark/Light themes, Director, Glass and Aurora skins, motion) merged; a background-services audit after sync, every finding fixed. |
| 26–30 Oct | Rules for reliable browser tests; a plan applied on one device reaching the other within minutes; Execute naming the device running the session. |
| 30–31 Oct | Data topology and backup remediation (findings F1–F20, passes A–F): restore journal atomicity, trustworthy freshness and receipts, browser reset and note rescue, binary verification, Drive resumable-upload safety. Certified by full Promotion QA. F16–F18 closed as accepted policy; F19–F20 deferred ([backlog.md](backlog.md#noted-for-later)). |
| 31 Oct–1 Nov | Background services programme (21 findings, passes P0–P6): Active Session claim safety, notification clicks and PDF lifetimes, scheduler deadlines and clock jumps, attachment integrity and cleanup cost, update checks yielding to Drive transfers, Device Folder permission races. Certified by full Promotion QA; real-device checks not run. |
| 1 Nov | Insights opens from an idle pre-computed model; a Drive sync that failed and looped on every catch-up fixed; Drive backups made faster; Version History hides Replace for versions missing attachments. |
| 1–2 Nov | One sync and background status indicator; Continue Here feedback; the Connect Google Drive card; notifications as one stack with kinds, Recent and new sounds; clickable pop-ups; the refined profile panel. |
| 2 Nov | Docs reorganised into area docs; the journal and per-pass ledgers retired. |
| 3–5 Nov | BF-1/BF-2 and BF-C1–C8 separated Plan drafts from session handoff, strengthened Saved Day evidence and ownership recovery, and narrowed/clarified Kept Versions. Final source follow-ups included the 24-hour Practice Pacer cap and full saved-plan comparisons; physical cross-device/browser acceptance remained open. Detailed implementation ledgers live in Git history. |

## Ideas dropped or replaced

- **One shared checkpoint history for both locations** (the same version id copied between the Device Folder and Drive). Replaced on 27 Oct by independent publication to each destination, with one Version History list in the interface.
- **"The newer edit wins and the other text goes to Recently deleted."** Replaced the same day (18 Oct) by kept-for-review versions, so nothing is lost and nothing is decided by clocks.
- **A "backup health" summary**: each location's row already shows its last backup and any problem.
- **Streaming verification during restore**: every downloaded piece is already checked against the version's manifest before anything is written.
- **A separate version history for notes**: earlier versions come from backups.
- **A device lock for two open devices**: a Web Lock works only inside one browser, and a Drive lock would stop the other device.
- **Running upkeep only while the page is visible**: a background desktop tab would never run it.
