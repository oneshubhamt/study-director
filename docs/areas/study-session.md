# Study session

Today's study session (the Active Session) and its timer: what is stored, which device runs it, and how it moves between devices. Timer sounds and reminders are in [notifications.md](notifications.md).

## The Active Session

The Active Session is portable across devices and backups. It carries the current session/schedule/review state required to resume work, and the installation running it (`runningOn`, ActiveSession v10; an older session belongs to the installation that converts it). A restored running or paused timer is rehydrated into the timer runtime only on the installation it names, and the Execute controls are then derived from that restored runtime. Any other installation shows the session as running on another device and runs it only after Continue Here (below).

If a restored Plan working draft is semantically identical to the applied Active Session schedule, Plan remains in the applied/live state. A genuinely different restored working draft remains an editing draft.

## Across devices

Decisions (owner, 2026-10-18):

- The session names the device running it; only that device runs the timer. Another device shows "Running on another device" and edits notes and everything else freely; notes from it reach the running device without stopping its session.
- Suspend hands the session over: it uploads at once and the other device offers Continue here.
- Continue Here and Restore Session sit in Execute's status card and in the session strip above the Plan board, in one order: next step, Suspend, Finish, Reset last. Controls that cannot act are hidden, not disabled. Continue Here on a device whose copy still runs elsewhere asks first; the device taken over from stops at its next sync and keeps its unsynced progress for review.
- "Needs review" opens during a running session and leaves the session as it is.

How Continue Here shows its steps and errors: [status-indicator.md](status-indicator.md#continue-here).

**How sync treats it.** The session names the device running it (`runningOn`, the installation id), and only that device runs its timer. Another device keeps a copy it never runs and shows "Running on another device"; notes, Saved Days and everything else work there as usual, and that copy follows the running device at every sync. Otherwise an incoming session is taken only when this device's session is the shared one and the incoming one follows it (same day, same or later revision), or this device has none, or the incoming side saved this device's day and cleared its session. While a session runs here, an incoming change to it waits ("hold") and everything else merges, during a sync and during a review alike. While Drive's newest ownership claim names this device and the session runs here, an incoming version naming another device was saved before this device took over, so it holds too rather than taking the session back (the sync reads the claim only while a session runs here).

## Moving a session

Active Session content revisions and ownership are separate. Continue Here first stages the candidate locally without starting its timer, acquires a new monotonic Drive ownership epoch through a tiny protected v2 claim (hashed session/owner tokens; no schedule, progress, device id or date in plaintext), then publishes and re-observes the full verified Drive checkpoint. Only after both proofs succeed does the new device run the timer. A failed handoff restores the previous local session and removes only its uncommitted newest claim where safe. The newest applicable ownership epoch remains authoritative until a later verified epoch supersedes or explicitly releases it; it does not expire by time. An open old owner checks the lightweight claim about every 15 seconds, flushes its latest progress, freezes only its runtime clock, and forces Drive catch-up; canonical progress remains untouched so ordinary reconciliation can keep any divergence for review. Older claim files are compacted best-effort after a successful full checkpoint. Suspend and plan-apply still publish urgently through the normal shared checkpoint path.

## When this device loses the session

When a verified lightweight Drive claim shows that this device no longer owns its running Active Session, Study Director stops its local execution loop immediately and preserves the frozen timer/practice evidence. The local draft must commit through strict canonical IndexedDB storage and pass a matching strict read-back before claim-triggered sync starts. Failure, null result and emergency local-only rescue are **not** declared canonical; the page retains a persistent safety warning and retries through its existing 15-second claim watcher. A managed-recovery preflight still independently rejects unverified snapshots; it can incorporate later Session reflection edits without adding time spent frozen. If the claim returns to this device, the runtime resumes only when the frozen state was saved and the TimerEngine actually resumes. No guarantee of recovery exists when every browser storage surface is unavailable and the page is terminated; keep the page open and heed the warning. This source/targeted simulation change did not alter shared repo claim format, the canonical Session schema or the provider engine.

The visible/eligible Active Session claim watcher keeps its **15-second** cadence and the parallel remote claim/strict local session reads. A confirmed-offline browser avoids futile Drive claim reads; returning online or making a hidden tab visible can immediately perform a missed eligible check. Those event-driven wakes use the same single interval owner's 15-second attempt throttle and the check's existing in-flight guard. Explicit claim verification remains independent of the wake throttle so a failed frozen-session local write can still retry through the normal direct path. This is **open-app cooperative work**, not a closed-app OS background service, and remote handoff cannot be observed while truly offline.
