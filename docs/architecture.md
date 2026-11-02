# Architecture

Study Director is a local-first study planning app, installed as a PWA. A person plans a day of study blocks (Plan), runs them with a timer (Execute), reflects (Review), keeps notes and saved days (Library) and looks back over time (Insights). Everything lives on the device; Google Drive and a Device Folder are optional backup destinations, and Drive also syncs a person's devices. There is no server.

This page is the overview. Each area has its own page ([README.md](README.md)); the code is the final authority.

## Composition

Application subsystems are registered as private internal modules and composed by the host. Modules receive narrow frozen capability ports instead of resolving one another freely. The internal registry validates module identity and exported contract versions at the host boundary.

Large feature areas remain separate when their failure models differ. Google Drive and the Device Folder are two independent destinations served by one backup engine (`backup-provider.js`): they share repository format, publication/verification algorithms, restore, cleanup, integrity and scheduling code, but each owns its transport state and checkpoint history. A device publishes verified canonical local state independently to each destination; providers never wait for or copy checkpoints from one another. Drive additionally owns multi-device synchronization and the lightweight Active Session ownership-claim transport (`drive.js`); Device Folder remains a local backup destination (`device-folder-storage.js` with the thin `device-backup.js` controller).

## Where things are

| Path | What |
|---|---|
| `source/app.html` | The host: composes the modules, gathers state, draws most screens and wires actions |
| `source/core/` | Internal modules, each behind a narrow capability port |
| `source/external/` | Workers, the Drive transport, the rich-text editor and Wordgard, skins, Insights |
| `source/styles/` | Core styles and skin styles |
| `rich-text/`, `portable/` | Authored sources for the generated editor and worker bundles |
| `contracts/` | Data, limits, compatibility and identity contracts that code and tests share |
| `build/` | Build, bundling, verification and deployment staging |
| `tests/` | unit, integration, browser and architecture tests ([tests/README.md](../tests/README.md)) |
| `release.config.mjs` | The one source of release identity |
| `dist/` | Generated output; never edited by hand |

Main modules by area:

| Area | Modules |
|---|---|
| [Data and storage](areas/data-and-storage.md) | `persistence.js`, `repositories.js`, `repositories-notes.js`, `record-codecs.js`, `canonical.js`, `app-meta.js`, `profiles.js`, `compatibility*.js`, `asset-storage.js`, `attachments.js` |
| [Backup and sync](areas/backup-and-sync.md) | `backup-provider.js` (the engine), `managed-repository.js`, `backup.js`, `backup-capture.js`, `backup-codec.js`, `device-folder-storage.js`, `device-backup.js`, `external/drive.js`, `reconciliation*.js`, `managed-recovery.js`, `backup-recovery-host.js` |
| [Study session](areas/study-session.md) | `session-lifecycle.js`, `timer-engine.js`, `timer-state.js`, `plan.js`, `pomodoro.js`, `practice-pacer.js` |
| [Notes](areas/notes.md) | `repositories-notes.js`, `save-lane.js`, `note-links.js`, `note-export.js`, `library.js`, `external/rich-text.js`, `rich-text/` |
| [Notifications and sounds](areas/notifications.md) | `notice-coordinator.js`, `interactions.js`, `audio-engine.js` |
| [Status indicator](areas/status-indicator.md) | `backup-presentation.js` (status model), host rendering in `app.html` |
| [Background jobs](areas/background-jobs.md) | `operation-lifecycle.js`, `repository-background.js`, `asset-maintenance.js`, `backup-operation-diagnostics.js`, `mutation-coordinator.js`, `ownership.js` |
| [App updates](areas/app-updates.md) | `pwa-lifecycle.js`, the service worker in `source/platform/` |
| [Interface](areas/ui.md) | `navigation.js`, `library.js`, `source/styles/`, `external/glass.js`, `external/aurora.js` |

## Core safety rules

The following invariants should be preserved by future changes:

1. Local canonical data must never depend on the continued existence of a backup repository.
2. A failed/incomplete restore must not leave a half-applied local dataset.
3. A checkpoint is not trusted merely because an upload/write call returned successfully; integrity must be verified.
4. Foreground Backup/Restore must not be permanently blocked by abandoned background-maintenance state.
5. External deletion/recreation of a provider repository must not poison future provider state.
6. Provider-specific failure models remain provider-specific below the shared repository semantics.
7. Compatibility retirement and historical backup readability are separate decisions.
8. Temporary UI locks must release into state derived from the current runtime, not a stale pre-operation DOM snapshot.
9. Generated deployment output is derived from source and is never the canonical place to make changes.
10. Data a build cannot read is never changed, deleted or uploaded over; the build works with everything else ([data-and-storage.md](areas/data-and-storage.md#data-this-version-cannot-read)).
11. Background work belongs to the open app: it is never promised to run while every page is closed, and work with durable intent is found again on the next open ([background-jobs.md](areas/background-jobs.md)).
