import type {RecordCodecsModule} from '../source/core/record-codecs.ts';
import type {RepositoryJournalsModule} from '../source/core/repository-journals.ts';
import type {NotesRepositoryModule} from '../source/core/repositories-notes.ts';
import type {NotesInput} from './notes-repository.ts';
import type {Limits,DataContract,KeyedRecord,RecordHelpers,ActiveSession,DailyRecord,SavedPlans,PendingReview} from './record-models.ts';
import type {IndexedDb,LocalStoragePort,PersistenceModule} from './persistence.ts';
import type {MetaOwner} from './app-meta.ts';
import type {WriteToken} from './ownership.ts';
import type {SaveLaneModule} from './pilot.ts';
export type DailyCodec=ReturnType<RecordCodecsModule['createDailyRecordCodec']>;
export type DailyView=NonNullable<ReturnType<DailyCodec['materializeDailyRecordView']>>;
export type DailySummary=NonNullable<ReturnType<DailyCodec['sanitizeDailyRecordSummary']>>;
export type SummaryView=NonNullable<ReturnType<DailyCodec['materializeDailyRecordSummary']>>;
export type PersonalCodec=ReturnType<RecordCodecsModule['createPersonalDataCodec']>;
export type PortablePreferences=ReturnType<PersonalCodec['portablePreferences']>;
export type RevisionValue={format:string;version:number;counter:number;updatedAt:string};
export type RevisionState={value:RevisionValue|null;reason:string};
export type RevisionSnapshot={format:string;version:number;counter:number|null;updatedAt:string|null;revision:string|null;volatileRevision:number;lastReason:string;lastError:string};
export type CanonicalCommit=Readonly<{format:'study-director.canonical-commit';contractVersion:1;entityType:string;operation:'delete'|'upsert';committedAt:string;value:unknown;backupCapture:boolean}>;
export type SessionResult={ok:boolean;value:ActiveSession|null;error:unknown;storage:{local:boolean;idb:boolean}};
export type RecoveryEnvelope={version:1;revision:number;shell:Omit<ActiveSession,'snapshot'>;snapshot:ActiveSession['snapshot'];updatedAt:string};
export type DeletionEntry={key:string;kind:'dailyRecord'|'activeSession';id:string;deletedAt:string};
export type DayDeletion={date:string;deletedAt:string};
export type NoteDeletion={key:string;deletedAt:string};
export type AttachmentDeletion={assetId:string;deletedAt:string};
export type WriteOptions={strictDurability?:boolean;ownershipToken?:WriteToken|null;allowHydrating?:boolean;backupCapture?:boolean};
export type BatchOptions={bumpRevision?:boolean;ownershipToken?:WriteToken|null;preserveNewer?:boolean;markDirty?:boolean};
export type MaintenanceOptions={force?:boolean;check?:()=>void;workBudget?:{check():void;advance():void}|undefined};
export type MaintenanceResult={status:'skipped';reason:string;lastRun?:string}|{status:'completed';version:number;completedAt:string}|{status:'yielded';reason:unknown;phase:number}|{status:'failed';reason:unknown};
export type WindowOptions={limit?:number;windowDays?:number;from?:string;to?:string};
export type ImportOptions={signal?:AbortSignal;onProgress?:(value:Readonly<{committed:number;total:number;batches:number}>)=>void;yieldControl?:()=>Promise<void>};
export type CanonicalReadOptions={requireCanonical?:boolean};
export type MetadataFields=Partial<Record<'format'|'version'|'token'|'committedAt'|'unit'|'updatedAt'|'counter'|'status'|'completedAt'|'date'|'deletedAt'|'key'|'assetId'|'savedPlans'|'defaultId',unknown>>;
// These validators accept numeric/string coercion for operational wire fields.
// Reads keep those fields unknown; domain documents are checked by their codecs.
export interface RepositoryMetadata {
 planDraft:string|null;planLibrary:Omit<SavedPlans,'draft'>;personalPreferences:PortablePreferences;
 canonicalMutationEpoch:MetadataFields;backupPreparationUnitPrefix:MetadataFields;insightsDatasetRevision:MetadataFields;dataMaintenance:MetadataFields;
 savedDayDeletionPrefix:MetadataFields;noteDeletionPrefix:MetadataFields;attachmentDeletionPrefix:MetadataFields;pendingReviewPrefix:PendingReview;
}
export interface ValidatorInput{
 limits:Limits;dataContract:DataContract;personalDataCodec:PersonalCodec;pendingReviewCodec:ReturnType<RecordCodecsModule['createPendingReviewCodec']>;
 helpers:{isValidIsoDate(value:unknown):boolean;isNoteId(value:unknown):boolean;isNoteKey(value:unknown):boolean;normalizeTimestamp:NotesInput['helpers']['normalizeTimestamp'];sameDataValue(a:unknown,b:unknown):boolean};
}
export interface RepositoriesInput{
 local:LocalStoragePort;indexedDb:IndexedDb;appMeta:MetaOwner;installationIdentity:ReturnType<PersistenceModule['createInstallationIdentity']>;
 dailyRecordCodec:DailyCodec;activeSessionCodec:ReturnType<RecordCodecsModule['createActiveSessionCodec']>;personalDataCodec:PersonalCodec;pendingReviewCodec:ValidatorInput['pendingReviewCodec'];keyedRecord:KeyedRecord;journals:ReturnType<RepositoryJournalsModule['create']>;
 limits:Limits;dataContract:DataContract;stores:{dailyRecords:string;dailySummaries:string;notes:string;activeSessions:string;appMeta:string};keys:{recovery:string;fallbackDailyRecords:string;noteRescue:string;deletionRecovery:string};metaKeys:Record<keyof RepositoryMetadata,string>;activeSessionId:string;
 helpers:Pick<RecordHelpers,'boundedInt'|'boundedNumber'|'clampText'|'clampEditorContent'|'editorContentWithinLimits'|'sameDataValue'>&Pick<NotesInput['helpers'],'wipeObject'|'normalizeAreaName'|'displayAreaName'|'normalizeTimestamp'|'jsonByteLength'>&{isValidIsoDate(value:unknown):boolean;isCanonicalScheduleText(value:unknown):boolean;activeSessionScheduleFingerprint(value:{date:string;scheduleText:string}):string;isoDateDay(value:string):number};
 hooks:{canMutate():boolean;getOwnershipRevision():number;issueWriteToken(reason:string,options?:{allowHydrating?:boolean}):WriteToken;assertWriteToken(token:WriteToken,reason:string):unknown;isOwnershipLostError(error:unknown):boolean;capture(scope:string,error:unknown,severity?:'warn'|'error'):void;onStorageOk(surface:string,key:string):void;onStorageError(surface:string,reason:unknown):void;onNotesChanged():void;onNoteSyncState:NotesInput['hooks']['onNoteSyncState'];onNoteConflict:NotesInput['hooks']['onNoteConflict'];onDailyRecordsChanged(value:Readonly<{date:string;type:string}>):void;onDatasetRevisionChanged(value:RevisionSnapshot):void;onCanonicalCommit(value:CanonicalCommit):void};
 clock:{nowMs():number};notesRepositoryModule:NotesRepositoryModule;saveLaneModule:SaveLaneModule;
}
