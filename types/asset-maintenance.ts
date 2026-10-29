import type {LifecycleModule,JobResult} from './lifecycle.ts';
import type {CollectionScope,AssetCollectOptions} from './asset-storage.ts';
export interface AssetMaintenanceResult extends JobResult{status:string;reason:string;removed:number;assets?:number;references?:number;swept?:number}
export type AssetLease={protect(id:unknown):string;release(id:unknown):boolean;isProtected(id:unknown):boolean};
export type LiveField={readonly value:unknown;readonly isConnected:boolean};
export type LiveValues=readonly (readonly [LiveField,string])[];
export type ReferenceScan={signature:string;references:Set<string>;phase:number;index:number;values:unknown[]|null};
export type MaintenanceDiagnosticDetails={background?:boolean;trigger?:string;nextEligibleAt?:string;actionable?:boolean;status?:string;reason?:string;removed?:number};
export interface AssetMaintenancePorts{
 canMutate():boolean;mutationActive():boolean;
 collect(scan:(store:Readonly<CollectionScope>)=>Promise<AssetMaintenanceResult>,options:AssetCollectOptions):Promise<AssetMaintenanceResult>;
 readRestoreJournal():Promise<{state:unknown}|null>;readLibraryClearJournal():Promise<{state:unknown}|null>;
 liveFields():readonly LiveField[];getReferenceRevision():string|number;getDatasetRevision():Promise<string|number|null>;
 scanReferences(value:string):{assetIds?:readonly string[];trusted:boolean};
 readNotes():Promise<Readonly<Record<string,{text?:unknown}>>>;
 loadActiveSession():Promise<{ok:boolean;error?:unknown;value?:{snapshot?:{review?:{reflection?:unknown}}}|null}>;
 listDailyRecords():Promise<readonly {reflection?:unknown}[]>;readPendingReviewTexts():Promise<readonly string[]>;
 budget():()=>boolean;yieldTask(options:{priority:'background'}):Promise<unknown>;invalidate():void;captureError(error:unknown):void;
 setTimeout?:(callback:()=>void,delay:number)=>number;clearTimeout?:(id:number)=>void;now?:()=>number;
 isAvailable?:()=>boolean|string;completed?:(result:AssetMaintenanceResult)=>unknown;
 diagnostics?:{start?:(kind:string,source:string,details:MaintenanceDiagnosticDetails)=>string;mark?:(phase:string,details:MaintenanceDiagnosticDetails,id:string)=>unknown;finish?:(details:MaintenanceDiagnosticDetails,id:string)=>unknown;fail?:(error:unknown,details:MaintenanceDiagnosticDetails,id:string)=>unknown};
}
export type AssetMaintenanceOptions={lease:AssetLease;delayMs?:number;workMs?:number;batchSize?:number};
export type AssetMaintenanceModuleInput={lifecycle:LifecycleModule};
