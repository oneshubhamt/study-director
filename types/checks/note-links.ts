import type {BrowserRegistry} from '../browser-registry.ts';
import type {AppData} from '../data-bootstrap-host.ts';
import type {Task} from '../domain.ts';
import type {NoteLinksInput,NoteLinkNavigationInput} from '../note-links.ts';

declare const registry:BrowserRegistry;
declare const appData:AppData;
declare const document:Document;
declare const task:Task|undefined;
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
  text:Object.freeze({tagsIn:(_value:string)=>[] as readonly string[]}),
  ownership:Object.freeze({canMutate:()=>true})
})}) satisfies Readonly<NoteLinksInput>;
const controller=module.createController(input);
void controller.tags();void controller.tagged(['focus']);void controller.pick({query:'focus'});controller.cancel();

const navigationInput=Object.freeze({
  controller,
  notes:Object.freeze({get:(ref:unknown)=>appData.notes.get(ref)}),
  execution:Object.freeze({
    isLiveTrackableTimer:()=>true,
    current:()=>Object.freeze({task,taskId:task?.id||'',ownNote:null}),
    open:async(_id:string,_taskId:string,_ownNote:ReturnType<typeof appData.notes.get>)=>true
  }),
  library:Object.freeze({open:async()=>true,reveal:(_ref:string)=>true,filterTag:(_name:string,_options?:Readonly<{show?:boolean}>)=>true})
}) satisfies Readonly<NoteLinkNavigationInput>;
const navigation=module.createNavigation(navigationInput);
void navigation.open('note-id');void navigation.richText().pickTag({query:'fo'});
// @ts-expect-error -- note-links is a closed registry contract.
registry.load('note-links',1,'study-director.notes-host-module',1);
