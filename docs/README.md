# Documentation

Start here. Read the page for the area you are changing; the code is the final authority. Keep each page current: change it in the same pull request as the code it describes, and keep history out of it.

| Page | What it covers |
|---|---|
| [architecture.md](architecture.md) | What the app is, how it is composed, where code lives, and the core safety rules |
| [workflow.md](workflow.md) | How to work, choosing tests, commands, build, release, CI and real-device acceptance |
| [backlog.md](backlog.md) | Open work, decisions to make, and what has not been checked yet |
| [test-programme.md](test-programme.md) | The test suite programme: full plan, rules and status (deleted when it ends) |
| [history.md](history.md) | A short record of past work and dropped ideas |

**Areas**

| Page | What it covers |
|---|---|
| [Data and storage](areas/data-and-storage.md) | IndexedDB, OPFS and browser storage; profiles and devices; record names; data a build cannot read; emergency copies; browser data clearing; compatibility and migration |
| [Backup and sync](areas/backup-and-sync.md) | The backup engine, Device Folder and Google Drive, Version History, restore and Combine, retention, sync between devices and its decisions, standalone backup files, integrity |
| [Study session](areas/study-session.md) | The Active Session and timer, which device runs it, Continue Here and hand-off |
| [Notes](areas/notes.md) | What notes do and why, saving, identity, links, tags, Recently deleted, clashes, the editor (Wordgard) |
| [Notifications and sounds](areas/notifications.md) | Pop-up kinds, the stack, Recent, sounds, device notifications, every producer |
| [Status indicator](areas/status-indicator.md) | The sync and background ring and badge, the profile panel's Sync & backups section, the Connect card |
| [Background jobs](areas/background-jobs.md) | Every job that runs on its own, the standard each meets, limits, diagnostics and data-safety boundaries |
| [App updates](areas/app-updates.md) | The service worker, safe update and caches |
| [Interface](areas/ui.md) | Themes and skins, typography, motion, the Library's layout |

Also: [AGENTS.md](../AGENTS.md) (rules for every AI agent), [CONTRIBUTING.md](../CONTRIBUTING.md), [tests/README.md](../tests/README.md) (test layers and rules), the project [README](../README.md) (building and running).

A new area of the app gets its own page under `areas/` when it has decisions or rules that the code alone does not make clear. Small features need no page.
