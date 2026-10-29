import type {LifecycleModule,OutcomeDetails} from './lifecycle.ts';
export type BackupDiagnosticsModuleInput={lifecycle:LifecycleModule};
export type DiagnosticScalar=string|number|boolean;
export type DiagnosticInput=Readonly<Record<string,unknown>>;
// Named outcome fields have already passed their field-specific allowlists.
export type DiagnosticDetails=Readonly<Record<string,DiagnosticScalar>&OutcomeDetails&{provider?:string;target?:string}>;
export type DiagnosticPhase=Readonly<{name:string;at:number;details:DiagnosticDetails}>;
export type DiagnosticRecord={id:string;release:string;kind:string;source:string;status:string;startedAt:number;endedAt:number;details:DiagnosticDetails;phases:DiagnosticPhase[]};
export type BackupRecorderInput={configuration:{limit:number;release:string};environment:{now():number};storage:{read():string|null;write(value:string):boolean|void}};
