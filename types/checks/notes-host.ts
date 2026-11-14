import type {BrowserRegistry} from '../browser-registry.ts';
import type {AppData} from '../data-bootstrap-host.ts';
import type {NotesHostInput} from '../notes-host.ts';
import type {PlanController} from '../plan.ts';
import type {RichTextApi} from '../../rich-text/editor.ts';
import type {Task} from '../domain.ts';

declare const registry:BrowserRegistry;
declare const appData:AppData;
declare const tasks:readonly Task[];
declare const plan:Readonly<PlanController>;
declare const rich:RichTextApi;
declare const document:Document;
declare const noteField:HTMLTextAreaElement;
const host=registry.require('notes-host',1);
const input=Object.freeze({
  configuration:Object.freeze({maxAreaNameChars:120,maxNoteChars:100000,maxNotes:500,maxRichTextWords:50000,maxRichTextBytes:1000000,supportNote:Object.freeze({key:'support / admin',label:'Support / Admin'})}),
  repository:appData.notes,
  tasks:()=>tasks,
  taskIdentity:Object.freeze({validIndex:(value:unknown)=>Number.isInteger(Number(value))?Number(value):null,idAt:(index:number)=>tasks[index]?.id||'',indexForId:(id:string)=>{const index=tasks.findIndex(task=>task.id===id);return index<0?null:index;},scheduleRevision:()=>1}),
  domain:Object.freeze({normalizeAreaName:(value:unknown)=>String(value||'').trim().toLowerCase(),displayAreaName:(value:unknown)=>String(value||'').trim(),areaParentKeys:(_value:unknown)=>[] as string[],clampText:(value:unknown,max:number)=>String(value||'').slice(0,max),hasOngoingTaskNotes:(_task:Task|undefined)=>true,noteKeyForTask:(task:Task)=>task.area,noteLabelForTask:(task:Task)=>task.area,isSupportBlock:(_task:Task|undefined)=>false,isTrackableBlock:(_task:Task|undefined)=>true}),
  lifecycle:Object.freeze({canWrite:()=>true,revision:()=>1}),ownership:Object.freeze({canMutate:()=>true,revision:()=>1}),
  richText:Object.freeze({closeField:(_field:HTMLTextAreaElement|null)=>true,syncField:(_field:HTMLTextAreaElement)=>true,reconcileExternal:(_field:HTMLTextAreaElement,_canonical:string,_revision:string)=>Object.freeze({status:'synced'}),validatedInput:(_event:Event|null,_field:HTMLTextAreaElement)=>null,plain:(value:unknown)=>rich.toPlainText(String(value??'')),isRich:(value:unknown)=>rich.isRichTextValue(String(value??'')),render:(_container:HTMLElement,_value:string)=>true,normalizeTag:rich.normalizeTag,renameTag:rich.renameTag,fromText:rich.fromText,fromMarkdown:rich.fromMarkdown,quiesce:async<T>(operation:()=>T|PromiseLike<T>)=>await operation()}),
  tags:Object.freeze({tagged:(_names:readonly string[])=>[] as string[]}),mutation:Object.freeze({runExclusive:async<T>(_name:string,operation:()=>T|PromiseLike<T>)=>await operation()}),
  view:Object.freeze({document,currentTaskIndex:()=>0,saveLiveDraft:()=>true,updateSearchDocument:()=>true,refreshExecute:()=>true,refreshLibrary:()=>true,requestScheduleRender:()=>true,refreshReviewIfVisible:()=>true,refreshRecovery:()=>true,setStatus:()=>true,setPlanStatus:()=>true,publishSafetyNotice:()=>true,syncPopover:()=>true}),
  diagnostics:Object.freeze({capture:(_scope:string,_error:unknown,_level?:'warn'|'error')=>undefined}),
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
