# Notes, Areas and the editor

This is the current feature contract and implementation map. The original notes plan, decisions and historical measurements are preserved in [product history](history/PRODUCT-DEVELOPMENT.md); they are not unfinished tasks or a historical migration specification. Current limits come from [production-limits](../contracts/production-limits.mjs).

## Identity and organization

A note has a permanent ID (stored as `key`), a title/path (`label`), text, update time and optional linked-note IDs. Titles organize the tree; IDs preserve links, attachment references, trash and earlier versions across rename/move. A schedule block opens the note whose title matches its Area. Renaming can also update today's/saved plans through the existing choice; recorded past days retain their original evidence.

The Library has Notes, Days and Data sections. Notes supports tree/name order, recently edited order, search, tags and an open-note editor; phones use list-then-note navigation. Days contains Diary and Saved Days; Data contains backup controls, files and storage. These are presentation boundaries, not separate copies of note data.

The current governed limits include 2,000 notes, 20,000 rich-text words and 50 linked notes per bar. Recently deleted is retained for 30 days under current maintenance rules. Treat those as source-governed limits; do not add competing constants in feature code.

## Writing, linking and portability

The authored editor supports formatting, lists/checklists, quotes, tables, web/note links, tags and image/PDF/audio references. Focus/workspace overlays and attachment previews have explicit lifetimes. It is not a media-annotation system or a general database/workspace product.

The linked-notes bar stores IDs, not duplicated content; backlink lists are derived. Inline note links and tags are encoded in supported rich text. Search highlights matching text and offers navigation through matches; editing/dismissal clears transient highlights. Exports preserve the supported content through the existing codecs rather than exposing editor internals.

Text/Markdown import creates new notes within supported size/count constraints and routes rich content through the existing sanitization path. Printing targets the note title/content/images. Markdown features outside the supported subset are retained as text where the importer specifies; do not promise arbitrary Markdown or document-format fidelity.

## Save and conflict lifecycle

`save-lane.ts` serializes saves for each stored target, coalesces newer edits and retries retained failures. Notes, Diary reflections and Review reflections share this scheduling mechanism; their owning repositories decide where and how values commit. A write result, not the presence of a timer, determines persistence.

`repositories-notes.ts` owns canonical note persistence, cached edits, conflict/recovery behavior and reference-aware operations. Rescue copies protect unsaved values when possible. Ownership handoff, dirty edits, late writes, deletion recovery and browser-data clearing must be checked together; do not replace newer live state with an older canonical read merely because it arrived later.

Save cadence is an implementation policy, not a hard crash-loss guarantee. Native I/O, throttling, failed writes and storage loss can delay or prevent durability. Preserve explicit saving/failure feedback and the existing conflict-copy/recovery paths.

## Earlier versions and deletion

Earlier versions come from retained Device Folder/Drive checkpoints, not a separate note-version database. The history combines available copies and distinguishes texts; a single-note restore uses verified note/asset objects, opens the existing comparison, and does not replace unrelated app data or establish a whole-app reconciliation base. No connected retained backup means no such earlier-version source. Ordinary portable backup files are imported through backup recovery, not indexed as note-version storage.

Current retention can include hourly note changes as well as longer-period checkpoints; the old “one version per day only” assumption is retired. [Backup engine](BACKUP-ENGINE.md) owns the current retention policy.

Delete moves a note into Recently deleted; Restore and Delete forever use the existing explicit actions. Attachment cleanup must retain bytes referenced by trash/recovery state. Deletion ledgers and canonical IDs preserve reconciliation meaning; removing a note is not permission to discard unsaved/conflicting content elsewhere.

## Code and evidence map

| Concern | Owners / relevant check surfaces |
| --- | --- |
| Canonical notes, rescue and conflicts | `source/core/repositories-notes.ts`, `record-codecs.ts`, `save-lane.ts`; storage/notes/deletion recovery tests |
| Notes UI and links | `source/core/library.js`, `note-links.js`, host adapters; notes-management, contextual-link and library selection journeys |
| Editor and serialization | Authored `rich-text/` and its adapter/codecs; rich-text unit/integration/browser checks |
| Search | Authored `rich-text/search-worker.ts` and Library integration; search/capacity tests |
| Export/import/print | `source/core/note-export.js`, `portable/`, editor codecs and host printing; exports/notes tests |
| Earlier versions | `backup-recovery-host.ts`, `backup-provider.ts`, `backup.ts`, `reconciliation-ui.js`; note-scope restore/history tests |

Wordgard stays byte-for-byte unchanged. Our editor and adapters can evolve through reviewed source; generated bundles come from the builder. See [adapter notes](../rich-text/wordgard-patches/README.md). Test names here identify relevant evidence locations, not a claim they were rerun for this documentation update.
