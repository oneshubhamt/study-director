import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {AssetRow} from '../../types/asset-storage.ts';
import type {AttachmentBatchOptions,UploadOptions} from '../../types/attachments.ts';
import type {DocumentHostModule as DocumentHostContract,DocumentIntegration,DocumentIntegrationInput,NotePrinter,NotePrinterInput,PdfController,PdfControllerInput} from '../../types/document-host.ts';
import type {AttachmentProgress,AttachmentUploadOptions} from '../../rich-text/editor.ts';
import type {OverlayHandle,WorkspaceDescriptor} from '../../types/workspace.ts';

const sdDocumentHostFactory=(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:ModuleRegistration<'document-host','study-director.document-host-module'>|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
const freeze=Object.freeze;
const PDF_DOWNLOAD_HANDOFF_MS=2*60*1000,PDF_UNTRACKED_VIEWER_MS=10*60*1000;
const errorMessage=(error:unknown)=>error instanceof Error?error.message:String(error);

function createPdfController(input:Readonly<PdfControllerInput>):Readonly<PdfController>{
  const {document,window,urls,store,overlay,notifications,diagnostics}=input;
  const prefersNative=()=>!!window.matchMedia?.('(hover:none) and (pointer:coarse)').matches;
  function prepareNativeWindow(){if(!prefersNative())return null;try{const opened=window.open('about:blank','_blank');if(opened)opened.opener=null;return opened||null}catch{return null}}
  function retainPdfUrl(url:string,releaseReader:()=>void){
    let released=false,poll:number|null=null,expiry:number|null=null;
    const release=()=>{if(released)return false;released=true;if(poll!==null)window.clearInterval(poll);if(expiry!==null)window.clearTimeout(expiry);window.removeEventListener('pagehide',release);try{urls.revokeObjectURL(url)}finally{releaseReader()}return true};
    const expireAfter=(delay:number)=>{if(released)return false;if(expiry!==null)window.clearTimeout(expiry);expiry=window.setTimeout(release,delay);return true};
    const track=(opened:Window|null)=>{if(!opened)return expireAfter(PDF_UNTRACKED_VIEWER_MS);if(poll!==null)window.clearInterval(poll);poll=window.setInterval(()=>{try{if(opened.closed)release()}catch{if(poll!==null)window.clearInterval(poll);poll=null;expireAfter(PDF_UNTRACKED_VIEWER_MS)}},1000);return true};
    window.addEventListener('pagehide',release);return freeze({release,expireAfter,track});
  }
  function openFallback(row:AssetRow,url:string,releaseReader:()=>void){
    const lease=retainPdfUrl(url,releaseReader),content=document.createElement('div'),message=document.createElement('p'),actions=document.createElement('div'),open=document.createElement('a'),download=document.createElement('a');
    content.className='workspace-pdf-fallback';message.className='ui-helper';message.textContent='This browser could not open the PDF automatically. Open it in the browser viewer or download it.';actions.className='workspace-pdf-fallback-actions';
    open.className='mini-btn ui-btn primary';open.textContent='Open PDF';open.href=url;open.target='_blank';open.rel='noopener noreferrer';
    download.className='mini-btn ui-btn';download.textContent='Download';download.href=url;download.download=String(row.name||'document.pdf');actions.append(open,download);content.append(message,actions);
    let handedOff=false,handle:OverlayHandle|null=null;
    const closeOnPagehide=()=>{handle?.close()};const closeAfterClick=()=>window.setTimeout(()=>handle?.close(),0);
    open.addEventListener('click',event=>{let opened:Window|null=null;try{opened=window.open('about:blank','_blank');if(opened){opened.opener=null;opened.location.replace(url)}}catch{try{opened?.close()}catch{}opened=null}if(opened)event.preventDefault();handedOff=true;lease.track(opened);closeAfterClick()});
    download.addEventListener('click',()=>{handedOff=true;lease.expireAfter(PDF_DOWNLOAD_HANDOFF_MS);closeAfterClick()});
    try{handle=overlay.open({label:String(row.name||'PDF'),content,className:'workspace-overlay-pdf-fallback',closeLabel:'Close PDF options',onBeforeClose:()=>{window.removeEventListener('pagehide',closeOnPagehide);if(!handedOff)lease.release()}})}catch(error){lease.release();throw error}
    if(!handle){lease.release();notifications.notify({source:'attachments',key:'pdf-open-failed',kind:'error',title:'PDF could not open',message:'Use the attachment Download action to save the PDF.'});return false}
    window.addEventListener('pagehide',closeOnPagehide);notifications.resolve('attachments','pdf-open-failed');notifications.resolve('attachments','pdf-overlay-busy');return true;
  }
  function openDirect(row:AssetRow,file:Blob,reservedWindow:Window|null,releaseReader:()=>void){const url=urls.createObjectURL(file);let opened=reservedWindow;if(!opened)try{opened=window.open('about:blank','_blank');if(opened)opened.opener=null}catch{opened=null}if(opened)try{opened.location.replace(url);retainPdfUrl(url,releaseReader).track(opened);notifications.resolve('attachments','pdf-open-failed');notifications.resolve('attachments','pdf-overlay-busy');return true}catch{try{opened.close()}catch{}}return openFallback(row,url,releaseReader)}
  async function reopen(id:string,descriptor:WorkspaceDescriptor){let release=()=>{};try{release=await store.retain();const row=(await store.list()).find(item=>item.id===id);if(!row||row.type!=='application/pdf'){release();return false}const file=await store.get(id);if(!(file instanceof Blob)){release();return false}return open(row,file,null,release,descriptor)}catch(error){try{release()}catch{}diagnostics.capture('pdf.workspace-reopen',error,'warn');return false}}
  function open(row:AssetRow,file:Blob,reservedWindow:Window|null=null,releaseReader:()=>void=()=>{},replay:WorkspaceDescriptor|null=null){
    if(!(file instanceof Blob)||String(row.type||file.type)!=='application/pdf')throw new TypeError('PDF preview requires a PDF attachment.');
    if(prefersNative()&&!replay)return openDirect(row,file,reservedWindow,releaseReader);
    const url=urls.createObjectURL(file),content=document.createElement('div'),frame=document.createElement('iframe');let released=false;
    content.className='workspace-pdf-viewer';frame.className='workspace-pdf-frame';frame.title=String(row.name||'PDF document');frame.src=url;content.append(frame);
    const release=()=>{if(released)return;released=true;try{frame.src='about:blank'}catch{}urls.revokeObjectURL(url);releaseReader()};
    const history={kind:'pdf',key:String(row.id||''),...(replay?.token?{token:replay.token}:{}),valid:()=>!!row.id,reopen:(descriptor:WorkspaceDescriptor)=>reopen(String(row.id||''),descriptor)};
    let handle:OverlayHandle|null;try{handle=overlay.open({label:String(row.name||'PDF'),content,className:'workspace-overlay-pdf workspace-overlay-minimal',closeLabel:'Close PDF',onAfterClose:release,history})}catch(error){release();throw error}
    if(!handle){release();notifications.notify({source:'attachments',key:'pdf-overlay-busy',kind:'error',title:'PDF could not open',message:'The PDF workspace is unavailable. Try again.'});return false}
    notifications.resolve('attachments','pdf-open-failed');notifications.resolve('attachments','pdf-overlay-busy');return true;
  }
  return freeze({format:'study-director.pdf-controller',contractVersion:1,prepareNativeWindow,open});
}

function createPrinter(input:Readonly<NotePrinterInput>):Readonly<NotePrinter>{
  const {document,window,richText,assets,plain,diagnostics,now}=input;
  async function print(heading:unknown,value:unknown){
    document.documentElement.classList.remove('printing-note');for(const old of document.querySelectorAll('.note-print'))old.remove();
    const sheet=document.createElement('article'),title=document.createElement('h1'),body=document.createElement('div');sheet.className='note-print';title.textContent=String(heading||'Note');sheet.append(title,body);document.body.appendChild(sheet);
    const text=String(value??'');try{if(text.trim())richText.renderRichText({container:body,value:text,label:title.textContent,assets,eager:true})}catch(error){diagnostics.capture('rich-text.print',error,'warn');body.textContent=plain(text)}
    const deadline=now()+10000,pending=()=>[...body.querySelectorAll<HTMLElement>('.sd-rte-image[data-sd-asset-id]')].some(figure=>!['ready','missing'].includes(figure.dataset['sdAssetHydrated']||''));
    while(pending()&&now()<deadline)await new Promise<void>(resolve=>window.setTimeout(resolve,50));
    await Promise.all([...body.querySelectorAll<HTMLImageElement>('img')].map(image=>typeof image.decode==='function'?image.decode().catch(()=>{}):Promise.resolve()));
    let cleaned=false;const cleanup=()=>{if(cleaned)return;cleaned=true;document.documentElement.classList.remove('printing-note');sheet.remove();window.removeEventListener('pagehide',cleanup)};
    document.documentElement.classList.add('printing-note');window.addEventListener('afterprint',cleanup,{once:true});window.addEventListener('pagehide',cleanup,{once:true});
    try{window.print()}catch(error){cleanup();throw error}return true;
  }
  return freeze({format:'study-director.note-printer',contractVersion:1,print});
}

function richProgress(options:AttachmentUploadOptions|undefined):((value:{phase:string;loaded:number;total:number;mode?:string|undefined})=>void)|undefined{
  if(!options?.onProgress)return undefined;const phases=new Set<AttachmentProgress['phase']>(['preparing','copying','verifying','complete']);
  return value=>{if(!phases.has(value.phase as AttachmentProgress['phase']))return;options.onProgress?.({phase:value.phase as AttachmentProgress['phase'],loaded:value.loaded,total:value.total,...(value.mode?{mode:value.mode}:{})})};
}
function createIntegration(input:Readonly<DocumentIntegrationInput>):Readonly<DocumentIntegration>{
  const {limits,notes,ownership,editor,review,session,library,attachmentLibrary,attachmentTypes,assets,richText,content,printer,exporter}=input;
  async function settleAttachmentWriters(){if(!await editor.close())throw new Error('Open rich-text editors could not be saved safely. Attachment changes were stopped.');if(!await library().settleDiary())throw new Error('The open Diary edit could not be saved safely.');await notes.flush({strict:true});if(notes.failure().failed)throw new Error('Notes have not saved. Retry after storage recovers.');if(await review.flushPending({strict:true})===false)throw new Error('The current reflection could not be saved safely.');await review.settled();await session.settled()}
  async function validateAttachmentInsertion(value:string,row:AssetRow){if(!richText.isRichTextValue(value)||!content.withinLimits(value))throw new Error('This note has no room for another attachment.');if(!attachmentTypes.validType(row.type))throw new Error('This attachment type cannot be inserted.');if(String(row.type||'').startsWith('image/')){const ids=richText.assetIds(value),policy=richText.assetPolicy;if(ids.length>Number(policy.maxPerDocument||limits.maxRichAssetPerDocument||20))throw new Error('This note already has the maximum number of images.');let bytes=0;for(const assetId of ids){const blob=await assets.get(assetId);if(!blob)throw new Error('An image used by this note is missing.');bytes+=blob.size}if(bytes>Number(policy.maxBytesPerDocument||limits.maxRichAssetBytesPerDocument||Number.MAX_SAFE_INTEGER))throw new Error('Images in this note exceed the safe storage allowance.')}return true}
  async function insertAttachment(key:unknown,row:AssetRow){
    const target=String(key||''),destination=library().noteDestinations().find(item=>item.key===target);if(!destination)throw new Error('This note destination is no longer available.');
    const token=ownership.issue('insert attachment in note');await settleAttachmentWriters();
    const fresh=await notes.readFreshPayload()||{},storedId=()=>notes.get(destination.key)?.id||'',id=storedId(),hadNote=!!id&&Object.hasOwn(fresh,id),note=hadNote?fresh[id]!:{label:destination.label,text:'',updatedAt:''};
    const type=String(row.type||''),mode=type.startsWith('image/')?'inline-image':type.startsWith('audio/')?'inline-audio':'link',transformed=richText.insertAttachmentReference(String(note.text||''),{id:row.id,name:row.name||'Attachment',mode}),value=transformed.value;
    await validateAttachmentInsertion(value,row);ownership.assert(token,'insert attachment in note');
    const result=notes.updateValidatedRich(destination.key,note.label||destination.label,value,note.updatedAt||'');if(!['changed','unchanged'].includes(result.status))throw new Error('The note changed. Reopen it and try again.');
    try{await notes.flush({strict:true});const verified=(await notes.readFreshPayload()||{})[storedId()];if(verified?.text!==value||notes.failure().failed)throw new Error('The attachment insertion could not be verified.')}
    catch(error){try{const current=notes.get(destination.key),rollback=notes.updateValidatedRich(destination.key,note.label||destination.label,String(note.text||''),current?.updatedAt||result.revision||'');if(!['changed','unchanged'].includes(rollback.status))throw new Error('The note changed before rollback.');await notes.flush({strict:true});if(!hadNote){if(notes.get(destination.key)&&!await notes.remove(destination.key))throw new Error('The newly materialized note could not be removed.')}else if((await notes.readFreshPayload())?.[id]?.text!==String(note.text||''))throw new Error('The prior note state did not restore.')}catch(rollbackError){throw new Error(errorMessage(error)+' Automatic note rollback also failed: '+errorMessage(rollbackError))}throw error}
    library().refreshNotes();return true;
  }
  async function quiesceAttachmentMutation<T>(work:()=>T|PromiseLike<T>,options:AttachmentBatchOptions={}){return editor.quiesce(()=>library().batchAttachmentMutation(work,options))}
  const richAttachmentPort:AttachmentPort=freeze({upload:async(file,options={})=>{const target=attachmentLibrary();if(!target)throw new Error('Attachment Library is not initialized.');const progress=richProgress(options),adapted:UploadOptions={...(options.signal?{signal:options.signal}:{}),...(progress?{onProgress:progress}:{})};const row=await target.add(file,adapted);if(!row)throw new Error('Attachment upload did not complete.');return freeze({id:row.id,name:row.name,type:row.type})}});
  const exportPort=freeze({exportKeys:(keys:readonly unknown[])=>{editor.flushEditors();return exporter.exportKeys(keys)},cancel:()=>exporter.cancel()});
  function printNote(key:unknown,title:unknown){editor.flushEditors();const note=notes.get(key);return note?printer.print(title,note.text):false}
  return freeze({format:'study-director.document-integration',contractVersion:1,exporter:exportPort,richAttachmentPort,settleAttachmentWriters,validateAttachmentInsertion,insertAttachment,quiesceAttachmentMutation,printNote});
}
const module=freeze({format:'study-director.document-host-module',contractVersion:1,createPdfController,createPrinter,createIntegration}) satisfies Readonly<DocumentHostContract>;
registry.define('document-host',1,()=>module);
return module;
})();
export type DocumentHostModule=typeof sdDocumentHostFactory;
