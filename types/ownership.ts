export type OwnershipState='secondary'|'resolving'|'acquiring'|'hydrating'|'primary'|'releasing'|'faulted';
export type OwnerRecord={version?:unknown;tabId?:unknown;pageId?:unknown;claimId?:unknown;expiresAt?:unknown};
export type OwnershipMessage={type?:unknown;tabId?:unknown;pageId?:unknown;claimId?:unknown;probeId?:unknown;requestId?:unknown;targetClaimId?:unknown;targetPageId?:unknown;detectedAt?:unknown;expiresAt?:unknown};
export type OwnershipStatus=Readonly<{format:'study-director.app-ownership-status';contractVersion:1;state:OwnershipState;revision:number;hasControl:boolean;hydrating:boolean;installed:boolean;takeoverPending:boolean;resolving:boolean;tabId:string;pageId:string;claimId:string;authority:'web-lock'|'lease';webLockHeld:boolean}>;
export type WriteToken=Readonly<{format:'study-director.ownership-write-token';contractVersion:1;tabId:string;pageId:string;claimId:string;revision:number;state:OwnershipState;allowHydrating:boolean;reason:string}>;
export type PrimaryOptions={faulted?:boolean;error?:unknown;hydrate?:boolean;sameTabReload?:boolean};
export type LeaseOptions={force?:boolean;hydrate?:boolean};
export interface OwnerChannel{onmessage:((event:MessageEvent<unknown>)=>void)|null;postMessage(message:OwnershipMessage):void}
export interface OwnershipInput{
 config:Readonly<{storageKey:string;sessionTabKey:string;channelName:string;heartbeatMs:number;staleMs:number;probeMs:number;webLockName:string}>;
 environment:{document:Pick<Document,'documentElement'>;window:{sessionStorage?:Pick<Storage,'getItem'|'setItem'>;navigator:{locks?:Pick<LockManager,'request'>};AbortController?:typeof AbortController;BroadcastChannel?:new(name:string)=>OwnerChannel;addEventListener(type:'storage',callback:(event:StorageEvent)=>void):void};now():number;randomIdPart(length:number):string;setInterval(callback:()=>void,delay:number):number;clearInterval(id:number):void;setTimeout(callback:()=>void,delay:number):number;clearTimeout(id:number):void};
 local:{getJson(key:string,fallback:null):unknown;setJson(key:string,value:unknown):boolean;remove(key:string):boolean;lastError():unknown};
 diagnostics:{capture(scope:string,error:unknown,severity?:'error'):void;guard(scope:string,callback:()=>unknown):unknown};
 hooks:{render():void;refreshStorage():void;stopExecution():void;isInitialized():boolean;hydrate(options:{sameTabReload:boolean}):unknown;finalizeHydration():unknown;resume():void;refreshCore():void;scheduleMaintenance():void;practiceRender():void;blocked(status:OwnershipStatus,reason:string):void;invalidate(context:{reason:unknown;state:OwnershipState;revision:number}):void;flush():unknown;settled():unknown;peerStorageReset?:(detectedAt:string)=>unknown};
}
