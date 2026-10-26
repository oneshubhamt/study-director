import assert from 'node:assert/strict';
import fs from 'node:fs';

// Current workspace composition invariants: attachment references, backup surfaces, diary records, and shared history ownership.

{ // attachment-reference-boundary
const attachments=fs.readFileSync('source/core/attachments.js','utf8');
const host=fs.readFileSync('source/app.html','utf8');
assert.match(attachments,/function createReferenceCoordinator\(/,'attachments module owns reference transaction coordination');
assert.doesNotMatch(attachments,/kind===['\"]draft|Unfinished Reflection/,'retired Reflection Draft references must not remain in current attachment runtime');
for(const name of ['restoreAttachmentReferenceState','removeAttachmentReferencesEverywhere','verifyAttachmentReferenceAbsent','attachmentReferenceDescriptor'])assert.doesNotMatch(host,new RegExp(`function\\s+${name}\\b`),`host must not reacquire attachment reference transaction logic: ${name}`);
assert.match(host,/AttachmentsModule\.createReferenceCoordinator/,'host composes the attachment reference coordinator');
assert.match(host,/AttachmentReferences\.removeEverywhere/,'attachment deletion consumes the coordinator rather than host-local surgery');
console.log(JSON.stringify({status:'PASS',boundary:'attachment-references',hostCompositionOnly:true},null,2));
}

{ // backup-surface-boundary
const app=fs.readFileSync('source/app.html','utf8');
const backup=fs.readFileSync('source/core/backup.js','utf8');
const provider=fs.readFileSync('source/core/backup-provider.js','utf8');
const styles=fs.readFileSync('source/styles/core.css','utf8');

const applicable=app.match(/function applicableNotesForTask\(t\)\{[\s\S]*?\n\}/u)?.[0]||'';
assert.ok(applicable,'applicableNotesForTask must remain present');
assert.match(applicable,/AppData\.notes\.get\(exactKey,exactLabel\)/u,'viewing a note may read the current note');
assert.doesNotMatch(applicable,/create\s*:\s*true/u,'read-only Note rendering must not create a noncanonical placeholder in the repository cache');

assert.match(app,/id="backup-file-status"[^>]*role="status"/u,'standalone backup must have a status surface beside its own controls');
const exportFn=backup.match(/async function exportPortableBackup\(\)\{[\s\S]*?\n\}/u)?.[0]||'';
assert.ok(exportFn,'exportPortableBackup must remain present');
assert.match(exportFn,/setLocalExportStatus\(message/u,'successful standalone download feedback must stay on the standalone backup surface');
assert.match(exportFn,/message=cancelled\?'Backup export cancelled\.'[\s\S]*setLocalExportStatus\(message,cancelled\)/u,'standalone export cancellation and failures must stay on the standalone backup surface');
assert.doesNotMatch(exportFn,/setStatus\('library-status'/u,'standalone export must not leak its routine status to the bottom-of-Library global status surface');
assert.doesNotMatch(backup,/Exports\.status\(\)/u,'Backup runtime must not depend on the restricted Exports port exposing internal coordinator status');
assert.doesNotMatch(backup,/document\.|getElementById/u,'the backup runtime draws nothing: the app draws the file row from its status');
assert.match(app,/if\(cancel\)cancel\.hidden=!\(exporting\|\|Exports\.status\(\)\.fileBusy\);/u,'one renderer decides the file row Cancel from export and file-processor state');


assert.match(app,/id="library-status"[^>]*role="status"[^>]*aria-live="polite"/u,'Library must retain a quiet generic status fallback surface');
assert.match(styles,/#library-status:empty,#pane-review #save-status:empty\{display:none\}/u,'the generic Library status must be visually quiet while empty');
assert.doesNotMatch(app,/BackupProtection\.refresh\(\)\.catch\(error=>setStatus\('library-status'/u,'backup-encryption refresh errors must stay beside Backup encryption');
assert.doesNotMatch(app,/'backup-protection':[\s\S]*?setStatus\('library-status'/u,'backup-encryption action errors must stay beside Backup encryption');
const libraryStatusWrites=[...backup.matchAll(/setStatus\('library-status'/gu)];
assert.equal(libraryStatusWrites.length,0,'backup runtime must use scoped presentation for startup recovery as well as foreground operations');
assert.match(backup,/presentation\.begin\('file','startup-recovery',[^\n]*surfaceId:'library-status'/u,'startup recovery retains its existing quiet Library surface');
assert.match(backup,/setLocalExportStatus\('Cancelling backup import safely/u,'standalone cancellation must stay on standalone backup surface');
assert.match(backup,/else setLocalExportStatus\(message\)/u,'standalone import batch progress must stay on standalone backup surface');
assert.match(backup,/setLocalExportStatus\(message,ok\);return false;/u,'standalone deep restore status must stay on standalone backup surface');
assert.match(provider,/BackupController\.cancelImport\(reason,freeze\(\{announce:false\}\)\)/u,'managed-provider cancellation must not leak into standalone or global Library status');

console.log(JSON.stringify({noteReadOnly:true,standaloneStatusLocal:true,libraryFallbackRetained:true,backupProtectionStatusLocal:true,managedCancellationLocal:true},null,2));
}


{ // workspace-history-boundary
const navigation=fs.readFileSync('source/core/navigation.js','utf8');
const guide=fs.readFileSync('source/external/guide.js','utf8');
const app=fs.readFileSync('source/app.html','utf8');
const overlay=fs.readFileSync('source/core/workspace-overlay.js','utf8');
const interactions=fs.readFileSync('source/core/interactions.js','utf8');

assert.match(navigation,/history\.pushState\(/);
assert.match(navigation,/history\.replaceState\(/);
assert.match(navigation,/addEventListener\('popstate'/);
assert.doesNotMatch(guide,/history\.pushState\(|history\.replaceState\(|addEventListener\(['"]popstate|studyDirectorLegalCenter/,'Legal Center must not own a parallel browser-history implementation');
assert.match(guide,/LegalCenter\.connect\(api\.ui\.workspaceHistory\)/,'Legal Center consumes shared workspace history without owning browser history or snapshot-transition state.');
assert.match(app,/workspaceHistory:WorkspaceHistoryPublic/);
assert.match(app,/WorkspaceRouteCoordinator/);
assert.match(overlay,/historyPort\?\.opened/);
assert.match(interactions,/kind:'prompt'/);
assert.doesNotMatch(overlay,/history\.pushState|history\.replaceState|popstate/);
assert.doesNotMatch(interactions,/history\.pushState|history\.replaceState|popstate/);

console.log(JSON.stringify({status:'PASS',suite:'workspace-history-ownership',owner:'source/core/navigation.js',consumers:['Legal Center','workspace overlay','interaction dialogs']},null,2));
}

{ // library-sections-contract
const app=fs.readFileSync('source/app.html','utf8');
const library=fs.readFileSync('source/core/library.js','utf8');
const editor=fs.readFileSync('rich-text/editor.ts','utf8');
// Notes · Days · Data: one switch, one panel each, Notes first.
const tabs=[...app.matchAll(/role="tab" id="library-tab-(\w+)" data-library-section="\1" aria-controls="library-\1"/gu)].map(match=>match[1]);
assert.deepEqual(tabs,['notes','days','data'],'The Library switch names its three sections in order.');
for(const name of tabs)assert.match(app,new RegExp(`<section class="[^"]*" id="library-${name}" role="tabpanel" aria-labelledby="library-tab-${name}"`,'u'),`The ${name} section is a tab panel.`);
assert.match(app,/Lasting notes for each subject and topic\. A note opens alongside any block whose Area has the same name\./u);
assert.doesNotMatch(app,/library-data-drawer|id="library-notes-drawer"|Ongoing Notes|Area Notes/u,'The old Library drawers and the "Ongoing Notes" name are gone.');
// The Diary and Files stay one-click panels inside Days and Data.
assert.ok(app.indexOf('id="library-diary"')>app.indexOf('id="library-days"')&&app.indexOf('id="library-diary"')<app.indexOf('id="library-data"'),'The Diary sits in Days.');
assert.ok(app.indexOf('id="library-attachments"')>app.indexOf('id="library-data"'),'Files sit in Data.');
assert.match(app,/openLibrary:\(\)=>\{LibraryView\.showSection\('data'\);/u,'An attachment link opens Data → Files.');
// Only the shown section renders, and the view is remembered.
assert.match(library,/function notesShown\(\)\{return libraryActive&&librarySection==='notes';\}/u);
assert.match(library,/ports\.preferences\.write\(\{section:librarySection,diary:!!diaryDrawer\(\)\?\.open,sort:noteSort,\.\.\.\(noteListWidth\?\{listWidth:noteListWidth\}:\{\}\)\}\)/u);
assert.match(app,/class="library-notes-resizer" id="library-notes-resizer" role="separator" aria-orientation="vertical"/u,'The notes list has a keyboard-reachable resize handle.');
// Search lands on matches through Wordgard's own decoration API; strikethrough is Wordgard's mark.
assert.match(editor,/const searchMatches=GardState\.Field\.define<SearchMatches\|null>/u);
assert.match(editor,/moreMenu\.append\(underlineButton,strikethroughButton,subscriptButton,superscriptButton\)/u);
assert.doesNotMatch(editor,/vendor\/wordgard/u,'The editor reaches Wordgard only through the adapter.');
console.log(JSON.stringify({status:'PASS',suite:'library-sections',sections:tabs},null,2));
}
