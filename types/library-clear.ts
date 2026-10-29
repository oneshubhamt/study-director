import type {RepositoriesModule} from '../source/core/repositories.ts';
import type {LibraryClearModule} from '../source/core/library-clear.ts';
import type {BackupDiagnosticsModule} from '../source/core/backup-operation-diagnostics.ts';
import type {AssetRow} from './asset-storage.ts';
import type {AuthorityOptions} from './mutation-coordinator.ts';
import type {DiagnosticInput} from './backup-operation-diagnostics.ts';
import type {SessionSnapshot} from './record-models.ts';
type AppData=ReturnType<RepositoriesModule['createAppData']>;
export type LibrarySelection=Readonly<{savedDays:boolean;notes:boolean;attachments:boolean}>;
export type ReferenceSource={kind:string;key:string;label:string;ids:Iterable<string>};
export type ProtectedReference={attachmentId:string;kind:string;key:string;label:string};
export type RewriteTarget={kind:string;key:string;label:string;attachmentIds:readonly string[];expectedValue?:string};
export type LibraryPlan=ReturnType<LibraryClearModule['createPlan']>;
export type LibraryPolicy={forceReferenced?:boolean;deleteIds?:readonly string[];protectedIds?:readonly string[]};
export type ScopedSnapshot<T>={mode:'all'|'selected';entries:T};
export type LibraryRawRow=Record<string,unknown>;
export type RollbackShape={format:'study-director.library-clear-rollback';version:1;notes:{mode:'all'|'selected';entries?:Record<string,LibraryRawRow>|null}|null;dailyRecords:{mode:'all'|'selected';entries?:(LibraryRawRow&{date:string})[]|null}|null;sessionCaptured:unknown;activeSession:LibraryRawRow|null;attachmentMetadata:(LibraryRawRow&{id:string})[]};
export interface LibraryStatePorts{
 createRollbackScope:LibraryClearModule['createRollbackScope'];withPersistenceSuppressed<T>(operation:()=>Promise<T>):Promise<T>;nowIso?:()=>string;
 data:{notes:Pick<AppData['notes'],'readFreshPayload'|'replace'|'updateValidatedRich'|'flush'|'failure'>;dailyRecords:Pick<AppData['dailyRecords'],'get'|'list'|'saveBatch'|'restoreBatch'>;activeSession:Pick<AppData['activeSession'],'load'|'nextRevision'|'save'|'clear'>};
 references:{scan(value:string):{assetIds:readonly string[]};remove(value:string,ids:readonly string[]):{value:string;removed:{total:number}}|null;listSources():Promise<readonly ReferenceSource[]>};
 attachments:{inventory():Promise<readonly AssetRow[]>;verifyMetadata(rows:readonly AssetRow[]):Promise<unknown>;restoreMetadata(rows:readonly unknown[]):Promise<unknown>};
 review:{hydrate(input:{date:string;snapshotReview:SessionSnapshot['review']}):unknown;invalidateBindings():void};
}
export type ClearJournal={state:{id:string};payload:unknown};
export type Trace={mark(name:string,details?:DiagnosticInput):unknown};
export type TraceOutcome={status?:string;pending?:boolean;recovered?:boolean;savedDays?:number;notes?:number;attachmentsRemoved?:number;sweepPending?:boolean};
export type ClearRecorder=Pick<ReturnType<BackupDiagnosticsModule['createRecorder']>,'start'|'mark'|'finish'|'fail'>;
export interface LibraryCoordinatorPorts{
 runExclusive<T>(kind:string,operation:()=>Promise<T>):Promise<T>;canMutate():boolean;assertAuthority(options?:AuthorityOptions):unknown;assertEligible():Promise<unknown>;settle():Promise<unknown>;
 snapshot():Promise<{attachments:readonly {id:string}[];sources:readonly ReferenceSource[]}>;
 createProtectedSafety(purpose:'before-clear-library'):Promise<{verified?:boolean}|null>;
 capture(plan:LibraryPlan,policy:LibraryPolicy):Promise<object>;
 deleteNotes():Promise<{count:number}>;deleteSavedDays():Promise<{count:number}>;removeReferences(targets:readonly RewriteTarget[]):Promise<unknown>;
 verifyLogical(plan:LibraryPlan,policy:LibraryPolicy):Promise<unknown>;removeAttachmentMetadata(ids:readonly string[]):Promise<{removed:number}>;verifyFinal(plan:LibraryPlan,policy:LibraryPolicy):Promise<unknown>;
 restore(payload:unknown):Promise<unknown>;verifyRestore(payload:unknown):Promise<unknown>;sweep():Promise<number>;failClosed(message:string):void;clearFault():void;
 journal:{prepare(input:{id:string;signature:string;payload:object}):Promise<ClearJournal>;read():Promise<ClearJournal|null>;mark(id:string,phase:string):Promise<unknown>;clear(id:string):Promise<unknown>};diagnostics?:Partial<ClearRecorder>;
}
