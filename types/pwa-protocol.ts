export type PwaCacheStatusState='completed'|'deferred'|'failed';
export type PwaCacheStatusReason='awaiting-client-state'|'unknown-client-release'|'client-limit'|'cooldown'|'cache-storage-unavailable';

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
export interface PwaCacheStatusMessage{readonly type:'SD_PWA_CACHE_STATUS';readonly releaseId:string;readonly state:PwaCacheStatusState;readonly reason?:PwaCacheStatusReason;readonly removed?:number;readonly retained?:number}
export type PwaWorkerToPageMessage=PwaIdentityMessage|PwaActivationAckMessage|PwaUpdateAvailableMessage|PwaActivatedMessage|PwaClientStateRequest|PwaInstallFailedMessage|PwaCacheStatusMessage;
