# Study session

Today's study session (the Active Session) and its timer: what is stored, which device runs it, and how it moves between devices. Timer sounds and reminders are in [notifications.md](notifications.md).

## The Active Session

The Active Session is portable across devices and backups. It carries the current session/schedule/review state required to resume work, and the installation running it (`runningOn`, ActiveSession v10; an older session belongs to the installation that converts it). A restored running or paused timer is rehydrated into the timer runtime only on the installation it names, and the Execute controls are then derived from that restored runtime. Any other installation shows the session as running on another device and runs it only after Continue Here (below).

The Plan draft and the applied plan are separate. Restoring or continuing a session applies the session's own schedule and never writes it into the Plan draft, so the draft stays exactly as authored. The board shows LIVE while a plan is applied and editing is closed; opening Edit shows the draft. Cancel closes editing and keeps the draft; Done and Apply save the draft first and apply only that exact text.

## Across devices

Decisions (owner, 2026-10-18):

- The session names the device running it; only that device runs the timer. Another device shows "Running on another device" and edits notes and everything else freely; notes from it reach the running device without stopping its session.
- Suspend hands the session over: it uploads at once and the other device offers Continue here.
- Continue Here and Restore Session sit in Execute's status card and in the session strip above the Plan board, in one order: next step, Suspend, Finish, Reset last. Controls that cannot act are hidden, not disabled. Continue Here on a device whose copy still runs elsewhere asks first; the device taken over from stops at its next sync and keeps its unsynced progress for review.
- "Needs review" opens during a running session and leaves the session as it is.

How Continue Here shows its steps and errors: [status-indicator.md](status-indicator.md#continue-here).

**How sync treats it.** The session names the device running it (`runningOn`, the installation id), and only that device runs its timer. Another device keeps a copy it never runs and shows "Running on another device"; notes, Saved Days and everything else work there as usual, and that copy follows the running device at every sync. Otherwise an incoming session is taken only when this device's session is the shared one and the incoming one follows it (same day, same or later revision), or this device has none, or the incoming side saved this device's day and cleared its session. While a session runs here, an incoming change to it waits ("hold") and everything else merges, during a sync and during a review alike. While Drive's newest ownership claim names this device and the session runs here, an incoming version naming another device was saved before this device took over, so it holds too rather than taking the session back (the sync reads the claim only while a session runs here).

## Moving a session

Active Session content and ownership are separate. Continue Here saves the Plan draft, then reads only the Active Session from Drive's newest verified version; it does not run a full sync, so a handoff never changes Plans, notes, Saved Days or settings on either device. When this device's copy is behind and the other device only added to it since the last handoff, the newer copy is taken first; otherwise a normal sync runs and Continue Here is tried again. The ownership claim on Drive (format v4; v2 and v3 still read) records a fingerprint of the session's study content and the Drive version it was based on, and is written only if Drive is still at that version. Only after the claim is read back and the new owner's session is saved locally does this device run the timer.

**If Continue Here is interrupted.** Before claiming, the device saves a small local marker (`sessionHandoffSafety`). While it exists the timer cannot start here, so two devices never run the session at once. On the next Continue Here, restore or start-up it is checked against Drive: a claim that did land is completed, a later owner is followed. When those checks cannot settle it, the marker is still cleared once nothing is left to guard: this device has no session for that day any more, or Drive does not name this device as the owner and this device is not running the session. A "busy" or "not connected" reply leaves no marker, since no claim was written. It stays only while Drive names this device as owner and the local copy could not be confirmed.

The newest applicable ownership claim stays authoritative until a later verified claim supersedes or releases it; it does not expire by time. An open old owner checks the claim about every 15 seconds, saves its latest progress, stops its timer, and syncs; any difference is kept for review. Older claim files are compacted after a successful full version.

## When this device loses the session

When a verified lightweight Drive claim shows that this device no longer owns its running Active Session, Study Director stops its local execution loop immediately and preserves the frozen timer/practice evidence. The local draft must commit through strict canonical IndexedDB storage and pass a matching strict read-back before claim-triggered sync starts. Failure, null result and emergency local-only rescue are **not** declared canonical; the page retains a persistent safety warning and retries through its existing 15-second claim watcher. A managed-recovery preflight still independently rejects unverified snapshots; it can incorporate later Session reflection edits without adding time spent frozen. If the claim returns to this device, the runtime resumes only when the frozen state was saved and the TimerEngine actually resumes. No guarantee of recovery exists when every browser storage surface is unavailable and the page is terminated; keep the page open and heed the warning.

The visible/eligible Active Session claim watcher keeps its **15-second** cadence and the parallel remote claim/strict local session reads. A confirmed-offline browser avoids futile Drive claim reads; returning online or making a hidden tab visible can immediately perform a missed eligible check. Those event-driven wakes use the same single interval owner's 15-second attempt throttle and the check's existing in-flight guard. Explicit claim verification remains independent of the wake throttle so a failed frozen-session local write can still retry through the normal direct path. This is **open-app cooperative work**, not a closed-app OS background service, and remote handoff cannot be observed while truly offline.

## Saved Day coverage

A Saved Day "covers" a session when it holds all that session's study work: the same schedule, task results, recorded time and pauses, review text, schedule adjustments and Practice Pacer runs (a run still going may have grown, never shrunk). `DailyRecordCodec.savedDayCoversSessionEvidence` decides this. It is used to clear a "Save today" reminder once another device saved the day, and to retire a leftover previous-day session without a kept version. Save metadata and revision numbers are not proof, and when in doubt the reminder or the kept version stays: work is never dropped on a guess.
