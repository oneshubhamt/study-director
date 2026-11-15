import type {CanonicalCommit} from './repositories.ts';
import type {ReferenceScan} from './attachments.ts';

export type StorageHealthIssue=Readonly<{source:string;label:string;message:string;level:'warn'|'error';at:string}>;
export type StorageHealthHistory=Readonly<{version:3;lastLocalSaveAt:string|null;lastStudyDataSaveAt:string|null;browserDataClearedAt:string|null}>;
export type StorageHealthState=Readonly<StorageHealthHistory&{issues:readonly StorageHealthIssue[];hasIssues:boolean}>;
export type StorageHealthPatch=Partial<Pick<StorageHealthHistory,'lastLocalSaveAt'|'lastStudyDataSaveAt'|'browserDataClearedAt'>>&Record<string,unknown>;
export interface StorageHealthInput{
  readonly local:Readonly<{getJson(key:string,fallback:unknown):unknown;setJson(key:string,value:unknown):boolean;readonly lastError:unknown}>;
  readonly key:string;
  readonly maxStatusMessageChars:number;
  clampText(value:unknown,max:number):string;
  refreshWarning():unknown;
  scheduleSyncStatus():unknown;
  readonly document:Document;
  timeLabelFromIso(value:string):string;
  renderCapabilities():unknown;
}
export interface StorageHealthController{
  readonly format:'study-director.storage-health';readonly contractVersion:1;
  activate():StorageHealthState;
  issue(source:unknown,message:unknown,options?:Readonly<{level?:'warn';mirror?:boolean}>):StorageHealthState;
  recover(source:unknown,patch?:StorageHealthPatch|null,options?:Readonly<{mirror?:boolean}>):StorageHealthState;
  updateHistory(patch:StorageHealthPatch):StorageHealthState;
  observeLocalStorage(operation:unknown,error:unknown):void;
  snapshot():StorageHealthState;
  render(health?:StorageHealthState):void;
  markOk(source:string,key?:string):StorageHealthState;
  markTimestamp(key:string):StorageHealthState;
  markError(source:string,reason:unknown,options?:Readonly<{level?:'warn';mirror?:boolean}>):StorageHealthState;
}
export type CanonicalCommitEvent=CanonicalCommit&Readonly<{startup?:boolean;settingsOnly?:boolean}>;
export interface CanonicalCommitInput{
  readonly storage:Pick<StorageHealthController,'updateHistory'|'render'>;
  scanAttachmentReferences(value:string):ReferenceScan;
  incrementReferenceRevision():unknown;
  syncCapability(event:CanonicalCommitEvent):unknown;
  notifyBackupChange(change:Readonly<{urgent:boolean;reason:string}>):unknown;
  scheduleAssetMaintenance():unknown;
  invalidateAttachmentLibrary():unknown;
  fullyInitialized():boolean;
  refreshKeptVersions():unknown;
  reminderDate():string;
  revalidateSaveReminder():Promise<unknown>|unknown;
  nowIso():string;
}
export interface CanonicalCommitController{
  readonly format:'study-director.canonical-commit-host';readonly contractVersion:1;
  handle(event:CanonicalCommitEvent):void;
  changesAttachmentReferences(event:CanonicalCommitEvent):boolean;
}
export interface BackupReadinessHostContract{
  readonly format:'study-director.backup-readiness-host-module';readonly contractVersion:1;
  createStorageHealth(input:Readonly<StorageHealthInput>):Readonly<StorageHealthController>;
  createCanonicalCommit(input:Readonly<CanonicalCommitInput>):Readonly<CanonicalCommitController>;
}
