import type {RecordCodecsModule} from '../source/core/record-codecs.ts';
import type {Limits,DataContract,KeyedRecord,NoteRecord} from './record-models.ts';
import type {IndexedDb,LocalStoragePort,DbTransaction} from './persistence.ts';
import type {MetaOwner} from './app-meta.ts';
import type {SaveLaneModule,FlushOptions} from './pilot.ts';
export type DraftNote=Omit<NoteRecord,'updatedAt'>&{updatedAt:string|null};
export type NoteDelta=(NoteRecord&{deleted?:false})|{key:string;deleted:true;updatedAt:string};
export type RawNote=Partial<Record<'key'|'label'|'text'|'updatedAt'|'format'|'version'|'entries'|'deleted',unknown>>;
export type NoteConflict={key:string;persisted:NoteRecord|null;local:NoteRecord|null;copy:NoteRecord|null;unresolved:boolean};
export type DeltaResult={conflicts:NoteConflict[];committed:Record<string,NoteRecord|null>;evicted:string[];written:number};
export type NoteMetadataSnapshot=Readonly<{revision:number;records:readonly Readonly<{id:string;key:string;label:string;hasNote:boolean;updatedAt:string}>[]}>;
export type NoteSearchSnapshot=Readonly<{revision:number;documents:readonly Readonly<{key:string;revision:string;value:string}>[]}>;
export type NoteUpdate={status:'rejected'|'conflict'|'unchanged'|'content-limit'|'limit'|'changed';revision:string};
export type NoteMove={id:string;from:string;to:string;label:string};
export type NoteDeletion={key:string;deletedAt:string};
export interface NotesInput{
 configuration:{limits:Limits;dataContract:DataContract;stores:{notes:string;appMeta:string};keys:{noteRescue:string}};
 storage:{local:LocalStoragePort;meta:MetaOwner;idbGetAll:IndexedDb['getAll'];idbStoreTransaction:IndexedDb['storeTransaction'];idbStrictTransaction:IndexedDb['strictTransaction'];storageResets():number};
 codecs:Pick<ReturnType<RecordCodecsModule['createDailyRecordCodec']>,'sanitizeCurrentNote'|'noteKeys'>;keyedRecord:KeyedRecord;
 helpers:{clampText(value:unknown,max:number):string;clampEditorContent(value:unknown,max:number):string;editorContentWithinLimits(value:unknown):boolean;wipeObject(value:object):void;normalizeAreaName(value:unknown):string;displayAreaName(value:unknown):string;normalizeTimestamp(value:unknown,fallback:string):string;normalizeTimestamp(value:unknown,fallback:null):string|null;sameDataValue(a:unknown,b:unknown):boolean;jsonByteLength(value:unknown):number;canonicalRuntimeError(message:string):Error;isCanonicalRuntimeError(error:unknown):boolean;rescueRoom():number};
 hooks:{canMutate():boolean;storageOk(surface:string,stamp:string):void;reportCommit(entity:'note',operation:'upsert'|'delete',value?:null,options?:FlushOptions):void;onNotesChanged():void;onNoteSyncState(key:string,state:'saving'|'synced'):void;onNoteConflict(value:{key:string;label:string;copyLabel?:string}):void;saveWarning(message:string):void;diagnosticsCapture(scope:string,error:unknown,severity:'warn'|'error'):void};
 canonical:{noteDeletionValue(key:string,deletedAt:string):NoteDeletion|null;notePreparationUnit(key:string):string;stageMutationEpoch(tx:DbTransaction,units:string[]):void;normalizeNoteDeletions(value:unknown):NoteDeletion[]};
 clock:{nowMs():number};saveLane:SaveLaneModule;
}
