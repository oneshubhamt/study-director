import type {RepositoriesModule} from '../source/core/repositories.ts';
import type {RecordCodecsModule} from '../source/core/record-codecs.ts';
import type {BackupCodecModule} from '../source/core/backup-codec.ts';
import type {Limits,ActiveSession,SessionSnapshot,DailyRecord,NoteRecord,PersonalData,PendingReview} from './record-models.ts';
import type {AssetRow} from './asset-storage.ts';
import type {ExportProcessing} from './exports.ts';
import type {Checkpoint,ProtectedManifest,AssetDescriptor,Counts,SavedDayDeletion,NoteDeletion,AttachmentDeletion} from './backup-models.ts';
type AppData=ReturnType<RepositoriesModule['createAppData']>;
export interface BackupCaptureInput{
 configuration:{limits:Limits};
 data:{activeSession:Pick<AppData['activeSession'],'save'|'settled'|'load'>;dailyRecords:Pick<AppData['dailyRecords'],'backupDates'|'backupMonth'>;notes:Pick<AppData['notes'],'flush'|'failure'|'readFreshPayload'|'exportPayload'|'readFreshItems'>;deletionRecovery:Pick<AppData['deletionRecovery'],'flush'|'savedDays'|'notes'|'attachments'>;mutationEpoch:Pick<AppData['mutationEpoch'],'read'>;preparationUnits:AppData['preparationUnits'];provenance:Pick<AppData['provenance'],'installationId'>;pendingReviews:Pick<AppData['pendingReviews'],'list'|'readItems'>};
 codecs:{activeSession:ReturnType<RecordCodecsModule['createActiveSessionCodec']>;backup:ReturnType<BackupCodecModule['createBackupCodec']>};
 session:{canMutate():boolean;cancelLiveDraftSave():void;captureSnapshot():SessionSnapshot|null;hasTasks():boolean;toActiveSession(snapshot:SessionSnapshot):ActiveSession|null};
 personal:{settle(options:{backupCapture:boolean}):Promise<unknown>;export(options:{flush:boolean;backupCapture?:boolean}):Promise<PersonalData|null>};
 assets:{get(id:string):Promise<Blob|null>;list():Promise<AssetRow[]>};exports:Pick<ExportProcessing,'run'|'check'>;
 persistence:{sourceRevision():Promise<string>;snapshotRevision(options:{full:boolean}):Promise<string>;dailyRecordDocuments(dates:readonly string[],options:{requireCanonical:boolean}):Promise<unknown>;storageGeneration():number};
 diagnostics:{capture(label:string,error:unknown,level:'warn'|'error'):void;mark(label:string,details?:Record<string,unknown>):void};
 domain:{getStudentName():string;currentDailyRecords(records:unknown,label:string):DailyRecord[]};environment:{yieldTask():Promise<unknown>};
}
export type SessionCapture={session:ActiveSession|null;warning:string;canonical:boolean};
export type Completeness=Readonly<{complete:boolean;dailyRecords:'canonical'|'rescue-partial';notes:'canonical'|'recovered-complete'|'rescue-partial';activeSession:'canonical'|'rescue-partial';deletionState:'canonical'|'uncertain'}>;
export interface CaptureBase{format:'study-director.logical-checkpoint-capture';version:1;exportedAt:string;sourceRevision:string;studentName:string;installationId:string;checkpoint:Checkpoint;recordDates:readonly string[];savedDayDeletions:readonly SavedDayDeletion[];noteDeletions:readonly NoteDeletion[];attachmentDeletions:readonly AttachmentDeletion[];counts:Counts;warning:string;completeness:Completeness;protectedCheckpointManifest:ProtectedManifest}
export type CapturedAsset=Readonly<{descriptor:AssetDescriptor;blob:Blob|null}>;
export interface FullLogicalCapture extends CaptureBase{dailyDocuments:readonly DailyRecord[];noteItems:readonly NoteRecord[];activeSession:ActiveSession|null;personalData:PersonalData|null;pendingReviewItems:readonly PendingReview[];assetItems:readonly CapturedAsset[]}
export interface InventoryLogicalCapture extends CaptureBase{dailyDocuments:readonly never[];noteItems:readonly Readonly<{key:string}>[];activeSession:null;personalData:null;pendingReviewItems:readonly Readonly<{id:string}>[];assetItems:readonly Readonly<{descriptor:Readonly<{assetId:string}>;blob:null}>[]}
export type LogicalCapture=FullLogicalCapture|InventoryLogicalCapture;
export type CaptureGuard={snapshotRevision:string;sourceRevision:string;forceFullSnapshotFence:boolean;generation:number|undefined};
export type PreparationStamp=Readonly<{unit:string;token:string}>;
export type ManagedCapture=Readonly<{format:'study-director.managed-preparation-capture';version:1;exportedAt:string;sourceRevision:string;installationId:string;checkpoint:Checkpoint;epochToken:string;stamps:readonly PreparationStamp[];savedDayDeletions:readonly SavedDayDeletion[];noteDeletions:readonly NoteDeletion[];attachmentDeletions:readonly AttachmentDeletion[];assetCatalogue:readonly Readonly<AssetRow>[];warning:string;completeness:Completeness}>;
export type CaptureOptions={includeAssetBlobs?:boolean;assumeFlushed?:boolean;fullRescueFence?:boolean;requireCanonicalComplete?:boolean};
export type PreparationUnitResult={unit:`dailyRecordPack:${string}`;present:boolean;payload:readonly DailyRecord[]}|{unit:`note:${string}`;present:boolean;payload:NoteRecord|null}|{unit:`pendingReview:${string}`;present:boolean;payload:PendingReview|null}|{unit:'personalData';present:boolean;payload:PersonalData|null}|{unit:'activeSession';present:boolean;payload:ActiveSession|null};
export type CaptureInventory={recordDates?:readonly string[];noteKeys?:readonly string[];pendingReviewIds?:readonly string[];assetIds?:readonly string[];counts?:Counts};
