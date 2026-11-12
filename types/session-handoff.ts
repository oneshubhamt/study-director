import type {ActiveSession,SessionSnapshot} from './record-models.ts';
import type {RuntimeEvidence} from './timer-engine.ts';
import type {SessionHostController} from './session-host.ts';

export type SessionClaimProjection=Readonly<{
  state:'owned'|'released';
  applies:boolean;
  ownedHere:boolean;
  epoch:number;
  newer?:boolean;
  revision?:number;
  observedRevision?:number;
  ownerToken?:string;
  observedOwnerToken?:string;
  observedContentFingerprint?:string;
  handoffToken?:string;
}>;
export type SessionOwnershipClaim=Readonly<{revision:number;[key:string]:unknown}>;
export type SessionHandoffSource=Readonly<{
  status:string;
  reason?:string;
  checkpointId?:string;
  session?:ActiveSession|null;
  priorClaim?:SessionClaimProjection|null;
  sharedContentFingerprint?:string;
}>;
export type SessionClaimDecision=Readonly<{
  observedOwner:string;
  observedRevision:number;
  observedContentFingerprint:string;
  revision:number;
}>;
export type SessionClaimRequest=Readonly<{
  date:string;
  handoffToken:string;
  decide:(source:SessionHandoffSource)=>Promise<SessionClaimDecision>;
  onWrite:()=>void;
}>;
export type SessionClaimResult=Readonly<{status:string;reason?:string;claim?:SessionOwnershipClaim;source?:SessionHandoffSource}>;

export interface SessionHandoffInput{
  configuration:{
    providerId:string;
    claimWatchMs:number;
    claimSyncRetryMs:number;
    claimSaveWarning:string;
  };
  authority:{
    canMutate():boolean;
    startupReady():boolean;
    visible():boolean;
    online():boolean;
    hasTasks():boolean;
    panelElsewhere():boolean;
  };
  provider:{
    connected(id:string):boolean;
    readHandoffSource(id:string):Promise<SessionHandoffSource>;
    claimOwnership(id:string,request:SessionClaimRequest):Promise<SessionClaimResult>;
    releaseClaim(id:string,claim:SessionOwnershipClaim):Promise<boolean>;
    readClaim(id:string):Promise<SessionClaimProjection|null>;
    scheduleSync(id:string,reason:string):boolean;
    suspendBackground(reason:string):Readonly<{settled:PromiseLike<unknown>;release():unknown}>;
    wakeBackground(reason:string):unknown;
  };
  session:{
    host:Pick<SessionHostController,'captureSnapshot'|'writeSnapshot'|'requireCanonicalWrite'|'saveCanonicalSession'|'load'|'payload'|'cancelPendingLiveDraftSave'|'resetRuntime'|'suspendLocal'>;
    sanitize(value:unknown):ActiveSession|null;
    same(left:unknown,right:unknown):boolean;
    nextRevision(seed:number):number;
    contentFingerprint(value:ActiveSession):Promise<string>;
    assetIds(value:ActiveSession):readonly string[];
  };
  plan:{
    flushDraft():unknown;
    settled():PromiseLike<unknown>;
    readDraft():string|null;
    readCanonicalDraft():Promise<string|null>;
    displayedDraft():string;
    defaultScheduleText():string;
  };
  runtime:{
    markContentChanged():unknown;
    captureEvidence():RuntimeEvidence;
    stopExecution():unknown;
    resumeExecution(options:Readonly<{frozenSinceMs:number}>):boolean;
  };
  presentation:{
    capture(scope:string,error:unknown,level:'warn'|'error'):unknown;
    setStatus(message:string,ok?:boolean):unknown;
    warnStorage(message:string):unknown;
    clearStorageWarning(message:string):unknown;
    notifyNewerClaim():unknown;
    noteBackupChange(reason:string):unknown;
  };
  installation:{id():string};
  clock:{nowMs():number;nowIso():string};
  identity:{uuid():string};
}
export interface SessionHandoffStatus{
  readonly checking:boolean;
  readonly lastAttemptAt:number;
  readonly frozen:boolean;
  readonly epoch:number;
  readonly localVerified:boolean;
  readonly frozenSinceMs:number;
  readonly lastSyncAt:number;
}
export interface SessionHandoffTransferOptions{
  readonly onStep?:(text:string)=>unknown;
  readonly preread?:PromiseLike<unknown>|null;
}
export interface SessionHandoffTransferResult{
  readonly previous:ActiveSession;
  readonly session:ActiveSession;
  readonly claim:SessionOwnershipClaim;
}
export interface SessionHandoffController{
  readonly format:'study-director.session-handoff';
  readonly contractVersion:1;
  runsElsewhere(session:unknown):boolean;
  fromElsewhere(session:unknown):boolean;
  frozen():boolean;
  status():SessionHandoffStatus;
  snapshotForWrite():SessionSnapshot|null;
  prefetchSource():Promise<SessionHandoffSource|null>;
  checkClaim():Promise<boolean>;
  wakeClaim(slackMs?:number):Promise<boolean>|false;
  transferHere(session:unknown,options?:SessionHandoffTransferOptions):Promise<Readonly<SessionHandoffTransferResult>>;
  yieldLocal():Promise<ActiveSession|false>;
}
export interface SessionHandoffModule{
  readonly format:'study-director.session-handoff-module';
  readonly contractVersion:1;
  readonly retryMessage:string;
  createController(input:Readonly<SessionHandoffInput>):Readonly<SessionHandoffController>;
}
