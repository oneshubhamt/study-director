import type {BrowserRegistry} from '../browser-registry.ts';
import type {AppData} from '../data-bootstrap-host.ts';
import type {DocumentIntegration} from '../document-host.ts';
import type {DomainModule} from '../domain.ts';
import type {LibraryInput} from '../library.ts';
import type {LibraryNoteWorkflows,NotesRuntime} from '../notes-host.ts';
import type {NoteLinksController} from '../note-links.ts';
import type {ReviewPersistence} from '../review-persistence.ts';
import type {ReviewSubsystem} from '../review.ts';
import type {OwnershipController} from '../startup-host.ts';
import type {AttachmentsModule} from '../../source/core/attachments.ts';
import type {InteractionsModule} from '../../source/core/interactions.ts';
import type {LibraryClearModule} from '../../source/core/library-clear.ts';
import type {NoticeCoordinator} from '../../source/core/notice-coordinator.ts';
import type {SessionActionsModule} from '../../source/core/session-actions.ts';
import type {RichTextApi} from '../../rich-text/editor.ts';

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
declare const domain:Readonly<DomainModule>;
declare const interactions:Readonly<ReturnType<InteractionsModule['createController']>>;
declare const notices:Readonly<NoticeCoordinator>;
declare const documents:Readonly<DocumentIntegration>;
declare const attachmentLibrary:Readonly<ReturnType<AttachmentsModule['create']>>;
declare const richText:RichTextApi;
declare const ownershipController:Readonly<OwnershipController>;
declare const sessionActions:Readonly<ReturnType<SessionActionsModule['createController']>>;

declare const earliestSupportedSavedDate:Ports['domain']['earliestSupportedSavedDate'];
declare const isSupportedSavedDate:Ports['domain']['isSupportedSavedDate'];
declare const todayISO:Ports['domain']['todayISO'];
declare const sanitizePracticeRuns:Ports['domain']['sanitizePracticeRuns'];
declare const viewHelpers:Pick<Ports['view'],'goTab'|'setStatus'|'setTextSafe'>;
declare const environment:Ports['environment'];
declare const richNoteHelpers:Pick<Ports['notes'],'clearFind'|'find'|'findStep'|'focusEditor'|'normalizeTag'|'print'|'reviewKept'|'keptVersion'|'versions'>;
declare const emptyMsg:Ports['presentation']['emptyMsg'];
declare const optionalHoursLabel:Ports['presentation']['optionalHoursLabel'];
declare const prettyDate:Ports['presentation']['prettyDate'];
declare const renderRichTextContent:Ports['presentation']['renderRichTextContent'];
declare const textEl:Ports['presentation']['textEl'];
declare const plainTextContent:Ports['presentation']['plainTextContent'];

const notifications=notices.presentation('library') satisfies Ports['notifications'];
const libraryDomain=Object.freeze({
  countTaskOutcomes:domain.OutcomeModel.count,
  earliestSupportedSavedDate,
  isTrackableBlock:domain.ScheduleModel.isTrackable,
  isValidIsoDate:domain.TimeModel.isValidIsoDate,
  isSupportedSavedDate,
  todayISO,
  sanitizePracticeRuns,
  sanitizeTaskOutcomeCounts:domain.OutcomeModel.sanitizeCounts,
  taskOutcomeSummaryText:domain.OutcomeModel.summary
}) satisfies Ports['domain'];
const libraryInteractions=Object.freeze({
  choose:(options:Parameters<typeof interactions.choose>[0])=>interactions.choose(options),
  confirm:(options:Parameters<typeof interactions.confirm>[0])=>interactions.confirm(options),
  input:(options:Parameters<typeof interactions.input>[0])=>interactions.input(options)
}) satisfies Ports['interactions'];
const attachments=Object.freeze({
  batch:<T>(operation:()=>T|PromiseLike<T>)=>attachmentLibrary.batch(operation),
  close:()=>attachmentLibrary.close(),
  count:()=>attachmentLibrary.count(),
  invalidate:()=>attachmentLibrary.invalidate(),
  reconcile:()=>attachmentLibrary.reconcile(),
  refresh:()=>attachmentLibrary.refresh()
}) satisfies Ports['attachments'];
const overlays=Object.freeze({
  createAnchoredPopover:(popup:HTMLElement,options?:Parameters<RichTextApi['createAnchoredPopover']>[1])=>richText.createAnchoredPopover(popup,options)
}) satisfies Ports['overlays'];
const ownership=Object.freeze({canMutate:()=>ownershipController.canMutate()}) satisfies Ports['ownership'];
const session=Object.freeze({hasActiveSession:()=>sessionActions.hasBlockingActiveSession()}) satisfies Ports['session'];

const input=Object.freeze({ports:Object.freeze({
  notifications,
  records:Object.freeze({
    get:(date:string)=>appData.dailyRecords.get(date),
    remove:(date:string)=>appData.dailyRecords.remove(date),
    sortedSummaries:()=>appData.dailyRecords.sortedSummaries()
  }),
  domain:libraryDomain,
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
  interactions:libraryInteractions,
  environment,
  exporter:documents.exporter,
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
