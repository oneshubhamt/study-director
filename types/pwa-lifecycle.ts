export type PwaCacheState=''|'completed'|'deferred'|'failed';
export type PwaCacheReason=''|'awaiting-client-state'|'unknown-client-release'|'client-limit'|'cooldown'|'cache-storage-unavailable';
export interface PwaIdentifyRequest{readonly type:'SD_PWA_IDENTIFY'}
export interface PwaApplyUpdateRequest{readonly type:'SD_PWA_APPLY_UPDATE';readonly requestId:string;readonly releaseId:string}
export interface PwaClientStateMessage{readonly type:'SD_PWA_CLIENT_STATE';readonly assetId:string;readonly buildId:string;readonly ready:true}
export type PwaPageToWorkerMessage=PwaIdentifyRequest|PwaApplyUpdateRequest|PwaClientStateMessage;
export interface PwaIdentityMessage{readonly type:'SD_PWA_IDENTITY';readonly releaseId:string;readonly buildId:string;readonly assetId:string;readonly waiting?:boolean}
export interface PwaActivationAckMessage{readonly type:'SD_PWA_ACTIVATION_ACK';readonly requestId:string;readonly releaseId:string}
export interface PwaUpdateAvailableMessage{readonly type:'SD_PWA_UPDATE_AVAILABLE';readonly releaseId:string;readonly buildId:string;readonly assetId:string}
export interface PwaActivatedMessage{readonly type:'SD_PWA_ACTIVATED';readonly releaseId:string;readonly buildId:string;readonly assetId:string}
export interface PwaClientStateRequest{readonly type:'SD_PWA_CLIENT_STATE_REQUEST';readonly releaseId:string}
export interface PwaInstallFailedMessage{readonly type:'SD_PWA_INSTALL_FAILED';readonly releaseId:string;readonly reason:'cache-limit'|'asset-unavailable'}
export interface PwaCacheStatusMessage{readonly type:'SD_PWA_CACHE_STATUS';readonly releaseId:string;readonly state:Exclude<PwaCacheState,''>;readonly reason?:Exclude<PwaCacheReason,''>;readonly removed?:number;readonly retained?:number}
export type PwaWorkerToPageMessage=PwaIdentityMessage|PwaActivationAckMessage|PwaUpdateAvailableMessage|PwaActivatedMessage|PwaClientStateRequest|PwaInstallFailedMessage|PwaCacheStatusMessage;
export type PwaPhase='idle'|'unsupported'|'registration-failed'|'installation-failed'|'ready'|'boot-pending'|'boot-failed'|'registering'|'checking'|'downloading'|'blocked'|'preparing'|'activating'|'reloading';
export type PwaBootState='not-confirmed'|'pending'|'mismatch'|'confirmed'|'current';
export interface PwaLifecycleStatus{
 readonly format:'study-director.pwa-lifecycle-status';readonly contractVersion:1;readonly supported:boolean;readonly installed:boolean;
 readonly registered:boolean;readonly registering:boolean;readonly registrationError:string;readonly checkError:string;readonly checking:boolean;
 readonly bootState:PwaBootState;readonly bootReleaseId:string;readonly bootConfirmedAt:string;readonly buildId:string;readonly assetId:string;
 readonly cacheState:PwaCacheState;readonly cacheReason:PwaCacheReason;readonly updateReady:boolean;readonly externalUpdate:boolean;
 readonly waitingReleaseId:string;readonly applying:boolean;readonly reloading:boolean;readonly revision:number;readonly message:string;readonly phase:PwaPhase;
}
export interface PwaWorkerPort{state:string;postMessage(message:PwaPageToWorkerMessage,transfer?:readonly unknown[]):void;addEventListener(type:'statechange',listener:()=>void):void;removeEventListener?(type:'statechange',listener:()=>void):void}
export interface PwaRegistrationPort{waiting:PwaWorkerPort|null;installing:PwaWorkerPort|null;active:PwaWorkerPort|null;update():PromiseLike<unknown>;addEventListener(type:'updatefound',listener:()=>void):void}
export interface PwaMessageEventPort{readonly data:unknown;readonly source:PwaWorkerPort|null}
export interface PwaServiceWorkerContainerPort{
 controller:PwaWorkerPort|null;
 register(workerUrl:unknown,options:Readonly<{scope:string;updateViaCache:'none'}>):PromiseLike<PwaRegistrationPort>;
 addEventListener(type:'message',listener:(event:PwaMessageEventPort)=>void):void;
 addEventListener(type:'controllerchange',listener:()=>void):void;
}
export interface PwaMessagePort{onmessage:((event:Readonly<{data:unknown}>)=>void)|null;postMessage?(message:unknown):void;close?():void}
export interface PwaMessageChannel{readonly port1:PwaMessagePort;readonly port2:PwaMessagePort}
export interface PwaMessageChannelConstructor{new():PwaMessageChannel}
export interface PwaWindowPort{readonly crypto?:Readonly<{randomUUID?():string}>;readonly sessionStorage:Pick<Storage,'getItem'|'setItem'|'removeItem'>;readonly location:Readonly<{reload():void}>;addEventListener(type:'focus'|'pagehide'|'pageshow',listener:()=>void):void}
export interface PwaDocumentPort{readonly hidden:boolean;addEventListener(type:'visibilitychange',listener:()=>void):void}
export interface PwaEnvironment{readonly AbortController:typeof AbortController;readonly MessageChannel:PwaMessageChannelConstructor|null;clearTimeout(handle:number):void;readonly document:PwaDocumentPort;readonly navigator:Readonly<{serviceWorker?:PwaServiceWorkerContainerPort|null}>;setTimeout(callback:()=>void,delay:number):number;readonly window:PwaWindowPort}
export interface PwaUpdateContext{readonly requestId:string;readonly releaseId:string;readonly automatic:boolean;readonly external:boolean;readonly follower:boolean;readonly signal:AbortSignal}
export interface PwaUpdateGuard{readonly ready:PromiseLike<unknown>;validate():boolean;release():PromiseLike<unknown>|unknown}
export interface PwaPreparationResult{readonly ok:boolean;readonly reason?:string}
export interface PwaLifecycleInput{readonly configuration:Readonly<{assetId:string;buildId:string;reloadSessionKey:string;scope:string;workerUrl:unknown}>;readonly environment:PwaEnvironment;readonly hooks:Readonly<{capture(scope:string,error:unknown):unknown;prepare(context:PwaUpdateContext):PromiseLike<PwaPreparationResult>|PwaPreparationResult;render(state:PwaLifecycleStatus):unknown;reserve(context:PwaUpdateContext):PwaUpdateGuard}>}
export interface PwaLifecycleController{readonly format:'study-director.pwa-lifecycle';readonly contractVersion:1;install():Promise<PwaLifecycleStatus>|PwaLifecycleStatus;apply(options?:Readonly<{automatic?:boolean}>):Promise<boolean>;checkForUpdate():Promise<boolean>;confirmBoot():Promise<boolean>;reportClient(worker?:PwaWorkerPort|null):boolean;status():PwaLifecycleStatus}
