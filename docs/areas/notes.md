# Notes

Notes are a first-class part of Study Director alongside the timer. This covers what notes do, the decisions behind them, and how they are stored, saved and edited. The Library layout around them is in [ui.md](ui.md).

## Aim and scope

Study Director is a first-class notes app as well as a time tracker, and its notes are treated that way in durability, reliability and features. They should just work: simple, smooth, intuitive and beautiful, in keeping with the rest of the app. They should cover what students and professionals use notes for about 90% of the time, without becoming a full-featured app like Notion or Evernote.

What it covers:
- **Writing:** headings, bold, italic, underline and highlight; lists, checklists, quotes, tables and web links; images, PDFs and audio inside notes; focus mode.
- **Organising:** nested notes, full-text search that updates on each save, and rename, move and merge.
- **Safety:** one save engine with a safety copy; when two saves clash, the losing text is always kept; 30-day Recently deleted; earlier versions from backups; offline use.

- **No separate version history for notes.** Earlier versions come from the backup versions in the Device Folder and Google Drive (four to five months back). Together with undo and redo in the editor and Recently deleted (30 days), that is enough.
- **Accepted limits:**
  - each location keeps one version per day, so changes within a day are not kept separately;
  - someone who uses neither the Device Folder nor Drive has no earlier versions;
  - portable backup files are not a source of note versions.
- **No annotation features** for PDFs, audio or photos.

- **Later:** math equations. Code formatting is supported by the editor and can be switched on if wanted.
- **Not doing:** templates; sharing; drag-and-drop in the tree (Move covers it); a separate Notes tab in the main navigation (notes belong in the Library).
- **Better Smart merge** (`mergeThreeWay`) has room to improve; the owner will come back to it. Until then, do not audit it or suggest changes (owner, 2026-10-18).

## How notes and Areas fit together

- **Two things name a note:**
  - its **permanent id**, given when it is created and never changed;
  - its **title** (the label, such as "Cardiology › Heart failure").
- **The title connects a note to the plan.** A block opens the note whose title matches its Area. That is the only place titles are used to find a note, and two notes never share a title.
- **Everything else uses the id:**
  - saving and clash handling, Recently deleted, and deletion records;
  - backups, earlier versions and restoring a single note;
  - the note an attachment sits in;
  - the linked-notes bar and links inside the text.
- **So a rename changes only the title.** History, links and attachments stay with the note, and the rename dialog's "Also rename it in today's plan and saved plans" decides whether the plan follows (below).

## Features

### Earlier versions
- The list combines both backup locations.
- It holds one entry per distinct text of the note. Each backup records a fingerprint of every note, so identical texts collapse into one entry, whatever their location or time, without downloading anything.
- The note's current text is never listed.
- There is no per-day cap; at most 30 entries, and usually far fewer.
- Labels use plain time, such as "Yesterday" or "3 days ago". When two entries share a date, the time is added.
- **No backup machinery shows:** no locations, checkpoints or tiers. Nobody needs to know how backups work to use earlier versions.
- **Choosing an entry** opens the existing side-by-side note review, which already handles keeping, combining or replacing the text.
- **On Drive,** opening the list reads each version's small index file (up to 25, read together), so it takes a second or two.
- **Where:** "Earlier versions…" stays in the open note's ⋯ menu, with Rename, Move, Export and Delete. The menu stays on the open note rather than moving to the list.

### Import of text and Markdown files

Each file becomes a new note named after the file, at the top level or inside the selected note, within the limits.
- **Plain text:** easy. Each line becomes a paragraph.
- **Markdown:** converted to HTML, then passed through the existing paste cleaner that already turns pasted web pages into note format. Headings, lists, quotes, rules, tables (up to 15 × 15) and bold, italic, strikethrough, highlight and web links come across; `###` and deeper headings become bold lines, as notes have two heading levels.
- **Kept as written:** images, links to other files, task-list boxes and anything else a note cannot hold stay as their Markdown text, so nothing is lost. Code keeps its lines and indentation as plain text.
- **Images inside Markdown files:** not in the first version.
- A title already in use gets " (2)". Files that are not .txt or .md, too large, or past the note limit are named in the result with the reason.

### Linked notes bar

Every note can carry a short list of other notes.
- **Where:** at the bottom of the note, under the text, like sheet tabs in a spreadsheet. With no links it is one small "+ Link note", so it takes no room and asks for no attention until used.
- **In Execute,** while a block runs, the bar reads `[ Heart failure ]  Pharmacology ×   ECG basics ×   +`.
  - The first chip is the block's own note, matched by Area name as today.
  - Tapping any chip switches the editor to that note, and the title line says "Linked · Pharmacology"; tapping the first chip, or the block ending, goes back.
  - `+` searches and adds any note, and `×` removes one.
- **In the Library,** the same bar sits under the note's text, so it can be managed there too.
- **Up to 50** notes on one bar.
- **Combine** keeps the notes either side linked; nothing is lost and nothing is asked.
- **Remembered per subject, not per block.** The list is saved on the note, so every future block of that Area shows it.
- **One-way.** Linking Pharmacology to Heart failure does not put Heart failure on Pharmacology's bar. Pharmacology shows "Linked from: Heart failure" in small text instead; that list is worked out, not stored.
- **Stored:** one optional field on the note, the list of linked note ids. Ids never break on renames or moves.
- **Deleted notes** drop out of every bar, and come back if restored from Recently deleted. Ids of notes deleted for good are removed the next time the note is saved.
- **Earlier versions** restore the note's text only; its bar stays as it is.

### Links inside the text

The Link button gets a "Note" choice, and typing `[[` opens the same picker. Exports keep the linked word as plain text.
- A linked word opens that note when clicked, just as a web link opens a page.
- The link is stored by id inside the note's text, so nothing new is stored and renames never break it.
- A link to a deleted note shows as unavailable, and works again if the note is restored.
- Notes that link to the open one, from either the text or the bar, appear in its "Linked from" line.

### Tags

Tags are written as `#tag` in the text, the way Apple Notes, Bear and Obsidian work.
- **Suggestions:** typing `#` offers existing tags, so near-duplicates like `#revise` and `#revison` don't appear.
- **Look:** tags show as small chips in the text, and clicking one filters the notes list to that tag. In the Library's open note a tap narrows the list beside it and still places the cursor; elsewhere a tap in read-only text, or Ctrl/Cmd-click while editing, opens the Library's notes with that tag.
- **Suggestions in use:** they open by the text at the first letter after `#`, only when another tag starts with it. Enter or Tab takes the highlighted tag; a space, a stop or Esc keeps what was typed.
- **Tag list:** the notes panel lists tags with a count each. Picking one or more filters the list; more than one means "has all of them". One tap clears the filter. Picked tags come first, then the twelve most used; "+N more" shows the rest.
- **Rename everywhere:** renaming a tag changes it in every note, which fixes typos or merges two tags. Rename shows when exactly one tag is picked. Only the text changes: links, attachments and formatting stay.
- **Rules:** capital letters do not matter, and a tag starts with a letter after a space or at the start of a line. So `#1`, `C#` and a Markdown heading are not tags.
- **Storage:** none. Tags are read from the notes' text, each note read again only when it changes, and exports keep them as plain `#tags`. (Built on the main thread rather than in the search worker, because the list and the suggestions need them at once. Step 5 measured it at about 80 ms, once per session, for 2,000 notes, so it stays there.)
- The `#` suggestions, the `[[` picker and the bar's `+` share one picker.

### Notes list and open note

The Notes list is a tree in name order, Support Activities first. A branch opens on its twisty or the Right arrow key and starts open only while it holds today's Areas or the open note; what the person opens or closes is kept for the session. Rows show today's mark and when the note last changed; empty notes and plan placeholders are muted. The list shows 100 rows at a time. Sorting by "Recently edited" lists the notes flat, newest edit first, and search lists matches; both show each note's path. Opening a note while searching marks every match in its text and scrolls to the first, through Wordgard's own decoration API; the arrows or Enter (Shift+Enter backwards) step through them, and an edit or Escape clears them. The list header holds New, Export and an "i" that says what a note is. The open note shows where it sits as a breadcrumb whose parts open their notes, its title (click, or F2, to rename it in place; Escape keeps the name) and when it was last edited. Its ⋯ menu renames, moves (a full name such as "GS2 > Polity"), exports, prints (the title and the text with its images, nothing else on the page) and deletes (Del) it. Parent notes appear as closed "From GS2" sections, drawn when opened and refreshed without disturbing the editor. Support Activities keeps its name and cannot be deleted, so it has no menu. Deleting moves a note to Recently deleted, at the bottom of the list and opening upward, with Undo; a deleted note opens read-only with Restore and Delete forever. On phones the list fills the panel and opening a note shows it full width with a back button.

## Limits and speed

A note holds up to 20,000 words and a library up to 2,000 notes (one limit, `maxNotes`, everywhere). Measured at 2,000 notes holding 2.3 million words (18 MB): the app opens in about 2.5 s and never freezes for more than 0.1 s; typing costs the app under 2 ms a keystroke; search takes 0.25 s the first time and 0.03 s after; a full backup takes 3.0 s. `tests/browser/library/notes-at-limit.mjs` repeats the measurement and fails if it slows again. The tree shows 100 rows at a time, so no faster tree was needed.

## Saving

Notes, Diary reflections and the Review reflection save through one engine, `core/save-lane.js`. Each stored target has a lane: the first change after a quiet moment is written at once, and while typing continues the latest value is written again every 250 ms, one write at a time. A hard crash therefore loses at most 250 ms plus one write of typing, with no separate journal. A failed write keeps that value and retries after 2, 5, 15, 30 and then every 60 seconds until it is saved or replaced. A newer value ends that pause; a failed write that a newer value already replaced is not retried and leaves the newer value's timing alone. Cancelling a lane drops its pending value, and a write still running is not retried. Every lane reports saving, saved or the same failure wording. Where the data lives stays with each lane's write: notes in their rows, a Diary or day-without-a-session reflection in its Saved Day, a study day's reflection in the session. Each store keeps its own emergency copy: the notes rescue, the Saved-Day fallback and the session recovery copy.

The rich-text editor publishes every change to its field. A document of 64 KB or more groups a burst of changes and publishes once typing pauses (200 ms), at the latest after half a second, and always before anything reads, replaces or closes it: on blur, before any lane writes (`onBeforeFlush`), before a mutation, when the page is hidden or closed, and when the editor is destroyed. These changes are in Study Director's editor wrapper; vendored Wordgard is untouched.

Each change is written to its canonical row through the notes lane, in one strict transaction with its deletion record and mutation epoch. A note's revision is its `updatedAt`, moved forward on every accepted change and never repeated, even if the clock stands still or goes back. Nothing else is written while saves succeed. When a save fails, or the page is hidden or closed before one finishes, every note not yet confirmed is copied to one localStorage entry (the rescue), newest first while it fits in `noteRescueBytes` (1 MiB, within the shared emergency budget); the next load folds it back in, saves it, and drops the copy once storage matches. The database write is the crash protection; the rescue covers failing saves and a page closed mid-save. A note it cannot hold is named in the save failure ("could not keep …, so closing this tab now would lose it"), so a large note is never silently unprotected. A reload never replaces an edit that is still waiting for its save. A note holds up to 20,000 words (2 MiB stored, 60,000 blocks and text runs) and a library up to 2,000 notes. A note's text is checked against those limits once: the record codec keeps, for each note, the text it last found sound (one per note, at most `maxNotes`, least recently read first out), so reading the notes again at start-up, for backups and for upkeep compares instead of parsing, and hands on that one copy. The editor adapter keeps the last document it decoded, since one check asks for a text's kind and then its size, and counts UTF-8 bytes without encoding a copy. One limit, `maxNotes`, covers live notes, imports, backups and note deletion records, and a collection over it is refused whole rather than cut. Recently deleted counts toward it but never blocks a note: at the limit the oldest deleted notes give way, in the same write, for a new note, an import or Combine, or a clash's copy. A backup entry is sized to hold a maximum note even when JSON escaping doubles it.

## Identity, links, tags and Recently deleted

A note is stored under its permanent id (`n_` and 16 hex digits, given at creation); its title is the label, and the title key (the label normalised) is how plan Areas, Execute and the Library find it, through a lookup the repository rebuilds only when a note is added, removed or relabelled; each label is normalised once. Two live notes never share a title: a collection that brings two (a backup, or a write this tab could not see) numbers the one edited earlier. Everything else (saves and clashes, deletion records, Recently deleted, backups, earlier versions, attachments) follows the id, so a rename changes only the label. Earlier versions of a note come from the backup versions saved since ids (repository manifest 6, portable format 21). Older versions name notes by title: restored or combined whole, their notes take the ids the conversion gives them, but they offer no earlier version of a single note.

A note links other notes in two ways, both by id so renames and moves never break them. Its bar is the optional `links` field of the Note (ids of other notes, at most `maxNoteLinks`, never itself; absent when empty), set through `notes.link(ref,id,{on})`, which also creates the note for a title that has none yet. A link in the text is a Link mark whose value is `#note=<id>`. "Linked from" is worked out from both (`notes.linkedFrom`), never stored. A linked note in Recently deleted drops out of the bar and returns with a restore; ids of notes gone for good are dropped the next time the bar changes. The `note-links` module draws the bar (at the bottom of the note, in the Library and in Execute) and owns the one note picker, which the bar's +, the editor's Link → Note and typing `[[` all open; the editor reaches it only through its `notes` port (pick, title, open), so Wordgard itself is untouched. Exports turn note links into plain text.

Tags are `#name` in a note's text and are never stored. One set of rules (`rich-text/tags.ts`: a letter after a space or at a line's start, letters, digits, `-` and `_`, ending on a letter or digit, compared in lower case) serves the editor, the tag list and rename. The `note-links` module keeps the tag index, read from `notes.searchSnapshot()` and cached per note revision, so only edited notes are read again; it answers the Library's tag list and AND filter (`tags`, `tagged`) and the `#` suggestions, which open the same picker in a tag mode. The editor shows tags as chips through a Wordgard decoration field, as it does search matches, and read-only notes wrap them after rendering. Renaming a tag (`RichTextApi.renameTag`) rewrites only Text nodes, a run of inline nodes at a time so a tag crossing formatting is found, and validates the document before it is saved; the app applies it to each note under the mutation coordinator with the editors quiesced. Import reads .txt as one paragraph per line and Markdown through `markdownToHtml` (DOM-free) and the editor's paste cleaner into a Wordgard document, refusing anything that would not load back; each file becomes a note through `notes.update` like any new note.

Deleting a note moves it to Recently deleted. It stays an ordinary Note row under its id behind a reserved prefix (`~deleted <id>`, the `trashKeyPrefix` of the Note contract), keeping its label and text, with the time of deletion as its revision. The live row's removal, its deletion record and the trash row are one transaction, so the title is free at once and Combine will not bring the old note back. Backups carry trash like any note. Restore puts the note back with its id, under its title, or as "<Title> (restored)" beside a note that took the title meanwhile. After `noteTrashDays` (30) a load or the trash list removes it; trash rows leave no deletion record. Live lists and search skip trash rows, and attachments they reference stay until they are removed.

Rename and move change titles only: a note moves with every note nested under it ("GS2" carries "GS2 > Polity"), keeping its id. With the rename dialog's "Also rename it in today's plan and saved plans" (ticked by default), today's blocks under that Area change their Area in place, keeping times, progress and the timer, and the draft and saved plans are rewritten; otherwise blocks keep the old name and start a new note under it. A new title that already holds text is merged only after the person agrees: the existing note keeps its id and appends what the moved note adds (the same rich-text append used by Combine), and the moved note is removed; a merge that would pass the rich-text limits is refused. Combine matches a backup's notes by id, and a backup note with an unknown id but a title used here by its title; a note this device deleted or holds in Recently deleted keeps its id, so its deletion still applies. A title that reads as a stored key is refused. Earlier versions journaled edits in appMeta (`areaNoteRecovery.v1:`) and before that in localStorage; startup compatibility folds both into the canonical rows once, the newer revision winning and a later deletion staying, and removes them in the same pass.

## Clashes and recovery

Note saves run one batch at a time. A batch reads its expected revision only when it runs, after the previous batch committed, and a committed note stays pending while the tab already holds something newer than what was written. A tab therefore never mistakes its own commit for a competing edit. Competing writers cannot otherwise occur: the exclusive ownership lock hands over only after the outgoing tab's note writes settle and the incoming tab reloads notes, and restores run under the exclusive mutation lock with editors quiesced and re-synced. The revision check is therefore a fail-safe. When it does reject a save, the stored version wins only once this tab's version is stored elsewhere: the transaction that finds the clash adds it as an ordinary note "<Label> (unsaved copy)", numbered up to 99 and then stamped, so a name is always found. It is added, never put, so it cannot replace a stored note, and memory adopts the stored version only after that transaction commits. Edits made while the clash is settled join the copy. At the note limit the oldest Recently deleted notes make room. With none left nothing is replaced: the note stays unsaved in this tab and in the rescue, the save failure says why, saving keeps retrying, a strict flush fails, and other notes can still be deleted to make room.

The IndexedDB owner counts a database recreated under an open page the moment it opens it, before any transaction on it runs. From then until every note this tab holds has been written back, a row that vanished without a deletion record is lost storage rather than a newer decision, and is rewritten from memory. Without that count, a vanished row is treated the same way only while the canonical mutation epoch is also missing: an exact Version Restore removes notes without deletion records, and the epoch is what stops a stale tab from bringing them back. A reload keeps notes that survive only in memory. If it cannot read that metadata, it stops and leaves memory unchanged instead of guessing.

## The editor (Wordgard)

Vendored Wordgard (`vendor/wordgard`) is the exact upstream source. Study Director's runtime behaviour on top of it (the shared Trusted Types parser and cut handling) is reached only through `rich-text/wordgard-adapter.ts`. The few build-time rewrites Wordgard offers no extension point for (`build/wordgard-source-patches.mjs`) each name the upstream text they replace, so a new Wordgard version builds as is unless that text moved; `rich-text/wordgard-patches/README.md` lists them. Wordgard ships as its own readable module (`source/external/wordgard.js`, on `globalThis.StudyDirectorWordgard`) that Study Director's editor (`source/external/rich-text.js`) reads; the minified deployment ships one lean build of both instead.

| What | Where |
|---|---|
| Upstream source, exact | `vendor/wordgard` is Wordgard 0.6.2, checked against `build/wordgard-metadata.mjs`. |
| Wordgard's own module | `source/external/wordgard.js`: readable (not minified), the parts of each Wordgard package the editor uses, on `globalThis.StudyDirectorWordgard`. Entry `rich-text/wordgard-module.ts`. |
| Study Director's editor | `source/external/rich-text.js` reads Wordgard from that global (`wordgardGlobalPlugin` in `build/wordgard-bundle.mjs`); it holds no Wordgard code. |
| How they ship | Development and the plain deployment load both as one script, Wordgard first (`rich-text` has two sources in `build/module-manifest.mjs`). The minified deployment (`stage:firebase:minified`) ships the lean build instead: the editor and only the Wordgard code it reaches, tree-shaken and minified together. |
| Our changes to Wordgard | Build-time rewrites (`build/wordgard-source-patches.mjs`) and runtime additions behind `rich-text/wordgard-adapter.ts`, unchanged in kind. |
| New version | Replace `vendor/wordgard`, run `npm run build:richtext`; a rewrite whose upstream text moved fails by name. Record the snapshot in `build/wordgard-metadata.mjs`. |
| Tests | Tests that load the editor read both files through `tests/helpers/rich-text-runtime.mjs`. |

**Checked with 0.6.2: still needed.**

| Workaround | Why it stays |
|---|---|
| `inert-html.ts` and the two parsing rewrites | Wordgard still creates a Trusted Types policy on every HTML parse, which the app's policy list refuses. |
| `cut.ts` | Copy and cut still read the selection without first reading the DOM, and `deleteByCut` still maps to no command. |
| `Node.slice` rewrite | Still spelled in a way esbuild rejects. |
| History menu trim | Upstream history still ships undo/redo menu buttons. |
