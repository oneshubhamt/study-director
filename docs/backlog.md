# Backlog — incidental context, not the conversion schedule

**TypeScript conversion remains the assigned work. Do not hunt these bugs.** If a conversion pass exposes an evident cause and a supported fix, address it with relevant regression checks and record the result under its existing ID. Otherwise leave it parked. Reports and theories below have not been re-investigated on this conversion branch; imported “fixed” claims are historical evidence, not new certification.

Sources: [previous production backlog preserved at `b4e4cfd`](https://github.com/oneshubhamt/study-director/blob/b4e4cfd716626c55fd713f3565837ac7f9e70a95/docs/backlog.md) and [Background Refactor backlog at `a0ff20c`](https://github.com/oneshubhamt/study-director/blob/a0ff20c0649ba5c6e20a4aab53782304a9d72210/docs/backlog.md), branch `refactor/background-coordination`. These retain detailed reports, diagnostics, hypotheses and earlier decisions. Only the backlog document was imported; no branch implementation or bug-hunt schedule was adopted. Item numbers below retain those sources' IDs. [The execution record](../TS-CONVERSION-EXECUTION.md) owns current work.

## Additional reports from Background Refactor

| ID | Report / intended outcome | Evidence limits and related surfaces |
| --- | --- | --- |
| Data loss + 11 | Database disappeared again on F24, roughly 30 minutes after the phone app was closed. Browser storage survived; the clearing notice and session rescue worked, and Drive restored Saved Days. Site estimate was about 4.3 GB on a nearly full phone | Cause unknown. Real storage growth versus an inflated estimate remains unresolved; earlier iPad loss with ample free space prevents treating low disk as a complete explanation. Retain diagnostics before recovery if it recurs. Storage/profile/startup/recovery surfaces |
| 17 | Practice Pacer Start initially does nothing in Simple mode with a running block/default ten-minute target; switching to Paper Plan and back makes it work | Not reproduced. A disabled Start button was ruled out in one browser check; duration formatting/parsing is only a lead. Pacer/session surfaces |
| 18 | Drive cleanup and uploads block each other for minutes, on one or two devices; manual backups can fail with generic `Error`. Brief contention escalates to a long retry pause | A yielded cleanup leaving its marker is a theory, not a verified cause here. Intended outcome: cleanup yields safely, ordinary contention does not count as repeated transport failure, and failures retain useful diagnostics. Repository coordination/Drive surfaces; related 12, 14, 22 |
| 19 | Review reflection editor repeatedly unmounts while typing, briefly exposing serialized rich text; opening Review sometimes requires a click before it mounts | Intended outcome: mount when Review opens and preserve the active editor through background redraws. Compare behavior only when working on these surfaces; do not alter vendored Wordgard. Review/our editor integration |
| 20 | Save Day with a reflection failed after a handoff; clearing it allowed a save but an older reflection reappeared. Three session copies were kept within five minutes | Sync settlement, stale editor state and old-device uploads are hypotheses. Intended outcome: background contention does not discard edits; cleared text stays cleared; copies are kept only for genuinely divergent decisions. Review/saving/reconciliation; related 19, 21, 22 |
| 21 | Finish Today leaves Execute/Pacer and session review blocking as if a session still exists; saving reportedly did not release it either | Desired flow is recorded below. This may require coordinated state/UI work, not a quick local tweak. Session lifecycle, Review, Plan and cross-device handoff |
| 22 | After Continue Here on the laptop, the phone retained the session and failed uploads. Its timer display froze while underlying time advanced; it yielded only after background/foreground | Logs report maintenance-busy refusals on both devices; delayed claim publication and stalled claim observation/display are hypotheses. Intended outcome: durable ownership is observed promptly, previous owner stops, elapsed time is never counted twice, and contention/failure remains intelligible. Related 18 and 20 |

**Item 21's recorded intended flow:** Finish Today confirms, stops the timer, records a running block as partial, and ends ownership permanently without auto-saving to Library. Execute/Pacer become idle; Plan returns to an editable draft with its text preserved. Review opens on the retained finished day, allowing edits, ratings, reflection and kept-session review without restarting a timer. The finished day survives reload/sync and cannot resume on another device; the unsaved-day reminder still protects it. Saving closes that finished day. A mid-day Save Today continues the live session. Repeated saves replace the same date's one Saved Day. This is a requested outcome, not an assertion about current implementation.

## Earlier unresolved context

| Original IDs | Remaining report / question |
| --- | --- |
| 1, 5 | Plan's editing/draft state after Continue Here or relinquishing a session; preserve the independent draft |
| 2 | Repeated unsaved-day reminders after another device saved the day |
| 3 | Kept-version choices lack enough explanation of differences and provenance |
| 4, 6 | Initial iPad Drive sync stalls and its progress display appears static |
| 9 | Verification/recheck visibility and completion on real mobile devices; prior partial fixes exist |
| 10, 12 | Confirm retention/cleanup convergence on devices; reloads may discard in-memory cleanup progress; question frequency of full session checkpoints |
| 14, 16 | Slow Drive requests and overall UI lag; optimizations require relevant measurements, not speculative rewrites |
| 15 | Mobile pages freeze in the background. No new background server/service is planned; any device completing Drive cleanup benefits all |

Historical fixes for 7 (safe areas), 8 (verification wording), 10 (abandoned upload markers), 13 (recovery snapshot interference) and initial sync delays are retained in the source record. They are not new investigations here. Historical migration-removal waiting instructions are superseded on this branch: canonical-only preparation is already complete.

## Deferred product and engineering work

- First-start Drive profile selection; image enlargement/pan/zoom; notes feature discoverability and possible interface redesign.
- Notification lifecycle/expiry and revalidation of actions; possible expansion of multi-device journey coverage.
- Backup/repository design and handoff-versus-live-sync proposals, transfer efficiency and measured long-session CPU/memory/battery work. Earlier requests for additional backup/background/notes audits remain unscheduled here; conversion does not activate them.
- Future encryption at rest and sign-in/password design. Current local-first behavior and accepted Drive sign-in/storage trade-offs remain. Fully silent background sync needing a server is not planned.
- Very large restore/storage measurements; resumable Drive maintenance planning, duplicate checkpoint capture and module splitting only with evidence. Deployment minification remains deferred. The unregistered diagnostics storage-key observation remains unverified here.
- Smart merge (`mergeThreeWay`) redesign remains explicitly deferred: do not audit or propose changes to it as backlog work. Math equations in notes are also deferred.
- The imported production test programme is historical context; Phase 6/7 and the current execution record control this branch's test work.

Real-device obligations remain: live Drive interruptions/handoff, folder permission changes, Android/iOS suspend/kill/reopen and eviction, Safari cleanup behavior, accessibility/skins and phone audio. See [final certification](VERIFICATION.md#final-certification). These are not claimed covered by simulated tests.
