export interface OutcomeDetails{status?:string;reason?:string;available?:boolean;complete?:boolean;cancelled?:boolean;pending?:boolean;ok?:boolean;gcPending?:boolean}
export type OperationOutcome='failed'|'unavailable'|'yielded'|'cancelled'|'interrupted'|'superseded'|'deferred'|'completed';
export type SnapshotInput={busy?:boolean;pending?:boolean;scheduled?:boolean;suspended?:boolean;reason?:string;nextEligibleAt?:string;lastResult?:OutcomeDetails|null};
export type Snapshot=Readonly<{state:'running'|'paused'|'scheduled'|'pending'|'idle';busy:boolean;pending:boolean;scheduled:boolean;suspended:boolean;reason:string;nextEligibleAt:string;lastOutcome:OperationOutcome|''}>;
export type WorkBudgetInput={now:()=>number;milliseconds?:number;check?:()=>void;yieldError:()=>unknown};
export type WorkBudget=Readonly<{start(milliseconds:number):boolean;check():void;advance():void}>;
export interface TimerEnvironment<Timer=number>{now():number;setTimeout(callback:()=>void,delay:number):Timer;clearTimeout(handle:Timer):void}
export interface JobResult extends OutcomeDetails{status:string}
export type JobInput<R extends JobResult,Timer=number>={environment:TimerEnvironment<Timer>;isAvailable:()=>boolean|string;execute:(context:Readonly<{trigger:string;nextEligibleAt:string;options:Readonly<Record<string,unknown>>}>)=>R|PromiseLike<R>;capture:(error:unknown)=>void;onBlocked?:(reason:string)=>void;retryMs?:number;minDelayMs?:number};
export type DeferredResult=Readonly<{status:'skipped'|'deferred'|'unavailable';reason:string;pending?:boolean}>;
export interface Job<R extends JobResult>{schedule(delay?:number,reason?:string,mode?:'earliest'|'replace'):boolean;run(reason?:string,options?:Readonly<Record<string,unknown>>):Promise<R|DeferredResult>;wake(reason?:string,discover?:boolean):boolean;clear():boolean;dispose():void;settled():Promise<R|DeferredResult|null>;status():Snapshot&{blocker:string;running:boolean}}
export interface CancellationSignal{readonly aborted:boolean;readonly reason:unknown;addEventListener(type:"abort",callback:()=>void,options:{once:boolean}):void;removeEventListener(type:"abort",callback:()=>void):void}
export interface SettlementOptions{signal?:CancellationSignal|null;setTimeout?:(callback:()=>void,delay:number)=>number;clearTimeout?:(handle:number)=>void;timeoutMs?:number;timeoutCode?:string;timeoutMessage?:string;cancelError?:()=>unknown;subscribeCancel?:((callback:()=>void)=>()=>void)|null;ignoreFailures?:boolean}
export interface LifecycleModule{
 readonly format:'study-director.operation-lifecycle';readonly contractVersion:1;
 createWorkBudget(input:WorkBudgetInput):WorkBudget;outcome(input?:OutcomeDetails):OperationOutcome;snapshot(input?:SnapshotInput):Snapshot;
 waitForSettlement<T>(waiting:Iterable<T|PromiseLike<T>>,options?:SettlementOptions):Promise<(T|null)[]>;
 createJob<R extends JobResult,Timer=number>(input:JobInput<R,Timer>):Readonly<Job<R>>;
 createGroup(capture:(id:string,error:unknown)=>void):Readonly<{register(id:string,owner:{wake(trigger:string):unknown}):void;wake(trigger?:string):void}>;
}
export interface RepositoryPolicyModule{readonly format:'study-director.repository-policy-module';readonly contractVersion:1;readonly protocol:Readonly<Record<'publicationRenewMs'|'publicationStaleMs'|'publicationMaxAgeMs'|'publicationAssertionMarginMs'|'maintenanceWorkBudgetMs'|'maintenanceReleaseGraceMs'|'maintenanceMaxAgeMs'|'maintenanceAssertionMarginMs'|'driveMetadataTimeoutMs'|'driveMaintenanceMaxAgeMs'|'driveMaintenanceAssertionMarginMs'|'objectGcGraceMs'|'automaticQuietMs'|'automaticUrgentMs'|'automaticExpiryLeadMs',number>>}
