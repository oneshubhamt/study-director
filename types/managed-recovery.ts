import type {AuthorityOptions} from './mutation-coordinator.ts';
export type RecoveryKind='bring-in'|'restore-version'|'sync';
export type VerifiedSafety={verified:true;checkpointId:string;sourceRevision:string};
export type SafetyProof=VerifiedSafety|{verified:false;skipped:'local-empty'};
export type RecoverySpec<R extends object,P extends object>={label:string;keepsActiveSession?:boolean;verifyEmpty?:()=>Promise<boolean>;apply():Promise<R>;publishPresent(result:R):Promise<P|null>} & ({kind:'sync';createSafety:null}|{kind:'bring-in'|'restore-version';createSafety():Promise<unknown>});
export interface ManagedRecoveryInput<S>{
 automaticBackup:{suspend(reason:RecoveryKind):Promise<S>;resume(suspension:S):unknown};
 diagnostics:{capture(scope:string,error:unknown,severity:'warn'):void;mark(phase:string,details:Readonly<Record<string,unknown>>):void};
 lifecycle:{quiesce<T>(operation:()=>Promise<T>):Promise<T>;settle(kind:RecoveryKind,options?:Readonly<{phase:'final';keepsActiveSession:boolean}>):Promise<unknown>;revision():unknown;rebuild(kind:RecoveryKind,result:object):Promise<unknown>};
 mutation:{run<T>(kind:string,operation:(authority?:{assert(options?:AuthorityOptions):unknown})=>Promise<T>):Promise<T>};
}
