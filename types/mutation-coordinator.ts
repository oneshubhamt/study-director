export type AuthorityError=Error&{code:'STUDY_DIRECTOR_MUTATION_AUTHORITY_LOST';durableProtected:boolean};
export type AuthorityOptions={allowDurableProtected?:boolean};
/** Ephemeral operation identity; never serialized into journal records. */
export type JournalFence=Readonly<{id:string;owner:string;assert():true}>;
export type MutationAuthority=Readonly<{signal:AbortSignal;assert(options?:AuthorityOptions):true;status():Readonly<{healthy:boolean;durableProtected:boolean}>}>;
export type MutationOrigin=Readonly<{tabId:string;pageId:string;claimId:string;revision:number}>;
export type MutationState={kind:string;id:string;origin:MutationOrigin;owner:string;phase:'pending'|'active'|'retired';expiresAt:number;controller:AbortController;authorityError:AuthorityError|null};
export type LeaseInput={kind:string;id:string;owner:string;expiresAt:number;renew?:boolean};
export type LeaseResult={acquired:boolean;holder?:{expiresAt:unknown}|null};
export type LocalLease={version?:unknown;tabId?:unknown;pageId?:unknown;claimId?:unknown;id?:unknown;expiresAt?:unknown};
export interface MutationInput{
 configuration:Readonly<{heartbeatMs:number;leaseMs:number;lockName:string;storageKey:string}>;
 durable:{acquire(value:LeaseInput):Promise<LeaseResult>;release(id:string,owner:string):Promise<unknown>};
 environment:{AbortController:typeof AbortController;addStorageListener(listener:(event:{key:string|null})=>void):void;clearInterval(id:number):void;locks:Pick<LockManager,'request'>|null;now():number;randomIdPart(length:number):string;setInterval(callback:()=>void,ms:number):number;setTimeout(callback:()=>void,ms:number):number};
 hooks:{foreignReleased():void;refreshUi():void;scheduleUpdate(delay:number):void};identity:{canMutate():boolean;status():{tabId?:unknown;pageId?:unknown;claimId?:unknown;revision:number}};
 local:{getJson(key:string,fallback:null):unknown;remove(key:string):unknown;setJson(key:string,value:unknown):boolean};
}
