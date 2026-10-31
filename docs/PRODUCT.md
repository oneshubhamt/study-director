# Study Director — purpose and product model

Study Director brings planning, execution, reflection and lasting notes into one local-first workspace. It supports people doing sustained study or knowledge work; it is not an examination service, a guarantee of outcomes or a live collaborative document system. This guide describes the product model, not the current implementation schedule. Use the [execution record](../TS-CONVERSION-EXECUTION.md) for that schedule.

## The daily workflow

| Surface | What the person does | What must remain coherent |
| --- | --- | --- |
| Plan | Draft a schedule, assign Areas/tasks, save reusable plans and apply a plan | Editing a draft must not silently replace running-session evidence |
| Execute | Follow the active schedule, track work/breaks, use Pomodoro/Practice Pacer, and write the relevant note | Timer/session state, write ownership and note durability must agree |
| Review | Inspect the day, reflect and save its record | Saved evidence and ongoing session/reflection changes must not overwrite one another |
| Library → Notes | Organize, search, link, tag, import/export and edit durable notes | Permanent note identity survives rename/move; references and earlier versions remain attached |
| Library → Days | Browse Diary entries and Saved Days | Historical days retain their recorded data and meaning |
| Library → Data | Manage backup locations, versions, files and storage | Restore, deletion, verification and pending work remain distinguishable |
| Insights | Inspect aggregates and findings based on recorded study evidence | Unknown/missing evidence must not be presented as measured achievement |
| Guide / display controls | Understand the app and adjust its presentation | Useful navigation, keyboard access and saved preferences remain available |

An Area is a schedule label associated with a note by title. A note has a permanent stored identity; renaming an Area/title is not a new note identity. [Notes and editor behavior](NOTES.md) explains that distinction and the effect of optional plan renaming.

## Data ownership and portability

- Each local profile has its own working library and scoped storage. Profiles support separation on the device; they are not a replacement for browser/OS account security.
- IndexedDB stores structured data; OPFS stores attachment bytes and temporary processing files. Recovery copies and journals protect interrupted operations but share the browser's failure boundary.
- A standalone backup is a portable file. Device Folder and Google Drive hold managed incremental repositories. They use the same canonical records but different transport/storage capabilities.
- Drive sync is optional. Each device keeps a local copy and reconciles through committed backup versions; it is not instantaneous multi-user editing. Concurrent changes may be kept for review.
- Password protection encrypts backup contents. It does not encrypt the app's live browser storage, ordinary note exports or internal recovery journals. The implemented key-retention behavior is documented in [data contracts](DATA-CONTRACTS.md) and the served [privacy notice](../source/legal/privacy.html).
- Offline use depends on the app/resources having been installed or cached and on browser storage remaining available. Background work runs while the application has execution time and access; it is not guaranteed after the app closes.

## Long-term design principles

1. **Preserve the person's work.** Unknown data, failed reads and incomplete verification cannot authorize destructive cleanup. Surface uncertainty rather than quietly treating it as empty.
2. **Keep common actions direct.** Planning, writing, saving and finding notes should remain understandable without knowing storage or backup internals.
3. **One owner for each responsibility.** Feature controllers own actions; common services own saving, background scheduling and notification policy; transports own their storage/network access.
4. **Make durable facts explicit.** Separate saved data from projections, completed local recovery from external backup, and a downloaded file from a read-back-verified save.
5. **Improve without losing useful behavior.** Strict typing and modularity must preserve user workflows, timing and recovery. New abstractions are justified by clearer contracts or demonstrated benefit.
6. **Respect browser boundaries.** Permissions, background throttling, storage eviction and platform APIs vary. A test in one browser does not establish every device's behavior.
7. **Keep visual and functional access aligned.** Director, Glass and Aurora presentations share semantic theme/typography/motion roles; accessibility and reduced motion are behavior requirements, not claims inferred from appearance.

## Product boundaries

The existing notes feature is intentionally focused: rich text, tables, links, images/PDF/audio references, search, tags and organization. It is not a general workspace database or media-annotation suite. Ideas in archived planning notes are not commitments or completed features. Improvements and future features need explicit scope and evidence; they must not be smuggled into a TypeScript conversion.

The canonical-only conversion policy assumes the previous upgrade already happened. It does not promise import of historical formats. Current-format backup/restore, unsupported-data protection and interrupted-operation recovery remain required.

## Engineering references

[Architecture](ARCHITECTURE.md) maps code and lifecycles; [data contracts](DATA-CONTRACTS.md) defines authority and preservation rules; [backup](BACKUP-ENGINE.md), [background work](BACKGROUND-OPERATIONS.md) and [notifications](NOTIFICATIONS.md) own their detailed contracts. [Verification](VERIFICATION.md) describes how claims are checked. Earlier decisions and measurements are preserved in [product history](history/PRODUCT-DEVELOPMENT.md), not presented as current guarantees.
