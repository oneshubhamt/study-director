import type {Limits} from './record-models.ts';
import type {MetaOwner} from './app-meta.ts';
import type {ReconciliationBaselineModule} from '../source/core/reconciliation-baseline.ts';
export type BaselineNote=Readonly<{label:string;text:string}>;
export type BaselineDays=Readonly<Record<string,string>>;
export type BaselineHeader=Readonly<{format:'study-director.reconciliation-base';version:3;checkpointId:string;establishedAt:string;noteCount:number;noteKeyFingerprint:string;personalFingerprint:string;sessionFingerprint:string}>;
export type BaselineNoteRecord=BaselineNote&Readonly<{format:'study-director.reconciliation-base-note';version:1;key:string}>;
export type BaselineDayRecord=Readonly<{format:'study-director.reconciliation-base-days';version:1;month:string;days:BaselineDays}>;
export type BaselineCodecInput={limits:Pick<Limits,'maxRichTextBytes'|'maxAreaNameChars'|'maxNotes'>;isNoteKey(value:unknown):boolean};
export type BaselineStoreInput={codec:ReturnType<ReconciliationBaselineModule['createCodec']>;families:{days:string;header:string;notes:string};meta:MetaOwner};
// null preserves a fingerprint only for incremental updates; a full write
// supplies both fingerprints and its complete key inventory.
export type BaselineUpdate={format:'study-director.reconciliation-base-update';version:2;noteCount:number;noteKeyFingerprint:string;updates:Readonly<Record<string,BaselineNote>>;deletes:readonly string[]}&({full:true;baseCheckpointId:string;personalFingerprint:string;sessionFingerprint:string;noteKeys:readonly string[];days:Readonly<Record<string,BaselineDays>>}|{full:false;baseCheckpointId:string;personalFingerprint:string|null;sessionFingerprint:string|null;noteKeys:null;days:Readonly<Record<string,BaselineDays|null>>});
