import type {AppData} from './data-bootstrap-host.ts';
import type {InteractionOptions,InteractionInputValue} from './interactions.ts';
import type {LibraryPlan,LibrarySelection} from './library-clear.ts';
import type {NoteLinkBar,NoteLinkBarOptions,NoteTag} from './note-links.ts';
import type {LibraryNoteWorkflows,NoteAreaIdentity,NoteCatalogueEntry,NotesRepository,NotesRuntime,NoteView} from './notes-host.ts';
import type {Task} from './domain.ts';
import type {PracticeRun} from './record-models.ts';
import type {DiaryEditor,DiaryDraft,SavedDayRecord} from './review-persistence.ts';
import type {ReviewRecordViewTask,SharedReviewPresentation} from './review.ts';

type DailyRecords=AppData['dailyRecords'];
export type LibraryDay=NonNullable<Awaited<ReturnType<DailyRecords['get']>>>;
export type LibrarySummary=Awaited<ReturnType<DailyRecords['sortedSummaries']>>[number];
export type LibraryPreparedSummary=LibrarySummary&Readonly<{libraryView:Readonly<{dateLabel:string;outcomeText:string;searchText:string}>}>;
export type LibrarySection='notes'|'days'|'data';
export type LibrarySavedView=Readonly<{section?:LibrarySection;diary?:boolean;sort?:'name'|'recent';listWidth?:number}>;
export type LibraryNoteSearchDocument=Readonly<{key:string;revision?:string;value?:string;plain?:string;deleted?:boolean}>;
export type LibraryNoteTrashItem=ReturnType<NotesRepository['trashSnapshot']>[number];
export type NoteDestination=Readonly<{key:string;label:string;hasNote:boolean;pending:boolean}>;
export type LibraryExportResult=Readonly<{status:string;kind?:string;notes?:number;assets?:number;missing?:number;maxBytes?:number}>;
export type NoteVersionsResult=Readonly<{reason?:string;opened?:boolean}>;
export type LibraryNotice=Readonly<{finish(outcome:'succeeded'|'failed'|'cancelled',message:string):unknown}>;
export type LibraryClearResult=Readonly<{selection:LibrarySelection;savedDays:number;notes:number;attachmentsRemoved:number;attachmentsProtected:number;sweepPending:boolean}>;
export type ClearChoice=Readonly<{selection:LibrarySelection;plan:LibraryPlan;forceReferenced:boolean}>;
export type AttachmentReferenceSource=Readonly<{kind?:string;key?:string}>;
export type AttachmentBatchOptions=Readonly<{sources?:readonly AttachmentReferenceSource[];notes?:boolean;days?:boolean;finalReconcile?:boolean}>;
export type NoteSearchMatch=Readonly<{index:number;count:number}>;
export type AnchoredPopover=Readonly<{show(anchor:HTMLElement):unknown;hide():unknown}>;
export type LibraryNotePort=Readonly<{
  areaUse:LibraryNoteWorkflows['areaUse'];
  bindEditor:NotesRuntime['bindAreaEditor'];canCreate:NotesRuntime['canCreate'];catalogue:NotesRuntime['catalogue'];clearEditor:NotesRuntime['clearEditor'];
  clearFind(field:HTMLTextAreaElement):unknown;commitEditor:NotesRuntime['commitEditor'];
  find(field:HTMLTextAreaElement,query:string,onClear?:()=>unknown):NoteSearchMatch;
  findStep(field:HTMLTextAreaElement,direction:number):NoteSearchMatch;
  focusEditor(field:HTMLTextAreaElement):unknown;
  get(ref:unknown,label?:string):NoteView|null;
  importFiles:NotesRuntime['importFiles'];linksBar(options:NoteLinkBarOptions):NoteLinkBar;normalizeArea:NotesRuntime['normalizeAreaInput'];
  normalizeTag(value:unknown):string;orderEntries:NotesRuntime['orderEntries'];
  print(key:string,title:string):boolean|PromiseLike<boolean>;purgeTrash():number;
  remove:LibraryNoteWorkflows['remove'];renameTag:NotesRuntime['renameTag'];rename:LibraryNoteWorkflows['rename'];renderInherited:NotesRuntime['renderInherited'];
  restore:LibraryNoteWorkflows['restore'];reviewKept(id:string):unknown;keptVersion(id:string):unknown;
  searchDocuments():readonly LibraryNoteSearchDocument[];size():number;tagged(names:readonly string[]):Set<string>;tags():readonly NoteTag[];
  trash:LibraryNoteWorkflows['trash'];trashSnapshot():readonly LibraryNoteTrashItem[];
  versions(target:Readonly<{id:string;label:string;text:string;onRestored(value:Readonly<{exportedAt?:unknown}>):unknown}>):PromiseLike<NoteVersionsResult>|NoteVersionsResult;
}>;
export type LibraryDiaryPort=Readonly<Pick<DiaryEditor,'bind'|'capture'|'clear'|'deleteEntry'|'draft'|'flush'|'schedule'|'settled'>>;
export interface LibraryInput{
  readonly ports:Readonly<{
    notifications:Readonly<{begin(input:Readonly<Record<string,unknown>>):LibraryNotice;feedback(input:Readonly<Record<string,unknown>>):unknown}>;
    records:Readonly<Pick<DailyRecords,'get'|'remove'|'sortedSummaries'>>;
    domain:Readonly<{
      countTaskOutcomes(tasks:readonly ReviewRecordViewTask[]):unknown;
      earliestSupportedSavedDate():string;isTrackableBlock(task:Task|undefined):boolean;isValidIsoDate(value:unknown):boolean;isSupportedSavedDate(value:string):boolean;todayISO():string;
      sanitizePracticeRuns(value:unknown):readonly PracticeRun[];sanitizeTaskOutcomeCounts(value:unknown):unknown;taskOutcomeSummaryText(value:unknown,options?:Readonly<{includeZero?:boolean}>):string;
    }>;
    presentation:Readonly<Pick<SharedReviewPresentation,'createSavedDayTaskCard'|'createPomodoroSummaryLine'|'populatePracticeRunTable'|'optionalDurationLabel'|'optionalPercentLabel'>&{
      emptyMsg(message:string):HTMLElement;optionalHoursLabel(value:unknown):string;prettyDate(date:string):string;
      renderRichTextContent(container:HTMLElement,value:unknown,emptyText:string,label:string):unknown;
      textEl<K extends keyof HTMLElementTagNameMap>(tag:K,className:string,text?:unknown):HTMLElementTagNameMap[K];
      plainTextContent(value:unknown):string;
    }>;
    view:Readonly<{document:Document;window:Window;goTab(tab:string,options?:Readonly<Record<string,unknown>>):boolean|PromiseLike<boolean>;setStatus(id:string,message:string,ok?:boolean,state?:string):unknown;setTextSafe(id:string,value:unknown):unknown}>;
    interactions:Readonly<{choose(options:InteractionOptions):PromiseLike<string|null>|string|null;confirm(options:InteractionOptions):PromiseLike<boolean>|boolean;input(options:InteractionOptions):PromiseLike<InteractionInputValue|null>|InteractionInputValue|null}>;
    environment:Readonly<{cancelAnimationFrame(handle:number):void;createOption(text:string,value:string):HTMLOptionElement;createSearchWorker():Worker;requestAnimationFrame(callback:FrameRequestCallback):number}>;
    exporter:Readonly<{exportKeys(keys:readonly string[]):PromiseLike<LibraryExportResult|null>|LibraryExportResult|null;cancel():unknown}>;
    diary:LibraryDiaryPort;notes:LibraryNotePort;
    attachments:Readonly<{batch<T>(operation:()=>T|PromiseLike<T>):Promise<T>;close():unknown;count():PromiseLike<number>|number;invalidate():unknown;reconcile():PromiseLike<unknown>|unknown;refresh():PromiseLike<unknown>|unknown}>;
    preferences:Readonly<{read():unknown;write(value:LibrarySavedView):unknown}>;
    clearLibrary:Readonly<{preflight(selection:Partial<LibrarySelection>):PromiseLike<LibraryPlan>|LibraryPlan;execute(options:Readonly<{selection:LibrarySelection;signature:string;forceReferenced:boolean}>):PromiseLike<LibraryClearResult>|LibraryClearResult}>;
    ownership:Readonly<{canMutate():boolean}>;
    overlays:Readonly<{createAnchoredPopover(popup:HTMLElement,options?:Readonly<{align?:string;onClose?:()=>unknown}>):AnchoredPopover}>;
    session:Readonly<{hasActiveSession():boolean}>;
  }>;
}
export interface LibraryView{
  readonly format:'study-director.library-view';readonly contractVersion:1;
  render(options?:Readonly<{restoreScroll?:boolean}>):Promise<boolean>;
  activate(options?:Readonly<{restoreScroll?:boolean;immediateScroll?:boolean}>):Promise<boolean>;
  deactivate(options?:Readonly<{diarySettled?:boolean}>):void;
  requestRender():boolean;invalidate():void;refreshNotes():boolean;updateSearchDocument(record:LibraryNoteSearchDocument):boolean;
  openDay(date:unknown):Promise<boolean>;showSection(name:unknown):boolean;openNote(key:unknown):boolean;
  noteDestinations():readonly NoteDestination[];revealNoteReference(ref:unknown):boolean;filterTag(tag:unknown,options?:Readonly<{show?:boolean}>):unknown;
  batchAttachmentMutation<T>(work:()=>T|PromiseLike<T>,options?:AttachmentBatchOptions):Promise<T>;
  settleDiary(options?:Readonly<Record<string,unknown>>):Promise<boolean>;loadMore():void;clearAll():Promise<void>;
}
export interface LibraryModule{
  readonly format:'study-director.library-module';readonly contractVersion:1;
  createView(input:Readonly<LibraryInput>):Readonly<LibraryView>;
}
export type {NoteCatalogueEntry,NoteAreaIdentity,SavedDayRecord,DiaryDraft};
