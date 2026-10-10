# Notes

The plan for making notes a first-class part of Study Director. **Status: brainstorm.** Nothing is built until every item below is decided; then the work follows the order at the end.

## Aim

Notes are as important as time tracking. They should feel simple, smooth and beautiful, never lose anything, and cover what students and professionals use notes for most of the time. They are not meant to become Notion or Evernote.

What already works well:
- **Writing:** headings, bold, italic, underline and highlight; lists, checklists, quotes, tables and web links; images, PDFs and audio inside notes; focus mode.
- **Organising:** nested notes, full-text search that updates on each save, and rename, move and merge.
- **Safety:** one save engine with a safety copy; when two saves clash, the losing text is always kept; 30-day Recently deleted; earlier versions from backups; offline use.

## Decided

1. **Earlier versions.**
   - The list combines both backup locations.
   - It holds one entry per distinct text of the note. Each backup records a fingerprint of every note, so identical texts collapse into one entry, whatever their location or time, without downloading anything.
   - The note's current text is never listed.
   - There is no per-day cap; at most 30 entries, and usually far fewer.
   - Labels use plain time, such as "Yesterday" or "3 days ago". When two entries share a date, the time is added.
   - "Earlier versions…" stays in the open note's ⋯ menu.
2. **Limit:** 2,000 notes (down from 10,000), 20,000 words each. Measure opening, saving and searching at that size, and build a faster tree only if it is slow.
3. **Strikethrough:** in the "More text formatting" menu, next to superscript and subscript. The editor already supports it, so it only needs switching on.
4. **Search lands on the match.** Opening a note from a search highlights every match and scrolls to the first. Arrow buttons or Enter step through the matches, and Esc or typing clears the highlights. The editor has highlighting built in, so this is a small addition, not a new system.
5. **Sorting:** a sort button with two choices. "Name" shows the tree. "Recently edited" shows a flat list, newest first, with each note's path in small text. It uses the edit time already stored. Other orders were left out: created date would need a new stored field, and size is rarely useful. Today's notes already carry a TODAY mark.
6. **Print a note:** "Print…" in the ⋯ menu prints only the note's title and content, with its images. The browser's print dialog also offers Save as PDF.
7. **Import text and Markdown files:** if it stays simple. Each file becomes a new note named after the file, at the top level or inside the selected note, within the limits.
   - **Plain text:** easy.
   - **Markdown:** converted to HTML, then passed through the existing paste cleaner that already turns pasted web pages into note format.
   - **Images inside Markdown files:** not in the first version.
8. **Already covered:** keeping images and PDFs inside notes in sync with their note is part of attachment upkeep, checked in the background-services pass. Editing while another tab takes over writing is already safe; add one test only if none covers it.
9. **Later:** math equations.
10. **Not doing:** templates, sharing, and drag-and-drop in the tree (Move covers it).

## Proposed, to confirm

### A. Every note gets a permanent identity

**Today:** a note is identified by its name ("Cardiology › Heart failure"). Renaming or moving a note gives it a new identity, so:
- its earlier versions disappear (older backups hold it under the old name);
- anything pointing at it by name breaks.

**Proposal:**
- **Permanent id.** Each note gets an id at creation that never changes. The title is just a property, so rename and move change only the title.
- **Everything points at the id:** versions, links between notes, trash, backups, search, export, and the "open the note this attachment belongs to" action.
- **Stored record:** `{id, title, text, updatedAt}`. It replaces `{key, label, text, updatedAt}`, so there is no extra field. Matching a block's Area to a note title uses a lookup built in memory; nothing extra is stored.
- **Existing notes** are converted once, following the migration rule. A converted note's id is derived from its current name. Older backups, which store notes by name, therefore map to the same note, and its history is kept.
  - Exception: history from before a rename that happened before this change stays under the old name.

Text matching was considered as the identity and rejected. A note's text changes with every edit, so it cannot recognise the note over time. The permanent id is the note's lasting fingerprint; text fingerprints are used only to compare versions.

This is the largest change, and everything else builds on it, so it comes first.

### B. Notes and plan blocks

**Today:** a block shows the note whose title matches the block's Area.

**Proposal:**
- **Keep the automatic match** as the default. It needs no setup.
- **Extra notes come from links.** For more notes, or notes with other names, the block's note links to them (see C). In Execute, those linked notes appear as small buttons under the note; tapping one opens it in place, with a way back.
- **Nothing new is stored on blocks or plans.** The links live in the note, so they come back with every future block of that Area.

Two alternatives were considered:
- **Storing note ids on each block.** Rejected: each day's blocks are new, so the links would vanish the next day. Plans are also typed as text lines, which would need a new editing screen.
- **A note listing the Areas it should also appear in** ("Also show during: Revision"). This works, but adds a stored field and a setting that links already cover.

### C. Links between notes

**Today:** notes link vertically (parent and child) and out to the web.

**Proposal: horizontal links.**
- **Making a link.** The Link button gets a "Note" choice; you pick the note by name, with search. Typing `[[` could open the same picker.
- **Following a link.** It shows as a link in the text, and clicking it opens the note.
- **Stored by id**, so renames and moves never break it. It lives in the note's text, so there is no new store.
- **Backlinks.** The open note shows "Linked from: A, B" at the bottom. This list is worked out from the existing search index, not stored.
- **Deleted targets.** A link to a deleted note shows as unavailable, and works again if the note is restored from Recently deleted.

Together with B, one mechanism gives both a web of linked notes and several notes per block.

### D. Tags

**Proposal:**
- **Writing a tag.** You write `#revise` or `#exam` anywhere in a note. A tag must start with a letter, so `#1` is not one.
- **Nothing stored separately.** Tags are read from the text.
- **Filtering.** The notes list gets a tag filter listing the tags in use; picking one shows the notes that have it.

Tags earn their place as labels that cut across the tree, for example "revise before the exam".

An explicit tags field per note was considered and set aside: it needs more screens and more stored data for the same result.

### E. The Library, redesigned

**Today:**
- The Library opens with filters for saved days.
- Data & Backup, Notes, Attachments and Diary follow as small fold-out panels.
- The saved-days list comes last.
- Notes look like a minor panel.

**Proposal:**
- **One switch at the top** of the Library: **Notes · Diary · Saved Days · Attachments · Backup**.
- **Each section opens full width** with its own tools. Notes comes first and is the default; the Library remembers the last section used.
- **Saved-day filters** move into Saved Days.
- **Notes heading:** "Notes" (dropping "Ongoing"), with one line explaining what they are: *Lasting notes for each subject and topic. A note opens alongside any block whose Area has the same name.*
- **Proportions:** on a computer, the note list takes about a third and the open note two thirds, at the full height of the window. Phones keep "list, then note".
- **Screenshots first:** the redesign is shown as screenshots for approval before it is finalised.

## Order of work (once everything is decided)

1. **Permanent note identity (A)** and **earlier versions (decision 1):**
   - the record and a one-time conversion;
   - backups;
   - the combined versions list, which survives renames;
   - the 2,000-note limit.
2. **Library redesign and notes surface (E):**
   - the new layout and name;
   - sorting;
   - landing on search matches;
   - strikethrough;
   - print.
3. **Links (C) and notes on blocks (B).**
4. **Tags (D) and import.**
5. **Measure at 2,000 notes,** then fix only what is slow.
