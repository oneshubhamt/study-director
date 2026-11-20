import type {DownloadOptions,HistorySummary,ItemRef,Lease,ProviderConfig,ProviderItem,RepositoryKind,RepositoryTransport,Upload} from '../../types/backup-provider.ts';

/*
  Study Director Google Drive Backup Provider
  Copyright © 2026 Shubham Tiwari and Dr Satyam Kumar. All rights reserved.

  Source-available for personal and noncommercial use only.
  See LICENSE.txt and NOTICE.txt for full terms.

  Configure GOOGLE_OAUTH_CLIENT_ID below with the Web OAuth client ID for the
  deployed Study Director origin. Google-specific code remains outside core.
*/
(function(){
  'use strict';
  type DriveCheck=()=>unknown|PromiseLike<unknown>;
  type DriveError=Error&{code?:string;driveStatus?:number;studyDirectorDriveNoRetry?:boolean;studyDirectorProfileDeleted?:boolean;studyDirectorProfileRefused?:boolean};
  type SessionValue={token:string;expiresAt:number};
  type ProfileSnapshot=Readonly<{id:string;generation:number}>;
  type FolderReceipt=Readonly<{id:string;epoch:number;profile:ProfileSnapshot}>;
  type FolderState={readonly authorization:number;profile:ProfileSnapshot;receipt:FolderReceipt|null};
  type DriveOperation=Readonly<{signal:AbortSignal|null;checkProtection:DriveCheck|null;checkSource:DriveCheck|null;folderState:FolderState|null}>;
  type DriveOperationOptions={signal?:AbortSignal|null|undefined;checkProtection?:DriveCheck|null|undefined;checkSource?:DriveCheck|null|undefined;folderState?:FolderState|null|undefined};
  type DriveCapabilities={canAddChildren?:boolean;canDownload?:boolean};
  type DriveFile={id:string;name:string;size:string;version:string;modifiedTime:string;createdTime:string;mimeType:string;parents:readonly string[];ownedByMe?:boolean;shared?:boolean;trashed?:boolean;sha256Checksum:string;appProperties:Readonly<Record<string,string>>;capabilities:DriveCapabilities};
  type DrivePayload=DriveFile&{files?:readonly DriveFile[];nextPageToken?:string;incompleteSearch?:boolean;error?:{message?:string;errors?:readonly {reason?:string}[]};user?:{emailAddress?:string};successful?:boolean};
  type RepositoryIdentities=Readonly<{driveAppVersionMarker:string;driveDeletedProfileMarker:string;driveExportedAtMarker:string;driveFileDigestMarker:string;driveFileSecurityMarker:string;driveFolder:string;driveFolderMarker:string;driveFolderProfileMarker:string;driveRepositoryIdMarker:string;driveRepositoryKindMarker:string;driveRepositoryMarker:string;driveRepositoryVersionMarker:string}>;
  type GoogleTokenClient={requestAccessToken(options:{include_granted_scopes:boolean;prompt:string}):void};
  type GoogleOAuth2={initTokenClient(config:{client_id:string;scope:string;include_granted_scopes:boolean;prompt:string;callback:(response:unknown)=>void;error_callback:(detail:unknown)=>void}):unknown;hasGrantedAllScopes(response:unknown,...scopes:string[]):boolean;revoke(token:string,callback:(response:unknown)=>void):void};
  type PendingAuthorization={promise:Promise<string>;resolve:(value:string)=>void;reject:(error:unknown)=>void;timer:ReturnType<typeof setTimeout>|null;profile:ProfileSnapshot};
  type FolderFlight={controller:AbortController;promise:Promise<string>;waiters:number;settled:boolean;profile:ProfileSnapshot};
  type UploadSession={parent:string;digest:string;size:number;url:string;offset:number;busy:boolean};
  type DriveProfilePort={id:()=>string;name:()=>string;bind:(info:Readonly<{email:string;folder:string;found:string;mine:boolean;library:Readonly<{savedAt:string;days:number|null;notes:number|null}>|null}>)=>string|Promise<string>;deleted?:(info:Readonly<{profile:string}>)=>unknown|PromiseLike<unknown>;controls?:(control:Readonly<{deleteLibrary:()=>Promise<boolean>}>)=>unknown};
  type RepositoryPolicy=Readonly<Record<string,unknown>>;
  type ReceiveStream=(stream:ReadableStream<Uint8Array>,size:number,options?:{signal?:AbortSignal|null;onProgress?:(value:{loaded?:number;total?:number;phase?:string})=>void})=>Promise<Blob>;
  type PluginApi={capabilities:Readonly<Record<string,number>>;backup:{repositoryPolicy:RepositoryPolicy;receiveStream:ReceiveStream;releaseFile:(file:Blob)=>unknown|PromiseLike<unknown>;limits:{maxFileBytes:number};device:()=>string;profile:DriveProfilePort;providers:{register:(config:ProviderConfig)=>unknown}}};
  type PluginDescriptor=Readonly<{name:string;version:string;requires:Readonly<Record<string,number>>;setup:(api:unknown)=>boolean}>;
  type TrustedTypesPort={createPolicy:(name:string,rules:{createScriptURL:(value:string)=>string})=>{createScriptURL:(value:string)=>unknown}};
  type CoordinationLease=Lease&{kind:string;remoteId:string;verificationScope:string;name:string;modifiedAt:string;renews?:boolean;startedAt?:string;device?:string};
  type RepositoryListOptions={kind:RepositoryKind;signal?:AbortSignal|null;freshDigests?:boolean};
  type DriveDownloadOptions=DownloadOptions&{offset?:number;length?:number};
  type RangeDownload={blob:Blob;totalBytes:number;version:string};
  type BlobDownload={blob:Blob;release:()=>Promise<unknown>};
  type FindMarker=(parent:string,id:string,context?:DriveOperation)=>Promise<DriveFile|null>;
  type CoordinationDeleteOptions={parent:string;id:string;findMarker:FindMarker;context:DriveOperation;label:string};
  type UploadRecovery={complete:boolean;response:Response;offset:number};
  type PlatformPort=Readonly<{fetch:typeof globalThis.fetch|undefined;Headers:typeof globalThis.Headers;Response:typeof globalThis.Response;XMLHttpRequest:typeof globalThis.XMLHttpRequest|undefined;AbortController:typeof globalThis.AbortController;URL:typeof globalThis.URL;URLSearchParams:typeof globalThis.URLSearchParams;Blob:typeof globalThis.Blob;Uint8Array:typeof globalThis.Uint8Array;crypto:Crypto;online:()=>boolean}>;

  function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
  function asDriveError(value:unknown):DriveError{return (value instanceof Error?value:new Error(String(value))) as DriveError;}
  function profileScopeKey(name:string):string{
    const holder=(window as unknown as {[key:symbol]:unknown})[Symbol.for('studyDirector.profileScope.v1')];
    if(!isRecord(holder)||typeof holder['scoped']!=='function')throw new Error('Study Director profile storage scope is unavailable.');
    return String((holder['scoped'] as (value:string)=>unknown)(name));
  }
  function googleOAuth():GoogleOAuth2|null{
    const google=(window as unknown as {google?:unknown}).google;if(!isRecord(google))return null;
    const accounts=google['accounts'];if(!isRecord(accounts))return null;
    const oauth=accounts['oauth2'];if(!isRecord(oauth)||typeof oauth['initTokenClient']!=='function'||typeof oauth['hasGrantedAllScopes']!=='function'||typeof oauth['revoke']!=='function')return null;
    return oauth as unknown as GoogleOAuth2;
  }
  function googleTokenClient(value:unknown):GoogleTokenClient|null{
    if(!isRecord(value)||typeof value['requestAccessToken']!=='function')return null;
    const request=value['requestAccessToken'];return Object.freeze({requestAccessToken:(options:{include_granted_scopes:boolean;prompt:string})=>{Reflect.apply(request,value,[options]);}});
  }
  function trustedTypesFactory():TrustedTypesPort|null{const value=(globalThis as unknown as {trustedTypes?:unknown}).trustedTypes;return isRecord(value)&&typeof value['createPolicy']==='function'?value as unknown as TrustedTypesPort:null;}
  function stringField(source:Record<string,unknown>,key:string):string|undefined{if(!Object.hasOwn(source,key))return undefined;const value=source[key];if(typeof value!=='string'&&typeof value!=='number')throw noRetry(new Error('Google Drive returned malformed metadata.'));return String(value);}
  function booleanField(source:Record<string,unknown>,key:string):boolean|undefined{if(!Object.hasOwn(source,key))return undefined;const value=source[key];if(typeof value!=='boolean')throw noRetry(new Error('Google Drive returned malformed metadata.'));return value;}
  function stringProperties(value:unknown):Readonly<Record<string,string>>|undefined{if(value===undefined)return undefined;if(!isRecord(value))throw noRetry(new Error('Google Drive returned malformed properties.'));const result:Record<string,string>={};for(const [key,item] of Object.entries(value)){if(typeof item!=='string')throw noRetry(new Error('Google Drive returned malformed properties.'));result[key]=item;}return Object.freeze(result);}
  function parseDriveFile(value:unknown):DriveFile{
    if(!isRecord(value))throw noRetry(new Error('Google Drive returned malformed file metadata.'));
    const parentsValue=value['parents'];let parents:readonly string[]=Object.freeze([] as string[]);if(parentsValue!==undefined){if(!Array.isArray(parentsValue))throw noRetry(new Error('Google Drive returned malformed parent metadata.'));const parentItems:string[]=[];for(const item of parentsValue as unknown[]){if(typeof item!=='string')throw noRetry(new Error('Google Drive returned malformed parent metadata.'));parentItems.push(item);}parents=Object.freeze(parentItems);}
    const capabilitiesValue=value['capabilities'];let capabilities:DriveCapabilities=Object.freeze({});if(capabilitiesValue!==undefined){if(!isRecord(capabilitiesValue))throw noRetry(new Error('Google Drive returned malformed capability metadata.'));const canAddChildren=booleanField(capabilitiesValue,'canAddChildren'),canDownload=booleanField(capabilitiesValue,'canDownload');capabilities=Object.freeze({...canAddChildren!==undefined?{canAddChildren}:{},...canDownload!==undefined?{canDownload}:{}});}
    const result={id:'',name:'',size:'',version:'',modifiedTime:'',createdTime:'',mimeType:'',sha256Checksum:''};for(const key of ['id','name','size','version','modifiedTime','createdTime','mimeType','sha256Checksum'] as const){const field=stringField(value,key);if(field!==undefined)result[key]=field;}
    const ownedByMe=booleanField(value,'ownedByMe'),shared=booleanField(value,'shared'),trashed=booleanField(value,'trashed'),appProperties=stringProperties(value['appProperties'])||Object.freeze({});
    return Object.freeze({...result,parents,appProperties,capabilities,...ownedByMe!==undefined?{ownedByMe}:{},...shared!==undefined?{shared}:{},...trashed!==undefined?{trashed}:{}});
  }
  function parseDrivePayload(value:unknown):DrivePayload{
    if(!isRecord(value))throw noRetry(new Error('Google Drive could not confirm the backup information. Retry after the connection recovers.'));const payload:DrivePayload={...parseDriveFile(value)};
    if(Object.hasOwn(value,'files')){const files=value['files'];if(!Array.isArray(files))throw noRetry(new Error('Google Drive could not confirm the backup information. Retry after the connection recovers.'));payload.files=Object.freeze(files.map(parseDriveFile));}
    const nextPageToken=stringField(value,'nextPageToken');if(nextPageToken!==undefined)payload.nextPageToken=nextPageToken;const incompleteSearch=booleanField(value,'incompleteSearch');if(incompleteSearch!==undefined)payload.incompleteSearch=incompleteSearch;
    const errorValue=value['error'];if(errorValue!==undefined){if(!isRecord(errorValue))throw noRetry(new Error('Google Drive returned malformed error information.'));const message=stringField(errorValue,'message'),errorsValue=errorValue['errors'];let errors:readonly {reason?:string}[]|undefined;if(errorsValue!==undefined){if(!Array.isArray(errorsValue))throw noRetry(new Error('Google Drive returned malformed error information.'));errors=Object.freeze(errorsValue.map(item=>{if(!isRecord(item))throw noRetry(new Error('Google Drive returned malformed error information.'));const reason=stringField(item,'reason');return reason===undefined?Object.freeze({}):Object.freeze({reason});}));}payload.error=Object.freeze({...message!==undefined?{message}:{},...errors!==undefined?{errors}:{}});}
    const userValue=value['user'];if(userValue!==undefined){if(!isRecord(userValue))throw noRetry(new Error('Google Drive returned malformed account information.'));const emailAddress=stringField(userValue,'emailAddress');payload.user=Object.freeze(emailAddress===undefined?{}:{emailAddress});}const successful=booleanField(value,'successful');if(successful!==undefined)payload.successful=successful;return payload;
  }
  function isPluginApi(value:unknown):value is PluginApi{
    if(!isRecord(value)||!isRecord(value['capabilities'])||!isRecord(value['backup']))return false;
    const backup=value['backup'];if(!isRecord(backup['repositoryPolicy'])||typeof backup['receiveStream']!=='function'||typeof backup['releaseFile']!=='function'||!isRecord(backup['limits'])||typeof backup['device']!=='function'||!isRecord(backup['profile'])||!isRecord(backup['providers']))return false;
    const profile=backup['profile'],providers=backup['providers'],deleted=profile['deleted'],controls=profile['controls'];
    return typeof profile['id']==='function'&&typeof profile['name']==='function'&&typeof profile['bind']==='function'&&
      (deleted===undefined||typeof deleted==='function')&&(controls===undefined||typeof controls==='function')&&typeof providers['register']==='function';
  }
  function parseRepositoryIdentities(raw:string):RepositoryIdentities{
    let value:unknown;try{value=JSON.parse(raw);}catch{throw new Error('Google Drive repository identities are unavailable.');}if(!isRecord(value))throw new Error('Google Drive repository identities are unavailable.');
    const keys=['driveAppVersionMarker','driveDeletedProfileMarker','driveExportedAtMarker','driveFileDigestMarker','driveFileSecurityMarker','driveFolder','driveFolderMarker','driveFolderProfileMarker','driveRepositoryIdMarker','driveRepositoryKindMarker','driveRepositoryMarker','driveRepositoryVersionMarker'] as const;
    const result=Object.create(null) as Record<(typeof keys)[number],string>;for(const key of keys){const item=value[key];if(typeof item!=='string'||!item)throw new Error('Google Drive repository identities are unavailable.');result[key]=item;}return Object.freeze(result);
  }


  const PLUGIN_VERSION='@@SD_RELEASE@@';
  const GOOGLE_OAUTH_CLIENT_ID='@@SD_GOOGLE_OAUTH_CLIENT_ID@@';
  // Each profile on the device keeps its own sign-in (see the profile scope in app.html).
  const SESSION_KEY=profileScopeKey('@@SD_DRIVE_SESSION_STORAGE_KEY@@');
  const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
  const DRIVE_API='https://www.googleapis.com/drive/v3';
  const DRIVE_UPLOAD_API='https://www.googleapis.com/upload/drive/v3';
  const DRIVE_ORIGIN='https://www.googleapis.com';
  const GIS_SRC='https://accounts.google.com/gsi/client';
  const REPOSITORY_IDENTITIES=parseRepositoryIdentities(decodeURIComponent('@@SD_EXTERNAL_REPOSITORY_IDENTITIES_URI@@'));
  const FOLDER_NAME=REPOSITORY_IDENTITIES.driveFolder;
  const FOLDER_MIME='application/vnd.google-apps.folder';
  const FOLDER_MARKER=Object.freeze({key:REPOSITORY_IDENTITIES.driveFolderMarker,value:'true'});
  // The profile whose library the folder holds. Two people's data never mix.
  const PROFILE_MARKER=REPOSITORY_IDENTITIES.driveFolderProfileMarker,DELETED_MARKER=REPOSITORY_IDENTITIES.driveDeletedProfileMarker,PROFILE_PATTERN=/^prof_[a-z0-9]{1,24}_[a-z0-9]{6,12}_[a-f0-9]{8}$/u;
  const FILE_SECURITY_VERSION='1';
  const FILE_SECURITY_MARKER=REPOSITORY_IDENTITIES.driveFileSecurityMarker;
  const FILE_DIGEST_MARKER=REPOSITORY_IDENTITIES.driveFileDigestMarker;
  const REPOSITORY_MARKER=Object.freeze({key:REPOSITORY_IDENTITIES.driveRepositoryMarker,value:'true'});
  const REPOSITORY_VERSION_MARKER=REPOSITORY_IDENTITIES.driveRepositoryVersionMarker;
  const REPOSITORY_KIND_MARKER=REPOSITORY_IDENTITIES.driveRepositoryKindMarker;
  const REPOSITORY_ID_MARKER=REPOSITORY_IDENTITIES.driveRepositoryIdMarker;
  const REPOSITORY_VERSION='1';
  const REPOSITORY_KINDS=Object.freeze(new Set<RepositoryKind>(['object','checkpoint','commit','session-claim']));
  const PUBLICATION_KIND='publication',MAINTENANCE_KIND='maintenance';
  const MAINTENANCE_VERSION='2';
  let PUBLICATION_MAX_AGE_MS=0,PUBLICATION_ASSERTION_MARGIN_MS=0,PUBLICATION_RENEW_MS=0,PUBLICATION_STALE_MS=0,MAINTENANCE_MAX_AGE_MS=0,MAINTENANCE_ASSERTION_MARGIN_MS=0;
  const REQUIRED_CAPABILITIES=Object.freeze({pluginApi:1,backupController:1,backupProviders:1});
  const DEFAULT_MAX_BACKUP_BYTES=20*1024*1024;
  const UPLOAD_CHUNK_BYTES=2*1024*1024;
  const MULTIPART_UPLOAD_MAX_BYTES=5*1024*1024;
  // The device an upload marker comes from, so a device never waits its turn
  // for a marker an earlier page of its own left behind.
  // A marker carrying PUBLICATION_RENEWS_MARKER is replaced by a fresh one
  // while its upload runs; see renewRepositoryPublication.
  // A replacement keeps the first marker's start, so taking turns at Drive
  // still goes by when each upload began.
  const PUBLICATION_RENEWS_MARKER='sdPublicationRenews',PUBLICATION_STARTED_MARKER='sdPublicationStartedAt';
  const PUBLICATION_DEVICE_MARKER='sdPublicationDevice',MAINTENANCE_DEVICE_MARKER='sdMaintenanceDevice',DEVICE_PATTERN=/^inst_[a-z0-9_]{1,80}$/u;
  const HISTORY_FINGERPRINT_MARKER='sdHistoryFingerprint';
  const HISTORY_COUNTS_MARKER='sdHistoryCounts';
  const HISTORY_ENCRYPTED_MARKER='sdHistoryEncrypted';
  const HISTORY_ROLE_MARKER='sdHistoryRole';
  const HISTORY_PROTECTED_UNTIL_MARKER='sdHistoryProtectedUntil';
  const HISTORY_CALENDAR_MARKER='sdHistoryCalendar';
  const HISTORY_NOTES_MARKER='sdHistoryNotes';
  // The version's manifest format. Files without it are older than this build.
  const HISTORY_FORMAT_MARKER='sdHistoryFormat';
  const HISTORY_ATTACHMENTS_MISSING_MARKER='sdHistoryAttachmentsMissing';
  // The device that made the version (its ID says what it is).
  const HISTORY_ORIGIN_MARKER='sdHistoryOrigin',ORIGIN_PATTERN=/^inst_[a-z0-9_]{8,96}$/u;
  const GIS_LOAD_TIMEOUT_MS=20000;
  const AUTH_TIMEOUT_MS=120000;
  let API_TIMEOUT_MS=0;
  const TRANSFER_TIMEOUT_MS=120000;
  const REVOKE_TIMEOUT_MS=30000;
  const MAX_TRANSIENT_ATTEMPTS=3;
  const Platform:PlatformPort=Object.freeze({
    fetch:globalThis.fetch&&globalThis.fetch.bind(globalThis),
    Headers:globalThis.Headers,
    Response:globalThis.Response,
    XMLHttpRequest:globalThis.XMLHttpRequest,
    AbortController:globalThis.AbortController,
    URL:globalThis.URL,
    URLSearchParams:globalThis.URLSearchParams,
    Blob:globalThis.Blob,
    Uint8Array:globalThis.Uint8Array,
    crypto:globalThis.crypto,
    // Offline (the browser says so): background work waits for the network
    // instead of failing and backing off.
    online:()=>globalThis.navigator?.onLine!==false
  });

  // JSON metadata is consumed once, inside the request's timeout/abort lifetime.
  const responsePayloads=new WeakMap<Response,DrivePayload>();
  let gisPromise:Promise<void>|null=null;
  let oauthClient:GoogleOAuth2|null=null;
  let accessToken='',authorizationGeneration=0;
  let tokenExpiresAt=0,signedInBefore=false;
  let connectionExpiryTimer:ReturnType<typeof setTimeout>|null=null;
  const connectionListeners=new Set<()=>void>();
  let folderId='';
  // deletionChecked: the profile already checked for a deletion marker in this sign-in.
  let profilePort:DriveProfilePort|null=null,devicePort:(()=>string)|null=null,boundFolder='',seenFolder:DriveFile|null=null,deletionChecked='',libraryDeleted='';
  let observedProfileId:string|null=null,profileGeneration=0;
  function thisDevice():string{try{const id=String(devicePort?.()||'');return DEVICE_PATTERN.test(id)?id:'';}catch{return '';}}
  let folderEpoch=0;
  let folderResolutionFlight:FolderFlight|null=null;
  let pendingAuthorization:PendingAuthorization|null=null;
  let maxBackupBytes=DEFAULT_MAX_BACKUP_BYTES;
  const repositoryUploads=new Map<string,UploadSession>(),uploadsInFlight=new Set<string>(),MAX_RETAINED_UPLOADS=16;
  let releaseFile:(file:Blob)=>unknown|PromiseLike<unknown>=async()=>{},receiveBackupStream:ReceiveStream|null=null;

  const EMPTY_DRIVE_OPERATION:DriveOperation=Object.freeze({signal:null,checkProtection:null,checkSource:null,folderState:null});
  function driveOperationContext({signal=null,checkProtection=null,checkSource=null,folderState=null}:DriveOperationOptions={}):DriveOperation{
    return Object.freeze({
      signal:signal&&typeof signal.addEventListener==='function'?signal:null,
      checkProtection:typeof checkProtection==='function'?checkProtection:null,
      checkSource:typeof checkSource==='function'?checkSource:null,
      folderState:folderState&&typeof folderState==='object'?folderState:{authorization:authorizationGeneration,profile:profileSnapshot(),receipt:null}
    });
  }
  function childDriveOperationContext(base:DriveOperation=EMPTY_DRIVE_OPERATION,{signal=null,checkProtection=null,checkSource=null}:DriveOperationOptions={}):DriveOperation{
    const parent=base||EMPTY_DRIVE_OPERATION;
    return driveOperationContext({
      signal:signal&&typeof signal.addEventListener==='function'?signal:parent.signal,
      checkProtection:typeof checkProtection==='function'?checkProtection:parent.checkProtection,
      checkSource:typeof checkSource==='function'?checkSource:parent.checkSource,
      folderState:parent.folderState
    });
  }
  function invalidateFolderIdentity():void{folderId='';boundFolder='';seenFolder=null;deletionChecked='';folderEpoch+=1;}
  function verifiedFolderReceipt(context:DriveOperation=EMPTY_DRIVE_OPERATION):string{
    const state=context&&context.folderState,receipt=state&&state.receipt;
    if(!receipt)return '';
    if(!folderId||receipt.id!==folderId||receipt.epoch!==folderEpoch){state.receipt=null;return '';}
    return receipt.id;
  }
  function rememberVerifiedFolder(context:DriveOperation,id:string):string{
    const value=String(id||''),state=context&&context.folderState;if(!value||!state)return value;
    state.profile=profileSnapshot();
    state.receipt=Object.freeze({id:value,epoch:folderEpoch,profile:state.profile});return value;
  }
  async function assertDriveOperationCurrent(context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<void>{
    const operation=context||EMPTY_DRIVE_OPERATION;
    if(operation.signal&&operation.signal.aborted)throw noRetry(driveAbortError(operation.signal));
    const state=operation.folderState,receipt=state?.receipt;
    const verifyIdentity=()=>{
      if(state&&state.authorization!==authorizationGeneration)throw noRetry(new Error('Google Drive authorization changed. Retry the Drive action.'));
      if(receipt){
        assertProfileCurrent(receipt.profile);
        if(receipt.epoch!==folderEpoch||receipt.id!==folderId)throw noRetry(new Error('The Google Drive repository changed during the operation.'));
      }
    };
    verifyIdentity();
    await operation.checkProtection?.();
    await operation.checkSource?.();
    verifyIdentity();
    if(operation.signal&&operation.signal.aborted)throw noRetry(driveAbortError(operation.signal));
  }

  function requirePlatform():void{
    if(!Platform.fetch||!Platform.Headers||!Platform.Response||!Platform.AbortController||!Platform.URL||!Platform.URLSearchParams||!Platform.Blob||!Platform.Uint8Array||!Platform.crypto||!Platform.crypto.subtle){
      throw new Error('This browser does not provide the secure web APIs required for Google Drive.');
    }
  }
  function supportsCapabilities(api:PluginApi,requirements:Readonly<Record<string,number>>):boolean{
    const capabilities=api&&api.capabilities;
    return !!capabilities&&Object.entries(requirements).every(([key,minimum])=>Number(capabilities[key]||0)>=Number(minimum));
  }
  function configuredClientId():string{
    const value=String(GOOGLE_OAUTH_CLIENT_ID||'').trim();
    return value&&!value.includes('PASTE_')?value:'';
  }
  function configurationError():Error{
    return new Error('Google Drive is not configured. Add the production Web OAuth client ID in the release configuration and rebuild Study Director.');
  }
  function delay(ms:number):Promise<void>{return new Promise(resolve=>{setTimeout(resolve,Math.max(0,Number(ms)||0));});}
  function timeoutError(label:string):Error{return new Error(`${label} timed out. Check the connection and retry.`);}
  function driveAbortError(signal:AbortSignal|null|undefined):DriveError{
    const reason=(signal as unknown as {readonly reason?:unknown}|null|undefined)?.reason,error=asDriveError(reason instanceof Error?reason:new Error(String(reason||'Google Drive import was cancelled.')));
    if(!error.code)error.code='STUDY_DIRECTOR_IMPORT_CANCELLED';if(!error.name||error.name==='Error')error.name='AbortError';return error;
  }
  const operationStopped=(error:unknown):boolean=>{const value=asDriveError(error);return value.name==='AbortError'||value.code==='BACKUP_POLICY_CHANGED'||value.code==='STUDY_DIRECTOR_IMPORT_CANCELLED';};
  let signInPolicy:{createScriptURL:(value:string)=>unknown}|null=null;
  function loadScript(src:string):Promise<void>{
    if(src!=='https://accounts.google.com/gsi/client')return Promise.reject(new TypeError('Unapproved sign-in script.'));
    const trustedTypes=trustedTypesFactory();if(trustedTypes&&!signInPolicy)signInPolicy=trustedTypes.createPolicy('sd-google-signin',{createScriptURL:(value:string)=>{if(value!=='https://accounts.google.com/gsi/client')throw new TypeError('Unapproved sign-in script.');return value;}});
    const existing=[...document.scripts].find(script=>script.src===src);
    if(existing&&googleOAuth())return Promise.resolve();
    if(existing)existing.remove();
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      let settled=false;
      const timer=setTimeout(()=>finish(reject,timeoutError('Google sign-in loading')),GIS_LOAD_TIMEOUT_MS);
      const finish=(fn:(value?:unknown)=>void,value?:unknown)=>{
        if(settled)return;
        settled=true;clearTimeout(timer);
        script.onload=null;script.onerror=null;
        fn(value);
      };
      script.onload=()=>finish(()=>resolve());
      script.onerror=()=>{script.remove();finish(reject,new Error('Google sign-in could not be loaded. Check the connection and retry.'));};
      Reflect.set(script,'src',signInPolicy?signInPolicy.createScriptURL(src):src);script.async=true;script.defer=true;script.referrerPolicy='strict-origin-when-cross-origin';document.head.appendChild(script);
    });
  }
  function notifyConnectionChange():void{for(const listener of [...connectionListeners])try{listener();}catch{}}
  function clearConnectionExpiryTimer():void{if(connectionExpiryTimer!==null){clearTimeout(connectionExpiryTimer);connectionExpiryTimer=null;}}
  function scheduleConnectionExpiry():void{clearConnectionExpiryTimer();if(!accessToken||!tokenExpiresAt)return;const delay=Math.max(0,tokenExpiresAt-Date.now());connectionExpiryTimer=setTimeout(()=>{connectionExpiryTimer=null;if(!accessToken)return;if(Date.now()>=tokenExpiresAt)expireSession();else scheduleConnectionExpiry();},delay);}
  // The sign-in is kept in this browser until it expires (about an hour), so a
  // reload or reopening the app does not ask again. Other tabs pick it up too.
  function parseSession(raw:string|null|undefined):SessionValue|null{try{const value:unknown=JSON.parse(raw||'null');if(!isRecord(value)||typeof value['token']!=='string'||typeof value['expiresAt']!=='number')return null;return {token:value['token'],expiresAt:value['expiresAt']};}catch{return null;}}
  function usableSession(value:SessionValue|null):value is SessionValue{const expiresAt=Number(value?.expiresAt);return !!value&&!!value.token&&expiresAt>Date.now()+5000&&expiresAt<=Date.now()+7200000;}
  function storedSession():SessionValue|null{try{return parseSession(window.localStorage.getItem(SESSION_KEY));}catch{return null;}}
  function rememberSession():void{try{window.localStorage.setItem(SESSION_KEY,JSON.stringify({token:accessToken,expiresAt:tokenExpiresAt}));}catch{}}
  function forgetSession(token:string):void{if(token&&storedSession()?.token===token)try{window.localStorage.removeItem(SESSION_KEY);}catch{}}
  function startAuthorization():void{
    authorizationGeneration+=1;
    invalidateFolderIdentity();
    cancelFolderResolution();
  }
  function adoptSession(value:SessionValue):void{startAuthorization();cancelPendingAuthorization(noRetry(new Error('Google authorization was superseded by another signed-in session.')));accessToken=value.token;tokenExpiresAt=Number(value.expiresAt);signedInBefore=true;scheduleConnectionExpiry();notifyConnectionChange();}
  function restoreSession():void{
    const value=storedSession();
    if(usableSession(value))adoptSession(value);else try{window.localStorage.removeItem(SESSION_KEY);}catch{}
    try{window.addEventListener('storage',event=>{
      if(event.key!==SESSION_KEY)return;
      const next=parseSession(event.newValue);
      if(usableSession(next)){if(next.token!==accessToken)adoptSession(next);}
      else if(accessToken&&parseSession(event.oldValue)?.token===accessToken)clearSession();
    });}catch{}
  }
  function clearAccessToken():void{const changed=!!accessToken||tokenExpiresAt!==0;forgetSession(accessToken);clearConnectionExpiryTimer();accessToken='';tokenExpiresAt=0;if(changed)notifyConnectionChange();}
  function expireSession():void{if(accessToken){startAuthorization();clearAccessToken();}}
  function clearSession():void{cancelPendingAuthorization(noRetry(new Error('Google authorization was superseded.')));startAuthorization();clearAccessToken();}
  function grantedScopeSet(response:Readonly<{scope?:string}>):Set<string>{return new Set(String(response.scope||'').split(/\s+/).filter(Boolean));}
  function cancelPendingAuthorization(error:unknown):void{const pending=pendingAuthorization;if(!pending)return;pendingAuthorization=null;if(pending.timer!==null)clearTimeout(pending.timer);pending.reject(error);}
  function parseOAuthResponse(value:unknown):Readonly<{access_token?:string;expires_in?:number;token_type?:string;scope?:string;error?:string;error_description?:string}>|null{
    if(!isRecord(value))return null;const result:{access_token?:string;expires_in?:number;token_type?:string;scope?:string;error?:string;error_description?:string}={};
    for(const key of ['access_token','token_type','scope','error','error_description'] as const){const field=value[key];if(field!==undefined){if(typeof field!=='string')return null;result[key]=field;}}
    const expires=value['expires_in'];if(expires!==undefined){const numeric=Number(expires);if(!Number.isFinite(numeric)||numeric<=0)return null;result.expires_in=numeric;}return Object.freeze(result);
  }
  function settleAuthorization(request:PendingAuthorization,error:unknown,responseValue:unknown=null):void{
    if(pendingAuthorization!==request)return;pendingAuthorization=null;if(request.timer!==null)clearTimeout(request.timer);
    const current=profileSnapshot();if(current.id!==request.profile.id||current.generation!==request.profile.generation){request.reject(noRetry(new Error('The active Study Director profile changed before Google authorization completed. Retry the Drive action.')));return;}
    if(error){clearSession();request.reject(error);return;}const response=parseOAuthResponse(responseValue);
    if(!response||response.error){clearSession();request.reject(new Error(response?.error_description||response?.error||'Google authorization was not completed.'));return;}
    const oauth=oauthClient,scopes=grantedScopeSet(response);
    if(!oauth||!oauth.hasGrantedAllScopes(response,DRIVE_SCOPE)||!scopes.has(DRIVE_SCOPE)){clearSession();request.reject(new Error('Google Drive permission was not granted.'));return;}
    if(scopes.size!==1){clearSession();request.reject(new Error('Google returned permissions beyond the requested Drive-file scope. Use a dedicated Study Director OAuth client.'));return;}
    if(response.token_type&&response.token_type.toLowerCase()!=='bearer'){clearSession();request.reject(new Error('Google returned an unsupported authorization token.'));return;}
    startAuthorization();accessToken=String(response.access_token||'');const lifetimeMs=Math.max(1,Number(response.expires_in)||3600)*1000;const safetyMs=Math.min(60000,Math.max(5000,Math.floor(lifetimeMs*0.1)));tokenExpiresAt=Date.now()+Math.max(1000,lifetimeMs-safetyMs);
    if(!accessToken){clearSession();request.reject(new Error('Google did not return an access token.'));return;}signedInBefore=true;rememberSession();scheduleConnectionExpiry();notifyConnectionChange();request.resolve(accessToken);
  }
  async function prepare():Promise<void>{
    requirePlatform();const clientId=configuredClientId();if(!clientId)throw configurationError();
    if(!gisPromise)gisPromise=loadScript(GIS_SRC).then(()=>{const oauth=googleOAuth();if(!oauth)throw new Error('Google sign-in is unavailable.');oauthClient=oauth;}).catch((error:unknown)=>{gisPromise=null;oauthClient=null;throw error;});await gisPromise;
  }
  function tokenValid():boolean{return !!accessToken&&Date.now()<tokenExpiresAt;}
  function subscribeConnection(listener:()=>void):()=>void{connectionListeners.add(listener);return ()=>{connectionListeners.delete(listener);};}
  function authorize(_options?:{operation:string}):Promise<string>{
    if(tokenValid())return Promise.resolve(accessToken);const oauth=oauthClient;if(!oauth)return Promise.reject(new Error('Google Drive is still preparing. Try again in a moment.'));if(pendingAuthorization)return pendingAuthorization.promise;
    let resolvePromise:(value:string)=>void=()=>{},rejectPromise:(error:unknown)=>void=()=>{};const promise=new Promise<string>((resolve,reject)=>{resolvePromise=resolve;rejectPromise=reject;});
    const request:PendingAuthorization={promise,resolve:resolvePromise,reject:rejectPromise,timer:null,profile:profileSnapshot()};pendingAuthorization=request;
    try{const client=googleTokenClient(oauth.initTokenClient({client_id:configuredClientId(),scope:DRIVE_SCOPE,include_granted_scopes:false,prompt:'select_account',callback:(response:unknown)=>settleAuthorization(request,null,response),error_callback:(detail:unknown)=>{const type=isRecord(detail)?String(detail['type']||''):'';const message=type==='popup_failed_to_open'?'Google sign-in was blocked by the browser. Allow pop-ups and retry.':type==='popup_closed'?'Google authorization was cancelled.':'Google authorization could not be completed.';settleAuthorization(request,new Error(message));}}));if(!client)throw new Error('Google sign-in is unavailable.');request.timer=setTimeout(()=>settleAuthorization(request,timeoutError('Google authorization')),AUTH_TIMEOUT_MS);client.requestAccessToken({include_granted_scopes:false,prompt:signedInBefore?'':'select_account'});}
    catch(error){settleAuthorization(request,error instanceof Error?error:new Error(String(error)));}return promise;
  }
  function requireAccessToken():string{
    if(tokenValid())return accessToken;
    expireSession();
    throw new Error('Google authorization expired. Retry the Drive action.');
  }
  function parseDriveUrl(value:unknown):URL{
    let url;
    try{url=new Platform.URL(String(value||''));}catch(error){throw new Error('Blocked an invalid Google Drive endpoint.');}
    if(url.protocol!=='https:'||url.origin!==DRIVE_ORIGIN||url.username||url.password||url.hash)throw new Error('Blocked an unexpected Google Drive endpoint.');
    return url;
  }
  function validatedDriveRequest(value:unknown,method='GET'):string{
    const url=parseDriveUrl(value),verb=String(method||'GET').toUpperCase();
    const collection=url.pathname==='/drive/v3/files',about=url.pathname==='/drive/v3/about';
    const item=/^\/drive\/v3\/files\/[^/]+$/u.test(url.pathname);
    const uploadType=url.pathname==='/upload/drive/v3/files'?String(url.searchParams.get('uploadType')||''):'';
    const uploadCreate=uploadType==='resumable'||uploadType==='multipart';
    const uploadSession=uploadType==='resumable'&&!!url.searchParams.get('upload_id');
    const allowed=(collection&&(verb==='GET'||verb==='POST'))||(about&&verb==='GET')||(item&&(verb==='GET'||verb==='DELETE'||verb==='PATCH'))||(uploadCreate&&verb==='POST')||(uploadSession&&verb==='PUT');
    if(!allowed)throw new Error('Blocked an unsupported Google Drive request.');
    return url.href;
  }
  function validatedUploadSession(value:unknown):string{
    const url=parseDriveUrl(value);
    if(url.pathname!=='/upload/drive/v3/files'||url.searchParams.get('uploadType')!=='resumable'||!url.searchParams.get('upload_id')){
      throw new Error('Google Drive returned an invalid upload session.');
    }
    return url.href;
  }
  // Fetch exposes download streams but no upload byte progress. Use the
  // browser's asynchronous upload transport only for validated binary uploads.
  function uploadWithProgress(url:string,options:RequestInit,signal:AbortSignal,progress:()=>void):Promise<Response>{
    return new Promise((resolve,reject)=>{
      const Xhr=Platform.XMLHttpRequest;if(!Xhr)throw new Error('Upload progress transport is unavailable.');const xhr=new Xhr();let settled=false,uploaded=0,downloaded=0;
      const finish=(error:unknown,response?:Response)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);xhr.onload=xhr.onerror=xhr.onabort=xhr.onprogress=null;xhr.upload.onprogress=null;error?reject(error):response?resolve(response):reject(new Error('Google Drive upload ended without a response.'));};
      const abort=()=>{xhr.abort();finish(signal.reason||Object.assign(new Error('Google Drive upload was stopped.'),{name:'AbortError'}));};
      try{
        xhr.open(String(options.method||'GET'),url,true);xhr.withCredentials=false;
        for(const [key,value] of new Platform.Headers(options.headers))xhr.setRequestHeader(key,value);
        xhr.upload.onprogress=(event:ProgressEvent)=>{if(event.loaded>uploaded){uploaded=event.loaded;progress();}};
        xhr.onprogress=(event:ProgressEvent)=>{if(event.loaded>downloaded){downloaded=event.loaded;progress();}};
        xhr.onerror=()=>finish(new TypeError('Google Drive upload connection failed.'));
        xhr.onabort=()=>finish(signal.reason||Object.assign(new Error('Google Drive upload was stopped.'),{name:'AbortError'}));
        xhr.onload=()=>{try{const headers=new Platform.Headers();for(const line of xhr.getAllResponseHeaders().trim().split(/[\r\n]+/u)){const colon=line.indexOf(':');if(colon>0)headers.append(line.slice(0,colon),line.slice(colon+1).trim());}finish(null,new Platform.Response(xhr.responseText||null,{status:xhr.status,headers}));}catch(error){finish(error);}};
        signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();else{const body=options.body;if(!(body instanceof Blob))throw new Error('Google Drive upload body is unavailable.');xhr.send(body);}
      }catch(error){finish(error);}
    });
  }
  async function fetchWithTimeout(url:string,options:RequestInit,timeoutMs:number,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<Response>{
    const controller=new Platform.AbortController();
    const operation=context||EMPTY_DRIVE_OPERATION;
    const externalSignal=options&&options.signal||operation.signal;
    const abortFromExternal=()=>controller.abort();
    if(externalSignal){if(externalSignal.aborted)throw noRetry(driveAbortError(externalSignal));externalSignal.addEventListener('abort',abortFromExternal,{once:true});}
    let timer:ReturnType<typeof setTimeout>|null=null;const disarm=()=>{if(timer!==null){clearTimeout(timer);timer=null;}},renew=()=>{disarm();timer=setTimeout(()=>{timer=null;controller.abort();},Math.max(1000,Number(timeoutMs)||API_TIMEOUT_MS));};
    let bodyAbort:(()=>void)|null=null;
    try{
      await assertDriveOperationCurrent(operation);renew();
      const progressUpload=!!Platform.XMLHttpRequest&&options.body instanceof Platform.Blob&&new Platform.URL(url).pathname==='/upload/drive/v3/files';
      const response=await (progressUpload?uploadWithProgress(url,options,controller.signal,renew):Platform.fetch!(url,{...options,signal:controller.signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'}));
      const media=response.ok&&new Platform.URL(url).searchParams.get('alt')==='media';
      if(!media&&![204,308,401].includes(response.status)){
        const stopped=new Promise<never>((_,reject)=>{
          bodyAbort=()=>reject(controller.signal.reason||Object.assign(new Error('Google Drive request was stopped.'),{name:'AbortError'}));
          controller.signal.addEventListener('abort',bodyAbort,{once:true});
          if(controller.signal.aborted)bodyAbort();
        });
        const payload=parseDrivePayload(await Promise.race([response.json(),stopped]));
        responsePayloads.set(response,payload);
      }else if(!media){void response.body?.cancel().catch(()=>{});}
      if(controller.signal.aborted)throw controller.signal.reason;
      disarm();await assertDriveOperationCurrent(operation);
      return response;
    }catch(error){
      if(externalSignal&&externalSignal.aborted)throw noRetry(driveAbortError(externalSignal));
      if(operationStopped(error)&&!controller.signal.aborted)throw noRetry(error);
      if(asDriveError(error).name==='AbortError')throw timeoutError('Google Drive request');
      throw error;
    }finally{disarm();if(bodyAbort)controller.signal.removeEventListener('abort',bodyAbort);if(externalSignal)externalSignal.removeEventListener('abort',abortFromExternal);}
  }
  async function authorizedFetch(url:string,options:RequestInit={},timeoutMs=API_TIMEOUT_MS,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<Response>{
    const method=String(options.method||'GET').toUpperCase();
    const safeUrl=validatedDriveRequest(url,method);
    const token=requireAccessToken();
    const headers=new Platform.Headers(options.headers||{});
    headers.set('Authorization',`Bearer ${token}`);
    const response=await fetchWithTimeout(safeUrl,{...options,method,headers},timeoutMs,context);
    if(token!==accessToken)throw noRetry(new Error('Google Drive authorization changed. Retry the Drive action.'));
    if(response.status===401){expireSession();throw new Error('Google authorization expired. Retry the Drive action.');}
    return response;
  }
  function transientStatus(status:number):boolean{return status===429||status===500||status===502||status===503||status===504;}
  async function retryableResponse(response:Response|null):Promise<boolean>{
    if(transientStatus(response?.status??0))return true;
    if(!response||response.status!==403)return false;
    const payload=jsonResponse(response);
    const reasons=(payload.error?.errors||[]).map(item=>String(item.reason||''));
    return reasons.some(reason=>['rateLimitExceeded','userRateLimitExceeded','backendError'].includes(reason));
  }
  function retryDelay(response:Response|null,attempt:number):number{
    const raw=response&&response.headers&&response.headers.get('Retry-After');
    const seconds=Number(raw);
    if(Number.isFinite(seconds)&&seconds>0)return Math.min(5000,seconds*1000);
    const dateMs=raw?Date.parse(raw):NaN;
    if(Number.isFinite(dateMs)&&dateMs>Date.now())return Math.min(5000,dateMs-Date.now());
    return Math.min(4000,400*Math.pow(2,attempt));
  }
  function noRetry(error:unknown):DriveError{const value=asDriveError(error);value.studyDirectorDriveNoRetry=true;return value;}
  async function authorizedGet(url:string,{attempts=MAX_TRANSIENT_ATTEMPTS,timeoutMs=API_TIMEOUT_MS}:{attempts?:number;timeoutMs?:number}={},context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<Response>{
    let lastError:unknown=null;
    for(let attempt=0;attempt<attempts;attempt++){
      try{
        const response=await authorizedFetch(url,{method:'GET'},timeoutMs,context);
        if(!await retryableResponse(response)||attempt===attempts-1)return response;
        lastError=await apiError(response,'Google Drive is temporarily unavailable.');
        await delay(retryDelay(response,attempt));
      }catch(error){
        lastError=error;
        if(operationStopped(error)||asDriveError(error).studyDirectorDriveNoRetry||/authorization/i.test(asDriveError(error).message)||attempt===attempts-1)throw error;
        await delay(retryDelay(null,attempt));
      }
    }
    throw lastError||new Error('Google Drive request failed.');
  }
  async function apiError(response:Response,fallback:string):Promise<DriveError>{
    const payload=jsonResponse(response),message=payload.error?.message||'';
    const error=new Error(message||fallback||`Google Drive request failed (${response.status}).`);
    Object.defineProperty(error,'driveStatus',{value:Number(response.status)||0,configurable:true});
    return error;
  }
  function driveQuery(parts:readonly (string|false|null|undefined)[]):string{return parts.filter(Boolean).join(' and ');}
  function jsonResponse(response:Response):DrivePayload{
    const payload=responsePayloads.get(response);if(!payload)throw noRetry(new Error('Google Drive backup information is unavailable.'));
    return payload;
  }
  function listResponse(response:Response){
    const payload=jsonResponse(response);
    if(!payload.files)throw noRetry(new Error('Google Drive returned no file inventory. Retry the Drive action.'));
    return {files:payload.files,nextPageToken:payload.nextPageToken,incomplete:payload.incompleteSearch===true};
  }
  // Partial pages may be empty. A first match suffices for presence/latest;
  // a unique folder requires exhausting the search or seeing a second match.
  async function firstMatches(params:URLSearchParams,limit:number,context:DriveOperation,failure:string):Promise<readonly DriveFile[]>{
    params.set('fields','nextPageToken,incompleteSearch,'+params.get('fields'));
    const matches:DriveFile[]=[],seen=new Set<string>();
    for(;;){
      const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);
      if(!response.ok)throw await apiError(response,failure);
      const page=listResponse(response);
      if(page.incomplete)throw noRetry(new Error('Google Drive returned an incomplete file search. Retry the Drive action.'));
      matches.push(...page.files.slice(0,limit-matches.length));
      if(matches.length>=limit||!page.nextPageToken)return matches;
      if(seen.has(page.nextPageToken)||seen.size>=100)throw noRetry(new Error('Google Drive could not complete the file search.'));
      seen.add(page.nextPageToken);params.set('pageToken',page.nextPageToken);
    }
  }
  function validFolderMetadata(folder:DriveFile|null|undefined):boolean{
    return !!(folder&&folder.id&&folder.mimeType===FOLDER_MIME&&folder.ownedByMe===true&&folder.shared===false&&folder.trashed===false&&
      folder.appProperties&&folder.appProperties[FOLDER_MARKER.key]===FOLDER_MARKER.value&&
      (!folder.capabilities||folder.capabilities.canAddChildren!==false));
  }
  async function getFolderMetadata(id:string,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<DriveFile>{
    const fields='id,name,mimeType,ownedByMe,shared,trashed,appProperties,capabilities(canAddChildren)';
    const response=await authorizedGet(`${DRIVE_API}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`,{},context);
    if(!response.ok){if(response.status===403||response.status===404)invalidateFolderIdentity();throw await apiError(response,'Could not verify the Study Director backup folder.');}
    return jsonResponse(response);
  }
  async function findFolder(context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<string>{
    if(folderId){
      let cached=null;
      try{cached=await getFolderMetadata(folderId,context);}
      catch(error){if(Number(asDriveError(error).driveStatus)!==404)throw error;}
      if(cached){
        if(cached.trashed===true)invalidateFolderIdentity();
        else{
          if(!validFolderMetadata(cached)){invalidateFolderIdentity();throw noRetry(new Error('The Study Director backup folder is no longer private and owned by this account. Drive backup was stopped.'));}
          seenFolder=cached;return folderId;
        }
      }
    }
    const q=driveQuery([
      `mimeType='${FOLDER_MIME}'`,
      `appProperties has { key='${FOLDER_MARKER.key}' and value='${FOLDER_MARKER.value}' }`,
      'trashed=false'
    ]);
    const fields='files(id,name,mimeType,ownedByMe,shared,trashed,appProperties,capabilities(canAddChildren))';
    const params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'10',fields});
    const folders=await firstMatches(params,2,context,'Could not find the Study Director backup folder.');
    if(folders.length>1){invalidateFolderIdentity();throw noRetry(new Error('More than one marked Study Director backup folder was found. Drive backup was stopped without choosing or deleting anything.'));}
    if(folders.length===1&&!validFolderMetadata(folders[0])){invalidateFolderIdentity();throw noRetry(new Error('The marked Study Director backup folder is shared, foreign-owned, trashed, or otherwise unsafe. Drive backup was stopped.'));}
    folderId=String(folders[0]&&folders[0].id||'');seenFolder=folders[0]||null;
    return folderId;
  }
  async function createFolder(context:DriveOperation=EMPTY_DRIVE_OPERATION,expected:ProfileSnapshot=profileSnapshot()):Promise<string>{
    assertProfileCurrent(expected);
    const fields='id,name,mimeType,ownedByMe,shared,trashed,appProperties,capabilities(canAddChildren)';
    const response=await authorizedFetch(`${DRIVE_API}/files?fields=${encodeURIComponent(fields)}`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:libraryName(),mimeType:FOLDER_MIME,appProperties:{[FOLDER_MARKER.key]:FOLDER_MARKER.value,[PROFILE_MARKER]:expected.id}})
    },API_TIMEOUT_MS,context);
    if(!response.ok)throw await apiError(response,'Could not create the Study Director backup folder.');
    assertProfileCurrent(expected);const payload=jsonResponse(response);
    if(!validFolderMetadata(payload)){invalidateFolderIdentity();throw noRetry(new Error('Google Drive did not confirm a private, owned Study Director backup folder.'));}
    folderId='';
    assertProfileCurrent(expected);const found=await findFolder(context);assertProfileCurrent(expected);return found;
  }
  function disconnectProfileLater(profile:ProfileSnapshot):void{
    const generation=authorizationGeneration;
    setTimeout(()=>{
      const current=profileSnapshot();
      if(generation===authorizationGeneration&&current.id===profile.id&&current.generation===profile.generation){
        clearSession();signedInBefore=false;
      }
    },0);
  }
  async function resolveFolder(context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<string>{
    const expected=profileSnapshot();if(!expected.id)throw new Error('This profile is still starting. Try again in a moment.');
    if(libraryDeleted===expected.id)throw noRetry(Object.assign(new Error('This profile was deleted. Google Drive was not used.'),{studyDirectorProfileDeleted:true}));
    if(deletionChecked!==expected.id){
      if(await deletionMarker(expected.id,context)){assertProfileCurrent(expected);disconnectProfileLater(expected);Promise.resolve().then(()=>profilePort?.deleted?.(Object.freeze({profile:expected.id}))).catch(()=>{});throw noRetry(Object.assign(new Error('This profile was deleted on another device. Google Drive was not used.'),{studyDirectorProfileDeleted:true}));}
      assertProfileCurrent(expected);deletionChecked=expected.id;
    }
    let found=await findFolder(context);assertProfileCurrent(expected);if(!found){found=await createFolder(context,expected);assertProfileCurrent(expected);}await bindFolder(found,context,expected);return found;
  }
  function profileSnapshot():ProfileSnapshot{
    let id='';try{id=String(profilePort?.id()||'');if(!PROFILE_PATTERN.test(id))id='';}catch{id='';}
    if(observedProfileId===null){observedProfileId=id;profileGeneration=1;}else if(id!==observedProfileId){observedProfileId=id;profileGeneration+=1;invalidateFolderIdentity();}
    return Object.freeze({id,generation:profileGeneration});
  }
  function assertProfileCurrent(expected:ProfileSnapshot):ProfileSnapshot{
    const current=profileSnapshot();
    if(current.id!==expected.id||current.generation!==expected.generation){throw noRetry(new Error('The active Study Director profile changed while Google Drive was working. Retry the Drive action.'));}
    return current;
  }
  function expectedProfile():string{return profileSnapshot().id;}
  function folderProfile(folder:DriveFile|null|undefined):string{const id=String(folder&&folder.appProperties&&folder.appProperties[PROFILE_MARKER]||'');return PROFILE_PATTERN.test(id)?id:'';}
  async function bindFolder(id:string,context:DriveOperation=EMPTY_DRIVE_OPERATION,expected:ProfileSnapshot=profileSnapshot()):Promise<void>{
    assertProfileCurrent(expected);if(boundFolder===id+'\n'+expected.id)return;
    const metadata=seenFolder&&seenFolder.id===id?seenFolder:await getFolderMetadata(id,context);assertProfileCurrent(expected);
    const found=folderProfile(metadata),mine=found===expected.id;const [email,library]=await Promise.all([accountEmail(context),mine?Promise.resolve(null):latestLibrary(id,context)]);assertProfileCurrent(expected);
    if(!profilePort)throw new Error('Study Director profile binding is unavailable.');const decision=await profilePort.bind(Object.freeze({email,folder:String(id),found,mine,library}));
    await assertDriveOperationCurrent(context);
    const current=profileSnapshot();
    const adopted=!!found&&decision==='adopt'&&current.id===found&&current.generation!==expected.generation;
    if(!adopted&&(current.id!==expected.id||current.generation!==expected.generation)){invalidateFolderIdentity();cancelFolderResolution();throw noRetry(new Error('The active Study Director profile changed while the Drive library choice was open. Nothing was changed.'));}
    if(mine&&decision==='continue'){}else if(!found&&decision==='claim'){await markFolder(id,expected.id,context);assertProfileCurrent(expected);}else if(adopted){}else{disconnectProfileLater(current);throw noRetry(Object.assign(new Error(found?'This Google account holds the library of another profile. Drive was not used.':'This Google account already holds a Study Director library. Drive was not used.'),{studyDirectorProfileRefused:true}));}
    if(adopted){folderId=id;seenFolder=metadata;}const settled=profileSnapshot();boundFolder=id+'\n'+settled.id;const name=libraryName();if(name&&metadata.name!==name)await renameFolder(id,name,context).catch(()=>{});
  }
  function libraryName():string{try{const name=String(profilePort?.name()||'').trim();return name&&name.length<=200?name:FOLDER_NAME;}catch{return FOLDER_NAME;}}
  async function renameFolder(id:string,name:string,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<void>{
    const response=await authorizedFetch(`${DRIVE_API}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent('id,name')}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})},API_TIMEOUT_MS,context);
    if(!response.ok)throw await apiError(response,'Could not rename the Study Director backup folder.');
  }
  // Deleting a profile everywhere leaves a marker: a small folder named
  // "Study Director – Ana (deleted)" carrying the profile id, which every
  // device checks for before it uses or makes that profile's library.
  async function deletionMarker(profile:string,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<boolean>{
    const q=driveQuery([`mimeType='${FOLDER_MIME}'`,`appProperties has { key='${DELETED_MARKER}' and value='${profile}' }`,'trashed=false']);
    const params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'1',fields:'files(id)'});
    const files=await firstMatches(params,1,context,'Could not check whether this profile was deleted.');
    return files.length>0;
  }
  // Delete everywhere: the marker first, so no device makes the library
  // again, then the library folder goes to the Drive Trash, where it can be
  // brought back for 30 days.
  async function deleteLibrary():Promise<boolean>{
    const expected=profileSnapshot(),context=driveOperationContext();if(!expected.id)throw new Error('This profile is still starting.');if(!tokenValid())throw new Error('Sign in to Google Drive first.');
    if(!await deletionMarker(expected.id,context)){assertProfileCurrent(expected);const response=await authorizedFetch(DRIVE_API+'/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:libraryName()+' (deleted)',mimeType:FOLDER_MIME,appProperties:{[DELETED_MARKER]:expected.id}})},API_TIMEOUT_MS,context);if(!response.ok)throw await apiError(response,'Could not mark this profile as deleted in Google Drive.');assertProfileCurrent(expected);}else assertProfileCurrent(expected);
    libraryDeleted=expected.id;repositoryUploads.clear();const id=await findFolder(context);assertProfileCurrent(expected);
    if(id&&folderProfile(seenFolder)===expected.id){const response=await authorizedFetch(DRIVE_API+'/files/'+encodeURIComponent(id)+'?fields=id',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})},API_TIMEOUT_MS,context);if(!response.ok)throw await apiError(response,'Could not move the library to the Google Drive Trash.');assertProfileCurrent(expected);}
    invalidateFolderIdentity();return true;
  }
  async function markFolder(id:string,profile:string,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<void>{
    const expected=profileSnapshot();if(expected.id!==profile)throw noRetry(new Error('The active Study Director profile changed before the Drive folder could be claimed.'));
    const fields='id,name,mimeType,ownedByMe,shared,trashed,appProperties,capabilities(canAddChildren)';
    const response=await authorizedFetch(`${DRIVE_API}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({appProperties:{[PROFILE_MARKER]:profile}})},API_TIMEOUT_MS,context);
    if(!response.ok)throw await apiError(response,'Could not mark the Study Director backup folder for this profile.');
    assertProfileCurrent(expected);const payload=jsonResponse(response);
    if(!validFolderMetadata(payload)||folderProfile(payload)!==profile)throw noRetry(new Error('Google Drive did not confirm the profile of the Study Director backup folder.'));
  }
  // The signed-in Google account, shown by its email (one small request).
  async function accountEmail(context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<string>{
    const response=await authorizedGet(`${DRIVE_API}/about?fields=${encodeURIComponent('user(emailAddress)')}`,{},context);
    if(!response.ok)throw await apiError(response,'Could not read the Google account.');
    const email=String(jsonResponse(response).user?.emailAddress||'').trim().toLowerCase();
    return /^[^\s@]{1,128}@[^\s@]{1,190}$/u.test(email)?email:'';
  }
  // What the folder holds, for "Continue with your library": the newest
  // version's counts and time, or null when it holds none.
  async function latestLibrary(id:string,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<Readonly<{savedAt:string;days:number|null;notes:number|null}>|null>{
    const q=driveQuery([`'${String(id).replaceAll("'","\\'")}' in parents`,`appProperties has { key='${REPOSITORY_MARKER.key}' and value='${REPOSITORY_MARKER.value}' }`,`appProperties has { key='${REPOSITORY_KIND_MARKER}' and value='commit' }`,'trashed=false']);
    const params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'1',orderBy:'createdTime desc',fields:'files(id,createdTime,appProperties)'});
    const [file]=await firstMatches(params,1,context,'Could not read the Study Director library on Google Drive.');
    if(!file)return null;
    const checkpoint=await latestCheckpoint(id,context),counts=/^(\d+),(\d+)$/u.exec(String(checkpoint?.appProperties?.[HISTORY_COUNTS_MARKER]||''));
    return Object.freeze({savedAt:String(file.createdTime||''),days:counts?Number(counts[1]):null,notes:counts?Number(counts[2]):null});
  }
  async function latestCheckpoint(id:string,context:DriveOperation):Promise<DriveFile|null>{
    const q=driveQuery([`'${String(id).replaceAll("'","\\'")}' in parents`,`appProperties has { key='${REPOSITORY_KIND_MARKER}' and value='checkpoint' }`,`appProperties has { key='${HISTORY_ROLE_MARKER}' and value='normal' }`,'trashed=false']);
    const params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'1',orderBy:'createdTime desc',fields:'files(id,createdTime,appProperties)'});
    try{
      const [file]=await firstMatches(params,1,context,'Could not read the latest Study Director checkpoint.');
      return file??null;
    }catch(error){
      // The latest commit still identifies the library when optional counts are unavailable.
      if(asDriveError(error).driveStatus)return null;
      throw error;
    }
  }
  function cancelFolderResolution():void{
    const flight=folderResolutionFlight;
    if(!flight)return;
    folderResolutionFlight=null;
    if(!flight.settled)flight.controller.abort(new Error('Google Drive folder resolution was cancelled.'));
  }
  function startFolderResolution(profile:ProfileSnapshot=profileSnapshot()):FolderFlight{
    const controller=new Platform.AbortController(),context=driveOperationContext({signal:controller.signal});
    const flight:FolderFlight={controller,promise:Promise.resolve(''),waiters:0,settled:false,profile};
    const pending=resolveFolder(context);flight.promise=pending;folderResolutionFlight=flight;
    pending.then(()=>{flight.settled=true;if(folderResolutionFlight===flight)folderResolutionFlight=null;},()=>{flight.settled=true;if(folderResolutionFlight===flight)folderResolutionFlight=null;});
    return flight;
  }
  async function awaitFolderResolution(flight:FolderFlight,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<string>{
    const operation=context||EMPTY_DRIVE_OPERATION,signal=operation.signal;
    let abortListener:(()=>void)|null=null;flight.waiters+=1;
    try{
      await assertDriveOperationCurrent(operation);
      let result:string;
      if(signal){
        result=await Promise.race([flight.promise,new Promise<never>((_,reject)=>{
          abortListener=()=>reject(noRetry(driveAbortError(signal)));
          if(signal.aborted)abortListener();else signal.addEventListener('abort',abortListener,{once:true});
        })]);
      }else result=await flight.promise;
      await assertDriveOperationCurrent(operation);
      return result;
    }finally{
      if(signal&&abortListener)signal.removeEventListener('abort',abortListener);
      flight.waiters=Math.max(0,flight.waiters-1);
      if(flight.waiters===0&&!flight.settled)flight.controller.abort(new Error('Google Drive folder resolution has no active callers.'));
    }
  }
  async function ensureFolder(context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<string>{
    const operation=context||EMPTY_DRIVE_OPERATION;
    if(operation.signal&&operation.signal.aborted)throw noRetry(driveAbortError(operation.signal));
    if(operation.folderState){
      if(operation.folderState.authorization!==authorizationGeneration)throw noRetry(new Error('Google Drive authorization changed. Retry the Drive action.'));
      assertProfileCurrent(operation.folderState.profile);
    }
    const verified=verifiedFolderReceipt(operation);if(verified){await assertDriveOperationCurrent(operation);return verified;}
    const current=profileSnapshot();if(folderResolutionFlight&&(folderResolutionFlight.profile.id!==current.id||folderResolutionFlight.profile.generation!==current.generation))cancelFolderResolution();
    const flight=folderResolutionFlight||startFolderResolution(current);
    const resolved=await awaitFolderResolution(flight,operation),settledProfile=profileSnapshot();
    if(boundFolder!==resolved+'\n'+settledProfile.id){
      invalidateFolderIdentity();
      throw noRetry(new Error('The active Study Director profile changed while Google Drive was settling its library. Retry the Drive action.'));
    }
    return rememberVerifiedFolder(operation,resolved);
  }
  async function repositoryScope(context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<string>{return repositoryVerificationScope(await ensureFolder(context));}
  const REPOSITORY_FIELDS='id,name,size,version,modifiedTime,createdTime,mimeType,parents,ownedByMe,shared,trashed,sha256Checksum,appProperties,capabilities(canDownload)';
  function isRepositoryKind(value:unknown):value is RepositoryKind{return typeof value==='string'&&REPOSITORY_KINDS.has(value as RepositoryKind);}
  function repositoryIdValid(kind:RepositoryKind,id:unknown):boolean{return kind==='object'?/^obj_[a-f0-9]{32}$/u.test(String(id||'')):['checkpoint','commit'].includes(kind)?/^cp_[a-f0-9]{32}$/u.test(String(id||'')):kind==='session-claim'?/^sc_[a-f0-9]{16}$/u.test(String(id||'')):false;}
  function repositoryFilename(kind:RepositoryKind,id:unknown):string{return String(id)+(kind==='object'?'.sdobject':kind==='commit'?'.sdcommit':kind==='session-claim'?'.sdsessionclaim':'.sdcheckpoint');}
  function validRepositoryMetadata(file:DriveFile|null|undefined,parent:string,kind:RepositoryKind|''=''):boolean{
    const properties=file&&file.appProperties||{},actualKind=String(properties[REPOSITORY_KIND_MARKER]||''),id=String(properties[REPOSITORY_ID_MARKER]||''),size=finiteSize(file&&file.size);
    if(kind&&actualKind!==kind)return false;
    return !!(file&&file.id&&isRepositoryKind(actualKind)&&repositoryIdValid(actualKind,id)&&file.name===repositoryFilename(actualKind,id)&&size!==null&&size>0&&size<=maxBackupBytes&&
      file.ownedByMe===true&&file.shared===false&&file.trashed===false&&exactParent(file,parent)&&file.appProperties&&properties[REPOSITORY_MARKER.key]===REPOSITORY_MARKER.value&&
      properties[REPOSITORY_VERSION_MARKER]===REPOSITORY_VERSION&&/^[a-f0-9]{64}$/u.test(String(properties[FILE_DIGEST_MARKER]||''))&&file.capabilities&&file.capabilities.canDownload===true);
  }
  function repositoryVerificationScope(parent:string):string{return `drive-repository:${REPOSITORY_VERSION}:${FILE_SECURITY_VERSION}:${String(parent)}`;}
  function repositoryDescriptor(file:DriveFile,parent:string):ProviderItem{
    if(!validRepositoryMetadata(file,parent))throw noRetry(new Error('Google Drive returned unsafe Study Director backup metadata.'));
    const properties=file.appProperties,kind=String(properties[REPOSITORY_KIND_MARKER]),id=String(properties[REPOSITORY_ID_MARKER]);
    const serverDigest=/^[a-f0-9]{64}$/u.test(String(file.sha256Checksum||'').toLowerCase())?String(file.sha256Checksum).toLowerCase():'';
    let history:HistorySummary|null=null;
    if(kind==='checkpoint'){
      const logicalFingerprint=String(properties[HISTORY_FINGERPRINT_MARKER]||'').toLowerCase(),countsMatch=/^(\d+),(\d+)$/u.exec(String(properties[HISTORY_COUNTS_MARKER]||'')),role=String(properties[HISTORY_ROLE_MARKER]||'normal'),protectedUntil=String(properties[HISTORY_PROTECTED_UNTIL_MARKER]||''),exportedAt=String(properties[REPOSITORY_IDENTITIES.driveExportedAtMarker]||file.createdTime||''),calendarMatch=/^(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}),(-?\d{1,4})$/u.exec(String(properties[HISTORY_CALENDAR_MARKER]||''));
      let calendar=null;
      if(calendarMatch&&Number.isFinite(Date.parse(exportedAt))){const localDate=calendarMatch[1]??'',weekStart=calendarMatch[2]??'',month=calendarMatch[3]??'',utcOffsetMinutes=Number(calendarMatch[4]??''),localOrdinal=Math.floor(Date.parse(`${localDate}T00:00:00.000Z`)/86400000),weekOrdinal=Math.floor(Date.parse(`${weekStart}T00:00:00.000Z`)/86400000),offsetDate=new Date(Date.parse(exportedAt)+utcOffsetMinutes*60000).toISOString().slice(0,10);if(Number.isInteger(utcOffsetMinutes)&&Math.abs(utcOffsetMinutes)<=14*60&&month===localDate.slice(0,7)&&offsetDate===localDate&&Number.isFinite(localOrdinal)&&Number.isFinite(weekOrdinal)&&weekOrdinal<=localOrdinal&&localOrdinal-weekOrdinal<=6&&new Date(weekOrdinal*86400000).getUTCDay()===1)calendar=Object.freeze({localDate,weekStart,month,utcOffsetMinutes});}
      if(/^[a-f0-9]{64}$/u.test(logicalFingerprint)&&countsMatch&&['normal','before-restore'].includes(role)&&Number.isFinite(Date.parse(exportedAt))&&(!protectedUntil||Number.isFinite(Date.parse(protectedUntil))))history=Object.freeze({format:/^[1-9]\d{0,3}$/u.test(String(properties[HISTORY_FORMAT_MARKER]||''))?Number(properties[HISTORY_FORMAT_MARKER]):0,logicalFingerprint,exportedAt:new Date(exportedAt).toISOString(),counts:Object.freeze({dailyRecord:Number(countsMatch[1]),note:Number(countsMatch[2])}),encrypted:properties[HISTORY_ENCRYPTED_MARKER]==='1',retention:Object.freeze({role:role as 'normal'|'before-restore',protectedUntil:protectedUntil?new Date(protectedUntil).toISOString():'',purpose:'',calendar,notesFingerprint:/^[a-f0-9]{64}$/u.test(String(properties[HISTORY_NOTES_MARKER]||''))?String(properties[HISTORY_NOTES_MARKER]):''}),origin:ORIGIN_PATTERN.test(String(properties[HISTORY_ORIGIN_MARKER]||''))?String(properties[HISTORY_ORIGIN_MARKER]):'',attachmentsMissing:/^\d{1,6}$/u.test(String(properties[HISTORY_ATTACHMENTS_MISSING_MARKER]||''))?Number(properties[HISTORY_ATTACHMENTS_MISSING_MARKER]):0});
    }
    if(!isRepositoryKind(kind))throw noRetry(new Error('Google Drive returned an invalid Study Director repository kind.'));return Object.freeze({kind,id,remoteId:String(file.id),remoteVersion:String(file.version||''),verificationScope:repositoryVerificationScope(parent),name:String(file.name),size:Number(file.size),createdAt:String(file.createdTime||''),modifiedAt:String(file.modifiedTime||''),digest:String(properties[FILE_DIGEST_MARKER]||''),serverDigest,history,unreadable:false,locked:false});
  }
  function coordinationVerificationScope(parent:string):string{return `drive:${folderEpoch}:${String(parent)}`;}
  function publicationIdValid(id:unknown):boolean{return /^pub_[a-f0-9]{32}$/u.test(String(id||''));}
  function publicationFilename(id:unknown):string{return String(id)+'.sdpublication';}
  function validPublicationMetadata(file:DriveFile|null|undefined,parent:string):boolean{
    const properties=file&&file.appProperties||{},id=String(properties[REPOSITORY_ID_MARKER]||'');
    return !!(file&&file.id&&publicationIdValid(id)&&file.name===publicationFilename(id)&&file.ownedByMe===true&&file.shared===false&&file.trashed===false&&exactParent(file,parent)&&
      properties[REPOSITORY_MARKER.key]===REPOSITORY_MARKER.value&&properties[REPOSITORY_VERSION_MARKER]===REPOSITORY_VERSION&&properties[REPOSITORY_KIND_MARKER]===PUBLICATION_KIND);
  }
  function publicationDescriptor(file:DriveFile,parent:string):CoordinationLease{
    if(!validPublicationMetadata(file,parent))throw noRetry(new Error('Google Drive returned unsafe Study Director publication metadata.'));
    const id=String(file.appProperties[REPOSITORY_ID_MARKER]),createdAt=String(file.createdTime||''),device=thisDevice();
    const writer=String(file.appProperties[PUBLICATION_DEVICE_MARKER]||'');
    return Object.freeze({kind:PUBLICATION_KIND,id,device:DEVICE_PATTERN.test(writer)?writer:'',sameDevice:!!device&&writer===device,renews:file.appProperties[PUBLICATION_RENEWS_MARKER]==='1',startedAt:Number.isFinite(Date.parse(String(file.appProperties[PUBLICATION_STARTED_MARKER]||'')))?new Date(Date.parse(String(file.appProperties[PUBLICATION_STARTED_MARKER]||''))).toISOString():createdAt,remoteId:String(file.id),verificationScope:coordinationVerificationScope(parent),name:String(file.name),createdAt,modifiedAt:String(file.modifiedTime||''),expiresAt:Number.isFinite(Date.parse(createdAt))?new Date(Date.parse(createdAt)+PUBLICATION_MAX_AGE_MS).toISOString():''});
  }
  function trustedCoordinationRemoteId(ref:Lease|ItemRef|null|undefined,parent:string,kind:string,idValid:(id:unknown)=>boolean):string{
    const id=String(ref&&ref.id||''),remoteId=String(ref&&ref['remoteId']||''),scope=String(ref&&ref['verificationScope']||'');
    return ref&&ref['kind']===kind&&idValid(id)&&remoteId&&remoteId.length<=512&&scope===coordinationVerificationScope(parent)?remoteId:'';
  }
  function ambiguousDriveMutation(error:unknown):boolean{
    if(!error||operationStopped(error)||asDriveError(error).studyDirectorDriveNoRetry||/authorization/i.test(String(asDriveError(error).message||'')))return false;
    const status=Number(asDriveError(error).driveStatus)||0;return status===0||transientStatus(status);
  }
  async function recoverCreatedCoordinationMarker(parent:string,id:string,findMarker:FindMarker,context:DriveOperation,error:unknown):Promise<DriveFile>{
    if(!ambiguousDriveMutation(error))throw error;
    const recovered=await findMarker(parent,id,context);if(recovered)return recovered;throw error;
  }
  async function deleteCoordinationMarker(metadata:DriveFile,{parent,id,findMarker,context,label}:CoordinationDeleteOptions):Promise<boolean>{
    let current=metadata,lastError=null;
    for(let attempt=0;attempt<2;attempt++){
      let response:Response|null=null;
      try{response=await authorizedFetch(`${DRIVE_API}/files/${encodeURIComponent(current.id)}`,{method:'DELETE'},API_TIMEOUT_MS,context);}
      catch(error){
        if(!ambiguousDriveMutation(error))throw error;lastError=error;
        const remaining=await findMarker(parent,id,context);if(!remaining)return true;current=remaining;continue;
      }
      if(response.ok||response.status===404)return true;
      const retryable=await retryableResponse(response),error=await apiError(response,label);if(!retryable)throw error;lastError=error;
      const remaining=await findMarker(parent,id,context);if(!remaining)return true;current=remaining;
    }
    throw lastError||new Error(label);
  }
  async function findRepositoryPublication(parent:string,id:string,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<DriveFile|null>{
    if(!publicationIdValid(id))throw noRetry(new Error('A Study Director publication marker has an invalid identity.'));
    const q=driveQuery([
      `'${String(parent).replaceAll("'","\\'")}' in parents`,
      `appProperties has { key='${REPOSITORY_MARKER.key}' and value='${REPOSITORY_MARKER.value}' }`,
      `appProperties has { key='${REPOSITORY_KIND_MARKER}' and value='${PUBLICATION_KIND}' }`,
      `appProperties has { key='${REPOSITORY_ID_MARKER}' and value='${String(id).replaceAll("'","\\'")}' }`,
      'trashed=false'
    ]);
    const params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'3',fields:`nextPageToken,incompleteSearch,files(${REPOSITORY_FIELDS})`});
    const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);if(!response.ok)throw await apiError(response,'Could not verify the Study Director backup publication marker.');
    const payload=listResponse(response),files=payload.files;
    if(payload.incomplete)throw noRetry(new Error('Google Drive returned an incomplete marker inventory.'));
    if(payload.nextPageToken||files.length>1)throw noRetry(new Error('Duplicate Study Director backup publication markers were found. Maintenance stopped safely.'));
    const marker=files[0];
    if(marker&&(!validPublicationMetadata(marker,parent)||marker.appProperties[REPOSITORY_ID_MARKER]!==id))throw noRetry(new Error('Google Drive returned invalid marker metadata.'));
    return files[0]||null;
  }
  // Drive's clock, learned from the markers this device creates (Drive
  // stamps their creation time). Marker ages are measured on it, so a device
  // whose own clock is wrong neither removes another device's live upload
  // marker nor waits for one that ended long ago. Until a marker is created
  // it is this device's clock.
  let driveClockOffset=0;
  function learnDriveClock(file:DriveFile|null|undefined,sentAt:number,receivedAt:number):void{
    const created=Date.parse(String(file&&file.createdTime||''));
    if(Number.isFinite(created)&&receivedAt>=sentAt&&receivedAt-sentAt<=30000)driveClockOffset=created-(sentAt+receivedAt)/2;
  }
  function driveNow():number{return Date.now()+driveClockOffset;}
  async function beginRepositoryPublication(baseContext:DriveOperation=EMPTY_DRIVE_OPERATION,startedAt=''):Promise<CoordinationLease>{
    // An upload's first marker records no start of its own: its creation
    // time on Drive is the start. Renewals carry that time forward.
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id='pub_'+Platform.crypto.randomUUID().replace(/-/gu,''),now=new Date().toISOString(),started=Number.isFinite(Date.parse(String(startedAt||'')))?new Date(Date.parse(startedAt)).toISOString():'';
    const metadata={name:publicationFilename(id),parents:[parent],mimeType:'application/octet-stream',appProperties:{
      [REPOSITORY_MARKER.key]:REPOSITORY_MARKER.value,[REPOSITORY_VERSION_MARKER]:REPOSITORY_VERSION,[REPOSITORY_KIND_MARKER]:PUBLICATION_KIND,[REPOSITORY_ID_MARKER]:id,
      [FILE_SECURITY_MARKER]:FILE_SECURITY_VERSION,[REPOSITORY_IDENTITIES.driveAppVersionMarker]:PLUGIN_VERSION,[REPOSITORY_IDENTITIES.driveExportedAtMarker]:now,[PUBLICATION_RENEWS_MARKER]:'1',...(started?{[PUBLICATION_STARTED_MARKER]:started}:{}),
      ...(thisDevice()?{[PUBLICATION_DEVICE_MARKER]:thisDevice()}:{})
    }};
    let response:Response|null=null,file:DriveFile|null=null;const sentAt=Date.now();
    try{response=await authorizedFetch(`${DRIVE_API}/files?fields=${encodeURIComponent(REPOSITORY_FIELDS)}`,{method:'POST',headers:{'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(metadata)},API_TIMEOUT_MS,context);}
    catch(error){file=await recoverCreatedCoordinationMarker(parent,id,findRepositoryPublication,context,error);}
    if(response&&!response.ok){const retryable=await retryableResponse(response),error=await apiError(response,'Could not establish a safe Google Drive backup publication marker.');if(!retryable)throw error;file=await findRepositoryPublication(parent,id,context);if(!file)throw error;}
    if(response&&response.ok){file=jsonResponse(response);learnDriveClock(file,sentAt,Date.now());if(!file||!validPublicationMetadata(file,parent)){const remoteId=String(file&&file.id||'');file=remoteId?await getFileMetadata(remoteId,context):await findRepositoryPublication(parent,id,context);}}
    if(!file||!validPublicationMetadata(file,parent))throw noRetry(new Error('Google Drive did not confirm the backup publication marker.'));
    return publicationDescriptor(file,parent);
  }
  async function listRepositoryPublications(baseContext:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<{items:readonly CoordinationLease[];overflow:boolean;ignored:number}>{
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),q=driveQuery([
      `'${String(parent).replaceAll("'","\\'")}' in parents`,
      `appProperties has { key='${REPOSITORY_MARKER.key}' and value='${REPOSITORY_MARKER.value}' }`,
      `appProperties has { key='${REPOSITORY_KIND_MARKER}' and value='${PUBLICATION_KIND}' }`,'trashed=false'
    ]),params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'100',fields:`nextPageToken,incompleteSearch,files(${REPOSITORY_FIELDS})`});
    const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);if(!response.ok)throw await apiError(response,'Could not inspect active Study Director backup publications.');
    const payload=listResponse(response),raw=payload.files,items=[];let ignored=0;
    for(const file of raw){if(validPublicationMetadata(file,parent))items.push(publicationDescriptor(file,parent));else ignored+=1;}
    return Object.freeze({items:Object.freeze(items),overflow:!!payload.nextPageToken||payload.incomplete,ignored});
  }
  async function assertRepositoryPublication(ref:Lease,baseContext:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<CoordinationLease>{
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id=String(ref&&ref.id||'');let metadata:DriveFile|null=null;
    if(ref&&ref['remoteId']){const candidate=await getFileMetadata(String(ref['remoteId']),context).catch(error=>{if(Number(asDriveError(error).driveStatus)===404)return null;throw error;});if(candidate&&validPublicationMetadata(candidate,parent)&&candidate.appProperties[REPOSITORY_ID_MARKER]===id)metadata=candidate;}
    if(!metadata)metadata=await findRepositoryPublication(parent,id,context);if(!metadata)throw noRetry(new Error('The Google Drive backup publication marker disappeared before commit. Retry the backup.'));
    const descriptor=publicationDescriptor(metadata,parent),created=Date.parse(descriptor.createdAt);if(!Number.isFinite(created)||driveNow()-created>=PUBLICATION_MAX_AGE_MS-PUBLICATION_ASSERTION_MARGIN_MS)throw noRetry(new Error('The Google Drive backup publication marker is too old to safely begin another commit step. Retry the backup.'));
    return descriptor;
  }
  async function endRepositoryPublication(ref:Lease,baseContext:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<boolean>{
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id=String(ref&&ref.id||'');if(!publicationIdValid(id))return false;let metadata:DriveFile|null=null;
    const trustedRemoteId=trustedCoordinationRemoteId(ref,parent,PUBLICATION_KIND,publicationIdValid);if(trustedRemoteId)metadata=parseDriveFile({id:trustedRemoteId});
    else if(ref&&ref['remoteId']){const candidate=await getFileMetadata(String(ref['remoteId']),context).catch(error=>{if(Number(asDriveError(error).driveStatus)===404)return null;throw error;});if(candidate&&validPublicationMetadata(candidate,parent)&&candidate.appProperties[REPOSITORY_ID_MARKER]===id)metadata=candidate;}
    if(!metadata)metadata=await findRepositoryPublication(parent,id,context);if(!metadata)return false;
    return await deleteCoordinationMarker(metadata,{parent,id,findMarker:findRepositoryPublication,context,label:'Could not clear a completed Study Director backup publication marker.'});
  }

  // Drive markers never change, so renewal replaces the marker: a fresh one
  // first, then the old one goes. The old one must still be here and must not
  // be close to looking abandoned; otherwise cleanup may already have taken it
  // for abandoned, and the upload has to stop before it commits.
  async function renewRepositoryPublication(ref:Lease,baseContext:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<CoordinationLease>{
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id=String(ref&&ref.id||'');
    if(!publicationIdValid(id))throw noRetry(new Error('A Study Director publication marker has an invalid identity.'));
    const startedAt=typeof ref['startedAt']==='string'?ref['startedAt']:'';const next=await beginRepositoryPublication(context,startedAt);
    try{
      const remoteId=trustedCoordinationRemoteId(ref,parent,PUBLICATION_KIND,publicationIdValid);
      const previous=remoteId?await getFileMetadata(remoteId,context).catch(error=>{if(Number(asDriveError(error).driveStatus)===404)return null;throw error;}):await findRepositoryPublication(parent,id,context);
      const created=previous&&validPublicationMetadata(previous,parent)&&previous.appProperties[REPOSITORY_ID_MARKER]===id?Date.parse(String(previous.createdTime||'')):NaN;
      if(!Number.isFinite(created))throw noRetry(new Error('The Google Drive backup publication marker disappeared before commit. Retry the backup.'));
      if(driveNow()-created>=PUBLICATION_STALE_MS-PUBLICATION_RENEW_MS)throw noRetry(new Error('The Google Drive backup publication marker went too long without renewal. Retry the backup.'));
      await endRepositoryPublication(ref,context);return next;
    }catch(error){
      await endRepositoryPublication(next,driveOperationContext({folderState:context.folderState})).catch(()=>{});throw error;
    }
  }

  function maintenanceIdValid(id:unknown):boolean{return /^mnt_[a-f0-9]{32}$/u.test(String(id||''));}
  function maintenanceFilename(id:unknown):string{return String(id)+'.sdmaintenance';}
  function validMaintenanceMetadata(file:DriveFile|null|undefined,parent:string):boolean{
    const properties=file&&file.appProperties||{},id=String(properties[REPOSITORY_ID_MARKER]||'');
    return !!(file&&file.id&&maintenanceIdValid(id)&&file.name===maintenanceFilename(id)&&file.ownedByMe===true&&file.shared===false&&file.trashed===false&&exactParent(file,parent)&&
      properties[REPOSITORY_MARKER.key]===REPOSITORY_MARKER.value&&properties[REPOSITORY_VERSION_MARKER]===MAINTENANCE_VERSION&&properties[REPOSITORY_KIND_MARKER]===MAINTENANCE_KIND);
  }
  function maintenanceDescriptor(file:DriveFile,parent:string):CoordinationLease{
    if(!validMaintenanceMetadata(file,parent))throw noRetry(new Error('Google Drive returned unsafe Study Director maintenance metadata.'));
    const id=String(file.appProperties[REPOSITORY_ID_MARKER]),createdAt=String(file.createdTime||''),maxAge=MAINTENANCE_MAX_AGE_MS;
    const device=thisDevice();return Object.freeze({kind:MAINTENANCE_KIND,id,sameDevice:!!device&&file.appProperties[MAINTENANCE_DEVICE_MARKER]===device,remoteId:String(file.id),verificationScope:coordinationVerificationScope(parent),name:String(file.name),createdAt,modifiedAt:String(file.modifiedTime||''),expiresAt:Number.isFinite(Date.parse(createdAt))?new Date(Date.parse(createdAt)+maxAge).toISOString():''});
  }
  async function findRepositoryMaintenance(parent:string,id:string,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<DriveFile|null>{
    if(!maintenanceIdValid(id))throw noRetry(new Error('A Study Director maintenance marker has an invalid identity.'));
    const q=driveQuery([
      `'${String(parent).replaceAll("'","\\'")}' in parents`,
      `appProperties has { key='${REPOSITORY_MARKER.key}' and value='${REPOSITORY_MARKER.value}' }`,
      `appProperties has { key='${REPOSITORY_KIND_MARKER}' and value='${MAINTENANCE_KIND}' }`,
      `appProperties has { key='${REPOSITORY_ID_MARKER}' and value='${String(id).replaceAll("'","\\'")}' }`,
      'trashed=false'
    ]);
    const params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'3',fields:`nextPageToken,incompleteSearch,files(${REPOSITORY_FIELDS})`});
    const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);if(!response.ok)throw await apiError(response,'Could not verify the Study Director repository-maintenance marker.');
    const payload=listResponse(response),files=payload.files;
    if(payload.incomplete)throw noRetry(new Error('Google Drive returned an incomplete marker inventory.'));
    if(payload.nextPageToken||files.length>1)throw noRetry(new Error('Duplicate Study Director repository-maintenance markers were found. Maintenance stopped safely.'));
    const marker=files[0];
    if(marker&&(!validMaintenanceMetadata(marker,parent)||marker.appProperties[REPOSITORY_ID_MARKER]!==id))throw noRetry(new Error('Google Drive returned invalid marker metadata.'));
    return files[0]||null;
  }
  async function beginRepositoryMaintenance(baseContext:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<CoordinationLease>{
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id='mnt_'+Platform.crypto.randomUUID().replace(/-/gu,''),now=new Date().toISOString();
    const metadata={name:maintenanceFilename(id),parents:[parent],mimeType:'application/octet-stream',appProperties:{
      // Older clients classify this version as uncertain and defer. They must
      // not expire a network lease using their former 60-second lifetime.
      [REPOSITORY_MARKER.key]:REPOSITORY_MARKER.value,[REPOSITORY_VERSION_MARKER]:MAINTENANCE_VERSION,[REPOSITORY_KIND_MARKER]:MAINTENANCE_KIND,[REPOSITORY_ID_MARKER]:id,
      [FILE_SECURITY_MARKER]:FILE_SECURITY_VERSION,[REPOSITORY_IDENTITIES.driveAppVersionMarker]:PLUGIN_VERSION,[REPOSITORY_IDENTITIES.driveExportedAtMarker]:now,
      ...(thisDevice()?{[MAINTENANCE_DEVICE_MARKER]:thisDevice()}:{})
    }};
    let response:Response|null=null,file:DriveFile|null=null;const sentAt=Date.now();
    try{response=await authorizedFetch(`${DRIVE_API}/files?fields=${encodeURIComponent(REPOSITORY_FIELDS)}`,{method:'POST',headers:{'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(metadata)},API_TIMEOUT_MS,context);}
    catch(error){file=await recoverCreatedCoordinationMarker(parent,id,findRepositoryMaintenance,context,error);}
    if(response&&!response.ok){const retryable=await retryableResponse(response),error=await apiError(response,'Could not establish safe Google Drive repository maintenance.');if(!retryable)throw error;file=await findRepositoryMaintenance(parent,id,context);if(!file)throw error;}
    if(response&&response.ok){file=jsonResponse(response);learnDriveClock(file,sentAt,Date.now());if(!file||!validMaintenanceMetadata(file,parent)){const remoteId=String(file&&file.id||'');file=remoteId?await getFileMetadata(remoteId,context):await findRepositoryMaintenance(parent,id,context);}}
    if(!file||!validMaintenanceMetadata(file,parent))throw noRetry(new Error('Google Drive did not confirm the repository-maintenance marker.'));
    return maintenanceDescriptor(file,parent);
  }
  async function listRepositoryMaintenances(baseContext:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<{items:readonly CoordinationLease[];overflow:boolean;ignored:number}>{
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),q=driveQuery([
      `'${String(parent).replaceAll("'","\\'")}' in parents`,
      `appProperties has { key='${REPOSITORY_MARKER.key}' and value='${REPOSITORY_MARKER.value}' }`,
      `appProperties has { key='${REPOSITORY_KIND_MARKER}' and value='${MAINTENANCE_KIND}' }`,'trashed=false'
    ]),params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'100',fields:`nextPageToken,incompleteSearch,files(${REPOSITORY_FIELDS})`});
    const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);if(!response.ok)throw await apiError(response,'Could not inspect active Study Director repository maintenance.');
    const payload=listResponse(response),raw=payload.files,items=[];let ignored=0;
    for(const file of raw){if(validMaintenanceMetadata(file,parent))items.push(maintenanceDescriptor(file,parent));else ignored+=1;}
    return Object.freeze({items:Object.freeze(items),overflow:!!payload.nextPageToken||payload.incomplete,ignored});
  }
  async function assertRepositoryMaintenance(ref:Lease,baseContext:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<CoordinationLease>{
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id=String(ref&&ref.id||'');let metadata:DriveFile|null=null;
    if(ref&&ref['remoteId']){const candidate=await getFileMetadata(String(ref['remoteId']),context).catch(error=>{if(Number(asDriveError(error).driveStatus)===404)return null;throw error;});if(candidate&&validMaintenanceMetadata(candidate,parent)&&candidate.appProperties[REPOSITORY_ID_MARKER]===id)metadata=candidate;}
    if(!metadata)metadata=await findRepositoryMaintenance(parent,id,context);if(!metadata)throw noRetry(new Error('The Google Drive repository-maintenance marker disappeared during cleanup. Maintenance stopped safely.'));
    const descriptor=maintenanceDescriptor(metadata,parent),expires=Date.parse(String(descriptor.expiresAt||'')),margin=MAINTENANCE_ASSERTION_MARGIN_MS;if(!Number.isFinite(expires)||driveNow()>=expires-margin)throw noRetry(new Error('The Google Drive repository-maintenance marker is too old to continue destructive cleanup safely.'));
    return descriptor;
  }
  async function endRepositoryMaintenance(ref:Lease,baseContext:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<boolean>{
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id=String(ref&&ref.id||'');if(!maintenanceIdValid(id))return false;let metadata:DriveFile|null=null;
    const trustedRemoteId=trustedCoordinationRemoteId(ref,parent,MAINTENANCE_KIND,maintenanceIdValid);if(trustedRemoteId)metadata=parseDriveFile({id:trustedRemoteId});
    else if(ref&&ref['remoteId']){const candidate=await getFileMetadata(String(ref['remoteId']),context).catch(error=>{if(Number(asDriveError(error).driveStatus)===404)return null;throw error;});if(candidate&&validMaintenanceMetadata(candidate,parent)&&candidate.appProperties[REPOSITORY_ID_MARKER]===id)metadata=candidate;}
    if(!metadata)metadata=await findRepositoryMaintenance(parent,id,context);if(!metadata)return false;
    return await deleteCoordinationMarker(metadata,{parent,id,findMarker:findRepositoryMaintenance,context,label:'Could not clear a completed Study Director repository-maintenance marker.'});
  }
  async function renewRepositoryMaintenance(ref:Lease,baseContext:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<CoordinationLease>{
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id=String(ref&&ref.id||'');
    if(!maintenanceIdValid(id))throw noRetry(new Error('Repository maintenance renewal has an invalid identity.'));
    // Rotate immutable markers with verified overlap. Missing or expired
    // protection invalidates the inventory instead of resuming deletion.
    const next=await beginRepositoryMaintenance(context);
    try{
      const remoteId=trustedCoordinationRemoteId(ref,parent,MAINTENANCE_KIND,maintenanceIdValid);
      const previous=remoteId?await getFileMetadata(remoteId,context).catch(error=>{if(Number(asDriveError(error).driveStatus)===404)return null;throw error;}):await findRepositoryMaintenance(parent,id,context);
      if(!previous||!validMaintenanceMetadata(previous,parent))throw noRetry(new Error('Repository maintenance protection was interrupted. A fresh inventory is required.'));
      const expires=Date.parse(String(maintenanceDescriptor(previous,parent).expiresAt||''));
      if(!Number.isFinite(expires)||previous.appProperties[REPOSITORY_ID_MARKER]!==id||driveNow()>=expires)throw noRetry(new Error('Repository maintenance protection was interrupted. A fresh inventory is required.'));
      await endRepositoryMaintenance(ref,context);return next;
    }catch(error){
      await endRepositoryMaintenance(next,driveOperationContext({folderState:context.folderState})).catch(()=>{});throw error;
    }
  }
  async function listRepositoryFiles(kind:RepositoryKind,{limit=100000}:{limit?:number}={},context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<{items:readonly ProviderItem[];overflow:boolean;ignored:number}>{
    if(!isRepositoryKind(kind))throw noRetry(new Error('Repository file kind is invalid.'));
    const parent=await ensureFolder(context),q=driveQuery([
      `'${String(parent).replaceAll("'","\\'")}' in parents`,
      `appProperties has { key='${REPOSITORY_MARKER.key}' and value='${REPOSITORY_MARKER.value}' }`,
      `appProperties has { key='${REPOSITORY_KIND_MARKER}' and value='${kind}' }`,
      'trashed=false'
    ]);
    const items=[],pageTokens=new Set();let pageToken='',overflow=false,pages=0,ignored=0;
    do{
      const params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'1000',orderBy:'createdTime desc',fields:`nextPageToken,incompleteSearch,files(${REPOSITORY_FIELDS})`});if(pageToken)params.set('pageToken',pageToken);
      const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);if(!response.ok)throw await apiError(response,'Could not read the Study Director backup history in Google Drive.');
      const payload=listResponse(response),files=payload.files;
      if(payload.incomplete){overflow=true;break;}
      for(const file of files){if(validRepositoryMetadata(file,parent,kind)){items.push(repositoryDescriptor(file,parent));if(items.length>=limit){overflow=!!payload?.nextPageToken||files.indexOf(file)<files.length-1;break;}}else ignored+=1;}
      if(items.length>=limit)break;pageToken=String(payload.nextPageToken||'');
      if(pageToken){if(pageTokens.has(pageToken))throw noRetry(new Error('Google Drive repeated a backup inventory page. Nothing was changed.'));pageTokens.add(pageToken);}
      pages+=1;if(Number.isFinite(limit)&&pages>=100&&pageToken){overflow=true;break;}
    }while(pageToken);
    return Object.freeze({items:Object.freeze(items),overflow,ignored});
  }
  async function findRepositoryFile(parent:string,kind:RepositoryKind,id:string,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<DriveFile|null>{
    if(!isRepositoryKind(kind)||!repositoryIdValid(kind,id))throw noRetry(new Error('A Study Director backup file has an invalid identity.'));
    const q=driveQuery([
      `'${String(parent).replaceAll("'","\\'")}' in parents`,
      `appProperties has { key='${REPOSITORY_MARKER.key}' and value='${REPOSITORY_MARKER.value}' }`,
      `appProperties has { key='${REPOSITORY_KIND_MARKER}' and value='${kind}' }`,
      `appProperties has { key='${REPOSITORY_ID_MARKER}' and value='${String(id).replaceAll("'","\\'")}' }`,
      'trashed=false'
    ]);
    const params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'3',fields:`nextPageToken,incompleteSearch,files(${REPOSITORY_FIELDS})`});
    const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);if(!response.ok)throw await apiError(response,'Could not locate a required Study Director backup file in Google Drive.');
    const payload=listResponse(response),files=payload.files;
    if(payload.incomplete)throw noRetry(new Error('Google Drive returned an incomplete backup inventory.'));
    if(payload.nextPageToken||files.length>1)throw noRetry(new Error('Duplicate Study Director backup files were found. Nothing was changed.'));
    // A marked identity with unsafe metadata is *not* proof that the identity
    // is absent. Do not create a duplicate beside a malformed remote file.
    const found=files[0]||null;if(found&&(!validRepositoryMetadata(found,parent,kind)||found.appProperties[REPOSITORY_ID_MARKER]!==id))throw noRetry(new Error('Google Drive found a backup identity with unsafe metadata. Nothing was uploaded.'));
    return found;
  }
  function repositoryUploadMetadata(file:Upload&{blob:Blob},parent:string):{name:string;parents:string[];mimeType:string;appProperties:Record<string,string>}{
    const properties:Record<string,string>={
      [REPOSITORY_MARKER.key]:REPOSITORY_MARKER.value,[REPOSITORY_VERSION_MARKER]:REPOSITORY_VERSION,[REPOSITORY_KIND_MARKER]:file.kind,[REPOSITORY_ID_MARKER]:file.id,
      [FILE_SECURITY_MARKER]:FILE_SECURITY_VERSION,[FILE_DIGEST_MARKER]:file.digest,[REPOSITORY_IDENTITIES.driveAppVersionMarker]:String(file.appVersion||PLUGIN_VERSION),[REPOSITORY_IDENTITIES.driveExportedAtMarker]:String(file.exportedAt||new Date().toISOString())
    };
    const history=file.kind==='checkpoint'&&file.historySummary&&typeof file.historySummary==='object'?file.historySummary:null;
    if(history){
      const fingerprint=String(history.logicalFingerprint||'').toLowerCase(),daily=Math.max(0,Math.floor(Number(history.counts&&history.counts['dailyRecord'])||0)),notes=Math.max(0,Math.floor(Number(history.counts&&history.counts['note'])||0)),role=String(history.retention&&history.retention.role||'normal'),protectedUntil=String(history.retention&&history.retention.protectedUntil||''),calendar=history.retention&&history.retention.calendar||null;
      if(/^[a-f0-9]{64}$/u.test(fingerprint)&&['normal','before-restore'].includes(role)){
        properties[HISTORY_FINGERPRINT_MARKER]=fingerprint;properties[HISTORY_COUNTS_MARKER]=`${daily},${notes}`;properties[HISTORY_ENCRYPTED_MARKER]=history.encrypted===true?'1':'0';properties[HISTORY_ROLE_MARKER]=role;if(protectedUntil&&Number.isFinite(Date.parse(protectedUntil)))properties[HISTORY_PROTECTED_UNTIL_MARKER]=new Date(protectedUntil).toISOString();
        if(calendar&&/^\d{4}-\d{2}-\d{2}$/u.test(String(calendar.localDate||''))&&/^\d{4}-\d{2}-\d{2}$/u.test(String(calendar.weekStart||''))&&/^\d{4}-\d{2}$/u.test(String(calendar.month||''))&&Number.isInteger(Number(calendar.utcOffsetMinutes)))properties[HISTORY_CALENDAR_MARKER]=`${calendar.localDate},${calendar.weekStart},${calendar.month},${Number(calendar.utcOffsetMinutes)}`;
        const notesFingerprint=String(history.retention&&history.retention.notesFingerprint||'').toLowerCase();if(/^[a-f0-9]{64}$/u.test(notesFingerprint))properties[HISTORY_NOTES_MARKER]=notesFingerprint;
        if(ORIGIN_PATTERN.test(String(history.origin||'')))properties[HISTORY_ORIGIN_MARKER]=String(history.origin);
        if(Number.isSafeInteger(Number(history.format))&&Number(history.format)>0&&Number(history.format)<10000)properties[HISTORY_FORMAT_MARKER]=String(Number(history.format));
        properties[HISTORY_ATTACHMENTS_MISSING_MARKER]=String(Number.isSafeInteger(Number(history.attachmentsMissing))&&Number(history.attachmentsMissing)>0?Number(history.attachmentsMissing):0);
      }
    }
    return {name:repositoryFilename(file.kind,file.id),parents:[parent],mimeType:'application/octet-stream',appProperties:properties};
  }
  async function beginRepositoryUpload(file:Upload&{blob:Blob},parent:string,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<string>{
    const metadata=repositoryUploadMetadata(file,parent);
    const response=await authorizedFetch(`${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=${encodeURIComponent(REPOSITORY_FIELDS)}`,{
      method:'POST',headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'application/octet-stream','X-Upload-Content-Length':String(file.blob.size)},body:JSON.stringify(metadata)
    },API_TIMEOUT_MS,context);
    if(!response.ok)throw await apiError(response,'Could not begin the Google Drive backup upload.');
    const uploadUrl=response.headers.get('Location');if(!uploadUrl)throw noRetry(new Error('Google Drive did not provide a resumable backup upload session.'));
    return validatedUploadSession(uploadUrl);
  }
  async function uploadRepositoryMultipart(file:Upload&{blob:Blob},parent:string,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<DrivePayload>{
    const boundary='sd_'+Platform.crypto.randomUUID().replace(/-/gu,''),metadata=repositoryUploadMetadata(file,parent),prefix=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,suffix=`\r\n--${boundary}--\r\n`,body=new Blob([prefix,file.blob,suffix],{type:`multipart/related; boundary=${boundary}`});
    const response=await authorizedFetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=${encodeURIComponent(REPOSITORY_FIELDS)}`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body},TRANSFER_TIMEOUT_MS,context);
    if(!response.ok)throw await apiError(response,'Could not upload the Study Director backup to Google Drive.');
    return jsonResponse(response);
  }
  async function repositoryUpload(file:Upload,baseContext:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<ProviderItem>{
    if(!REPOSITORY_KINDS.has(file.kind)||!repositoryIdValid(file.kind,file.id)||!(file.blob instanceof Blob)||file.blob.size<=0||file.blob.size>maxBackupBytes||!/^[a-f0-9]{64}$/u.test(String(file.digest||'')))throw new Error('No safe Study Director backup payload was supplied to Google Drive.');
    const upload=file as Upload&{blob:Blob};
    const context=childDriveOperationContext(baseContext,{checkProtection:file.checkProtection,checkSource:file.checkSource});
    await assertDriveOperationCurrent(context);
    const parent=await ensureFolder(context),uploadKey=parent+':'+file.kind+':'+file.id;
    if(uploadsInFlight.has(uploadKey))throw noRetry(new Error('This Study Director backup file is already uploading.'));
    uploadsInFlight.add(uploadKey);
    try{return await uploadVerifiedFile(upload,parent,uploadKey,context);}
    finally{uploadsInFlight.delete(uploadKey);}
  }
  async function uploadVerifiedFile(upload:Upload&{blob:Blob},parent:string,uploadKey:string,context:DriveOperation):Promise<ProviderItem>{
    for(const [key,row] of repositoryUploads)if(row.parent!==parent&&!row.busy)repositoryUploads.delete(key);
    const saved=repositoryUploads.get(uploadKey);
    if(saved&&(saved.digest!==upload.digest||saved.size!==upload.blob.size))throw noRetry(new Error('An incomplete Study Director upload has different content for this identity.'));
    // A presumed-new identity is not proof of absence after an interrupted
    // upload or page restart. Check the remote logical identity before any
    // multipart POST or resumable session creation; only metadata is read.
    const existing=await findRepositoryFile(parent,upload.kind,upload.id,context);
    if(existing){
      const descriptor=repositoryDescriptor(existing,parent);if(descriptor.size!==upload.blob.size||descriptor.digest!==upload.digest||descriptor.serverDigest&&descriptor.serverDigest!==upload.digest)throw noRetry(new Error('A Study Director backup file with this identity already exists but has different content.'));
      await assertDriveOperationCurrent(context);repositoryUploads.delete(uploadKey);return descriptor;
    }
    let payload:DrivePayload|undefined,session:UploadSession|null=saved||null;
    try{
      if(upload.blob.size<=MULTIPART_UPLOAD_MAX_BYTES)payload=await uploadRepositoryMultipart(upload,parent,context);
      else{
        let recovered:UploadRecovery|null=null;
        if(session){
          const resumed=session;resumed.busy=true;
          try{recovered=await recoverUploadPosition(resumed.url,upload.blob.size,0,context);}
          catch(error){if(asDriveError(error).code!=='DRIVE_UPLOAD_SESSION_EXPIRED')throw error;repositoryUploads.delete(uploadKey);session=null;}
          if(session&&recovered&&recovered.offset<resumed.offset){repositoryUploads.delete(uploadKey);throw noRetry(new Error('Google Drive reported a regressed upload position. Retry the backup.'));}
          if(session&&recovered)resumed.offset=recovered.offset;
        }
        if(!session){
          if(repositoryUploads.size>=MAX_RETAINED_UPLOADS){const old=[...repositoryUploads].find(([,row])=>!row.busy);if(!old)throw new Error('Google Drive upload continuation capacity is busy. Retry later.');repositoryUploads.delete(old[0]);}
          session={parent,digest:upload.digest,size:upload.blob.size,url:await beginRepositoryUpload(upload,parent,context),offset:0,busy:true};repositoryUploads.set(uploadKey,session);
        }
        const activeSession=session;payload=recovered?.complete?jsonResponse(recovered.response):await uploadContent(activeSession.url,upload.blob,'application/octet-stream',recovered?.offset||0,context,offset=>{activeSession.offset=offset;});
      }
    }catch(error){
      if(operationStopped(error))throw error;
      const recovered=await findRepositoryFile(parent,upload.kind,upload.id,context);if(recovered){const descriptor=repositoryDescriptor(recovered,parent);if(descriptor.size===upload.blob.size&&descriptor.digest===upload.digest&&(!descriptor.serverDigest||descriptor.serverDigest===upload.digest)){await assertDriveOperationCurrent(context);repositoryUploads.delete(uploadKey);return descriptor;}}
      throw error;
    }finally{if(session)session.busy=false;}
    await assertDriveOperationCurrent(context);
    const responseDigest=String(payload&&payload.sha256Checksum||'').toLowerCase();
    let metadata=payload&&validRepositoryMetadata(payload,parent,upload.kind)&&/^[a-f0-9]{64}$/u.test(responseDigest)?payload:null;
    if(!metadata){const remoteId=String(payload&&payload.id||'');metadata=remoteId?await getFileMetadata(remoteId,context):await findRepositoryFile(parent,upload.kind,upload.id,context);}
    if(!metadata||!validRepositoryMetadata(metadata,parent,upload.kind))throw new Error('Google Drive did not confirm the backup upload.');
    const descriptor=repositoryDescriptor(metadata,parent);if(descriptor.id!==upload.id||descriptor.size!==upload.blob.size||descriptor.digest!==upload.digest||!descriptor.serverDigest||descriptor.serverDigest!==upload.digest)throw noRetry(new Error('Google Drive server SHA-256 did not confirm the uploaded backup bytes.'));
    await assertDriveOperationCurrent(context);repositoryUploads.delete(uploadKey);return descriptor;
  }
  async function repositoryDownload(ref:ItemRef,options:DriveDownloadOptions={},baseContext:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<RangeDownload|BlobDownload>{
    if(!ref||!REPOSITORY_KINDS.has(ref['kind'])||!repositoryIdValid(ref['kind'],ref.id))throw new Error('A Study Director backup download has an invalid identity.');
    const context=childDriveOperationContext(baseContext,{signal:options.signal??null});
    const parent=await ensureFolder(context),scope=repositoryVerificationScope(parent),trustedListedRef=!!(ref['remoteId']&&ref['verificationScope']===scope&&Number.isSafeInteger(Number(ref.size))&&Number(ref.size)>0&&/^[a-f0-9]{64}$/u.test(String(ref.digest||''))&&String(ref['remoteId']).length<=256);
    let metadata:DriveFile|null=null;
    if(trustedListedRef)metadata=parseDriveFile({id:String(ref['remoteId']),size:String(Number(ref.size))});
    else if(ref['remoteId']){const candidate=await getFileMetadata(String(ref['remoteId']),context);if(validRepositoryMetadata(candidate,parent,ref['kind'])&&candidate.appProperties[REPOSITORY_ID_MARKER]===ref.id)metadata=candidate;}
    if(!metadata)metadata=await findRepositoryFile(parent,ref['kind'],ref.id,context);
    if(!metadata){const error=asDriveError(new Error('A file required by this backup version is missing from Google Drive.'));error.code='REPOSITORY_OBJECT_MISSING';throw error;}
    if(!trustedListedRef){const descriptor=repositoryDescriptor(metadata,parent);if(ref.size&&descriptor.size!==Number(ref.size))throw noRetry(new Error('A Google Drive backup file changed size unexpectedly.'));if(ref.digest&&descriptor.digest!==String(ref.digest))throw noRetry(new Error('Google Drive backup verification metadata changed unexpectedly.'));}
    if(Object.hasOwn(options,'offset')){
      const offset=Number(options.offset),length=Number(options.length),total=Number(metadata.size);
      if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||length<1||length>1024*1024||offset+length>total)throw new Error('Repository download range is invalid.');
      // Re-read metadata on every segment; a changed immutable object restarts
      // verification instead of combining bytes from different versions.
      const current=await getFileMetadata(metadata.id,context),descriptor=repositoryDescriptor(current,parent);
      if(!validRepositoryMetadata(current,parent,ref['kind'])||current.appProperties[REPOSITORY_ID_MARKER]!==ref.id||descriptor.size!==total||descriptor.digest!==ref.digest)throw new Error('Repository range identity is unavailable or changed.');
      const response=await authorizedFetch(`${DRIVE_API}/files/${encodeURIComponent(metadata.id)}?alt=media`,{headers:{Range:`bytes=${offset}-${offset+length-1}`}},TRANSFER_TIMEOUT_MS,context);
      if(response.status!==206||response.headers.get('Content-Range')!==`bytes ${offset}-${offset+length-1}/${total}`)throw new Error('Google Drive did not return the requested backup range.');
      const reader=response.body?.getReader();if(!reader)throw new Error('Google Drive range body is unavailable.');
      let timer:ReturnType<typeof setTimeout>|undefined,abort:(()=>void)|undefined,stall:(()=>void)|undefined,loaded=0;const parts:Blob[]=[];
      const renew=()=>{if(timer!==undefined)clearTimeout(timer);timer=setTimeout(()=>stall?.(),TRANSFER_TIMEOUT_MS);};
      const stopped=new Promise<never>((_,reject)=>{const stop=(error:unknown)=>{void reader.cancel().catch(()=>{});reject(error);};abort=()=>stop(driveAbortError(context.signal));stall=()=>stop(timeoutError('Google Drive range download'));context.signal?.addEventListener('abort',abort,{once:true});renew();if(context.signal?.aborted)abort();});
      try{for(let chunks=0;;chunks++){const part=await Promise.race([reader.read(),stopped]);if(part.done)break;loaded+=part.value.byteLength;if(loaded>length||chunks>4096)throw new Error('Google Drive range exceeded its verified size.');if(part.value.byteLength)renew();parts.push(new Blob([part.value]));}}
      finally{if(timer!==undefined)clearTimeout(timer);if(abort)context.signal?.removeEventListener('abort',abort);void reader.cancel().catch(()=>{});}
      const blob=new Blob(parts);if(blob.size!==length)throw new Error('Google Drive returned an incomplete backup range.');
      const latest=repositoryDescriptor(await getFileMetadata(metadata.id,context),parent);if(latest.remoteVersion!==descriptor.remoteVersion)throw new Error('The repository object changed while reading a range.');
      return Object.freeze({blob,totalBytes:total,version:descriptor.remoteVersion});
    }
    const blob=await downloadBlob(metadata,context,typeof options.onProgress==='function'?options.onProgress:null);
    try{await assertDriveOperationCurrent(context);}
    catch(error){await releaseFile(blob);throw error;}
    return Object.freeze({blob,release:async()=>releaseFile(blob)});
  }
  async function repositoryDelete(ref:ItemRef,options:{signal?:AbortSignal|null}={},baseContext:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<boolean>{
    if(!ref||!REPOSITORY_KINDS.has(ref['kind'])||!repositoryIdValid(ref['kind'],ref.id))throw new Error('A Study Director backup deletion request has an invalid identity.');
    const context=childDriveOperationContext(baseContext,{signal:options.signal??null});
    const parent=await ensureFolder(context);let metadata:DriveFile|null=null;
    if(ref['remoteId']){const candidate=await getFileMetadata(String(ref['remoteId']),context).catch(error=>{if(Number(asDriveError(error).driveStatus)===404)return null;throw error;});if(candidate&&validRepositoryMetadata(candidate,parent,ref['kind'])&&candidate.appProperties[REPOSITORY_ID_MARKER]===ref.id)metadata=candidate;}
    if(!metadata)metadata=await findRepositoryFile(parent,ref['kind'],ref.id,context);if(!metadata)return false;
    const descriptor=repositoryDescriptor(metadata,parent);if(ref.remoteVersion&&descriptor.remoteVersion!==String(ref.remoteVersion))throw noRetry(new Error('A Study Director backup file changed version before deletion. Nothing was removed.'));if(ref.digest&&descriptor.digest!==String(ref.digest))throw noRetry(new Error('A Study Director backup file changed before deletion. Nothing was removed.'));
    const response=await authorizedFetch(`${DRIVE_API}/files/${encodeURIComponent(metadata.id)}`,{method:'DELETE'},API_TIMEOUT_MS,context);if(!response.ok&&response.status!==404)throw await apiError(response,'Could not remove an unused Study Director backup file from Google Drive.');return true;
  }
  async function repositoryList(options:RepositoryListOptions,baseContext:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<{items:readonly ProviderItem[];overflow:boolean;ignored:number}>{
    const context=childDriveOperationContext(baseContext,{signal:options.signal});
    // Retention is a target, not an inventory limit: blocked cleanup can leave
    // more physical versions. Read every history page before authorizing it.
    const kind=options.kind;return await listRepositoryFiles(kind,{limit:['checkpoint','commit'].includes(kind)?Number.POSITIVE_INFINITY:100000},context);
  }
  function beginRepositoryOperation(options:{signal?:AbortSignal|null|undefined;checkProtection?:DriveCheck|null}={}):RepositoryTransport{
    const base=driveOperationContext({signal:options.signal,checkProtection:options.checkProtection});
    const transport=repositoryTransport(base);
    const operationTransport:RepositoryTransport={...transport,
      endPublication:(ref:Lease)=>endRepositoryPublication(ref,Object.freeze({...base,signal:null,checkProtection:null,checkSource:null})),
      endMaintenance:(ref:Lease)=>endRepositoryMaintenance(ref,Object.freeze({...base,signal:null,checkProtection:null,checkSource:null}))
    };
    return Object.freeze(operationTransport);
  }
  function finiteSize(value:unknown):number|null{const size=Number(value);return Number.isFinite(size)&&size>=0?size:null;}
  function exactParent(file:DriveFile|null|undefined,parent:string):boolean{return !!(file&&parent&&file.parents.length===1&&file.parents[0]===parent);}
  function receivedOffset(response:Response,totalBytes:number):number{
    const raw=String(response&&response.headers&&response.headers.get('Range')||'');
    const match=raw.match(/^bytes=0-(\d+)$/i);
    const offset=match?Number(match[1]??'')+1:0;
    if(!Number.isSafeInteger(offset)||offset<0||offset>totalBytes)throw noRetry(new Error('Google Drive returned an invalid upload position.'));
    return offset;
  }
  async function queryUploadStatus(uploadUrl:string,totalBytes:number,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<Response>{
    return authorizedFetch(uploadUrl,{method:'PUT',headers:{'Content-Range':`bytes */${totalBytes}`}},TRANSFER_TIMEOUT_MS,context);
  }
  async function recoverUploadPosition(uploadUrl:string,totalBytes:number,attempt:number,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<UploadRecovery>{
    let lastError:unknown=null;
    for(let retry=0;retry<MAX_TRANSIENT_ATTEMPTS;retry++){
      try{
        const status=await queryUploadStatus(uploadUrl,totalBytes,context);
        if(status.status===200||status.status===201)return {complete:true,response:status,offset:totalBytes};
        if(status.status===308)return {complete:false,response:status,offset:receivedOffset(status,totalBytes)};
        if(status.status===404)throw noRetry(Object.assign(new Error('The Google Drive upload session expired. Retry the backup.'),{code:'DRIVE_UPLOAD_SESSION_EXPIRED'}));
        if(!await retryableResponse(status))throw noRetry(await apiError(status,'Could not recover the Google Drive upload.'));
        lastError=await apiError(status,'Google Drive is temporarily unavailable.');
        await delay(retryDelay(status,attempt+retry));
      }catch(error){
        lastError=error;
        if(operationStopped(error)||asDriveError(error).studyDirectorDriveNoRetry||/authorization|expired/i.test(asDriveError(error).message)||retry===MAX_TRANSIENT_ATTEMPTS-1)throw error;
        await delay(retryDelay(null,attempt+retry));
      }
    }
    throw lastError||new Error('Could not recover the Google Drive upload.');
  }
  async function uploadContent(uploadUrl:string,blob:Blob,mimeType:string,initialOffset=0,context:DriveOperation=EMPTY_DRIVE_OPERATION,onOffset:((offset:number)=>void)|null=null):Promise<DrivePayload>{
    const total=blob.size;
    if(!Number.isSafeInteger(total)||total<=0||total>maxBackupBytes)throw new Error('The prepared backup has an unsafe file size.');
    let offset=Math.max(0,Math.min(total,Number(initialOffset)||0)),transientAttempts=0,stalledRecoveries=0;
    const applyServerOffset=async(next:number,response:Response|null):Promise<void>=>{
      if(next<offset)throw new Error('Google Drive reported a regressed upload position. Retry the backup.');
      if(next===offset){
        stalledRecoveries+=1;
        if(stalledRecoveries>=MAX_TRANSIENT_ATTEMPTS)throw new Error('Google Drive did not advance the upload. Retry the backup.');
        await delay(retryDelay(response,stalledRecoveries));
      }else{
        stalledRecoveries=0;
        transientAttempts=0;
      }
      offset=next;
      onOffset?.(offset);
    };
    while(true){
      if(offset>=total)break;
      const end=Math.min(total,offset+UPLOAD_CHUNK_BYTES)-1;
      const body=blob.slice(offset,end+1,mimeType);
      let response:Response|null=null;
      try{
        response=await authorizedFetch(uploadUrl,{
          method:'PUT',
          headers:{'Content-Type':mimeType,'Content-Range':`bytes ${offset}-${end}/${total}`},
          body
        },TRANSFER_TIMEOUT_MS,context);
      }catch(error){
        if(operationStopped(error)||error&&/authorization/i.test(asDriveError(error).message))throw error;
        const recovered=await recoverUploadPosition(uploadUrl,total,transientAttempts++,context);
        if(recovered.complete)return jsonResponse(recovered.response);
        await applyServerOffset(recovered.offset,recovered.response);
        continue;
      }
      if(response.status===200||response.status===201)return jsonResponse(response);
      if(response.status===308){
        await applyServerOffset(receivedOffset(response,total),response);
        continue;
      }
      if(await retryableResponse(response)){
        const recovered=await recoverUploadPosition(uploadUrl,total,transientAttempts++,context);
        if(recovered.complete)return jsonResponse(recovered.response);
        await applyServerOffset(recovered.offset,recovered.response);
        continue;
      }
      throw await apiError(response,'Google Drive upload failed.');
    }
    const recovered=await recoverUploadPosition(uploadUrl,total,0,context);
    if(!recovered.complete)throw new Error('Google Drive did not confirm the completed upload.');
    return jsonResponse(recovered.response);
  }
  const FILE_FIELDS='id,name,size,version,modifiedTime,createdTime,mimeType,parents,ownedByMe,shared,trashed,sha256Checksum,appProperties,capabilities(canDownload)';
  async function getFileMetadata(id:string,context:DriveOperation=EMPTY_DRIVE_OPERATION):Promise<DriveFile>{
    const fields=FILE_FIELDS;
    const response=await authorizedGet(`${DRIVE_API}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`,{},context);
    if(!response.ok)throw await apiError(response,'Could not verify the Google Drive backup.');
    return jsonResponse(response);
  }
  async function readBoundedBlob(response:Response,expectedSize:unknown,context:DriveOperation=EMPTY_DRIVE_OPERATION,onProgress:((value:{loaded?:number;total?:number})=>void)|null=null):Promise<Blob>{
    const expected=finiteSize(expectedSize);
    if(expected===null||expected<=0||expected>maxBackupBytes)throw noRetry(new Error('The selected Google Drive backup has invalid size metadata.'));
    const rawLength=response.headers.get('Content-Length');
    if(rawLength!==null){
      const declared=finiteSize(rawLength);
      if(declared===null||declared!==expected)throw noRetry(new Error('The Google Drive download length does not match its verified metadata.'));
    }
    if(!receiveBackupStream||!response.body)throw noRetry(new Error('Streaming backup download is unavailable. Update Study Director.'));
    const streamOptions={signal:(context||EMPTY_DRIVE_OPERATION).signal,...typeof onProgress==='function'?{onProgress}:{}};return receiveBackupStream(response.body,expected,Object.freeze(streamOptions));
  }

  async function downloadBlob(metadata:DriveFile,context:DriveOperation=EMPTY_DRIVE_OPERATION,onProgress:((value:{loaded?:number;total?:number})=>void)|null=null):Promise<Blob>{
    const url=`${DRIVE_API}/files/${encodeURIComponent(metadata.id)}?alt=media`;
    let lastError:unknown=null;
    for(let attempt=0;attempt<MAX_TRANSIENT_ATTEMPTS;attempt++){
      try{
        const response=await authorizedFetch(url,{method:'GET'},TRANSFER_TIMEOUT_MS,context);
        if(await retryableResponse(response)){
          lastError=await apiError(response,'Google Drive is temporarily unavailable.');
          if(attempt<MAX_TRANSIENT_ATTEMPTS-1){await delay(retryDelay(response,attempt));continue;}
        }
        if(!response.ok)throw noRetry(await apiError(response,'Could not download the selected Google Drive backup.'));
        return await readBoundedBlob(response,metadata.size,context,onProgress);
      }catch(error){
        lastError=error;
        if(operationStopped(error)||(asDriveError(error).studyDirectorDriveNoRetry||/authorization/i.test(asDriveError(error).message))||attempt===MAX_TRANSIENT_ATTEMPTS-1)throw error;
        await delay(retryDelay(null,attempt));
      }
    }
    throw lastError||new Error('Could not download the selected Google Drive backup.');
  }
  async function release():Promise<void>{if(accessToken&&Date.now()>=tokenExpiresAt)expireSession();}
  async function disconnect():Promise<void>{
    await prepare();
    const token=requireAccessToken(),generation=authorizationGeneration;
    const oauth=googleOAuth();
    if(!oauth)throw new Error('Google Drive disconnection is unavailable.');
    try{
      await new Promise<void>((resolve,reject)=>{
        let settled=false;
        const finish=(fn:(value?:unknown)=>void,value?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value);};
        const timer=setTimeout(()=>finish(reject,timeoutError('Google Drive disconnection')),REVOKE_TIMEOUT_MS);
        oauth.revoke(token,responseValue=>{
          const response=isRecord(responseValue)?responseValue:null;if(response?.['successful']===true){finish(()=>resolve());return;}
          finish(reject,new Error(String(response?.['error_description']||response?.['error']||'Google did not confirm permission revocation.')));
        });
      });
    }finally{if(authorizationGeneration===generation){repositoryUploads.clear();clearSession();signedInBefore=false;}}
  }
  function bindRepositoryDownload(base:DriveOperation):RepositoryTransport['download']{
    return ((ref:ItemRef,options?:DriveDownloadOptions)=>repositoryDownload(ref,options||{},base)) as RepositoryTransport['download'];
  }
  function rootRepositoryUpload(file:Upload,options:DriveOperationOptions={}):ReturnType<typeof repositoryUpload>{
    return repositoryUpload(file,driveOperationContext(options));
  }
  function rootRepositoryDelete(ref:ItemRef,options:{signal?:AbortSignal|null|undefined}={}):ReturnType<typeof repositoryDelete>{
    const normalized=options.signal===undefined?{}:{signal:options.signal};
    return repositoryDelete(ref,normalized,EMPTY_DRIVE_OPERATION);
  }
  function repositoryTransport(base:DriveOperation=EMPTY_DRIVE_OPERATION):RepositoryTransport{
    const root=base===EMPTY_DRIVE_OPERATION;
    const transport:RepositoryTransport={
      discardUploads:()=>repositoryUploads.clear(),
      list:opts=>repositoryList(opts,base),
      upload:root?rootRepositoryUpload:file=>repositoryUpload(file,base),
      download:bindRepositoryDownload(base),
      delete:root?rootRepositoryDelete:ref=>repositoryDelete(ref,{},base),
      beginPublication:()=>beginRepositoryPublication(base),
      listPublications:()=>listRepositoryPublications(base),
      assertPublication:ref=>assertRepositoryPublication(ref,base),
      renewPublication:ref=>renewRepositoryPublication(ref,base),
      endPublication:ref=>endRepositoryPublication(ref,base),
      beginMaintenance:()=>beginRepositoryMaintenance(base),
      listMaintenances:()=>listRepositoryMaintenances(base),
      assertMaintenance:ref=>assertRepositoryMaintenance(ref,base),
      renewMaintenance:ref=>renewRepositoryMaintenance(ref,base),
      endMaintenance:ref=>endRepositoryMaintenance(ref,base),
      now:driveNow,
      listSessionClaims:opts=>repositoryList(Object.freeze({...opts,kind:'session-claim'}),base),
      uploadSessionClaim:root?rootRepositoryUpload:file=>repositoryUpload(file,base),
      downloadSessionClaim:async(ref,options)=>{const progress=options?.onProgress;const downloadOptions:DriveDownloadOptions={signal:options?.signal??null,...progress?{onProgress:value=>progress({loaded:value.loaded??0,total:value.total??0,phase:'download'})}:{}};const result=await repositoryDownload(ref,downloadOptions,base);if('totalBytes' in result)throw new Error('Session claim download unexpectedly returned a byte range.');return result;},
      deleteSessionClaim:root?rootRepositoryDelete:ref=>repositoryDelete(ref,{},base),
      scope:()=>repositoryScope(base),
      beginOperation:options=>beginRepositoryOperation(options),
      historyReadConcurrency:8
    };
    return Object.freeze(transport);
  }
  function setup(apiValue:unknown):boolean{
    if(!isPluginApi(apiValue))return false;const api=apiValue;if(!supportsCapabilities(api,REQUIRED_CAPABILITIES))return false;
    const policy=api.backup.repositoryPolicy;
    const publicationMaxAgeMs=Number(policy['publicationMaxAgeMs']),publicationAssertionMarginMs=Number(policy['publicationAssertionMarginMs']),publicationRenewMs=Number(policy['publicationRenewMs']),publicationStaleMs=Number(policy['publicationStaleMs']),maintenanceMaxAgeMs=Number(policy['maintenanceMaxAgeMs']),maintenanceAssertionMarginMs=Number(policy['maintenanceAssertionMarginMs']);
    const metadataTimeoutMs=Number(policy['driveMetadataTimeoutMs']),driveMaintenanceMaxAgeMs=Number(policy['driveMaintenanceMaxAgeMs']),driveMaintenanceAssertionMarginMs=Number(policy['driveMaintenanceAssertionMarginMs']);
    if(![publicationMaxAgeMs,publicationAssertionMarginMs,publicationRenewMs,publicationStaleMs,maintenanceMaxAgeMs,maintenanceAssertionMarginMs,metadataTimeoutMs,driveMaintenanceMaxAgeMs,driveMaintenanceAssertionMarginMs].every(value=>Number.isFinite(value)&&value>0)||publicationAssertionMarginMs>=publicationMaxAgeMs||2*publicationRenewMs>=publicationStaleMs||publicationStaleMs>=publicationMaxAgeMs||maintenanceAssertionMarginMs>=maintenanceMaxAgeMs||driveMaintenanceAssertionMarginMs>=driveMaintenanceMaxAgeMs)return false;
    PUBLICATION_MAX_AGE_MS=publicationMaxAgeMs;PUBLICATION_ASSERTION_MARGIN_MS=publicationAssertionMarginMs;PUBLICATION_RENEW_MS=publicationRenewMs;PUBLICATION_STALE_MS=publicationStaleMs;API_TIMEOUT_MS=metadataTimeoutMs;MAINTENANCE_MAX_AGE_MS=driveMaintenanceMaxAgeMs;MAINTENANCE_ASSERTION_MARGIN_MS=driveMaintenanceAssertionMarginMs;
    const publishedLimit=Number(api.backup.limits.maxFileBytes);if(Number.isFinite(publishedLimit)&&publishedLimit>0)maxBackupBytes=publishedLimit;
    releaseFile=api.backup.releaseFile;receiveBackupStream=api.backup.receiveStream;profilePort=api.backup.profile;devicePort=api.backup.device;
    profilePort.controls?.(Object.freeze({deleteLibrary}));restoreSession();
    const providerConfig:ProviderConfig=Object.freeze({id:'google-drive',label:'Google Drive',shared:true,prepare,authorize,backgroundAvailable:()=>tokenValid()&&Platform.online(),connected:()=>tokenValid(),automaticConfigured:()=>tokenValid()||signedInBefore,connectionExpiresAt:()=>tokenValid()?tokenExpiresAt:0,subscribeConnection,disconnect,release,repository:repositoryTransport()});
    return api.backup.providers.register(providerConfig)!==false;
  }
  const PLUGIN_READY_EVENT='studydirector:ready';
  const PLUGIN_DESCRIPTOR:PluginDescriptor=Object.freeze({name:'SD-google-drive-backup',version:PLUGIN_VERSION,requires:REQUIRED_CAPABILITIES,setup});
  let registered=false;
  function connect():boolean{
    if(registered)return true;
    const register=(window as unknown as {StudyDirector?:{registerPlugin?:(descriptor:PluginDescriptor)=>unknown}}).StudyDirector?.registerPlugin;
    if(typeof register!=='function')return false;
    try{registered=register(PLUGIN_DESCRIPTOR)===true;}catch(error){}
    return registered;
  }
  if(!connect())window.addEventListener(PLUGIN_READY_EVENT,connect,{once:true});
})();
