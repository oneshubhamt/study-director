import type {RecordCodecsModule} from '../source/core/record-codecs.ts';
import type {Limits,DataContract,KeyedRecord,RecordHelpers,DailyRecord,NoteRecord,ActiveSession,PersonalData,PendingReview} from './record-models.ts';
import type {ProcessingInputs,ProcessingOutputs,ProcessingOperation} from './portable-processing.ts';
export interface ProcessingOptions{signal?:AbortSignal|null|undefined}
export interface ProcessingPort{
 run<K extends ProcessingOperation>(type:K,data:ProcessingInputs[K],options?:ProcessingOptions):Promise<ProcessingOutputs[K]>;
 scope<T>(operation:()=>Promise<T>):Promise<T>;
}
export interface BackupOptions extends ProcessingOptions{filename?:string;yieldControl?:(()=>void|Promise<void>)|undefined;currentOnly?:boolean;validateOnly?:boolean}
export type BackupFile=Blob&{readonly name?:string};
export type AssetDescriptor={assetId:string;missing:true}|{assetId:string;missing?:false;mimeType:string;size:number;checksum:string;name:string;library:boolean};
export type PresentAsset=Extract<AssetDescriptor,{size:number}>;
export type AssetFrame={descriptor:PresentAsset;start:number;end:number};
export type ImportedAsset=PresentAsset&{blob:Blob};
export type SavedDayDeletion={date:string;deletedAt:string};
export type NoteDeletion={key:string;deletedAt:string};
export type AttachmentDeletion={assetId:string;deletedAt:string};
// Validated provenance retains the original wire values (including numeric
// version coercion); creation returns the precise canonical representation.
export interface CheckedCheckpoint{format:unknown;version:unknown;checkpointId:unknown;createdAt:unknown;originInstallationId:unknown}
export interface Checkpoint{format:'study-director.checkpoint-metadata';version:1;checkpointId:string;createdAt:string;originInstallationId:string}
export interface ProtectedManifest{format:'study-director.checkpoint-protected-manifest';version:3;checkpointId:unknown;sourceRevision:string;authority:Readonly<Record<'savedDays'|'notes'|'activeSession'|'plans'|'personalSettings'|'attachments',string>>;savedDayDeletions:readonly SavedDayDeletion[];noteDeletions:readonly NoteDeletion[];attachmentDeletions:readonly AttachmentDeletion[]}
export interface BackupEntities{dailyRecord:DailyRecord;note:NoteRecord;activeSession:ActiveSession;personalData:PersonalData;checkpointManifest:ProtectedManifest;pendingReview:PendingReview}
export type BackupEntity=keyof BackupEntities;
export type BackupItem={[K in BackupEntity]:{kind:K;value:BackupEntities[K]}}[BackupEntity];
export type Counts=Record<string,number>;
export interface BackupPlan{installationId:unknown;exportedAt:string;sourceRevision:string;checkpoint?:unknown;counts:Counts;recordDates?:readonly string[];noteItems?:readonly {key:string}[];assetItems?:readonly {descriptor:{assetId:string}}[];savedDayDeletions?:unknown;noteDeletions?:unknown;attachmentDeletions?:unknown}
export interface BackupInput{
 appConfig:Readonly<{appName:string;attribution:string}>;limits:Limits;
 dataContract:DataContract&{app:string;schemas:{Backup:{format:string};CheckpointMetadata:{format:'study-director.checkpoint-metadata';version:1};CheckpointProtectedManifest:{format:'study-director.checkpoint-protected-manifest';version:3}}};
 entityTypes:readonly string[];keyedRecord:KeyedRecord;
 entities:{entityDefinition(type:string):{backupLimit:number}|null|undefined;entityIdentity(type:string,value:BackupEntities[BackupEntity]):string};
 helpers:Pick<RecordHelpers,'boundedInt'>&{jsonByteLength(value:unknown):number};
 richText:{assetIds(value:string):readonly string[];assetIdValid(value:string):boolean;imageMimeTypeValid(value:string):boolean};
 dailyRecordCodec:ReturnType<RecordCodecsModule['createDailyRecordCodec']>;
 activeSessionCodec:ReturnType<RecordCodecsModule['createActiveSessionCodec']>;
 personalDataCodec:ReturnType<RecordCodecsModule['createPersonalDataCodec']>;
 pendingReviewCodec:ReturnType<RecordCodecsModule['createPendingReviewCodec']>;
 processing:ProcessingPort;
}
