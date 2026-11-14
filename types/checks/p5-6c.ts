import type {BrowserRegistry} from '../browser-registry.ts';
import type {AppData} from '../data-bootstrap-host.ts';
import type {DocumentHostModule,DocumentIntegrationInput,NotePrinterInput,PdfControllerInput} from '../document-host.ts';
import type {DomainModule} from '../domain.ts';
import type {NoteExportInput} from '../note-export.ts';
import type {RichTextRuntimeInput} from '../rich-text-host.ts';
import type {ReviewSubsystem} from '../review.ts';
import type {LibraryView} from '../library.ts';
import type {OwnershipController,StartupHostModule} from '../startup-host.ts';
import type {AssetStorageModule} from '../../source/core/asset-storage.ts';
import type {AttachmentsModule} from '../../source/core/attachments.ts';
import type {ExportsModule} from '../../source/core/exports.ts';
import type {InteractionsModule} from '../../source/core/interactions.ts';
import type {NativeCapabilitiesModule} from '../../source/core/native-capabilities.ts';
import type {NoticeCoordinator} from '../../source/core/notice-coordinator.ts';
import type {WorkspaceOverlayModule} from '../../source/core/workspace-overlay.ts';
import type {RichTextApi,WorkspaceOverlayPort} from '../../rich-text/editor.ts';

declare const registry:BrowserRegistry;
declare const appData:AppData;
declare const assetStorage:Readonly<ReturnType<AssetStorageModule['create']>>;
declare const attachmentLibrary:Readonly<ReturnType<AttachmentsModule['create']>>;
declare const exports:Readonly<ReturnType<ExportsModule['createCoordinator']>>;
declare const backgroundTasks:Readonly<ReturnType<NativeCapabilitiesModule['createTaskScheduler']>>;
declare const richText:RichTextApi;
declare const review:Readonly<ReviewSubsystem>;
declare const library:Readonly<LibraryView>;
declare const domain:Readonly<DomainModule>;
declare const workspace:Readonly<ReturnType<WorkspaceOverlayModule['createController']>>;
declare const interactions:Readonly<ReturnType<InteractionsModule['createController']>>;
declare const notices:Readonly<NoticeCoordinator>;
declare const ownership:Readonly<OwnershipController>;
declare const activation:Readonly<ReturnType<StartupHostModule['createActivation']>>;
declare const attachmentIntegrationProvider:Readonly<ReturnType<DocumentHostModule['createIntegration']>>;
declare const document:Document;
declare const browserWindow:Window;

const richWorkspaceOverlay:Readonly<WorkspaceOverlayPort>=Object.freeze({
  open:(options:Parameters<WorkspaceOverlayPort['open']>[0])=>{
    const {history,...surface}=options;
    if(!history)return workspace.open(surface);
    const mappedHistory=Object.freeze({
      kind:history.kind,
      ...(history.key!==undefined?{key:history.key}:{}),
      ...(history.token!==undefined?{token:history.token}:{}),
      ...(history.valid?{valid:history.valid}:{}),
      ...(history.reopen?{reopen:(descriptor:{kind:string;token:string;key?:string})=>{
        if(descriptor.kind!=='focus'&&descriptor.kind!=='audio')return false;
        return history.reopen!({kind:descriptor.kind,token:descriptor.token,...(descriptor.key!==undefined?{key:descriptor.key}:{})});
      }}:{})
    });
    return workspace.open(Object.freeze({...surface,history:mappedHistory}));
  }
});

const noteExportInput=Object.freeze({ports:Object.freeze({
  notes:Object.freeze({get:(key:string)=>appData.notes.get(key)}),
  assets:Object.freeze({get:(id:string)=>assetStorage.get(id)}),
  richText:Object.freeze({assetIds:richText.assetIds,exportDocument:richText.exportDocument}),
  output:Object.freeze({chooseSave:exports.chooseSave,save:exports.save}),
  processing:Object.freeze({job:exports.job,run:exports.run,cancel:exports.cancel,check:exports.check}),
  scheduling:Object.freeze({yieldTask:backgroundTasks.yieldTask,budget:backgroundTasks.budget})
})}) satisfies Readonly<NoteExportInput>;
const noteExporter=registry.require('note-export',1).createExporter(noteExportInput);
void noteExporter.exportKeys(['note']);
// @ts-expect-error -- the actual rich-text provider must expose the checked exportDocument contract.
registry.require('note-export',1).createExporter(Object.freeze({ports:Object.freeze({...noteExportInput.ports,richText:Object.freeze({assetIds:richText.assetIds})})}));

const richAssets=Object.freeze({
  retain:()=>assetStorage.retain(),
  get:(id:string)=>assetStorage.get(id),
  put:async(id:string,blob:Blob)=>{await assetStorage.put(id,blob);},
  remove:async(_id:string)=>{}
}) satisfies RichTextRuntimeInput['assets'];
declare const documentFor:RichTextRuntimeInput['view']['documentFor'];
declare const render:RichTextRuntimeInput['view']['render'];
declare const visible:RichTextRuntimeInput['view']['visible'];
declare const validatedInput:RichTextRuntimeInput['view']['validatedInput'];
declare const applyOwnership:RichTextRuntimeInput['view']['applyOwnership'];
declare const noteLinks:RichTextRuntimeInput['notes']['links'];
declare const diagnostics:RichTextRuntimeInput['diagnostics'];
const richHostInput=Object.freeze({
  configuration:Object.freeze({maxRichTextBytes:1024*1024}),document,window:browserWindow,richText,assets:richAssets,
  attachments:Object.freeze({port:()=>attachmentIntegrationProvider.richAttachmentPort,createImageWorker:()=>new Worker('about:blank'),workspaceOverlay:richWorkspaceOverlay,onBusy:(_busy:boolean)=>{}}),
  notes:Object.freeze({
    repository:appData.notes,links:noteLinks,normalizeArea:domain.ScheduleModel.normalizeArea,
    setSyncState:(_key:string,_state:'conflict'|'synced')=>undefined,updateSearchText:(_key:string,_plain:string)=>undefined
  }),
  review:Object.freeze({date:()=> '2026-11-14',flushPending:(options:{strict:boolean})=>review.ReviewEditor.flushPending(options),settled:()=>review.ReviewEditor.settled()}),
  session:Object.freeze({settled:()=>appData.activeSession.settled()}),
  view:Object.freeze({documentFor,render,plain:(value:unknown)=>richText.toPlainText(String(value??'')),visible,validatedInput,applyOwnership}),
  activation,diagnostics
}) satisfies Readonly<RichTextRuntimeInput>;
const richRuntime=registry.require('rich-text-host',1).createRuntime(richHostInput);
void richRuntime.status();

const documentHost=registry.require('document-host',1);
const pdfInput=Object.freeze({
  document,window:browserWindow,urls:URL,store:assetStorage,overlay:workspace,
  notifications:Object.freeze({notify:interactions.notify,resolve:notices.resolveEvent}),diagnostics
}) satisfies Readonly<PdfControllerInput>;
const pdf=documentHost.createPdfController(pdfInput);
void pdf.prepareNativeWindow();

const printerInput=Object.freeze({
  document,window:browserWindow,richText,assets:richAssets,plain:(value:unknown)=>richText.toPlainText(String(value??'')),diagnostics,now:()=>Date.now()
}) satisfies Readonly<NotePrinterInput>;
const printer=documentHost.createPrinter(printerInput);

const integrationInput=Object.freeze({
  limits:Object.freeze({maxRichAssetPerDocument:20,maxRichAssetBytesPerDocument:64*1024*1024}),
  notes:appData.notes,
  ownership:Object.freeze({issue:(reason:string)=>ownership.issueWriteToken(reason),assert:(token:unknown,reason:string)=>ownership.assertWriteToken(token,reason)}),
  editor:richRuntime,review:review.ReviewEditor,
  session:Object.freeze({settled:()=>appData.activeSession.settled()}),
  library:()=>library,attachmentLibrary:()=>attachmentLibrary,attachmentTypes:registry.require('attachments',1),
  assets:richAssets,richText,content:Object.freeze({withinLimits:(_value:unknown)=>true}),printer,exporter:noteExporter
}) satisfies Readonly<DocumentIntegrationInput>;
const integration=documentHost.createIntegration(integrationInput);
void integration.exporter.exportKeys(['note']);void integration.quiesceAttachmentMutation(async()=>true);
// @ts-expect-error -- actual document integration requires a checked rich-editor runtime.
documentHost.createIntegration(Object.freeze({...integrationInput,editor:Object.freeze({flushEditors(){}})}));
