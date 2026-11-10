import type {PersonalData,PersonalPreferences,SavedPlans} from './record-models.ts';
import type {PlanController,PlanDefaults,PlanDraftSaveOptions,PlanLibrary,PlanModule,PlanModuleInput} from './plan.ts';
import type {PortablePreferences,WriteOptions} from './repositories.ts';
import type {WriteToken} from './ownership.ts';

export interface PlanDataCodecPort{
  plans(value:unknown):SavedPlans;
  preferences(value:unknown):PersonalPreferences;
  normalize(value:unknown):PersonalData;
}
export interface PlanDocumentsRepositoryPort{
  read():PromiseLike<SavedPlans>;
  replace(value:SavedPlans):PromiseLike<unknown>;
  replacePortable(value:PersonalData):PromiseLike<PortablePreferences>;
  writeDraft(value:string|null,options?:WriteOptions):PromiseLike<unknown>;
  writeLibrary(value:Omit<SavedPlans,'draft'>,options?:WriteOptions):PromiseLike<unknown>;
}
export interface PlanPreferencesRepositoryPort{read():PromiseLike<unknown>}
export interface PlanOwnershipPort{
  issueWriteToken(reason:string,options?:Readonly<{allowHydrating?:boolean}>):WriteToken;
  assertWriteToken(token:WriteToken,reason:string):unknown;
}
export interface PlanPreferenceHooks{
  fallback():unknown;
  flush(options?:Readonly<{backupCapture?:boolean}>):unknown|PromiseLike<unknown>;
  accept(value:unknown):unknown;
  refreshAppearance(value:unknown):unknown;
  applyRuntime(value:unknown):unknown;
  studentName():string|null;
}
export interface PlanRuntimeHooks{
  canMutate():boolean;
  flushDraft(options?:Readonly<PlanDraftSaveOptions>):boolean|PromiseLike<boolean>;
  replaceDraftText(value:string):unknown;
  previewDraft():unknown;
  renderSavedPlans():unknown;
}
export interface PlanDataHostInput{
  readonly codec:Readonly<PlanDataCodecPort>;
  readonly repositories:Readonly<{plans:Readonly<PlanDocumentsRepositoryPort>;preferences:Readonly<PlanPreferencesRepositoryPort>}>;
  readonly ownership:Readonly<PlanOwnershipPort>;
  readonly storage:Readonly<{markError(surface:string,message:string):unknown}>;
  readonly preferences:Readonly<PlanPreferenceHooks>;
  readonly runtime:Readonly<PlanRuntimeHooks>;
  readonly defaults:Readonly<{factory:Readonly<PlanDefaults>}>;
}
export interface PlanDataWriteOptions extends PlanDraftSaveOptions{
  readonly force?:boolean;
  readonly ownershipToken?:WriteToken|null;
  readonly allowHydrating?:boolean;
}
export interface PlanLibraryWriteOptions{
  readonly ownershipToken?:WriteToken|null;
  readonly allowHydrating?:boolean;
}
export interface PlanDataSettleOptions{readonly backupCapture?:boolean}
export interface PlanDataController{
  readonly format:'study-director.plan-data';
  readonly contractVersion:1;
  readonly factory:Readonly<PlanDefaults>;
  hydrate():Promise<boolean>;
  writeDraft(value:string|null,options?:Readonly<PlanDataWriteOptions>):Promise<boolean>;
  writeLibrary(value:PlanLibrary,options?:Readonly<PlanLibraryWriteOptions>):Promise<boolean>;
  rewriteAfterStorageReset():Promise<boolean>;
  settled(options?:Readonly<PlanDataSettleOptions>):Promise<boolean>;
  exportData(options?:Readonly<{flush?:boolean;backupCapture?:boolean}>):Promise<PersonalData>;
  importData(value:unknown):Promise<boolean>;
  verify(value:unknown):Promise<boolean>;
  readDraft():string|null;
  library():PlanLibrary;
  defaultSchedule():string|null;
  activeDefaults():Readonly<PlanDefaults>;
  ready():boolean;
}
export type PlanControllerHostPorts=
  Omit<PlanModuleInput['ports'],'persistence'|'defaults'>&Readonly<{
    persistence:Pick<PlanModuleInput['ports']['persistence'],'lastError'|'reportDraftResult'>;
    defaults:Pick<PlanModuleInput['ports']['defaults'],'applyStudentName'>;
  }>;
export interface PlanControllerHostInput{
  readonly module:PlanModule;
  readonly data:Readonly<PlanDataController>;
  readonly ports:Readonly<PlanControllerHostPorts>;
}
export interface PlanHostModule{
  readonly format:'study-director.plan-host-module';
  readonly contractVersion:1;
  createData(input:Readonly<PlanDataHostInput>):Readonly<PlanDataController>;
  createController(input:Readonly<PlanControllerHostInput>):Readonly<PlanController>;
}
