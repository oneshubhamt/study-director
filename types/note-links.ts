import type {Task} from './domain.ts';
import type {NoteView,NotesRepository} from './notes-host.ts';

export type NoteTag=Readonly<{tag:string;count:number}>;
export type NoteTagCompletion=Readonly<{text:string;end:string}>;
export type NotePickerAnchor=Readonly<Pick<DOMRectReadOnly,'left'|'right'|'top'|'bottom'>>;
export type NoteLinkBar=HTMLDivElement&{refresh():void};

export interface NoteLinksInput{
  readonly ports:Readonly<{
    view:Readonly<{document:Document}>;
    notes:Readonly<{
      documents():ReturnType<NotesRepository['searchSnapshot']>;
      get(ref:unknown):NoteView|null;
      link(ref:unknown,id:unknown,options?:Readonly<{on?:boolean;label?:string}>):ReturnType<NotesRepository['link']>;
      linkedFrom(ref:unknown):ReturnType<NotesRepository['linkedFrom']>;
      list():ReturnType<NotesRepository['metadataSnapshot']>['records'];
    }>;
    text:Readonly<{tagsIn(value:string):readonly string[]}>;
    ownership:Readonly<{canMutate():boolean}>;
  }>;
}
export interface NotePickOptions{readonly exclude?:readonly string[];readonly query?:string}
export interface NoteTagPickOptions{readonly query?:string;readonly anchor?:NotePickerAnchor|null}
export interface NoteLinkBarOptions{
  readonly ref:string;readonly label?:string;readonly own?:boolean;readonly current?:string;
  readonly onOpen:(ref:string)=>unknown;readonly onChange?:()=>unknown;
}
export interface NoteLinksController{
  pick(options?:NotePickOptions):Promise<NoteView|null>;
  pickTag(options?:NoteTagPickOptions):Promise<NoteTagCompletion|null>;
  tags():readonly NoteTag[];
  tagged(names:readonly string[]):Set<string>;
  bar(options:NoteLinkBarOptions):NoteLinkBar;
  cancel():unknown;
}
export interface NoteLinkNavigationInput{
  readonly controller:Readonly<NoteLinksController>;
  readonly notes:Readonly<{get(ref:unknown):NoteView|null}>;
  readonly execution:Readonly<{
    isLiveTrackableTimer():boolean;
    current():Readonly<{task:Task|undefined;taskId:string|null;ownNote:NoteView|null}>;
    open(id:string,taskId:string|null,ownNote:NoteView|null):boolean|PromiseLike<boolean>;
  }>;
  readonly library:Readonly<{
    open():boolean|PromiseLike<boolean>;
    reveal(ref:string):boolean;
    filterTag(name:string,options?:Readonly<{show?:boolean}>):unknown;
  }>;
}
export interface RichTextNoteLinks{
  pick():Promise<NoteView|null>;
  title(id:string):string|null;
  open(id:string):void;
  tag(name:string,passive:boolean):void;
  pickTag(options?:NoteTagPickOptions):Promise<NoteTagCompletion|null>;
}
export interface NoteLinkNavigation{
  open(id:string,field?:HTMLTextAreaElement|null):Promise<boolean>;
  richText(field?:HTMLTextAreaElement|null):Readonly<RichTextNoteLinks>;
  showTagged(name:string,passive:boolean,field?:HTMLTextAreaElement|null):Promise<void>;
}
export interface NoteLinksModule{
  readonly format:'study-director.note-links-module';readonly contractVersion:1;
  createController(input:Readonly<NoteLinksInput>):Readonly<NoteLinksController>;
  createNavigation(input:Readonly<NoteLinkNavigationInput>):Readonly<NoteLinkNavigation>;
}
