# Sync and background status — plan and contract

One indicator tells the person, on every screen size, what Study Director is
doing in the background and whether anything needs them. It replaces the
sidebar's sync text line and the phone circle's warning dot. Decisions below
were made with the owner on 2026-11-01.

## 1. Where it shows

| Screen | Host | Shape |
|---|---|---|
| Phone and narrow tablet (≤ 900 px, bottom bar) | The profile circle (**S**) | Ring around the circle |
| iPad landscape and laptop (sidebar) | The profile name button (name shown in full) | Squircle around the name; the old sync text line is removed |
| Profile panel | The avatar in the panel header | Ring, plus a **Sync & backups** section |

Every host is the same component: a ring (SVG rounded rectangle) and a corner
badge. Tapping any host opens the profile panel. The panel lists everything
and offers each action.

## 2. Ring and badge

The ring shows **sync health**. The badge shows the **most important thing
that needs the person**. Both can show at once (for example Synced with a
review waiting). Colour is never the only signal: each state also differs in
shape or motion and always has text (hover tooltip and screen-reader label).

| Ring state | Look | Meaning |
|---|---|---|
| `off` | None | Google Drive not set up on this profile |
| `syncing` | Green arc travelling round | Connecting, bringing in changes, uploading, restoring, combining, reading versions, a Device Folder backup |
| `syncing` (slow) | Green arc travelling slowly | Waiting for another device to finish saving |
| `synced` | Solid green; settles from the arc with a brief glow | In step with Drive |
| `pending` | Green with an open segment | Changes here not uploaded yet; last sync failed and is retrying; first sync not finished; sync review waiting |
| `offline` | Grey dashed | No network; syncs when back online |
| `signed-out` | Amber, broken into segments | Drive set up but signed out or disconnected |
| `blocked` | Solid amber | Sync cannot continue until the person acts: backup password, app update |
| `error` | Solid red | Sync stopped after its retries ran out |

| Badge | Look | Meaning |
|---|---|---|
| `error` | Red **!** | A failure: sync stopped, storage error, Device Folder failing |
| `lock` | Amber lock | Backup password needed on this device |
| `update` | Amber **↑** | App update needed to keep syncing |
| `warning` | Amber **!** | Needs attention but not failing: Device Folder permission, storage or backup-check warning, no backup in over a week |
| `review` | Yellow dot (count when 2 or more) | Something to review: kept versions, a sync review |
| `info` | Small blue dot | A new app version is ready (not blocking) |

**Priority.** Ring: offline → signed-out → blocked → syncing → error →
pending → synced (a retry in progress shows as syncing). Badge: error → lock →
update → warning → review → info. The tooltip and screen-reader label start
with the most urgent text.

## 3. Every case the old text line covered

The sidebar text and the phone dot are retired. Each of their cases maps to
the indicator; `tests/unit/backup/sync-status.mjs` checks every row.

| Old text | When | Ring | Badge | Label starts | Panel action |
|---|---|---|---|---|---|
| Syncing… | Sync catch-up or upload running | syncing | — | Syncing… (or the specific activity) | — |
| Synced 12:04 | In step | synced | — | Synced 12:04 | Sync now |
| Changes since 12:04 | Local edits waiting | pending | — | Changes since 12:04 | Sync now |
| Last synced 12:04 | Last sync failed, retrying | pending | — | Last synced 12:04 · retrying | Sync now |
| Needs password | Password set or changed on another device | blocked | lock | Enter backup password to sync | Enter password |
| Needs review (sync) | Drive has changes needing a decision | pending | review | Google Drive has changes to review | Review |
| Needs review (kept versions) | Kept versions waiting | (unchanged) | review | N kept versions to review | Review |
| Needs app update | Drive or this device holds newer data | blocked | update | Update the app to keep syncing | Update app |
| (phone dot) password not entered here | Encryption on, not unlocked on this device | blocked | lock | Enter backup password to sync | Enter password |

Cases the old text left blank and the indicator now shows: Drive not set up,
signed out, first sync not finished, offline, failing after retries, Device
Folder activity and problems, storage and backup-check warnings, today's
session running on another device, app update ready, no backup in over a week.

## 4. Profile panel — Sync & backups

- **Headline:** one sentence, for example "Synced at 12:04. This device is up to date."
- **When next:** "Uploads by 12:24, or when you leave the app" (from the
  automatic-backup schedule), "Next try at 12:10", or "Checks Google Drive again
  when you return to the app". **Sync now** whenever Drive is connected and idle.
- **Needs you:** one row per item with its own button — Sign in, Enter password,
  Update app, Review (sync), Review (kept versions), Allow access (Device Folder),
  Details (storage, backup check, Device Folder failing), Go to Execute (session
  elsewhere), Update (new version ready).
- **Details in Library → Data** link.

## 5. Motion and accessibility

- Travelling arc only while work runs; `prefers-reduced-motion` shows a static
  dashed ring instead.
- The sidebar squircle uses a finer line (1.5 px) and steps back slightly while
  synced and at rest, so any change of state draws the eye; hover or focus
  brings it to full strength.
- Each host's `aria-label` and `title` carry the full status text.
- The panel section is a labelled region; its headline is a polite live region.

## 6. Noise rules

- Syncing and synced change only the indicator. Phase 1 adds no new toasts or sounds.
- Existing notices (sync review, sign-in expiry, session hand-off) are unchanged.
- Continue Here shows its steps in the Execute card and the Plan strip; only a
  failure adds a pop-up (it also stays in the card).
- Later phases: one pop-up when a new review first appears; red only after
  retries run out; during a running study session only blocking problems pop up.

## 7. Phases

| Phase | Scope | State |
|---|---|---|
| 1 | Status model (`backup-presentation.status`), indicator on all hosts, panel section, retire the text line and phone dot | Done |
| 2 | Continue Here: instant busy button ("Continuing…"), step text in the Execute card, errors in the Execute card; measure and shorten the wait for a running sync | Done (see below) |
| 3 | Connect Drive: a progress card on any tab (checking folder → bringing in changes → uploading → Synced ✓) | Done (see below) |
| 4 | Remaining cases: session hand-off ready row, first-sync progress counts, pop-up rules from section 6 | Planned |

### Phase 2 — Continue Here

- **Feedback.** Every Continue Here button reads "Continuing…" (disabled, busy) from the tap until it ends. The Execute card and the Plan strip show the step: checking today's session, pausing this device's sync, confirming with Google Drive, starting here. On a phone the step replaces the card's longer text so the button stays in view.
- **Errors** stay in the Execute card in plain words (Drive busy, not connected, changed on another device, offline) and pop up once.
- **Wait, measured** (two browsers, simulated Drive at 250 ms a request): 2.8 s with nothing running, 3.1 s with a sync catch-up running, 3.6 s with an upload running. Stopping the running work takes 0.03–0.6 s; the rest is the ownership claim, about 11 Drive requests one after another, whose order keeps two devices from claiming at once. It is not shortened here.
- **Fixed on the way:** Continue Here pressed before this device took in the other device's newest upload could hand the session back once that upload came in, leaving neither device able to run or upload it. A sync now keeps the session while Drive's claim names this device ([BACKUP-ENGINE.md](BACKUP-ENGINE.md), Active Session).

### Phase 3 — Connect Google Drive card

- **When.** From any Connect or Sign in (profile panel, Library → Data, first start, the permission notice) until that first sync ends, on every tab.
- **Where.** First in the notification area (top right on a laptop, top on a phone); toasts stack below it.
- **What.** Three steps — sign in to Google, bring in what's on Google Drive, upload this device's data — each waiting, working (spinner), done (✓) or failed (×); one sentence for where it is; the running stage with its counts ("Downloading backup data… · 2 of 5 complete · 150 KB of 300 KB") and a bar (a sweep when there are no counts yet).
- **Endings.** Synced (closes itself after 6 s; offers Review when the sync kept versions for review); needs the backup password, a review or an app update (stays, with the button); offline (continues when back online); couldn't finish (says when it tries again, with Try now); sign-in didn't finish (Try again). Declining or refusing a library closes it; the existing toast explains.
- **×** hides it; syncing carries on and the indicator still shows it.
- **Model.** `backup-presentation.connectProgress` decides; the host only remembers when the card started and whether a catch-up or upload ran since.

## 8. Ownership

- `source/core/backup-presentation.js` owns the pure status decision (no DOM, no clocks except the `now` it is given).
- The host (`source/app.html`) gathers the inputs, draws the hosts and panel, and maps panel actions to existing feature actions. Features keep their own operations; the indicator never starts work on its own.
