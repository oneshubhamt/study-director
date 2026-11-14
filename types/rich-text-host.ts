import type {AssetStore,AttachmentPort,MountedRichTextEditor,NotePort,RichTextApi,WorkspaceOverlayPort} from '../rich-text/editor.ts';
import type {AppData} from './data-bootstrap-host.ts';
import type {ReviewEditor,ReviewRichInputMeta} from './review.ts';

export type RichEditorSurface='default'|'reflection'|'execute-note'|'note'|'reconciliation';
export interface RichEditorDocument{
  readonly documentId:string;readonly label:string;readonly initialValue:string;readonly maxWords:number;readonly surface?:RichEditorSurface;
}
export type RichExternalReconcileResult=Readonly<{status:'unmounted'|'same'|'acknowledged'|'conflict'|'reload';documentId?:string;revision?:string}>;
export type RichEditorActivationEvent=Readonly<{format:string;kind:string}>;
export interface RichTextRuntimeInput{
  readonly configuration:Readonly<{maxRichTextBytes:number}>;
  readonly document:Document;readonly window:Window;
  readonly richText:Readonly<Pick<RichTextApi,'storagePrefix'|'isRichTextValue'|'mountRichTextEditor'>>;
  readonly assets:AssetStore&Readonly<{retain():Promise<()=>void>}>;
  readonly attachments:Readonly<{port():AttachmentPort;createImageWorker():Worker;workspaceOverlay?:WorkspaceOverlayPort;onBusy(busy:boolean):void}>;
  readonly notes:Readonly<{
    repository:Pick<AppData['notes'],'flush'|'protectUnsaved'|'get'>;
    links(field:HTMLTextAreaElement):NotePort;
    normalizeArea(value:unknown):string;
    setSyncState(key:string,state:'conflict'|'synced'):unknown;
    updateSearchText(key:string,plain:string):unknown;
  }>;
  readonly review:Readonly<{date():string;flushPending(options:{strict:boolean}):PromiseLike<unknown>;settled():PromiseLike<unknown>}>;
  readonly session:Readonly<{settled():PromiseLike<unknown>}>;
  readonly view:Readonly<{
    documentFor(field:HTMLTextAreaElement,options?:Readonly<{requireVisible?:boolean;editable?:boolean}>):RichEditorDocument|null;
    render(container:HTMLElement,value:string,emptyText:string,label:string):boolean;
    plain(value:unknown):string;
    visible(field:HTMLTextAreaElement):boolean;
    validatedInput(event:Event,field:HTMLTextAreaElement):ReviewRichInputMeta|null;
    applyOwnership(root:ParentNode):unknown;
  }>;
  readonly activation:Readonly<{kinds:Readonly<{BACKGROUND:string;ORDINARY_FOCUS:string;VISIBILITY_RETURN:string;OWNERSHIP_TAKEOVER:string;DATE_ROLLOVER:string;EXIT:string}>;subscribe(callback:(event:RichEditorActivationEvent)=>unknown):unknown}>;
  readonly diagnostics:Readonly<{capture(scope:string,error:unknown,level?:'warn'|'error'):unknown}>;
}
export interface RichTextRuntime{
  readonly format:'study-director.rich-text-runtime';readonly contractVersion:1;
  install():boolean;activate(field:HTMLTextAreaElement,options?:Readonly<{retry?:boolean;focus?:boolean}>):Promise<boolean>;
  close():Promise<boolean>;closeField(field:HTMLTextAreaElement|null):boolean;
  syncField(field:HTMLTextAreaElement):boolean;syncAll(root?:Document|Element):boolean|Promise<boolean>;
  reconcileExternal(field:HTMLTextAreaElement,canonicalValue:unknown,nextRevision:unknown):RichExternalReconcileResult;
  quiesce<T>(work:()=>T|PromiseLike<T>):Promise<T>;flushEditors():void;
  find(field:HTMLTextAreaElement,query:string,onClear?:()=>void):Promise<number>;findStep(field:HTMLTextAreaElement,direction:number):Readonly<{index:number;count:number}>;clearFind(field:HTMLTextAreaElement):void;
  status():Readonly<{installed:boolean;loaded:true;activeDocumentId:string;activeDocumentIds:readonly string[];mounted:number;pending:boolean;quiesced:boolean;backgroundDisposalPending:boolean;backgroundIdleDisposeMs:number;externalConflicts:number}>;
}
export interface RichTextHostModule{
  readonly format:'study-director.rich-text-host-module';readonly contractVersion:1;
  createRuntime(input:Readonly<RichTextRuntimeInput>):Readonly<RichTextRuntime>;
}
export type {MountedRichTextEditor};
