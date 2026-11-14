import type {AssetRow} from './asset-storage.ts';
import type {AttachmentsModule,AttachmentBatchOptions,UploadOptions} from '../source/core/attachments.ts';
import type {AppData} from './data-bootstrap-host.ts';
import type {LibraryView} from './library.ts';
import type {NoteExporter} from './note-export.ts';
import type {RichTextRuntime} from './rich-text-host.ts';
import type {ReviewEditor} from './review.ts';
import type {AssetStore,AttachmentPort,RichTextApi} from '../rich-text/editor.ts';
import type {OverlayHandle,OverlayOptions,WorkspaceDescriptor} from './workspace.ts';

export interface PdfDocumentStore{
  retain():Promise<()=>void>;list():Promise<readonly AssetRow[]>;get(id:string):Promise<Blob|null>;
}
export interface PdfControllerInput{
  readonly document:Document;readonly window:Window;readonly urls:Pick<typeof URL,'createObjectURL'|'revokeObjectURL'>;
  readonly store:PdfDocumentStore;
  readonly overlay:Readonly<{open(options:OverlayOptions):OverlayHandle|null}>;
  readonly notifications:Readonly<{notify(input:Readonly<{source:string;key:string;kind:'error';title:string;message:string}>):unknown;resolve(source:string,key:string):unknown}>;
  readonly diagnostics:Readonly<{capture(scope:string,error:unknown,level?:'warn'|'error'):unknown}>;
}
export interface PdfController{
  readonly format:'study-director.pdf-controller';readonly contractVersion:1;
  prepareNativeWindow():Window|null;
  open(row:AssetRow,file:Blob,reservedWindow?:Window|null,releaseReader?:()=>void,replay?:WorkspaceDescriptor|null):boolean;
}
export interface NotePrinterInput{
  readonly document:Document;readonly window:Window;
  readonly richText:Readonly<Pick<RichTextApi,'renderRichText'>>;
  readonly assets:AssetStore;
  readonly plain(value:unknown):string;
  readonly diagnostics:Readonly<{capture(scope:string,error:unknown,level?:'warn'|'error'):unknown}>;
  readonly now:()=>number;
}
export interface NotePrinter{readonly format:'study-director.note-printer';readonly contractVersion:1;print(heading:unknown,value:unknown):Promise<boolean>}
export interface DocumentIntegrationInput{
  readonly limits:Readonly<{maxRichAssetPerDocument:number;maxRichAssetBytesPerDocument:number}>;
  readonly notes:Pick<AppData['notes'],'get'|'flush'|'failure'|'readFreshPayload'|'updateValidatedRich'|'remove'>;
  readonly ownership:Readonly<{issue(reason:string):unknown;assert(token:unknown,reason:string):unknown}>;
  readonly editor:RichTextRuntime;
  readonly review:Pick<ReviewEditor,'flushPending'|'settled'>;
  readonly session:Readonly<{settled():PromiseLike<unknown>}>;
  readonly library:()=>Pick<LibraryView,'settleDiary'|'noteDestinations'|'refreshNotes'|'batchAttachmentMutation'>;
  readonly attachmentLibrary:()=>Pick<ReturnType<AttachmentsModule['create']>,'add'>|null;
  readonly attachmentTypes:Readonly<Pick<AttachmentsModule,'validType'>>;
  readonly assets:Readonly<Pick<AssetStore,'get'>>;
  readonly richText:Readonly<Pick<RichTextApi,'isRichTextValue'|'assetIds'|'insertAttachmentReference'|'assetPolicy'>>;
  readonly content:Readonly<{withinLimits(value:unknown):boolean}>;
  readonly printer:NotePrinter;readonly exporter:NoteExporter;
}
export interface DocumentIntegration{
  readonly format:'study-director.document-integration';readonly contractVersion:1;
  readonly exporter:Readonly<{exportKeys(keys:readonly unknown[]):ReturnType<NoteExporter['exportKeys']>;cancel():unknown}>;
  readonly richAttachmentPort:AttachmentPort;
  settleAttachmentWriters():Promise<void>;validateAttachmentInsertion(value:string,row:AssetRow):Promise<boolean>;
  insertAttachment(key:unknown,row:AssetRow):Promise<boolean>;
  quiesceAttachmentMutation<T>(work:()=>T|PromiseLike<T>,options?:AttachmentBatchOptions):Promise<T>;
  printNote(key:unknown,title:unknown):Promise<boolean>|false;
}
export interface DocumentHostModule{
  readonly format:'study-director.document-host-module';readonly contractVersion:1;
  createPdfController(input:Readonly<PdfControllerInput>):Readonly<PdfController>;
  createPrinter(input:Readonly<NotePrinterInput>):Readonly<NotePrinter>;
  createIntegration(input:Readonly<DocumentIntegrationInput>):Readonly<DocumentIntegration>;
}
export type {UploadOptions};
