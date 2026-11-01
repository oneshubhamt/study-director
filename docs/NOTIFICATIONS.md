# Notification coverage and delivery contract

This is the current SDVB75EA coverage inventory, audited from notification producers, presentation adapters, direct status writes, audio/OS calls and feature operation boundaries. It is not inferred solely from test names. See `VERIFICATION.md` for results and platform gaps.

## Ownership and shared contract

Features own execution, cancellation and durable data. `notice-coordinator` owns notification state, severity/priority, acknowledgement, expiry, recurrence, and visual/audio/OS delivery. `interactions` renders toasts and owns decision dialogs. `backup-presentation` is an adapter over the same coordinator, not a second message store. `audio-engine` owns playback only.

Events carry source and stable ID, lifecycle, severity, foreground/background intent, message/title, optional operation/occurrence identity, progress and contextual action. Scoped operation handles reject updates after replacement or terminal completion. Dismissal affects presentation only. The existing critical/safety/storage/update/install banner API and the legacy one-shot/OS APIs are adapters owned by this coordinator; feature controllers do not implement their own toast queues or audio policy.

## Producer inventory

| Producer / code owner | Identity and lifecycle | Presentation / action |
| --- | --- | --- |
| Local persistence health, active-session saves, note conflicts — host storage-health integration | `local-saving` per failing store plus critical/safety condition IDs; failed until resolved | Highest-priority persistent visual warning with keep-tab-open/recovery guidance; attention once per failure/escalation; editor save indicators remain local |
| Browser data clearing — host storage-reset coordinator | `storage-reset/restored` success toast (12 s) when the newest Device Folder version saved before the clear added back missing Saved Days and attachments (it gives the counts and the backup time); otherwise `storage-reset/detected`, a persistent warning until Continue, a verified restore/combine, or a user-made backup. It comes back after a reload while the clear is unresolved | The automatic recovery reports inline under Device Folder only. The decision toast is non-dismissible with two actions, Restore from backup and Continue with current data. It names any open data that could not be saved again. Automatic Device Folder and Drive publication is paused until then. No sound |
| Review explicit Study Day/reflection save — `review.js` | `review/save-study-day`, `save-reflection`; scoped running → succeeded/failed | Existing save status plus one result toast; Full confirmation; committed-local-save outcome survives follow-up refresh/cleanup failure |
| Review clipboard/report and practice-run removal | `review/copy-report` scoped; keyed deletion result | Existing status and one result; contextual UI remains available |
| Plan validation/draft/reapply — `plan.js` | `plan/plan-status`; inline feedback, explicit neutral cancellation | Quiet current Plan status; draft-save failures also enter central storage health; no autosave jingle |
| Saved plans save/rename/default/load/delete | `plan/saved-plan-operation`, per-attempt operation; transient saved-plan feedback | Existing inline status and one completion; coordinator expiry, no controller status timer; load avoids doubling study-start sound |
| Library note create/delete/export and saved-day/library deletion — `library.js` | Scoped `library` operations; generic status IDs for access/validation | Inline results and one completion; cancellation distinct from failure; output wording distinguishes download started from verified file save |
| Attachment upload/import/archive/export/delete/rename — `attachments.js` | `attachments/attachment-operation` or upload handle; progress bound to handle | Existing progress/details plus summary; operation Cancel retains controller ownership; obsolete progress cannot reopen or overwrite newer results |
| Attachment access, media playback and PDF workspace | Stable access/playback/PDF failure IDs; clear on verified recovery | Actionable visual guidance; playback/download failures remain recoverable; user-played media is content, not notification audio |
| Standalone portable export/import/replace — `backup.js` | `file/backup-operation`; running → terminal; picker `file-open` condition | Existing File Backup surface and one result; native picker cancellation silent; explicit recovery outcomes |
| Startup interrupted-restore journal recovery | `file/startup-recovery`; background scoped running → succeeded/failed | Quiet Library summary; failure additionally enters existing fail-closed safety system; successful local rollback does not claim external verification |
| Device Folder automatic/manual backup — backup engine, `device-backup.js` for the folder | `device-folder` operation, verified state, one permission notice per launch | Automatic success quiet; manual progress and one result; a stored folder that needs permission again gets one dismissible toast with Allow access; repeated failures get one dismissible notice; last-verified status derived from verified state |
| Drive backup — `backup-provider.js` | Provider source `google-drive`, scoped foreground or `external-backup` operation | Same lifecycle policy as Device; inline progress remains accessible outside the overlay; source-specific settings/reconnect action |
| Managed Versions / Device and Drive restore/combine — `backup-recovery-host.js` | Source-scoped operation handle lent to nested work | Existing decision and Versions overlays; close/reopen retains coordinator summary; local commit, external pending and external verified stay separate |
| Backup encryption settings | `backup-protection/settings` failure/resolution | Existing inline encryption hint; no extra toast; manage/unlock dialog remains the decision surface |
| Backup diagnostics clipboard | `diagnostics/copy-backup` scoped lifecycle | Quiet inline success expiry or persistent clipboard failure guidance; no jingle |
| Timer start/pause/resume/skip/block/day/overtime — `timer-engine.js` and host lifecycle | `timer/execution`, operation generation and occurrence identity | Existing study surfaces plus central semantic cue; block completion/next-start and plan/start combine into one transition |
| Pomodoro — `pomodoro.js` | `pomodoro/reminder` scoped occurrence and resolution | Existing study cue; coordinator chooses custom foreground sound or permitted background OS delivery |
| Practice — `practice-pacer.js` | `practice/pace`, near/target occurrence | Existing timer/pacing visuals; mode and user cue eligibility control sound |
| Session suspend/restore/reset/discard — host | Keyed `session` outcomes; execution handle invalidated as appropriate | Existing one-shot confirmations; mutation and decision dialogs remain controller-owned |
| Save/backup reminders and rollover | Legacy `notifyUser` → coordinator `deliverSystem`, stable tag/occurrence | Coordinated OS transport plus existing safety/banner/inline state; no second app jingle |
| App sounds/device notification settings | `system-settings` keyed outcomes; mode is persisted personal preference | Full / Minimal / Off, test exceptions and permission reporting; device notification permission is separate from app audio |
| Insights computation — `insights.js`, host capability port | `insights/report`; scoped running → succeeded/failed/cancelled | Existing inline loading/retained-view/retry UI; silent navigation and computation; stale generations do not replace newer views |
| Storage/recovery, startup failure, update and installation — host notice bridge | Stable banner condition IDs; acknowledge/resolve/recurrence | Existing ranked banner, contextual protect/update/install action; installation yields to higher priority |
| Background cleanup and maintenance | Concurrent operational traces and current-state diagnostics; no routine notification event | Yield/defer/preemption stays diagnostic; actual backup/storage faults use the appropriate condition above |

## Deliberately local UI state

The profile status indicator (ring and badge on the sidebar name, the phone circle and the profile panel; [STATUS-SYSTEM.md](STATUS-SYSTEM.md)) is derived from current state and is not a notification producer: it emits no events, toasts or sounds.

Editor autosave glyphs, timer counters and study eligibility, form validation inside decision dialogs, consent/restore choices, loading shells, empty states, search counts, and native media controls remain with their feature UI. They are not independent toast/audio/OS producers. Operation outcomes above use coordinator state. Rendering and DOM transition caches contain elements, not a second notification history. Provider caches contain repository data, not a competing message history.

The only app-generated audio playback entry is the coordinator's audio port (including explicit Test sound). The only OS constructors/delivery calls are in the host transport adapter, which rechecks enablement, permission, ownership and freshness after awaiting service-worker registration. The service worker handles notification clicks; it does not invent a separate alert policy.

Device Folder and Drive share the same compact location labels and inline summary formatting. Both describe backup/restore/combine progress and retain a single success tick at completion, including quiet automatic Device backup. The global third-line freshness summary is removed; provider verification timestamps still persist. Success marking belongs to rendering and never emits another notification or changes pending external convergence into verified backup.

## Required behavior

- At most one sound per accepted occurrence; rendering, progress, re-opening and retry bookkeeping never replay it.
- Expired loading/unlock opportunities are discarded; stale operation, occurrence or lifecycle callbacks cannot deliver.
- Errors retain priority over routine results; local-save attention overrides routine study cues.
- Off fades active app audio immediately, fences pending audio and requests silent OS delivery where supported. Test sound is an explicit one-shot exception.
- Resolving a condition resets acknowledgement and failure recurrence. A retry alone does not repeatedly sound an unresolved failure.
- Inline backup results remain reopenable after toast expiry. Explicitly transient inline feedback expires centrally and cannot resurrect an older message.
- A newer operation owns a shared inline surface; an older operation's late progress or completion cannot take it back.
- Local recovery success is not external backup success. Pending convergence remains pending until verification actually succeeds.
- Permissions and operations stay feature-owned; coordinator actions navigate/reopen or invoke an explicitly requested feature action.
- A system notification click **focuses an existing in-scope Study Director client without calling `navigate`**; this avoids bypassing dirty-work/page-save safeguards. With no in-scope client, the service worker opens only an origin-and-scope-validated notification URL (or the app root). It never treats the OS click as permission to reset an existing route.
