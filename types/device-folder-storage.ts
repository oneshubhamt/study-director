export type StorageKind='object'|'checkpoint'|'commit';
export type LockKind='publication'|'maintenance';
export type StoredFile=Blob&{lastModified:number};
export interface FolderFileHandle{kind:'file';getFile():Promise<StoredFile>;createWritable(options:{keepExistingData:boolean}):Promise<{write(value:Blob):Promise<void>;close():Promise<void>;abort?():Promise<void>}>}
export interface FolderDirectory{kind:'directory';getDirectoryHandle(name:string,options?:{create:boolean}):Promise<FolderDirectory>;getFileHandle(name:string,options?:{create:boolean}):Promise<FolderFileHandle>;removeEntry(name:string):Promise<void>;entries():AsyncIterableIterator<[string,FolderFileHandle|FolderDirectory]>}
export type RetentionDescriptor=Readonly<{format:'study-director.repository-retention';version:1;role:'normal'|'before-restore';protectedUntil:string;purpose:string;calendar:Readonly<{localDate:string;weekStart:string;month:string;utcOffsetMinutes:number}>;notesFingerprint:string}>;
export type FolderManifest={version:number;logicalFingerprint:string;exportedAt:string;counts:Readonly<Record<string,number>>;encrypted:boolean;retention:RetentionDescriptor;installationId:string};
export type StorageHistory=Readonly<{format:number;logicalFingerprint:string;exportedAt:string;counts:Readonly<{dailyRecord:number;note:number}>;encrypted:boolean;retention:RetentionDescriptor;origin:string}>;
export type FileSummary=Readonly<{history?:StorageHistory;locked?:boolean;unreadable?:boolean}>;
export type StorageIdentity={kind:StorageKind;id:string;remoteVersion?:string};
export type StorageItem=Readonly<StorageIdentity&{name:string;size:number;createdAt:string;modifiedAt:string;remoteId:string;remoteVersion:string;verificationScope:string;digest?:string}&FileSummary>;
export type StorageUpload=StorageIdentity&{blob:Blob;digest?:string;checkProtection?():void|Promise<void>;checkSource?():void|Promise<void>;onProgress?:(loaded:number,total:number)=>void};
export type SignalOptions={signal?:AbortSignal|null|undefined};
export type RangeOptions=SignalOptions&{offset:number;length:number};
export type WholeOptions=SignalOptions&{offset?:never;length?:never};
export type DownloadOptions=RangeOptions|WholeOptions;
export type RangeResult=Readonly<{blob:Blob;totalBytes:number;version:string}>;
export type LockLease=Readonly<{kind:LockKind;id:string;name:string;createdAt:string}>;
export type FolderOwner={profile:string;scope:string;device:string};
export type FolderMarker=Readonly<FolderOwner&{id:string;version:2}>;
export interface FolderStorageInput{
 checksum(file:Blob,options:SignalOptions):Promise<string>;folder():FolderDirectory|null;owner():FolderOwner|null;
 inspectManifest(file:Blob,options:{interactive:false}):Promise<FolderManifest>;
 identities:{root:string|(()=>string);prefix:string;objects:string;checkpoints:string;commits:string};
 limits:Record<'maintenanceAssertionMarginMs'|'maintenanceMaxAgeMs'|'publicationAssertionMarginMs'|'publicationMaxAgeMs'|'responseTimeoutMs',number>;
 environment:{canMutate():boolean;clearTimeout(handle:number):void;now():number;setTimeout(callback:()=>void,ms:number):number;yieldTask():Promise<unknown>};
}
