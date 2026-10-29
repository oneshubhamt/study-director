import type {MetaOwner} from './app-meta.ts';
import type {Limits} from './record-models.ts';
export interface JournalInput{appMeta:MetaOwner;limits:Limits;helpers:{clampText(value:unknown,max:number):string};clock:{nowMs():number}}
// Journal values are inspected after the metadata gateway's runtime validation.
// Coercive wire fields remain unknown until individual checks/normalizers.
export type JournalFields=Partial<Record<'arrayBuffer'|'assetId'|'attachmentDeletions'|'backupFile'|'blob'|'byteLength'|'bytes'|'chunkCount'|'createdAt'|'date'|'deletedAt'|'every'|'expiresAt'|'filename'|'format'|'hash'|'id'|'index'|'key'|'kind'|'length'|'name'|'noteDeletions'|'owner'|'payload'|'phase'|'savedDayDeletions'|'scheduleText'|'sha256'|'signature'|'signatureHash'|'size'|'suffix'|'toString'|'updatedAt'|'value'|'version',unknown>>;
export type LibraryPreparation={id?:unknown;payload?:object;signature?:unknown};
export type RestorePreparation={id?:unknown;blob?:Blob;backupFile?:{name:string;size:number;hash:string};filename?:unknown;scheduleText?:unknown;savedDayDeletions?:unknown;noteDeletions?:unknown;attachmentDeletions?:unknown};
export type MutationRequest={id?:unknown;owner?:unknown;kind?:unknown;expiresAt?:unknown};

export type LibraryJournalState={format:string;version:number;id:string;phase:string;chunkCount:number;byteLength:number;sha256:string;signatureHash:string;createdAt:string;updatedAt:string};
export type RestoreJournalState={format:string;version:number;id:string;phase:string;createdAt:string;updatedAt:string};
export type MutationLease={format:string;version:number;id:string;owner:string;kind:string;expiresAt:number;updatedAt:string};
export type AcquiredLease={acquired:false;holder:Readonly<JournalFields>}|{acquired:true;lease:Readonly<MutationLease>};
