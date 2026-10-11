# Notes

The plan for making notes a first-class part of Study Director. **Status: decided (2026-10-10).** Every item below is agreed; the work follows the order at the end.

## Aim

Study Director is a first-class notes app as well as a time tracker, and its notes are treated that way in durability, reliability and features. They should just work: simple, smooth, intuitive and beautiful, in keeping with the rest of the app. They should cover what students and professionals use notes for about 90% of the time, without becoming a full-featured app like Notion or Evernote.

What already works well:
- **Writing:** headings, bold, italic, underline and highlight; lists, checklists, quotes, tables and web links; images, PDFs and audio inside notes; focus mode.
- **Organising:** nested notes, full-text search that updates on each save, and rename, move and merge.
- **Safety:** one save engine with a safety copy; when two saves clash, the losing text is always kept; 30-day Recently deleted; earlier versions from backups; offline use.

## Settled before this plan

- **No separate version history for notes.** Earlier versions come from the backup versions in the Device Folder and Google Drive (four to five months back). Together with undo and redo in the editor and Recently deleted (30 days), that is enough.
- **Accepted limits:**
  - each location keeps one version per day, so changes within a day are not kept separately;
  - someone who uses neither the Device Folder nor Drive has no earlier versions;
  - portable backup files are not a source of note versions.
- **No annotation features** for PDFs, audio or photos.

## Decided

1. **Earlier versions.**
   - The list combines both backup locations.
   - It holds one entry per distinct text of the note. Each backup records a fingerprint of every note, so identical texts collapse into one entry, whatever their location or time, without downloading anything.
   - The note's current text is never listed.
   - There is no per-day cap; at most 30 entries, and usually far fewer.
   - Labels use plain time, such as "Yesterday" or "3 days ago". When two entries share a date, the time is added.
   - **No backup machinery shows:** no locations, checkpoints or tiers. Nobody needs to know how backups work to use earlier versions.
   - **Choosing an entry** opens the existing side-by-side note review, which already handles keeping, combining or replacing the text.
   - **On Drive,** opening the list reads each version's small index file (up to 15, read together), so it takes a second or two.
   - **Where:** "Earlier versions…" stays in the open note's ⋯ menu, with Rename, Move, Export and Delete. The menu stays on the open note rather than moving to the list.
2. **Limit:** 2,000 notes (down from 10,000), 20,000 words each. No existing data or backup holds more, so the one limit applies everywhere. Measure opening, saving and searching at that size, and build a faster tree only if it is slow. Search already updates on each save rather than rebuilding, so it only needs timing.
3. **Strikethrough:** in the "More text formatting" menu, next to superscript and subscript. The editor already supports it, so it only needs switching on.
4. **Search lands on the match.** Opening a note from a search highlights every match and scrolls to the first. Arrow buttons or Enter step through the matches, and Esc or typing clears the highlights. The editor has highlighting built in, so this is a small addition, not a new system.
5. **Sorting:** a sort button with two choices. "Name" shows the tree. "Recently edited" shows a flat list, newest first, with each note's path in small text. It uses the edit time already stored. Other orders were left out: created date would need a new stored field, and size is rarely useful. Today's notes already carry a TODAY mark.
6. **Print a note:** "Print…" in the ⋯ menu prints only the note's title and content, with its images. The browser's print dialog also offers Save as PDF.
7. **Import text and Markdown files:** if it stays simple. Each file becomes a new note named after the file, at the top level or inside the selected note, within the limits.
   - **Plain text:** easy.
   - **Markdown:** converted to HTML, then passed through the existing paste cleaner that already turns pasted web pages into note format.
   - **Images inside Markdown files:** not in the first version.
8. **Already covered:** keeping images and PDFs inside notes in sync with their note is part of attachment upkeep, checked in the background-services pass. Editing while another tab takes over writing is already safe; add one test only if none covers it.
9. **Later:** math equations. Code formatting is also supported by the editor and can be switched on if it is ever wanted.
10. **Not doing:**
    - templates;
    - sharing;
    - drag-and-drop in the tree (Move covers it);
    - a separate Notes tab in the main navigation, because notes belong in the Library, which is the app's storage.
11. **Every note gets a permanent identity** (confirmed 2026-10-10).
   **Today:** a note is identified by its name ("Cardiology › Heart failure"). Renaming or moving a note gives it a new identity, so:
   - its earlier versions disappear (older backups hold it under the old name);
   - anything pointing at it by name breaks.

   **Decision:**
   - **Permanent id.** Each note gets an id at creation that never changes. The title is just a property, so rename and move change only the title.
   - **Everything points at the id:** versions, links between notes, trash, backups, search, export, and the "open the note this attachment belongs to" action.
   - **Stored record:** `{id, title, text, updatedAt}`, which replaces `{key, label, text, updatedAt}`, plus the optional list of linked notes (decision 12). Matching a block's Area to a note title uses a lookup built in memory; nothing extra is stored.
   - **Existing notes** are converted once, following the migration rule. A converted note's id is derived from its current name. Older backups, which store notes by name, therefore map to the same note, and its history is kept.
     - Exception: history from before a rename that happened before this change stays under the old name.

   Text matching was considered as the identity and rejected. A note's text changes with every edit, so it cannot recognise the note over time. The permanent id is the note's lasting fingerprint; text fingerprints are used only to compare versions.

   This is the largest change, and everything else builds on it, so it comes first.

12. **Linked notes bar.** Every note can carry a short list of other notes.
   - **In Execute,** while a block runs, a bar sits under the note: `[ Heart failure ]  Pharmacology ×   ECG basics ×   +`.
     - The first chip is the block's own note, matched by Area name as today.
     - Tapping any chip switches the editor to that note.
     - `+` searches and adds any note, and `×` removes one.
   - **In the Library,** the same bar sits under the note's title, so it can be managed there too.
   - **Remembered per subject, not per block.** The list is saved on the note, so every future block of that Area shows it.
   - **One-way.** Linking Pharmacology to Heart failure does not put Heart failure on Pharmacology's bar. Pharmacology shows "Linked from: Heart failure" in small text instead; that list is worked out, not stored.
   - **Stored:** one optional field on the note, the list of linked note ids. Ids never break on renames or moves.
   - **Deleted notes** drop out of every bar, and come back if restored from Recently deleted. Ids of notes deleted for good are removed the next time the note is saved.
   - **Earlier versions** restore the note's text only; its bar stays as it is.
13. **Links inside the text.** The Link button gets a "Note" choice, and typing `[[` opens the same picker.
   - A linked word opens that note when clicked, just as a web link opens a page.
   - The link is stored by id inside the note's text, so nothing new is stored and renames never break it.
   - A link to a deleted note shows as unavailable, and works again if the note is restored.
   - Notes that link to the open one, from either the text or the bar, appear in its "Linked from" line.
14. **Tags,** written as `#tag` in the text, the way Apple Notes, Bear and Obsidian work.
   - **Suggestions:** typing `#` offers existing tags, so near-duplicates like `#revise` and `#revison` don't appear.
   - **Look:** tags show as small chips in the text, and clicking one filters the notes list to that tag.
   - **Tag list:** the notes panel lists tags with a count each. Picking one or more filters the list; more than one means "has all of them". One tap clears the filter.
   - **Rename everywhere:** renaming a tag changes it in every note, which fixes typos or merges two tags.
   - **Rules:** capital letters do not matter, and a tag starts with a letter after a space or at the start of a line. So `#1`, `C#` and a Markdown heading are not tags.
   - **Storage:** none. Tags are read from the text by the search indexer, and exports keep them as plain `#tags`.
   - The `#` suggestions, the `[[` picker and the bar's `+` share one picker.
15. **The Library has three sections: Notes · Days · Data.** A switch at the top chooses between them. Notes opens first, and the Library remembers the last section used.
   - **Notes:**
     - "Notes" replaces "Ongoing Notes" everywhere, including Execute.
     - Under the heading, one line explains what they are: *Lasting notes for each subject and topic. A note opens alongside any block whose Area has the same name.*
     - The section holds the list (search, sort and tags) and the open note with its bar.
     - On a computer, the list takes about a third of the width and the note two thirds, at the full height of the window. Phones keep "list, then note".
   - **Days:**
     - **Diary** sits at the top, as a panel that opens with one click and remembers whether it was open. Inside it, the Diary keeps today's notes-like layout, a list of dates beside the entry, so entries can be browsed without going through Saved Days.
     - **Saved Days** follows below it: the filters (search, year, month and order), the list and the expanded day, kept as they are today.
   - **Data:**
     - backup locations and versions;
     - **Files** (today's Attachments manager), which spans notes and the Diary;
     - storage use.

     Each note and diary entry still shows its own images inline.
   - **Proper weight for every section.** Notes in particular must not look like a minor panel. Each section gets the space and proportion its importance deserves.
   - **Keep what works.** The redesign rearranges and resizes the existing parts rather than rebuilding them, and is shown as screenshots for approval before it is finalised.

16. **Renaming a note can take its Area along** (decided 2026-10-11).
   - **The tick box.** The Move dialog shows "Also rename it in today's plan and saved plans", ticked by default, whenever either uses the note's Area. Renaming the title in place behaves as if it were ticked.
   - **Ticked.** Blocks in today's plan change their Area in place, keeping their times, progress and the running timer. The draft and saved plans are rewritten too, so blocks keep opening the same note.
   - **Unticked.** Blocks keep the old name. The moment the rename happens, a running block shows an empty note under its own name, which becomes a new note once written in. The renamed note stays separate.
   - **Typing an old name by hand** into a later plan likewise starts a new note.
   - **Finished days** keep the name they were recorded with.

## How notes and Areas fit together

- **Two things name a note:**
  - its **permanent id**, given when it is created and never changed;
  - its **title** (the label, such as "Cardiology › Heart failure").
- **The title connects a note to the plan.** A block opens the note whose title matches its Area. That is the only place titles are used to find a note, and two notes never share a title.
- **Everything else uses the id:**
  - saving and clash handling, Recently deleted, and deletion records;
  - backups, earlier versions and restoring a single note;
  - the note an attachment sits in;
  - the linked-notes bar and links inside the text, when they come.
- **So a rename changes only the title.** History, links and attachments stay with the note, and the tick box above decides whether the plan follows.

## Order of work

1. **Permanent note identity (11)** and **earlier versions (1).** Done (2026-10-11), with the tick box from 16:
   - the record and a one-time conversion;
   - backups;
   - the combined versions list, which survives renames;
   - the 2,000-note limit.
2. **The Library in three sections (15)** and the notes surface:
   - the new layout and names;
   - sorting (5);
   - landing on search matches (4);
   - strikethrough (3);
   - print (6).

   Screenshots go to the user before this step is finalised.
3. **Linked notes bar (12)** and **links inside the text (13),** with the shared picker.
4. **Tags (14)** and **import (7).**
5. **Measure at 2,000 notes,** then fix only what is slow.

Each step starts on the user's go-ahead and ends with a commit, so it can be reviewed before the next. Each step follows the testing rhythm: make all of the step's changes, build once, run the suites once, fix what fails, and rerun only the failing tests.
