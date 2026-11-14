import type {BrowserRegistry} from '../browser-registry.ts';
import type {AppData} from '../data-bootstrap-host.ts';
import type {DomainModule} from '../domain.ts';
import type {LibraryView} from '../library.ts';
import type {NoteLinksInput,NoteLinkNavigationInput} from '../note-links.ts';
import type {OwnershipController} from '../startup-host.ts';
import type {ExecutionHostModule} from '../../source/core/execution-host.ts';
import type {RichTextApi} from '../../rich-text/editor.ts';

declare const registry:BrowserRegistry;
declare const appData:AppData;
declare const document:Document;
declare const domain:Readonly<DomainModule>;
declare const execution:Readonly<ReturnType<ExecutionHostModule['createRuntime']>>;
declare const library:Readonly<LibraryView>;
declare const ownership:Readonly<OwnershipController>;
declare const rich:RichTextApi;
declare const isLiveTrackableTimer:()=>boolean;
declare const openExecute:(id:string,taskId:string|null,ownNote:ReturnType<typeof appData.notes.get>)=>boolean|PromiseLike<boolean>;
declare const openLibrary:()=>boolean|PromiseLike<boolean>;

const module=registry.require('note-links',1);
const input=Object.freeze({ports:Object.freeze({
  view:Object.freeze({document}),
  notes:Object.freeze({
    documents:()=>appData.notes.searchSnapshot(),
    get:(ref:unknown)=>appData.notes.get(ref),
    link:(ref:unknown,id:unknown,options?:Readonly<{on?:boolean;label?:string}>)=>appData.notes.link(ref,id,options),
    linkedFrom:(ref:unknown)=>appData.notes.linkedFrom(ref),
    list:()=>appData.notes.metadataSnapshot().records
  }),
  text:Object.freeze({tagsIn:(value:string)=>rich.tagsIn(value)}),
  ownership:Object.freeze({canMutate:()=>ownership.canMutate()})
})}) satisfies Readonly<NoteLinksInput>;
const controller=module.createController(input);
void controller.tags();void controller.tagged(['focus']);void controller.pick({query:'focus'});controller.cancel();

const navigationInput=Object.freeze({
  controller,
  notes:Object.freeze({get:(ref:unknown)=>appData.notes.get(ref)}),
  execution:Object.freeze({
    isLiveTrackableTimer,
    current:()=>{
      const index=execution.TimerState.currentIndex,task=execution.TASKS[index];
      return Object.freeze({
        task,taskId:execution.TaskIdentity.idAt(index),
        ownNote:task&&domain.ScheduleModel.hasNotes(task)?appData.notes.get(domain.ScheduleModel.areaKey(task)):null
      });
    },
    open:openExecute
  }),
  library:Object.freeze({
    open:openLibrary,
    reveal:(ref:string)=>library.revealNoteReference(ref),
    filterTag:(name:string,options?:Readonly<{show?:boolean}>)=>library.filterTag(name,options)
  })
}) satisfies Readonly<NoteLinkNavigationInput>;
const navigation=module.createNavigation(navigationInput);
void navigation.open('note-id');void navigation.richText().pickTag({query:'fo'});
// @ts-expect-error -- note-links is a closed registry contract.
registry.load('note-links',1,'study-director.notes-host-module',1);
