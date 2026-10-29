export type SessionOptions=Readonly<{reconcile?:boolean}&Record<string,unknown>>;
export interface SessionContext{readonly format:'study-director.session-lifecycle-context';readonly contractVersion:1;readonly id:string;readonly kind:string;readonly revision:number;readonly options:SessionOptions;readonly startedAt:string}
export type SessionCompletion=Readonly<SessionContext&{reconciled:boolean;failed:boolean;finishedAt:string;superseded?:true;supersededBy?:string}>;
export type SessionHooks={canMutate:()=>boolean;flushPending:(kind:string,options:SessionOptions)=>void;prepare:(context:SessionContext)=>void;reconcile:(context:SessionContext,result:unknown)=>unknown;complete:(result:SessionCompletion)=>void;capture:(name:string,error:unknown,level:'error')=>void};
export interface SessionCoordinator{
 readonly format:'study-director.session-lifecycle-coordinator';readonly contractVersion:1;readonly revision:number;readonly transitioning:boolean;
 run<T>(kind:unknown,options:SessionOptions,operation:(context:SessionContext)=>T|PromiseLike<T>):Promise<T>;
 runSync<T>(kind:unknown,options:SessionOptions,operation:(context:SessionContext)=>T extends PromiseLike<unknown>?never:T):T;
 invalidate(kind:unknown,options?:SessionOptions):SessionContext;reconcile(kind:unknown,options?:SessionOptions):boolean;canWrite():boolean;
 status():Readonly<{format:'study-director.session-lifecycle-status';contractVersion:1;revision:number;transitioning:boolean;ready:boolean;active:SessionContext|null;last:SessionCompletion|null;canWrite:boolean}>;
}
export interface SessionLifecycleModule{readonly format:'study-director.session-lifecycle';readonly contractVersion:1;LifecycleBusyError:new(message?:string)=>Error&{code:string};createCoordinator(input:{hooks:SessionHooks}):Readonly<SessionCoordinator>}
