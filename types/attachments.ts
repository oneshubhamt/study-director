import type {AssetStorageModule} from '../source/core/asset-storage.ts';
import type {ExportsModule} from '../source/core/exports.ts';
import type {RepositoriesModule} from '../source/core/repositories.ts';
import type {WriteToken} from './ownership.ts';
import type {AssetRow,AssetMetadata,AssetIssue} from './asset-storage.ts';
import type {DailyView} from './repositories.ts';
import type {NoteRecord,ActiveSession} from './record-models.ts';
import type {RewriteTarget,ReferenceRewriteOperation} from './library-clear.ts';
import type {WorkerProgress} from '../portable/worker-contracts.ts';
import type {AuthorityOptions} from './mutation-coordinator.ts';
import type {ScratchHandle} from './exports.ts';
import type {NoticeCoordinator} from '../source/core/notice-coordinator.ts';
import type {InteractionsModule} from '../source/core/interactions.ts';
declare const makeAssetStore:AssetStorageModule['create'];
type AssetStore=ReturnType<typeof makeAssetStore<WriteToken>>;
type AppData=ReturnType<RepositoriesModule['createAppData']>;
export type AttachmentEntry={id:string;hash:string;size:number;name:string;type:string;library:boolean};
export type AttachmentArchive={format:'study-director.attachments';version:1;entries:AttachmentEntry[];files:{hash:string;size:number}[]};
export type AttachmentFile=Blob&{name?:string};
export type AttachmentOccurrence={id:string;kind:'inline-image'|'inline-audio'|'link'};
export type ReferenceScan={trusted:boolean;assetIds:readonly string[];occurrences?:readonly AttachmentOccurrence[]};
export type AttachmentSource={kind:string;key:string;label:string;ids:ReadonlySet<string>;occurrences:readonly AttachmentOccurrence[];value:string};
export type SourceOptions={referencesOnly?:boolean;includeLive?:boolean;priority?:'background'|'user-visible'};
export type ReferenceSnapshot={notes:NoteRecord[];days:DailyView[];session:ActiveSession|null};
export type ReferenceChange={changed:boolean;sources:number;rollback:(()=>Promise<boolean>)|null};
export interface ReferenceCoordinatorInput{
 data:{notes:Pick<AppData['notes'],'readFreshPayload'>;dailyRecords:Pick<AppData['dailyRecords'],'get'|'list'>;activeSession:Pick<AppData['activeSession'],'load'>};
 background:{budget():()=>boolean;yieldTask(options:{priority:'background'|'user-visible'}):Promise<unknown>};
 live:{fields():Iterable<HTMLTextAreaElement>;reviewDate():string;todayIso():string;noteKey(value:string|undefined):string};
 scan(value:string):ReferenceScan;rewriteReferences(targets:readonly RewriteTarget[],operation:ReferenceRewriteOperation):Promise<unknown>;withPersistenceSuppressed<T>(operation:()=>Promise<T>):Promise<T>;
}
export type AttachmentNoticeEvent={lifecycle:string;message:string};
export type AttachmentProgress={stage:string;loadedBytes:number;activeBytes:number};
export interface AttachmentNotice{read():AttachmentNoticeEvent|null;update(patch:{message:string;progress:AttachmentProgress|null}):unknown;finish(lifecycle:'cancelled'|'failed'|'succeeded',message:string):unknown}
export type AttachmentNoticeInput={id:string;surfaceId?:string;surface?:string;cue?:string;severity?:string;lifecycle?:string;title?:string;message?:string;announce?:boolean};
export type UploadOptions={signal?:AbortSignal;onProgress?:(value:WorkerProgress)=>void;notice?:AttachmentNotice};
export type OperationOptions={processingJob?:boolean;cleanup?:boolean;refresh?:boolean};
export type PreparedDetail={content:DocumentFragment;url:string;stale?:boolean;release:()=>void};
export type AttachmentElements={
 'library-attachments':HTMLDetailsElement;'attachment-search':HTMLInputElement;'attachment-files':HTMLInputElement;'attachment-archive':HTMLInputElement;'attachment-progress-bar':HTMLProgressElement;
 'attachment-progress':HTMLElement;'attachment-progress-label':HTMLElement;'attachment-progress-value':HTMLElement;'attachment-detail':HTMLElement;'attachment-preview':HTMLElement;'attachment-list':HTMLElement;'attachment-count':HTMLElement;
 'attachment-add':HTMLButtonElement;'attachment-import':HTMLButtonElement;'attachment-export':HTMLButtonElement;'attachment-cancel':HTMLButtonElement;
};
export interface AttachmentsInput{
 store:AssetStore;processing:ReturnType<ExportsModule['createCoordinator']>;document:Document;
 notifications:Pick<ReturnType<NoticeCoordinator['presentation']>,'begin'|'feedback'>;
 interactions:Pick<ReturnType<InteractionsModule['createController']>,'choose'|'confirm'|'input'>;
 canMutate():boolean;requireOwner():void;token():WriteToken;assertToken(token:WriteToken):unknown;onWorkStart?:()=>void;cleanup?:()=>unknown;integrityIssue?:(id:string)=>AssetIssue|null;
 sources(options?:SourceOptions&{referencesOnly?:false}):Promise<readonly AttachmentSource[]>;destinations():PromiseLike<readonly {key:string;label:string}[]>|readonly {key:string;label:string}[];insert(key:string,row:AssetRow):Promise<unknown>;
 renderReference(element:HTMLElement,reference:AttachmentSource):unknown;openSource(reference:AttachmentSource):Promise<boolean>;
 deletionGuard(options?:{allowLibraryClearJournal:boolean}):Promise<()=>boolean>;settle():Promise<unknown>;removeReferences(id:string,refs:readonly AttachmentSource[],assert:(rollback?:boolean)=>void):Promise<ReferenceChange|null>;
 runExclusive<T>(kind:string,operation:(authority?:{assert(options?:AuthorityOptions):unknown})=>Promise<T>):Promise<T>;
 quiesce?:<T>(operation:()=>Promise<T>,options?:{sources?:readonly AttachmentSource[];notes?:boolean})=>Promise<T>;
 isActive?:()=>boolean;openLibrary():void;preparePdfOpen?:()=>Window|null;openPdf(row:AssetRow,file:Blob,reserved:Window|null,release:()=>void):boolean|Promise<boolean>;
}
