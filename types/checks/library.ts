import type {BrowserRegistry} from '../browser-registry.ts';
import type {AppData} from '../data-bootstrap-host.ts';
import type {LibraryInput} from '../library.ts';
import type {LibraryClearModule} from '../../source/core/library-clear.ts';
import type {LibraryNoteWorkflows,NotesRuntime} from '../notes-host.ts';
import type {NoteLinksController} from '../note-links.ts';
import type {ReviewPersistence} from '../review-persistence.ts';
import type {ReviewSubsystem} from '../review.ts';

type Ports=LibraryInput['ports'];

declare const registry:BrowserRegistry;
declare const appData:AppData;
declare const document:Document;
declare const browserWindow:Window;
declare const reviewPersistence:Readonly<ReviewPersistence>;
declare const reviewSubsystem:Readonly<ReviewSubsystem>;
declare const notesRuntime:Readonly<NotesRuntime>;
declare const noteWorkflows:Readonly<LibraryNoteWorkflows>;
declare const noteLinks:Readonly<NoteLinksController>;
declare const clearCoordinator:Readonly<ReturnType<LibraryClearModule['createCoordinator']>>;

declare const notifications:Ports['notifications'];
declare const domain:Ports['domain'];
declare const viewHelpers:Pick<Ports['view'],'goTab'|'setStatus'|'setTextSafe'>;
declare const interactions:Ports['interactions'];
declare const environment:Ports['environment'];
declare const exporter:Ports['exporter'];
declare const richNoteHelpers:Pick<Ports['notes'],'clearFind'|'find'|'findStep'|'focusEditor'|'normalizeTag'|'print'|'reviewKept'|'keptVersion'|'versions'>;
declare const attachments:Ports['attachments'];
declare const ownership:Ports['ownership'];
declare const overlays:Ports['overlays'];
declare const session:Ports['session'];
declare const emptyMsg:Ports['presentation']['emptyMsg'];
declare const optionalHoursLabel:Ports['presentation']['optionalHoursLabel'];
declare const prettyDate:Ports['presentation']['prettyDate'];
declare const renderRichTextContent:Ports['presentation']['renderRichTextContent'];
declare const textEl:Ports['presentation']['textEl'];
declare const plainTextContent:Ports['presentation']['plainTextContent'];

const input=Object.freeze({ports:Object.freeze({
  notifications,
  records:Object.freeze({
    get:(date:string)=>appData.dailyRecords.get(date),
    remove:(date:string)=>appData.dailyRecords.remove(date),
    sortedSummaries:()=>appData.dailyRecords.sortedSummaries()
  }),
  domain,
  presentation:Object.freeze({
    createSavedDayTaskReviewCard:reviewSubsystem.SharedReviewPresentation.createSavedDayTaskCard,
    createPomodoroSummaryLine:reviewSubsystem.SharedReviewPresentation.createPomodoroSummaryLine,
    emptyMsg,
    optionalDurationLabel:reviewSubsystem.SharedReviewPresentation.optionalDurationLabel,
    optionalHoursLabel,
    optionalPercentLabel:reviewSubsystem.SharedReviewPresentation.optionalPercentLabel,
    plainTextContent,
    populatePracticeRunTable:reviewSubsystem.SharedReviewPresentation.populatePracticeRunTable,
    prettyDate,
    renderRichTextContent,
    textEl
  }),
  view:Object.freeze({document,window:browserWindow,...viewHelpers}),
  interactions,
  environment,
  exporter,
  diary:Object.freeze({
    bindEditor:reviewPersistence.DiaryEditor.bind,
    captureEditor:reviewPersistence.DiaryEditor.capture,
    clearEditor:reviewPersistence.DiaryEditor.clear,
    deleteEntry:reviewPersistence.DiaryEditor.deleteEntry,
    draft:reviewPersistence.DiaryEditor.draft,
    flushEditor:reviewPersistence.DiaryEditor.flush,
    scheduleEditor:reviewPersistence.DiaryEditor.schedule,
    settled:reviewPersistence.DiaryEditor.settled
  }),
  notes:Object.freeze({
    areaUse:noteWorkflows.areaUse,
    bindEditor:notesRuntime.bindAreaEditor,
    canCreate:notesRuntime.canCreate,
    catalogue:notesRuntime.catalogue,
    clearEditor:notesRuntime.clearEditor,
    ...richNoteHelpers,
    commitEditor:notesRuntime.commitEditor,
    get:(key:unknown)=>appData.notes.get(key),
    importFiles:notesRuntime.importFiles,
    linksBar:noteLinks.bar,
    normalizeArea:notesRuntime.normalizeAreaInput,
    orderEntries:notesRuntime.orderEntries,
    purgeTrash:()=>appData.notes.purgeExpiredTrash(),
    remove:noteWorkflows.remove,
    renameTag:notesRuntime.renameTag,
    rename:noteWorkflows.rename,
    renderInherited:notesRuntime.renderInherited,
    restore:noteWorkflows.restore,
    searchDocuments:()=>appData.notes.searchSnapshot().documents,
    size:notesRuntime.size,
    tagged:noteLinks.tagged,
    tags:noteLinks.tags,
    trash:noteWorkflows.trash,
    trashSnapshot:()=>appData.notes.trashSnapshot()
  }),
  attachments,
  preferences:Object.freeze({
    read:()=>appData.local.getJson('library-view',null),
    write:(value:Parameters<typeof appData.local.setJson>[1])=>appData.local.setJson('library-view',value)
  }),
  clearLibrary:Object.freeze({
    preflight:(selection:Parameters<typeof clearCoordinator.preflight>[0])=>clearCoordinator.preflight(selection),
    execute:(options:Parameters<typeof clearCoordinator.execute>[0])=>clearCoordinator.execute(options)
  }),
  ownership,
  overlays,
  session
})}) satisfies Readonly<LibraryInput>;

const library=registry.require('library',1).createView(input);
void library.render();void library.openDay('2026-11-14');void library.showSection('days');
// @ts-expect-error -- Library input cannot accept an unchecked record repository shape.
registry.require('library',1).createView(Object.freeze({ports:Object.freeze({...input.ports,records:Object.freeze({get:()=>42,remove:()=>true,sortedSummaries:()=>[]})})}));
