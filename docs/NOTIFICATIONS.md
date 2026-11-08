# Notifications and sounds

Current feature behavior on `TS-Conversion`, reconciled with production intake `2638619`. [Data policy](DATA-CONTRACTS.md) requires current canonical formats only; [the execution record](../TS-CONVERSION-EXECUTION.md) owns implementation and verification status.

Pop-ups, banners, the Recent list, app sounds and device notifications: who owns them, how each kind behaves, and every producer.

## Ownership and shared contract

Features own execution, cancellation and durable data. `notice-coordinator` owns notification state, severity/priority, acknowledgement, expiry, recurrence, and visual/audio/OS delivery. `interactions` renders toasts and owns decision dialogs. `backup-presentation` is an adapter over the same coordinator, not a second message store. `audio-engine` owns playback only.

Events carry source and stable ID, lifecycle, severity, kind (`tier`), foreground/background intent, message/title, optional operation/occurrence identity, progress and contextual action. Scoped operation handles reject updates after replacement or terminal completion. Dismissal affects presentation only. The existing critical/safety/storage/update/install banner API and the legacy one-shot/OS APIs are adapters owned by this coordinator; feature controllers do not implement their own toast queues or audio policy.

## Kinds

Every pop-up has a kind (`tier`). The kind alone decides how long it stays, where it sits, what it sounds like and whether it waits during study. Producers set it where the default is wrong.

| Kind | Meaning | Stays | Place | Sound (first shown) | During a work block |
| --- | --- | --- | --- | --- | --- |
| `result` | Answers the person's own action | Success/info 4.2 s, warning 7 s, failed until closed | Stream | Its own cue, or Confirm for listed foreground results | Shows |
| `news` | Background news; nothing is blocked | 12 s | Stream | Chime (Full only, at most once every 4 s) | Waits; shows at a support or fixed block, a pause or the end, for its full time |
| `blocking` | Something stops until the person acts | Until closed or resolved | Pinned | Needs you (two soft knocks); Attention if red | Shows |
| `critical` | Data at risk | Until resolved; cannot be closed | Pinned first | Attention | Shows |

Default: foreground → `result`; background success/info → `news`; background warning/error → `blocking`. Red (error) and running or failed operations also stay. A blocking or critical pop-up sounds once per occurrence: an update does not sound again; closing it and raising it again does.

Order: critical, then the other pinned cards (blocking or red), newest first; then the rest, newest first. An update keeps a card's place. There is no hidden queue: every pop-up is in the stack at once and its time runs whether it is in front or behind. At most 32; beyond that the oldest that would fade anyway go first.

## Stack

`interactions` draws the coordinator's pop-ups and the Connect card as one stack in `#sd-toast-region` (top right on a laptop, above the bottom bar on a phone).

- **Collapsed.** Pinned cards in full (two on a laptop, one on a phone), the newest of the rest in full with up to two cards peeking 8 px and 16 px below it, and a bar with "+N more" and Clear all once two or more cards show. Long messages are clamped to six lines (four on a phone).
- **Expanded.** A click on a card or "+N more" opens one scrolling column over a see-through backdrop, with Show less and Clear all. Escape, a click outside or Show less folds it. Times stop while it is open (`setPaused('expanded')`).
- **Opening.** A card whose one button only opens something (Review, Reconnect, Allow access, Enter password, Check for update, Show details, Restore from backup) opens it from a click anywhere on the card, and closes as the button does. Producers mark such buttons `action.opens: true`. Buttons that change data or ownership (Undo, Continue here) and cards with two choices are not marked: clicking those cards expands the stack instead. A card behind the front one expands the stack; a swipe or a text selection is not a click; a closing card takes no more clicks. Such cards show a pointer and lift slightly on hover; the button stays for keyboards and screen readers.
- **Closing.** × closes a card; a sideways swipe (touch or pen, 80 px) does too, and a critical card springs back. Pressing a card's button closes it, except critical cards and decisions that close themselves once settled. Clear all closes everything that can be closed, the Connect card too. Closing hides a pop-up only; the work and the condition are unaffected.
- **Screen readers.** Pinned and front cards are read as they are. Cards behind or hidden are hidden from screen readers too, as from sight; each one that arrives there is read once through a polite live line, and "+N more" (`aria-expanded`) opens the full list.
- **Reduced motion.** No slide or scale.

## Recent

The profile panel lists today's pop-ups and banners (critical, unsaved work, storage), newest first, at most 20: time, title, message, and the card's button while what it points to still stands (until it is resolved, even after the pop-up was closed); a row whose button only opens something opens it from anywhere on the row. The panel shows the three newest; Show all lists the rest. Clear empties it. It survives a reload in the same window (sessionStorage `studyDirector.notifications.v1`, `{version, scope, entries}`, tied to the profile and to today; registered in `contracts/data-architecture.mjs`) and is never uploaded, backed up or exported. News that faded untouched since the panel was last opened is unseen: the profile indicator's blue badge shows the count ("N new notifications" in its label) when nothing more important needs the person, and opening the panel marks them seen. Pointing at a card marks it seen too.

## Sounds

Seventeen Quiet Wood cues are made in code (`audio-engine.js`, 22.05 kHz, each under 1.6 s); no sound file is used. Four were added for occasions that were silent:

| Cue | Phrase | Occasion | Minimal |
| --- | --- | --- | --- |
| `fixed-start` | Settle: D5–A4–D4 falling, the mirror of Begin | A fixed block stops the timer; a device notification instead while the app is in the background; silent when the person was away (the choice waits on return) | Yes |
| `session-moved` | Hand-off: B4–D5–A4, ending open | The session continues on another device; device notification in the background. The device that continues plays Resume when its timer starts (Continue Here, Restore Session) | Yes |
| `needs-you` | Knock: A4 A4, two soft knocks at three quarters level | An amber blocking pop-up; the storage banner (storage problems and backup reminders) | Yes |
| `news` | Chime: A4–F#5, a light sixth at 0.6 level | News when it first shows | No |

Red blocking and critical pop-ups and the unsaved-work banner play Attention. Banners sound once per new line and again only after they clear and return; Local saving failed keeps its Attention from the `local-saving` event.

## Producer inventory

| Producer / code owner | Identity and lifecycle | Presentation / action |
| --- | --- | --- |
| Local persistence health, active-session saves, note conflicts — host storage-health integration | `local-saving` per failing store plus critical/safety condition IDs; failed until resolved | Highest-priority persistent visual warning with keep-tab-open/recovery guidance; attention once per failure/escalation; editor save indicators remain local |
| Browser data clearing — host storage-reset coordinator | `storage-reset/restored` news (12 s) when the newest Device Folder version saved before the clear added back missing Saved Days and attachments (it gives the counts and the backup time); otherwise `storage-reset/detected`, critical (pinned first, cannot be closed) until Continue, a verified restore/combine, or a user-made backup. It comes back after a reload while the clear is unresolved | The automatic recovery reports inline under Device Folder only. The decision toast is non-dismissible with two actions, Restore from backup and Continue with current data. It names any open data that could not be saved again. Automatic Device Folder and Drive publication is paused until then. Attention once |
| Review explicit Study Day/reflection save — `review.js` | `review/save-study-day`, `save-reflection`; scoped running → succeeded/failed | Existing save status plus one result toast; Full confirmation; committed-local-save outcome survives follow-up refresh/cleanup failure |
| Review clipboard/report and practice-run removal | `review/copy-report` scoped; keyed deletion result | Existing status and one result; contextual UI remains available |
| Plan validation/draft/reapply — `plan.js` | `plan/plan-status`; inline feedback, explicit neutral cancellation | Quiet current Plan status; draft-save failures also enter central storage health; no autosave jingle |
| Saved plans save/rename/default/load/delete | `plan/saved-plan-operation`, per-attempt operation; transient saved-plan feedback | Existing inline status and one completion; coordinator expiry, no controller status timer; load avoids doubling study-start sound |
| Library note create/delete/export and saved-day/library deletion — `library.js` | Scoped `library` operations; generic status IDs for access/validation | Inline results and one completion; cancellation distinct from failure; output wording distinguishes download started from verified file save |
| Attachment upload/import/archive/export/delete/rename — `attachments.ts` | `attachments/attachment-operation` or upload handle; progress bound to handle | Existing progress/details plus summary; operation Cancel retains controller ownership; obsolete progress cannot reopen or overwrite newer results |
| Attachment access, media playback and PDF workspace | Stable access/playback/PDF failure IDs; clear on verified recovery | Actionable visual guidance; playback/download failures remain recoverable; user-played media is content, not notification audio |
| Standalone portable export/import/replace — `backup.ts` | `file/backup-operation`; running → terminal; picker `file-open` condition | Existing File Backup surface and one result; native picker cancellation silent; explicit recovery outcomes |
| Startup interrupted-restore journal recovery | `file/startup-recovery`; background scoped running → succeeded/failed | Quiet Library summary; failure additionally enters existing fail-closed safety system; successful local rollback does not claim external verification |
| Device Folder automatic/manual backup — backup engine, `device-backup.ts` for the folder | `device-folder` operation, verified state, one permission notice per launch | Automatic success quiet; manual progress and one result; a stored folder that needs permission again gets one blocking pop-up with Allow access; retries that ran out get one red blocking pop-up; last-verified status derived from verified state |
| Drive backup — `backup-provider.ts` | Provider source `google-drive`, scoped foreground or `external-backup` operation | Same lifecycle policy as Device; inline progress remains accessible outside the overlay; source-specific settings/reconnect action. Sign-in expired, backup password, a version from a newer app: blocking; retries that ran out: red blocking; sync review: news |
| Managed Versions / Device and Drive restore/combine — `backup-recovery-host.ts` | Source-scoped operation handle lent to nested work | Existing decision and Versions overlays; close/reopen retains coordinator summary; local commit, external pending and external verified stay separate |
| Backup encryption settings | `backup-protection/settings` failure/resolution | Existing inline encryption hint; no extra toast; manage/unlock dialog remains the decision surface |
| Backup diagnostics clipboard | `diagnostics/copy-backup` scoped lifecycle | Quiet inline success expiry or persistent clipboard failure guidance; no jingle |
| Timer start/pause/resume/skip/block/day/overtime/fixed block — `timer-engine.ts` and host lifecycle | `timer/execution`, operation generation and occurrence identity | Existing study surfaces plus central semantic cue; block completion/next-start and plan/start combine into one transition; a fixed block that stops the timer plays Settle (device notification in the background, silent when the person was away) |
| Pomodoro — `pomodoro.ts` | `pomodoro/reminder` scoped occurrence and resolution | Existing study cue; coordinator chooses custom foreground sound or permitted background OS delivery |
| Practice — `practice-pacer.ts` | `practice/pace`, near/target occurrence | Existing timer/pacing visuals; mode and user cue eligibility control sound |
| Session suspend/restore/reset/discard/hand-off — host | Keyed `session` outcomes; execution handle invalidated as appropriate | Existing one-shot confirmations; mutation and decision dialogs remain controller-owned. `session-yield` (continued on another device) is news with Hand-off, a device notification in the background, and Review (what this device recorded, kept for review); `session-handoff` (ready to continue) is news; Continue Here and Restore Session play Resume |
| Connect Google Drive card — host (`renderDriveConnectCard`, model `backup-presentation.connectProgress`) | Reads provider status and the `external-sync`/`external-backup` progress events from Connect until the first sync ends; not a coordinator producer | A card of the stack: first after the pinned cards, counted in "+N more", closed by Clear all; steps, counts and an ending with at most one action; Synced closes itself after 6 s |
| Continue Here — host (`continueSessionHere`; from the hand-off pop-up or the profile panel `continueSessionOnExecute`, which opens Execute first) | Steps shown in the Execute card's live line and the Plan strip; failure `session/session-continue` error toast | Buttons read "Continuing…" until it ends; the failure also stays in the Execute card until the next try or the session moves on |
| Kept versions — host (`KeptVersions`) | `sync/kept-new` news (12 s, Review) when versions kept for review first appear in this run; resolved when none are left | Not for those present at start-up, while the Connect card is showing, or when every new one is the session this device just yielded (its own pop-up says so) |
| Study-timer hold — `notice-coordinator` `setStudying`, host from the timer mode and the current block | News is kept but not shown while this device's timer runs on a work block | It shows at a support or fixed block, a pause or the session's end, for its full time, with its chime; one resolved meanwhile never shows. Blocking and critical pop-ups and results of the person's own actions show at once |
| Save/backup reminders and rollover | Legacy `notifyUser` → coordinator `deliverSystem`, stable tag/occurrence | Coordinated OS transport plus existing safety/banner/inline state; no second app jingle |
| App sounds/device notification settings | `system-settings` keyed outcomes; mode is persisted personal preference | Full / Minimal / Off, test exceptions and permission reporting; device notification permission is separate from app audio |
| Insights computation — `insights.js`, host capability port | `insights/report`; scoped running → succeeded/failed/cancelled | Existing inline loading/retained-view/retry UI; silent navigation and computation; stale generations do not replace newer views |
| Storage/recovery, startup failure, update and installation — host notice bridge | Stable banner condition IDs; acknowledge/resolve/recurrence | Existing ranked banner, contextual protect/update/install action; installation yields to higher priority. Unsaved work and startup failure play Attention, storage (with backup reminders) Needs you, once per new line; critical, unsaved-work and storage banners enter Recent |
| Background cleanup and maintenance | Concurrent operational traces and current-state diagnostics; no routine notification event | Yield/defer/preemption stays diagnostic; actual backup/storage faults use the appropriate condition above |

## Deliberately local UI state

The profile status indicator (ring and badge on the sidebar name, the phone circle and the profile panel; [status-indicator.md](areas/status-indicator.md)) is derived from current state and Recent's unseen count and is not a notification producer: it emits no events, toasts or sounds.

Editor autosave glyphs, timer counters and study eligibility, form validation inside decision dialogs, consent/restore choices, loading shells, empty states, search counts, and native media controls remain with their feature UI. They are not independent toast/audio/OS producers. Operation outcomes above use coordinator state. Rendering and DOM transition caches contain elements, not a second notification history; Recent is the coordinator's own day list. Provider caches contain repository data, not a competing message history.

The only app-generated audio playback entry is the coordinator's audio port (including explicit Test sound). The only OS constructors/delivery calls are in the host transport adapter, which rechecks enablement, permission, ownership and freshness after awaiting service-worker registration. The service worker handles notification clicks; it does not invent a separate alert policy.

Device Folder and Drive share the same compact location labels and inline summary formatting. Both describe backup/restore/combine progress and retain a single success tick at completion, including quiet automatic Device backup. The global third-line freshness summary is removed; provider verification timestamps still persist. Success marking belongs to rendering and never emits another notification or changes pending external convergence into verified backup.

## Required behavior

- At most one sound per accepted occurrence; rendering, progress, re-opening, stacking, expanding and retry bookkeeping never replay it. A sound never cuts off a more important one that is still playing.
- Expired loading/unlock opportunities are discarded; stale operation, occurrence or lifecycle callbacks cannot deliver.
- Errors retain priority over routine results; local-save attention overrides routine study cues.
- Off fades active app audio immediately, fences pending audio and requests silent OS delivery where supported. Test sound is an explicit one-shot exception.
- Resolving a condition resets acknowledgement and failure recurrence. A retry alone does not repeatedly sound an unresolved failure.
- Inline backup results remain reopenable after toast expiry. Explicitly transient inline feedback expires centrally and cannot resurrect an older message.
- A newer operation owns a shared inline surface; an older operation's late progress or completion cannot take it back.
- Local recovery success is not external backup success. Pending convergence remains pending until verification actually succeeds.
- Permissions and operations stay feature-owned; coordinator actions navigate/reopen or invoke an explicitly requested feature action.
- A system notification click **focuses an existing in-scope Study Director client without calling `navigate`**; this avoids bypassing dirty-work/page-save safeguards. With no in-scope client, the service worker opens only an origin-and-scope-validated notification URL (or the app root). It never treats the OS click as permission to reset an existing route.

## Coordinator events

The shared immutable event contract carries `source`, `id`, `operationId`, `severity` (`info`, `success`, `warning`, `error`), `lifecycle` (`running`, `succeeded`, `failed`, `cancelled`, `resolved`), `foreground`, `title`, `message`, optional numeric `progress`, optional `action` (`label`, `run`), and `surface` (`toast`, `inline`, `quiet`). Background success/cancellation defaults to the quiet surface. Presentation actions run only on explicit activation. Progress carries a stage, completed/total item counts and completed/total byte counts.

- `emit(event)` publishes a condition by source/id. Identical publications do not restart expiry or undo acknowledgement. `resolveEvent(source,id)` clears the condition and re-arms identical recurrence.
- `notify(options)` adapts existing one-shot interaction messages. It deduplicates visible repetitions, while a later foreground result can appear again after the previous result expired or was dismissed. Unspecified severity is neutral; known failure callers explicitly report errors.
- `begin(event)` establishes a new operation generation and returns a scoped `read()` / `update(patch)` / `resolve()` handle. A replaced generation cannot overwrite or clear the current one. Terminal outcomes reject later progress. Controllers must retain this handle in the operation closure rather than discover the current handle in a delayed callback.
- How long a pop-up stays, where it sits and its order follow its kind (above). One coordinator deadline timer manages pop-up expiry and explicitly transient inline feedback (`retainInline:false`). Hover, keyboard focus, a hidden page and the expanded stack pause the remaining time; removal cleans stale pause reasons. Active operations and unresolved failures stay until resolved or closed.
- The existing top notice region retains local-save failure > safety > storage > update > installation ordering. Acknowledgement suppresses the current condition; resolving it clears that suppression and resets the live announcement.

## Inline feedback

Device Folder, Drive and portable controllers publish directly through the shared backup presentation port. Recovery lends its event handle to nested work. The host renders coordinator-owned inline events beside the backup rows, preserving progress when an operation overlay closes. Existing Settings/Versions actions can reopen active operations. Device automatic backup retains its existing quiet inline presentation, with operation-specific busy labels. Recovery outcomes name local verification and provider-specific pending/verified backup state separately.

Provider transport caches retain operational repository metadata. Review saves, clipboard export, Library exports/deletions and attachment operations use the coordinator’s scoped presentation port. Optional `surfaceId` identifies the existing inline status node; a single host subscriber projects its latest event. Local save failures have the highest-priority persistent banner with recovery guidance. A committed save followed by a refresh or cleanup error explicitly retains the local-save-completed outcome. Editor autosave indicators and decision dialogs remain feature-owned.

Plan, saved-plan operations, generic Review/Library/recovery feedback, attachment access failures, backup encryption errors, clipboard diagnostics and Insights computation outcomes also use coordinator state. The host projects inline messages using a coordinator-issued surface revision: an operation keeps its initial surface precedence so late callbacks cannot overwrite a newer operation, while a new unscoped feedback occurrence can supersede older content. Expired transient feedback leaves the surface empty rather than resurrecting an older message. Scoped reads check generation even when a caller reuses an operation ID. Startup journal recovery is a background running/succeeded/failed operation, not an error-shaped progress message.

## Sound policy and settings

Sound is an output of the notification coordinator, not a Pomodoro setting. `configureDelivery` installs the audio and OS transport ports and the current tab/visibility predicate. Semantic event occurrences (`cue`, `occurrence`, `operationId`, optionally `system`) retain feature provenance. Features never select assets or audio frequencies. Timer start/resume/pause, combined block advancement, study-day completion, Pomodoro and practice cues are scoped through the coordinator. The Pomodoro module owns rhythm and break eligibility only.

The central cue policy defines Full / Minimal / Off. Full is the initial default; explicit changes persist as optional `soundMode` in typed PortablePreferences v2 within appMeta, including portable backup round trips. Existing records remain canonical without the optional field. An existing `nudge.sound:false` is read as Off only when the new field is absent; saving rhythm writes the current global sound mode and removes sound from new rhythm configuration. There is no migration framework or new store. Device permission and screen wake preferences remain device-local.

Full adds short pause/resume/skip, near-target and explicit successful-operation cues. Minimal retains core study milestones, Pomodoro/break/overtime/target cues and actionable failures. Autosaves, normal automatic backup completion, cleanup, navigation and progress are silent. Failure conditions sound on first appearance, severity escalation, or recurrence after success/resolution; retries and reopening never replay them. Sound acceptance is separate from visual dismissal and operation cancellation.

The coordinator fences delayed playback by operation generation, occurrence, lifecycle, semantic cue, visibility, ownership, sound mode and a 1.2-second loading deadline. It drops lower-priority cues during attention playback. Off and ownership/page lifecycle changes invalidate pending playback and fade current audio. Test sound is an explicit one-shot exception, without changing preferences or interrupting attention cues. No audio is queued for a future unlock.

The private `audio-engine` makes a bounded catalogue of seventeen cues in code (thirteen original, four added in November 2026; Sounds, above), plays them as buffers with short fades, reports readiness, keeps each cue once made, makes a cue again for a new event if making it failed, and releases source/gain nodes. Its AudioContext is closed on disposal. The cues are the original Quiet Wood family: short D-major/pentatonic phrases of plucked-string notes (eight damped, slightly inharmonic partials over a quiet wooden body) with two early reflections, normalised to one loudness, mono at 22.05 kHz. They are acoustic-style modal synthesis, not recordings. The recipe (`PHRASES`, `tone`, `render` in `audio-engine.js`) reproduces the WAV files that shipped before (identical but for three samples one step apart), so no sound files ship or are precached. After sound is unlocked the engine makes every cue in idle moments, one at a time (about 160 ms in all on a desktop), so a cue never waits to be made when it plays. `tests/integration/ui/sound-synthesis.mjs` holds each original cue to the former files' length, peak, loudness and shape.

For foreground study reminders, the coordinator chooses the custom cue; in the background it delegates to permitted OS delivery without deliberately playing an additional app sound. Off requests `silent` OS delivery. The browser adapter rechecks ownership, permission, enablement and occurrence validity after asynchronous service-worker lookup. Legacy OS-only reminders use `deliverSystem` with deduplication and a bounded delivery age. Only explicit settings actions request permission. Device-controlled sound, browser audio interaction requirements and lack of guaranteed closed-app alarms remain platform limits. Transient notification state is never backed up.

Execute settings have two independent panels: compact Pomodoro rhythm with inline validated minutes (commit on blur/Enter), and Focus & Alerts with screen awake, app sounds and device notifications. Both are available without an active session and use shared Director/Glass tokens. Numeric values remain editable with rhythm disabled; native radios provide the mode selector's keyboard behavior. There is one Test sound action and one device-notification test, with no per-cue catalogue or volume slider.
