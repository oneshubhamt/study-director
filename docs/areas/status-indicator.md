# Status indicator

One indicator tells the person, on every screen size, what Study Director is
doing in the background and whether anything needs them. It replaces the
sidebar's sync text line and the phone circle's warning dot. Decisions below
were made with the owner on 2026-11-01.

## Where it shows

| Screen | Host | Shape |
|---|---|---|
| Phone and narrow tablet (≤ 900 px, bottom bar) | The profile circle (**S**) | Ring around the circle |
| iPad landscape and laptop (sidebar) | The profile name button (name shown in full) | Squircle around the name; the old sync text line is removed |
| Profile panel | The avatar in the panel header | Ring, plus a **Sync & backups** section |

Every host is the same component: a ring (SVG rounded rectangle) and a corner
badge. Tapping any host opens the profile panel. The panel lists everything
and offers each action.

## Ring and badge

The ring shows **sync health**. The badge shows the **most important thing
that needs the person**. Both can show at once (for example Synced with a
review waiting). Colour is never the only signal: each state also differs in
shape or motion and always has text (hover tooltip and screen-reader label).

| Ring state | Look | Meaning |
|---|---|---|
| `off` | None | Google Drive not set up on this profile |
| `syncing` | Green arc travelling round | Connecting, bringing in changes, uploading, restoring, combining, reading versions, a Device Folder backup |
| `syncing` (slow) | Green arc travelling slowly | Waiting for another device to finish saving (named, as "Windows · Chrome", when known) |
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
| `info` | Small blue dot (count when 2 or more) | A new app version is ready (not blocking); news that faded unseen since the panel was last opened ([notifications.md](../NOTIFICATIONS.md#recent)) |

**Priority.** Ring: offline → signed-out → blocked → syncing → error →
pending → synced (a retry in progress shows as syncing). Badge: error → lock →
update → warning → review → info. The tooltip and screen-reader label start
with the most urgent text.

## Every case the old text line covered

The sidebar text and the phone dot are retired. Each of their cases maps to
the indicator; `tests/unit/backup/sync-status.mjs` checks every row.

| Old text | When | Ring | Badge | Label starts | Panel action |
|---|---|---|---|---|---|
| Syncing… | Sync catch-up or upload running | syncing | — | Syncing… (or the specific activity) | — |
| Waiting for another device | Drive's latest is here; this device's upload waits its turn | syncing (slow) | — | Waiting for Windows · Chrome to finish saving… | Sync now |
| Synced 12:04 | In step | synced | — | Synced 12:04 | — |
| Changes since 12:04 | Local edits waiting | pending | — | Changes since 12:04 | — |
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

## Profile panel — Sync & backups

- **Headline:** one sentence, for example "Synced at 12:04. This device is up to date."
- **When next:** "Uploads by 12:24, or when you leave the app" (from the
  automatic-backup schedule), "Next try at 12:10", or "Checks Google Drive again
  when you return to the app". A button only when something waits (owner, 2026-11-08): **Sync now** while this device waits for another device's upload (it uploads without waiting for that turn) or retries after a failure, and **Try again** once retries ran out. None while syncing works normally. The first-sync card shows the same Sync now on its upload step while waiting.
- **Needs you:** one row per item with its own button — Sign in, Enter password,
  Update app, Review (sync), Review (kept versions), Allow access (Device Folder),
  Details (storage, backup check, Device Folder failing), Go to Execute (session
  elsewhere), Continue here (session suspended on another device), Update (new
  version ready).
- **Settings rows** in the same box: Google Drive (account, Connect / Sign in /
  Disconnect) and Backup password (On / Off, Set / Change / Enter), then
  **Backup details** — a row with an arrow to Library → Data.

**Panel layout.** The header (avatar with its ring, the name, the
Google account when there is one) and Done stay in place; only the middle
scrolls. The name renames in place: tap it, type, Enter or leaving saves,
Escape keeps the old name. Sections, in order: Sync & backups, Profiles on this
device (one row each with Switch, then Add profile, then the device name),
Recent (the three newest, Show all for the rest). Every section is a small
heading over one box of rows; a row is a label over a quieter value with at most
one compact button (32 px, 36 px on touch screens).

## Motion and accessibility

- Travelling arc only while work runs; `prefers-reduced-motion` shows a static
  dashed ring instead.
- The sidebar squircle uses a finer line (1.5 px) and steps back slightly while
  synced and at rest, so any change of state draws the eye; hover or focus
  brings it to full strength.
- Each host's `aria-label` and `title` carry the full status text.
- The panel section is a labelled region; its headline is a polite live region.

## Noise rules

- Syncing and synced change only the indicator. They add no pop-ups or sounds.
- Existing notices (sync review, sign-in expiry, session hand-off) are unchanged.
- Continue Here shows its steps in the Execute card and the Plan strip; only a
  failure adds a pop-up (it also stays in the card).
- One pop-up when a review first appears: the sync review (once until it is
  resolved) and versions kept for review (once per version since start-up).
- Red only after retries run out: the ring, the badge, the "keeps failing"
  pop-up and the Connect card; while a sync still retries it is amber.
- Every pop-up has a kind ([notifications.md](../NOTIFICATIONS.md#kinds)):
  result, news, blocking or critical. Blocking problems (signed out,
  password, app update, retries ran out, Device Folder permission, data from
  a newer version) stay pinned until closed or resolved and knock once (red:
  Attention); news (sync review, kept versions, hand-off ready, storage
  restored) fades after 12 s with a chime.
- While this device's timer runs on a work block, news waits and shows at the
  next support or fixed block, pause, or the session's end; blocking and
  critical pop-ups and results of the person's own actions show at once.
- News that faded unseen counts on the blue `info` badge until the profile
  panel is opened; the panel's Recent list shows the day's pop-ups.

## Continue Here

- **Feedback.** Every Continue Here button reads "Continuing…" (disabled, busy) from the tap until it ends. The Execute card and the Plan strip show the step: checking today's session, pausing this device's sync, confirming with Google Drive, starting here. On a phone the step replaces the card's longer text so the button stays in view.
- **Errors** stay in the Execute card in plain words (Drive busy, not connected, changed on another device, offline) and pop up once.
- **Wait, measured** (two browsers, simulated Drive at 250 ms a request): 2.8 s with nothing running, 3.1 s with a sync catch-up running, 3.6 s with an upload running. Stopping the running work takes 0.03–0.6 s; the rest is the ownership claim, about 11 Drive requests one after another, whose order keeps two devices from claiming at once. It is not shortened here.
- **Session kept through a sync.** A sync keeps the session while Drive's ownership claim names this device, so Continue Here pressed before this device took in the other device's newest upload cannot hand the session back ([study-session.md](study-session.md)).

## Connect Google Drive card

- **When.** From any Connect or Sign in (profile panel, Library → Data, first start, the permission notice) until that first sync ends, on every tab.
- **Where.** A card of the notification stack (top right on a laptop, above the bottom bar on a phone): first after the pinned cards, counted in "+N more", closed by Clear all.
- **What.** Three steps — sign in to Google, bring in what's on Google Drive, upload this device's data — each waiting, working (spinner), done (✓) or failed (×); one sentence for where it is; the running stage with its counts ("Downloading backup data… · 2 of 5 complete · 150 KB of 300 KB") and a bar (a sweep when there are no counts yet). While this device's upload waits for another device, the step line reads amber, the sentence names that device by type and browser ("Waiting for Windows · Chrome to finish saving…") and **Sync now** sits at the end of that step's line as a quiet link; a retry's **Try now** sits the same way on its step. No bar moves while a step only waits. Every other action (Enter password, Review, Sign in, Update) is the card's button.
- **Endings.** Synced (closes itself after 6 s; offers Review when the sync kept versions for review); needs the backup password, a review or an app update (stays, with the button); offline (continues when back online); couldn't finish (says when it tries again, with Try now); sign-in didn't finish (Try again). Declining or refusing a library closes it; the existing toast explains.
- **×** hides it; syncing carries on and the indicator still shows it.
- **Model.** `backup-presentation.connectProgress` decides; the host only remembers when the card started and whether a catch-up or upload ran since.

## Hand-off row, counts and pop-ups

- **Hand-off row.** A session suspended on another device is a panel row, "Today’s session was suspended on Laptop. Continue it here when you’re ready.", with Continue here (no badge: it is an offer). That button and the hand-off pop-up's Continue here open Execute first, so the Continue Here steps show; the pop-up closes once Continue Here starts.
- **Counts.** While a catch-up or upload runs, the panel's line under the headline shows its stage and counts, for example "Downloading backup data from Google Drive… · 2 of 5 complete · 150 KB of 300 KB".
- **Pop-ups.** As in "Noise rules" above. Kept versions pop up once ("Kept for review", Review); not those present at start-up, not while the Connect card shows (it reports them), and not a session this device just handed over (its own pop-up says so). The Connect card is amber while a sync retries or is signed out, red once retries ran out or a sign-in fails.
- **Mechanism.** `notice-coordinator.setStudying` holds news without showing or timing it; the host sets it from the timer mode and the current block (work blocks only).

## Ownership

- `source/core/backup-presentation.js` owns the pure status decision (no DOM, no clocks except the `now` it is given).
- The host (`source/app.html`) gathers the inputs, draws the hosts and panel, and maps panel actions to existing feature actions. Features keep their own operations; the indicator never starts work on its own.
