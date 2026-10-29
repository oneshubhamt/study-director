import type {AttachmentIngestModule} from '../source/core/attachment-ingest.ts';
import type {IngestOptions} from './attachment-ingest.ts';
export type AssetMetadata={version:2;storage:'opfs';file:string;hash:string;size:number;type:string;name:string;library:boolean};
export type AssetRow=AssetMetadata&{id:string};
export type AssetIssue={id:string;kind:'missing-metadata'|'metadata-invalid'|'missing-file'|'size-mismatch';expectedSize?:number;actualSize?:number};
export type AuditProgress={scanId:string;cursor:number;checked:number;total:number;issues:readonly AssetIssue[]};
export type AuditOptions={progress?:AuditProgress|null;shouldYield?:()=>boolean;yieldTask?:()=>Promise<unknown>;check?:()=>void;now?:()=>number;maxEntries?:number;workMs?:number};
export interface AssetDirectory{getDirectoryHandle(name:string,options:{create:boolean}):Promise<AssetDirectory>;getFileHandle(name:string):Promise<{getFile():Promise<Blob>}>;removeEntry(name:string):Promise<void>;entries():AsyncIterableIterator<[string,{kind:'file'|'directory'}]>}
export type AssetIngest=ReturnType<AttachmentIngestModule['create']>;
export type AssetPutOptions<Token>=IngestOptions&{token?:Token;check?:()=>void;name?:unknown;library?:boolean;stage?:boolean};
export type AssetRestoreOptions=IngestOptions&{deletionState?:unknown};
export type AssetPublishOptions={deletionState?:unknown;restoreLabels?:boolean;replaceAll?:boolean};
export type AssetCollectOptions={check?:()=>void;maxEntries?:number;shouldYield?:()=>boolean;progress?:()=>void;yieldTask?:()=>Promise<unknown>};
export interface CollectionScope{keys():Promise<string[]>;removeMany(ids:readonly string[],guard?:()=>boolean,allowLibrary?:boolean):Promise<number>;sweep():Promise<number>;status():Readonly<{sweepPending:boolean}>}
export interface AssetStorageInput<Token>{
 read(key:string):Promise<unknown>;keys():Promise<string[]>;entries?:()=>Promise<readonly (readonly [string,unknown])[]>;
 commit(upserts:readonly (readonly [string,AssetMetadata])[],remove:readonly string[],token:Token,guard?:()=>boolean,deletionState?:unknown):Promise<unknown>;
 validId(value:unknown):boolean;validType(value:string):boolean;maxBytes:number;limitForType?:(type:string)=>number;
 storage:{getDirectory():Promise<AssetDirectory>};locks:Pick<LockManager,'request'>;issueToken():Token;assertToken(token:Token):unknown;canMutate():boolean;ingest:AssetIngest;
 name:string;directory?:string;protocol:string;onReleased?:()=>void;
}
