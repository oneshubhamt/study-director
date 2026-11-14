import type {Task} from './domain.ts';
import type {PlanController} from './plan.ts';
import type {NotesRepositoryModule} from '../source/core/repositories-notes.ts';

export type NotesRepository=ReturnType<NotesRepositoryModule['create']>;
export type NoteView=NonNullable<ReturnType<NotesRepository['get']>>;
export type NoteMetadataSnapshot=ReturnType<NotesRepository['metadataSnapshot']>;

export interface NoteAreaIdentity{readonly key:string;readonly label:string}
export interface NoteCatalogueInput{readonly key?:unknown;readonly id?:unknown;readonly label?:unknown;readonly text?:unknown;readonly hasNote?:unknown;readonly current?:unknown;readonly updatedAt?:unknown;readonly support?:unknown;readonly ephemeral?:unknown}
export interface NoteCatalogueEntry extends NoteAreaIdentity{
  readonly id:string;readonly hasNote:boolean;readonly current:boolean;readonly updatedAt:string;
  readonly support:boolean;readonly depth:number;readonly ephemeral:boolean;
}
export interface NoteInheritedEntry extends NoteAreaIdentity{readonly value:string;readonly text:string}
export interface ApplicableNotes{
  readonly exactKey:string;readonly exactLabel:string;readonly exactText:string;readonly inherited:readonly NoteInheritedEntry[];
}
export interface NoteEditorBinding extends NoteAreaIdentity{
  readonly idx:number|null;readonly taskId:string;readonly scheduleRevision:number|null;
  readonly lifecycleRevision:number;readonly ownershipRevision:number;readonly noteRevision:string;readonly noteId:string;
}
export interface ValidatedRichInput{readonly format?:string;readonly version?:number;readonly canonical:string;readonly plain:string}
export interface NoteConflictInfo{readonly key?:unknown;readonly label?:unknown;readonly copyLabel?:unknown}
export type NoteSyncState='saving'|'synced'|'conflict';

export type NotesRepositoryPort=Readonly<Pick<NotesRepository,
  'get'|'update'|'updateValidatedRich'|'flush'|'failure'|'metadataSnapshot'|'searchSnapshot'|'size'|
  'rename'|'trash'|'restore'|'remove'|'trashSnapshot'|'purgeExpiredTrash'
>>;

export interface NotesHostInput{
  readonly configuration:Readonly<{
    maxAreaNameChars:number;maxNoteChars:number;maxNotes:number;maxRichTextWords:number;maxRichTextBytes:number;
    supportNote:Readonly<NoteAreaIdentity>;
  }>;
  readonly repository:NotesRepositoryPort;
  readonly tasks:()=>readonly Task[];
  readonly taskIdentity:Readonly<{
    validIndex(value:unknown):number|null;idAt(index:number):string;indexForId(id:string):number|null;scheduleRevision():number;
  }>;
  readonly domain:Readonly<{
    normalizeAreaName(value:unknown):string;displayAreaName(value:unknown):string;areaParentKeys(value:unknown):string[];
    clampText(value:unknown,max:number):string;hasOngoingTaskNotes(task:Task|undefined):boolean;
    noteKeyForTask(task:Task):string;noteLabelForTask(task:Task):string;isSupportBlock(task:Task|undefined):boolean;isTrackableBlock(task:Task|undefined):boolean;
  }>;
  readonly lifecycle:Readonly<{canWrite():boolean;revision():number}>;
  readonly ownership:Readonly<{canMutate():boolean;revision():number}>;
  readonly richText:Readonly<{
    closeField(field:HTMLTextAreaElement|null):unknown;syncField(field:HTMLTextAreaElement):unknown;
    reconcileExternal(field:HTMLTextAreaElement,canonical:string,revision:string):Readonly<{status:string}>;
    validatedInput(event:Event|null,field:HTMLTextAreaElement):ValidatedRichInput|null;
    plain(value:unknown):string;isRich(value:unknown):boolean;
    render(container:HTMLElement,value:string,empty?:string,label?:string):unknown;
    normalizeTag(value:unknown):string;renameTag(value:string,from:string,to:string):string;
    fromText(value:string):string;fromMarkdown(value:string):string;
    quiesce<T>(operation:()=>T|PromiseLike<T>):Promise<T>;
  }>;
  readonly tags:Readonly<{tagged(names:readonly string[]):ReadonlySet<string>}>;
  readonly mutation:Readonly<{runExclusive<T>(name:string,operation:()=>T|PromiseLike<T>):Promise<T>}>;
  readonly view:Readonly<{
    document:Document;currentTaskIndex():number;saveLiveDraft():unknown;
    updateSearchText(key:string,plain:string):unknown;
    refreshExecute():unknown;refreshLibrary():unknown;requestScheduleRender():unknown;refreshReviewIfVisible():unknown;refreshRecovery():unknown;
    setStatus(id:string,message:string,ok?:boolean):unknown;setPlanStatus(message:string,ok?:boolean):unknown;
    publishSafetyNotice(message:string,title:string,key:string):unknown;syncPopover(element:HTMLElement):unknown;
  }>;
  readonly diagnostics:Readonly<{capture(scope:string,error:unknown,level?:'warn'|'error'):unknown}>;
  readonly environment:Readonly<{queueMicrotask(callback:()=>void):void}>;
}
export interface NotesRuntime{
  readonly format:'study-director.notes-runtime';readonly contractVersion:1;readonly bindingVersion:'area-v3';
  storedValueForKey(key:unknown):string;textForKey(key:unknown):string;editorContent(binding:Pick<NoteEditorBinding,'key'>,value:unknown):string;
  applicableForTask(task:Task|undefined):ApplicableNotes;inheritedEntries(areaKey:unknown):readonly NoteInheritedEntry[];
  normalizeAreaInput(value:unknown):NoteAreaIdentity|null;orderEntries(source:readonly NoteCatalogueInput[]):readonly NoteCatalogueEntry[];
  catalogue():readonly NoteCatalogueEntry[];canCreate():boolean;size():number;
  bindTaskEditor(field:HTMLTextAreaElement,index:number,source?:string):NoteEditorBinding|null;
  bindAreaEditor(field:HTMLTextAreaElement,areaKey:unknown,areaLabel?:unknown,source?:string):NoteEditorBinding|null;
  clearEditor(field:HTMLTextAreaElement|null):boolean;editorVisible(field:HTMLTextAreaElement):boolean;resolveEditor(field:HTMLTextAreaElement|null,options?:Readonly<{requireVisible?:boolean}>):NoteEditorBinding|null;
  commitEditor(field:HTMLTextAreaElement,value:unknown,event?:Event|null):boolean;
  refreshFieldsForKey(key:unknown,originField?:HTMLTextAreaElement|null,derived?:ValidatedRichInput|null,options?:Readonly<{deferRichMirrors?:boolean}>):void;
  refreshAllFields():void;setSyncState(key:unknown,state:NoteSyncState):boolean;reportConflict(info?:NoteConflictInfo):boolean;refreshConsumers():boolean;
  renderInherited(container:HTMLElement|null,areaKey:unknown,compact?:boolean,options?:Readonly<{collapsible?:boolean}>):void;
  renderInheritedForTask(container:HTMLElement|null,task:Task|undefined,compact?:boolean):void;
  inheritedTextForTask(task:Task|undefined):string;currentEntriesForTasks(tasks:readonly Task[]):readonly Readonly<{key:string;label:string;text:string}>[];
  renameTag(from:unknown,to:unknown):Promise<Readonly<{changed:number;failed:readonly string[]}>>;
  importFiles(files:Iterable<File>|ArrayLike<File>,parent?:string):Promise<Readonly<{made:readonly Readonly<{id:string;label:string}>[];skipped:readonly string[]}>>;
}
export interface LibraryNoteWorkflowInput{
  readonly runtime:Readonly<NotesRuntime>;readonly repository:Readonly<Pick<NotesRepository,'rename'|'trash'|'restore'|'remove'>>;
  readonly plan:Readonly<Pick<PlanController,'areaUse'|'renameArea'>>;
  readonly interactions:Readonly<{confirm(options:Readonly<Record<string,unknown>>):boolean|PromiseLike<boolean>}>;
  readonly mergeText:(existing:string,moved:string)=>string;
}
export type LibraryNoteRenameResult=
  |Readonly<{status:'cancelled'|'rejected'|'inside-itself';identity:NoteAreaIdentity|null}>
  |Readonly<{status:'content-limit';identity:NoteAreaIdentity;label:string}>
  |Readonly<{status:'renamed';identity:NoteAreaIdentity;moved:readonly Readonly<{from:string;to:string}>[];merged:number;
      plan:Readonly<{requested:boolean;ok:boolean;blocks:number;savedPlans:number;error:unknown}>}>;
export interface LibraryNoteWorkflows{
  readonly format:'study-director.library-note-workflows';readonly contractVersion:1;
  areaUse(title:unknown):Readonly<{today:boolean;savedPlans:number}>;
  rename(entry:Readonly<NoteAreaIdentity>,value:unknown,options?:Readonly<{renamePlans?:boolean}>):Promise<LibraryNoteRenameResult>;
  trash(key:unknown):Promise<string|null>;restore(key:unknown):Promise<string|null>;remove(key:unknown):Promise<boolean>;
}
export interface NotesHostModule{
  readonly format:'study-director.notes-host-module';readonly contractVersion:1;readonly bindingVersion:'area-v3';
  createController(input:Readonly<NotesHostInput>):Readonly<NotesRuntime>;
  createLibraryWorkflows(input:Readonly<LibraryNoteWorkflowInput>):Readonly<LibraryNoteWorkflows>;
}
