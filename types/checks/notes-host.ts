import type {BrowserRegistry} from '../browser-registry.ts';
import type {AppData} from '../data-bootstrap-host.ts';
import type {DomainModule,Task} from '../domain.ts';
import type {NoteLinksController} from '../note-links.ts';
import type {NotesHostInput} from '../notes-host.ts';
import type {PlanController} from '../plan.ts';
import type {RichTextRuntime} from '../rich-text-host.ts';
import type {SessionCoordinator} from '../session-lifecycle.ts';
import type {OwnershipController} from '../startup-host.ts';
import type {RichTextApi} from '../../rich-text/editor.ts';
import type {MutationCoordinatorModule} from '../../source/core/mutation-coordinator.ts';
import type {TimerStateModule} from '../../source/core/timer-state.ts';

declare const registry:BrowserRegistry;
declare const appData:AppData;
declare const plan:Readonly<PlanController>;
declare const rich:RichTextApi;
declare const richRuntime:Readonly<RichTextRuntime>;
declare const noteLinks:Readonly<NoteLinksController>;
declare const domain:Readonly<DomainModule>;
declare const timerState:Readonly<ReturnType<TimerStateModule['createStateController']>>;
declare const lifecycle:Readonly<SessionCoordinator>;
declare const ownership:Readonly<OwnershipController>;
declare const mutation:Readonly<ReturnType<MutationCoordinatorModule['createCoordinator']>>;
declare const document:Document;
declare const noteField:HTMLTextAreaElement;
declare const scheduleRevision:()=>number;
declare const clampText:(value:unknown,max:number)=>string;
declare const validatedInput:NotesHostInput['richText']['validatedInput'];
declare const renderRichText:NotesHostInput['richText']['render'];
declare const notesView:Omit<NotesHostInput['view'],'document'|'currentTaskIndex'>;
declare const diagnostics:NotesHostInput['diagnostics'];

const host=registry.require('notes-host',1);
const input=Object.freeze({
  configuration:Object.freeze({maxAreaNameChars:120,maxNoteChars:100000,maxNotes:500,maxRichTextWords:50000,maxRichTextBytes:1000000,supportNote:Object.freeze({key:'support / admin',label:'Support / Admin'})}),
  repository:appData.notes,
  tasks:()=>timerState.tasks,
  taskIdentity:Object.freeze({
    validIndex:timerState.taskIdentity.validIndex,idAt:timerState.taskIdentity.idAt,indexForId:timerState.taskIdentity.indexForId,
    scheduleRevision
  }),
  domain:Object.freeze({
    normalizeAreaName:domain.ScheduleModel.normalizeArea,displayAreaName:domain.ScheduleModel.displayArea,areaParentKeys:domain.ScheduleModel.parentAreaKeys,clampText,
    hasOngoingTaskNotes:domain.ScheduleModel.hasNotes,noteKeyForTask:(task:Task)=>domain.ScheduleModel.areaKey(task),noteLabelForTask:(task:Task)=>domain.ScheduleModel.areaLabel(task),
    isSupportBlock:domain.ScheduleModel.isSupport,isTrackableBlock:domain.ScheduleModel.isTrackable
  }),
  lifecycle:Object.freeze({canWrite:()=>lifecycle.canWrite(),revision:()=>lifecycle.revision}),
  ownership:Object.freeze({canMutate:()=>ownership.canMutate(),revision:()=>ownership.revision}),
  richText:Object.freeze({
    closeField:(field:HTMLTextAreaElement|null)=>richRuntime.closeField(field),syncField:(field:HTMLTextAreaElement)=>richRuntime.syncField(field),
    reconcileExternal:(field:HTMLTextAreaElement,canonical:string,revision:string)=>richRuntime.reconcileExternal(field,canonical,revision),
    validatedInput,plain:(value:unknown)=>rich.toPlainText(String(value??'')),isRich:(value:unknown)=>rich.isRichTextValue(String(value??'')),
    render:renderRichText,normalizeTag:rich.normalizeTag,renameTag:rich.renameTag,fromText:rich.fromText,fromMarkdown:rich.fromMarkdown,
    quiesce:<T>(operation:()=>T|PromiseLike<T>)=>richRuntime.quiesce(operation)
  }),
  tags:Object.freeze({tagged:(names:readonly string[])=>noteLinks.tagged(names)}),
  mutation:Object.freeze({runExclusive:<T>(name:string,operation:()=>T|PromiseLike<T>)=>mutation.runExclusive(name,()=>operation())}),
  view:Object.freeze({...notesView,document,currentTaskIndex:()=>timerState.currentIndex}),
  diagnostics,
  environment:Object.freeze({queueMicrotask:(callback:()=>void)=>queueMicrotask(callback)})
}) satisfies Readonly<NotesHostInput>;
const notes=host.createController(input);
notes.bindAreaEditor(noteField,'core','Core','library');
notes.commitEditor(noteField,noteField.value,new Event('input'));
const workflows=host.createLibraryWorkflows(Object.freeze({runtime:notes,repository:appData.notes,plan,interactions:Object.freeze({confirm:async()=>true}),mergeText:(existing:string,moved:string)=>rich.appendIncomingAdditions(existing,moved).value}));
void workflows.areaUse('core');
void workflows.rename(Object.freeze({key:'core',label:'Core'}),'Core > New',{renamePlans:true});
// @ts-expect-error -- the note host is a closed registry contract.
registry.load('notes-host',1,'study-director.review-host-module',1);
