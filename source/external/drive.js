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

  const PLUGIN_VERSION='@@SD_RELEASE@@';
  const GOOGLE_OAUTH_CLIENT_ID='@@SD_GOOGLE_OAUTH_CLIENT_ID@@';
  // Each profile on the device keeps its own sign-in (see the profile scope in app.html).
  const SESSION_KEY=window[Symbol.for('studyDirector.profileScope.v1')].scoped('@@SD_DRIVE_SESSION_STORAGE_KEY@@');
  const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
  const DRIVE_API='https://www.googleapis.com/drive/v3';
  const DRIVE_UPLOAD_API='https://www.googleapis.com/upload/drive/v3';
  const DRIVE_ORIGIN='https://www.googleapis.com';
  const GIS_SRC='https://accounts.google.com/gsi/client';
  const REPOSITORY_IDENTITIES=Object.freeze(@@SD_EXTERNAL_REPOSITORY_IDENTITIES@@);
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
  const REPOSITORY_KINDS=Object.freeze(new Set(['object','checkpoint','commit','session-claim']));
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
  const Platform=Object.freeze({
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
  const responsePayloads=new WeakMap();
  let gisPromise=null;
  let tokenClient=null;
  let accessToken='';
  let tokenExpiresAt=0,signedInBefore=false;
  let connectionExpiryTimer=null;
  const connectionListeners=new Set();
  let folderId='';
  // deletionChecked: the profile already checked for a deletion marker in this sign-in.
  let profilePort=null,devicePort=null,boundFolder='',seenFolder=null,deletionChecked='',libraryDeleted='';
  function thisDevice(){try{const id=String(devicePort?.()||'');return DEVICE_PATTERN.test(id)?id:'';}catch{return '';}}
  let folderEpoch=0;
  let folderResolutionFlight=null;
  let pendingAuthorization=null;
  let maxBackupBytes=DEFAULT_MAX_BACKUP_BYTES;
  const repositoryUploads=new Map(),MAX_RETAINED_UPLOADS=16;
  let releaseFile=async()=>{},receiveBackupStream=null;

  const EMPTY_DRIVE_OPERATION=Object.freeze({signal:null,checkProtection:null,checkSource:null,folderState:null});
  function driveOperationContext({signal=null,checkProtection=null,checkSource=null,folderState=null}={}){
    return Object.freeze({
      signal:signal&&typeof signal.addEventListener==='function'?signal:null,
      checkProtection:typeof checkProtection==='function'?checkProtection:null,
      checkSource:typeof checkSource==='function'?checkSource:null,
      folderState:folderState&&typeof folderState==='object'?folderState:{receipt:null}
    });
  }
  function childDriveOperationContext(base=EMPTY_DRIVE_OPERATION,{signal=null,checkProtection=null,checkSource=null}={}){
    const parent=base||EMPTY_DRIVE_OPERATION;
    return driveOperationContext({
      signal:signal&&typeof signal.addEventListener==='function'?signal:parent.signal,
      checkProtection:typeof checkProtection==='function'?checkProtection:parent.checkProtection,
      checkSource:typeof checkSource==='function'?checkSource:parent.checkSource,
      folderState:parent.folderState
    });
  }
  function invalidateFolderIdentity(){folderId='';boundFolder='';seenFolder=null;deletionChecked='';folderEpoch+=1;}
  function verifiedFolderReceipt(context=EMPTY_DRIVE_OPERATION){
    const state=context&&context.folderState,receipt=state&&state.receipt;
    if(!receipt)return '';
    if(!folderId||receipt.id!==folderId||receipt.epoch!==folderEpoch){state.receipt=null;return '';}
    return receipt.id;
  }
  function rememberVerifiedFolder(context,id){
    const value=String(id||''),state=context&&context.folderState;if(!value||!state)return value;
    state.receipt=Object.freeze({id:value,epoch:folderEpoch});return value;
  }
  async function assertDriveOperationCurrent(context=EMPTY_DRIVE_OPERATION){
    const operation=context||EMPTY_DRIVE_OPERATION;
    if(operation.signal&&operation.signal.aborted)throw noRetry(driveAbortError(operation.signal));
    await operation.checkProtection?.();
    await operation.checkSource?.();
    if(operation.signal&&operation.signal.aborted)throw noRetry(driveAbortError(operation.signal));
  }

  function requirePlatform(){
    if(!Platform.fetch||!Platform.Headers||!Platform.AbortController||!Platform.URL||!Platform.URLSearchParams||!Platform.Blob||!Platform.Uint8Array||!Platform.crypto||!Platform.crypto.subtle){
      throw new Error('This browser does not provide the secure web APIs required for Google Drive.');
    }
  }
  function supportsCapabilities(api,requirements){
    const capabilities=api&&api.capabilities;
    return !!capabilities&&Object.entries(requirements).every(([key,minimum])=>Number(capabilities[key]||0)>=Number(minimum));
  }
  function configuredClientId(){
    const value=String(GOOGLE_OAUTH_CLIENT_ID||'').trim();
    return value&&!value.includes('PASTE_')?value:'';
  }
  function configurationError(){
    return new Error('Google Drive is not configured. Add the production Web OAuth client ID in the release configuration and rebuild Study Director.');
  }
  function delay(ms){return new Promise(resolve=>{setTimeout(resolve,Math.max(0,Number(ms)||0));});}
  function timeoutError(label){return new Error(`${label} timed out. Check the connection and retry.`);}
  function driveAbortError(signal){
    const reason=signal&&signal.reason,error=reason instanceof Error?reason:new Error(String(reason||'Google Drive import was cancelled.'));
    if(!error.code)error.code='STUDY_DIRECTOR_IMPORT_CANCELLED';if(!error.name||error.name==='Error')error.name='AbortError';return error;
  }
  const operationStopped=error=>error?.name==='AbortError'||error?.code==='BACKUP_POLICY_CHANGED'||error?.code==='STUDY_DIRECTOR_IMPORT_CANCELLED';
  let signInPolicy;
  function loadScript(src){
    if(src!=='https://accounts.google.com/gsi/client')return Promise.reject(new TypeError('Unapproved sign-in script.'));
    if(globalThis.trustedTypes&&!signInPolicy)signInPolicy=globalThis.trustedTypes.createPolicy('sd-google-signin',{createScriptURL:value=>{if(value!=='https://accounts.google.com/gsi/client')throw new TypeError('Unapproved sign-in script.');return value;}});
    const existing=[...document.scripts].find(script=>script.src===src);
    if(existing&&window.google&&window.google.accounts&&window.google.accounts.oauth2)return Promise.resolve();
    if(existing)existing.remove();
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      let settled=false;
      const timer=setTimeout(()=>finish(reject,timeoutError('Google sign-in loading')),GIS_LOAD_TIMEOUT_MS);
      const finish=(fn,value)=>{
        if(settled)return;
        settled=true;clearTimeout(timer);
        script.onload=null;script.onerror=null;
        fn(value);
      };
      script.onload=()=>finish(resolve);
      script.onerror=()=>{script.remove();finish(reject,new Error('Google sign-in could not be loaded. Check the connection and retry.'));};
      script.src=signInPolicy?signInPolicy.createScriptURL(src):src;script.async=true;script.defer=true;script.referrerPolicy='strict-origin-when-cross-origin';document.head.appendChild(script);
    });
  }
  function notifyConnectionChange(){for(const listener of [...connectionListeners])try{listener();}catch{}}
  function clearConnectionExpiryTimer(){if(connectionExpiryTimer!==null){clearTimeout(connectionExpiryTimer);connectionExpiryTimer=null;}}
  function scheduleConnectionExpiry(){clearConnectionExpiryTimer();if(!accessToken||!tokenExpiresAt)return;const delay=Math.max(0,tokenExpiresAt-Date.now());connectionExpiryTimer=setTimeout(()=>{connectionExpiryTimer=null;if(!accessToken)return;if(Date.now()>=tokenExpiresAt)clearSession();else scheduleConnectionExpiry();},delay);}
  // The sign-in is kept in this browser until it expires (about an hour), so a
  // reload or reopening the app does not ask again. Other tabs pick it up too.
  function parseSession(raw){try{const value=JSON.parse(raw||'null');return value&&typeof value==='object'?value:null;}catch{return null;}}
  function usableSession(value){const expiresAt=Number(value&&value.expiresAt);return !!value&&typeof value.token==='string'&&!!value.token&&expiresAt>Date.now()+5000&&expiresAt<=Date.now()+7200000;}
  function storedSession(){try{return parseSession(window.localStorage.getItem(SESSION_KEY));}catch{return null;}}
  function rememberSession(){try{window.localStorage.setItem(SESSION_KEY,JSON.stringify({token:accessToken,expiresAt:tokenExpiresAt}));}catch{}}
  function forgetSession(token){if(token&&(storedSession()||{}).token===token)try{window.localStorage.removeItem(SESSION_KEY);}catch{}}
  function adoptSession(value){accessToken=value.token;tokenExpiresAt=Number(value.expiresAt);signedInBefore=true;scheduleConnectionExpiry();notifyConnectionChange();}
  function restoreSession(){
    const value=storedSession();
    if(usableSession(value))adoptSession(value);else try{window.localStorage.removeItem(SESSION_KEY);}catch{}
    try{window.addEventListener('storage',event=>{
      if(event.key!==SESSION_KEY)return;
      const next=parseSession(event.newValue);
      if(usableSession(next)){if(next.token!==accessToken)adoptSession(next);}
      else if(accessToken&&(parseSession(event.oldValue)||{}).token===accessToken)clearSession();
    });}catch{}
  }
  function clearAccessToken(){const changed=!!accessToken||tokenExpiresAt!==0;forgetSession(accessToken);clearConnectionExpiryTimer();accessToken='';tokenExpiresAt=0;if(changed)notifyConnectionChange();}
  function clearSession(){clearAccessToken();invalidateFolderIdentity();cancelFolderResolution();}
  function grantedScopeSet(response){return new Set(String(response&&response.scope||'').split(/\s+/).filter(Boolean));}
  function settleAuthorization(error,response){
    const pending=pendingAuthorization;
    pendingAuthorization=null;
    if(!pending)return;
    clearTimeout(pending.timer);
    if(error){clearSession();pending.reject(error);return;}
    if(!response||response.error){clearSession();pending.reject(new Error(response&&response.error_description||response&&response.error||'Google authorization was not completed.'));return;}
    const oauth=window.google&&window.google.accounts&&window.google.accounts.oauth2;
    const scopes=grantedScopeSet(response);
    if(!oauth||typeof oauth.hasGrantedAllScopes!=='function'||!oauth.hasGrantedAllScopes(response,DRIVE_SCOPE)||!scopes.has(DRIVE_SCOPE)){
      clearSession();pending.reject(new Error('Google Drive permission was not granted.'));return;
    }
    if(scopes.size!==1){
      clearSession();pending.reject(new Error('Google returned permissions beyond the requested Drive-file scope. Use a dedicated Study Director OAuth client.'));return;
    }
    if(response.token_type&&String(response.token_type).toLowerCase()!=='bearer'){
      clearSession();pending.reject(new Error('Google returned an unsupported authorization token.'));return;
    }
    accessToken=String(response.access_token||'');
    const lifetimeMs=Math.max(1,Number(response.expires_in)||3600)*1000;
    const safetyMs=Math.min(60000,Math.max(5000,Math.floor(lifetimeMs*0.1)));
    tokenExpiresAt=Date.now()+Math.max(1000,lifetimeMs-safetyMs);
    if(!accessToken){clearSession();pending.reject(new Error('Google did not return an access token.'));return;}
    signedInBefore=true;rememberSession();scheduleConnectionExpiry();notifyConnectionChange();pending.resolve(accessToken);
  }
  async function prepare(){
    requirePlatform();
    const clientId=configuredClientId();
    if(!clientId)throw configurationError();
    if(!gisPromise)gisPromise=loadScript(GIS_SRC).then(()=>{
      const oauth=window.google&&window.google.accounts&&window.google.accounts.oauth2;
      if(!oauth||typeof oauth.initTokenClient!=='function')throw new Error('Google sign-in is unavailable.');
      tokenClient=oauth.initTokenClient({
        client_id:clientId,
        scope:DRIVE_SCOPE,
        include_granted_scopes:false,
        prompt:'select_account',
        callback:response=>settleAuthorization(null,response),
        error_callback:detail=>{
          const type=String(detail&&detail.type||'');
          const message=type==='popup_failed_to_open'?'Google sign-in was blocked by the browser. Allow pop-ups and retry.':
            type==='popup_closed'?'Google authorization was cancelled.':'Google authorization could not be completed.';
          settleAuthorization(new Error(message));
        }
      });
    }).catch(error=>{gisPromise=null;tokenClient=null;throw error;});
    await gisPromise;
  }
  function tokenValid(){return !!accessToken&&Date.now()<tokenExpiresAt;}
  function subscribeConnection(listener){if(typeof listener!=='function')return ()=>{};connectionListeners.add(listener);return ()=>connectionListeners.delete(listener);}
  function authorize(){
    if(tokenValid())return Promise.resolve(accessToken);
    if(!tokenClient)return Promise.reject(new Error('Google Drive is still preparing. Try again in a moment.'));
    if(pendingAuthorization)return pendingAuthorization.promise;
    let resolve,reject;
    const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail;});
    const timer=setTimeout(()=>settleAuthorization(timeoutError('Google authorization')),AUTH_TIMEOUT_MS);
    pendingAuthorization={promise,resolve,reject,timer};
    try{tokenClient.requestAccessToken({include_granted_scopes:false,prompt:signedInBefore?'':'select_account'});}
    catch(error){settleAuthorization(error instanceof Error?error:new Error(String(error)));}
    return promise;
  }
  function requireAccessToken(){
    if(tokenValid())return accessToken;
    clearSession();
    throw new Error('Google authorization expired. Retry the Drive action.');
  }
  function parseDriveUrl(value){
    let url;
    try{url=new Platform.URL(String(value||''));}catch(error){throw new Error('Blocked an invalid Google Drive endpoint.');}
    if(url.protocol!=='https:'||url.origin!==DRIVE_ORIGIN||url.username||url.password||url.hash)throw new Error('Blocked an unexpected Google Drive endpoint.');
    return url;
  }
  function validatedDriveRequest(value,method='GET'){
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
  function validatedUploadSession(value){
    const url=parseDriveUrl(value);
    if(url.pathname!=='/upload/drive/v3/files'||url.searchParams.get('uploadType')!=='resumable'||!url.searchParams.get('upload_id')){
      throw new Error('Google Drive returned an invalid upload session.');
    }
    return url.href;
  }
  // Fetch exposes download streams but no upload byte progress. Use the
  // browser's asynchronous upload transport only for validated binary uploads.
  function uploadWithProgress(url,options,signal,progress){
    return new Promise((resolve,reject)=>{
      const xhr=new Platform.XMLHttpRequest();let settled=false,uploaded=0,downloaded=0;
      const finish=(error,response)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);xhr.onload=xhr.onerror=xhr.onabort=xhr.onprogress=null;xhr.upload.onprogress=null;error?reject(error):resolve(response);};
      const abort=()=>{xhr.abort();finish(signal.reason||Object.assign(new Error('Google Drive upload was stopped.'),{name:'AbortError'}));};
      try{
        xhr.open(options.method,url,true);xhr.withCredentials=false;
        for(const [key,value] of options.headers)xhr.setRequestHeader(key,value);
        xhr.upload.onprogress=event=>{if(event.loaded>uploaded){uploaded=event.loaded;progress();}};
        xhr.onprogress=event=>{if(event.loaded>downloaded){downloaded=event.loaded;progress();}};
        xhr.onerror=()=>finish(new TypeError('Google Drive upload connection failed.'));
        xhr.onabort=()=>finish(signal.reason||Object.assign(new Error('Google Drive upload was stopped.'),{name:'AbortError'}));
        xhr.onload=()=>{try{const headers=new Platform.Headers();for(const line of xhr.getAllResponseHeaders().trim().split(/[\r\n]+/u)){const colon=line.indexOf(':');if(colon>0)headers.append(line.slice(0,colon),line.slice(colon+1).trim());}finish(null,new Platform.Response(xhr.responseText||null,{status:xhr.status,headers}));}catch(error){finish(error);}};
        signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();else xhr.send(options.body);
      }catch(error){finish(error);}
    });
  }
  async function fetchWithTimeout(url,options,timeoutMs,context=EMPTY_DRIVE_OPERATION){
    const controller=new Platform.AbortController();
    const operation=context||EMPTY_DRIVE_OPERATION;
    const externalSignal=options&&options.signal||operation.signal;
    const abortFromExternal=()=>controller.abort();
    if(externalSignal){if(externalSignal.aborted)throw noRetry(driveAbortError(externalSignal));externalSignal.addEventListener('abort',abortFromExternal,{once:true});}
    let timer=null;const disarm=()=>{if(timer!==null){clearTimeout(timer);timer=null;}},renew=()=>{disarm();timer=setTimeout(()=>{timer=null;controller.abort();},Math.max(1000,Number(timeoutMs)||API_TIMEOUT_MS));};
    let bodyAbort=null;
    try{
      await assertDriveOperationCurrent(operation);renew();
      const progressUpload=Platform.XMLHttpRequest&&Platform.Response&&options.body instanceof Platform.Blob&&new Platform.URL(url).pathname==='/upload/drive/v3/files';
      const response=await (progressUpload?uploadWithProgress(url,options,controller.signal,renew):Platform.fetch(url,{...options,signal:controller.signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'}));
      const media=response.ok&&new Platform.URL(url).searchParams.get('alt')==='media';
      if(!media&&![204,308,401].includes(response.status)){
        const stopped=new Promise((_,reject)=>{
          bodyAbort=()=>reject(controller.signal.reason||Object.assign(new Error('Google Drive request was stopped.'),{name:'AbortError'}));
          controller.signal.addEventListener('abort',bodyAbort,{once:true});
          if(controller.signal.aborted)bodyAbort();
        });
        const payload=await Promise.race([response.json(),stopped]);
        if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.hasOwn(payload,'files')&&!Array.isArray(payload.files))throw noRetry(new Error('Google Drive could not confirm the backup information. Retry after the connection recovers.'));
        responsePayloads.set(response,payload);
      }else if(!media){void response.body?.cancel().catch(()=>{});}
      if(controller.signal.aborted)throw controller.signal.reason;
      disarm();await assertDriveOperationCurrent(operation);
      return response;
    }catch(error){
      if(externalSignal&&externalSignal.aborted)throw noRetry(driveAbortError(externalSignal));
      if(operationStopped(error)&&!controller.signal.aborted)throw noRetry(error);
      if(error&&error.name==='AbortError')throw timeoutError('Google Drive request');
      throw error;
    }finally{disarm();if(bodyAbort)controller.signal.removeEventListener('abort',bodyAbort);if(externalSignal)externalSignal.removeEventListener('abort',abortFromExternal);}
  }
  async function authorizedFetch(url,options={},timeoutMs=API_TIMEOUT_MS,context=EMPTY_DRIVE_OPERATION){
    const method=String(options.method||'GET').toUpperCase();
    const safeUrl=validatedDriveRequest(url,method);
    const token=requireAccessToken();
    const headers=new Platform.Headers(options.headers||{});
    headers.set('Authorization',`Bearer ${token}`);
    const response=await fetchWithTimeout(safeUrl,{...options,method,headers},timeoutMs,context);
    if(response.status===401){clearSession();throw new Error('Google authorization expired. Retry the Drive action.');}
    return response;
  }
  function transientStatus(status){return status===429||status===500||status===502||status===503||status===504;}
  async function retryableResponse(response){
    if(transientStatus(response&&response.status))return true;
    if(!response||response.status!==403)return false;
    const payload=jsonResponse(response);
    const reasons=(payload&&payload.error&&payload.error.errors||[]).map(item=>String(item&&item.reason||''));
    return reasons.some(reason=>['rateLimitExceeded','userRateLimitExceeded','backendError'].includes(reason));
  }
  function retryDelay(response,attempt){
    const raw=response&&response.headers&&response.headers.get('Retry-After');
    const seconds=Number(raw);
    if(Number.isFinite(seconds)&&seconds>0)return Math.min(5000,seconds*1000);
    const dateMs=raw?Date.parse(raw):NaN;
    if(Number.isFinite(dateMs)&&dateMs>Date.now())return Math.min(5000,dateMs-Date.now());
    return Math.min(4000,400*Math.pow(2,attempt));
  }
  function noRetry(error){if(error&&typeof error==='object')error.studyDirectorDriveNoRetry=true;return error;}
  async function authorizedGet(url,{attempts=MAX_TRANSIENT_ATTEMPTS,timeoutMs=API_TIMEOUT_MS}={},context=EMPTY_DRIVE_OPERATION){
    let lastError=null;
    for(let attempt=0;attempt<attempts;attempt++){
      try{
        const response=await authorizedFetch(url,{method:'GET'},timeoutMs,context);
        if(!await retryableResponse(response)||attempt===attempts-1)return response;
        lastError=await apiError(response,'Google Drive is temporarily unavailable.');
        await delay(retryDelay(response,attempt));
      }catch(error){
        lastError=error;
        if(operationStopped(error)||(error&&(error.studyDirectorDriveNoRetry||/authorization/i.test(error.message)))||attempt===attempts-1)throw error;
        await delay(retryDelay(null,attempt));
      }
    }
    throw lastError||new Error('Google Drive request failed.');
  }
  async function apiError(response,fallback){
    const payload=jsonResponse(response),message=payload&&payload.error&&payload.error.message||'';
    const error=new Error(message||fallback||`Google Drive request failed (${response.status}).`);
    Object.defineProperty(error,'driveStatus',{value:Number(response.status)||0,configurable:true});
    return error;
  }
  function driveQuery(parts){return parts.filter(Boolean).join(' and ');}
  function jsonResponse(response){
    if(!responsePayloads.has(response))throw noRetry(new Error('Google Drive backup information is unavailable.'));
    return responsePayloads.get(response);
  }
  function validFolderMetadata(folder){
    return !!(folder&&folder.id&&folder.mimeType===FOLDER_MIME&&folder.ownedByMe===true&&folder.shared===false&&folder.trashed===false&&
      folder.appProperties&&folder.appProperties[FOLDER_MARKER.key]===FOLDER_MARKER.value&&
      (!folder.capabilities||folder.capabilities.canAddChildren!==false));
  }
  async function getFolderMetadata(id,context=EMPTY_DRIVE_OPERATION){
    const fields='id,name,mimeType,ownedByMe,shared,trashed,appProperties,capabilities(canAddChildren)';
    const response=await authorizedGet(`${DRIVE_API}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`,{},context);
    if(!response.ok){if(response.status===403||response.status===404)invalidateFolderIdentity();throw await apiError(response,'Could not verify the Study Director backup folder.');}
    return await jsonResponse(response);
  }
  async function findFolder(context=EMPTY_DRIVE_OPERATION){
    if(folderId){
      let cached=null;
      try{cached=await getFolderMetadata(folderId,context);}
      catch(error){if(Number(error&&error.driveStatus)!==404)throw error;}
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
    const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);
    if(!response.ok)throw await apiError(response,'Could not find the Study Director backup folder.');
    const payload=await jsonResponse(response);
    const folders=Array.isArray(payload&&payload.files)?payload.files:[];
    if(folders.length>1){invalidateFolderIdentity();throw noRetry(new Error('More than one marked Study Director backup folder was found. Drive backup was stopped without choosing or deleting anything.'));}
    if(folders.length===1&&!validFolderMetadata(folders[0])){invalidateFolderIdentity();throw noRetry(new Error('The marked Study Director backup folder is shared, foreign-owned, trashed, or otherwise unsafe. Drive backup was stopped.'));}
    folderId=String(folders[0]&&folders[0].id||'');seenFolder=folders[0]||null;
    return folderId;
  }
  async function createFolder(context=EMPTY_DRIVE_OPERATION){
    const fields='id,name,mimeType,ownedByMe,shared,trashed,appProperties,capabilities(canAddChildren)';
    const response=await authorizedFetch(`${DRIVE_API}/files?fields=${encodeURIComponent(fields)}`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:libraryName(),mimeType:FOLDER_MIME,appProperties:{[FOLDER_MARKER.key]:FOLDER_MARKER.value,[PROFILE_MARKER]:expectedProfile()}})
    },API_TIMEOUT_MS,context);
    if(!response.ok)throw await apiError(response,'Could not create the Study Director backup folder.');
    const payload=await jsonResponse(response);
    if(!validFolderMetadata(payload)){invalidateFolderIdentity();throw noRetry(new Error('Google Drive did not confirm a private, owned Study Director backup folder.'));}
    folderId='';
    return await findFolder(context);
  }
  async function resolveFolder(context=EMPTY_DRIVE_OPERATION){
    const expected=expectedProfile();
    if(!expected)throw new Error('This profile is still starting. Try again in a moment.');
    if(libraryDeleted===expected)throw noRetry(Object.assign(new Error('This profile was deleted. Google Drive was not used.'),{studyDirectorProfileDeleted:true}));
    // Before its library is looked for (or made again), once per sign-in: was
    // this profile deleted on another device?
    if(deletionChecked!==expected){
      if(await deletionMarker(expected,context)){
        setTimeout(()=>{clearSession();signedInBefore=false;},0);
        Promise.resolve().then(()=>profilePort.deleted?.(Object.freeze({profile:expected}))).catch(()=>{});
        throw noRetry(Object.assign(new Error('This profile was deleted on another device. Google Drive was not used.'),{studyDirectorProfileDeleted:true}));
      }
      deletionChecked=expected;
    }
    const found=await findFolder(context)||await createFolder(context);
    await bindFolder(found,context);
    return found;
  }
  // The folder must belong to the active profile. Once per sign-in the app is
  // told the account and what the folder holds, and settles it: continue,
  // claim an unmarked folder, take the folder's profile, or refuse. A folder
  // marked by another profile on this device is always refused.
  function expectedProfile(){try{const id=String(profilePort.id()||'');return PROFILE_PATTERN.test(id)?id:'';}catch{return '';}}
  function folderProfile(folder){const id=String(folder&&folder.appProperties&&folder.appProperties[PROFILE_MARKER]||'');return PROFILE_PATTERN.test(id)?id:'';}
  async function bindFolder(id,context=EMPTY_DRIVE_OPERATION){
    const expected=expectedProfile();
    if(boundFolder===`${id}\n${expected}`)return;
    // The folder was just found or checked; its markers came with it.
    const metadata=seenFolder&&seenFolder.id===id?seenFolder:await getFolderMetadata(id,context),found=folderProfile(metadata),mine=found===expected;
    const [email,library]=await Promise.all([accountEmail(context),mine?null:latestLibrary(id,context)]);
    const decision=await profilePort.bind(Object.freeze({email,folder:String(id),found,mine,library}));
    if(mine&&decision==='continue'){}
    else if(!found&&decision==='claim')await markFolder(id,expected,context);
    else if(found&&decision==='adopt'&&expectedProfile()===found){}
    else{
      // Forget this sign-in so Connect offers the choice of account again.
      setTimeout(()=>{clearSession();signedInBefore=false;},0);
      throw noRetry(Object.assign(new Error(found?'This Google account holds the library of another profile. Drive was not used.':'This Google account already holds a Study Director library. Drive was not used.'),{studyDirectorProfileRefused:true}));
    }
    boundFolder=`${id}\n${expectedProfile()}`;
    // The folder is named after its profile ("Study Director – Ana") and
    // follows a rename; only its properties say whose it is.
    const name=libraryName();if(name&&metadata&&metadata.name!==name)await renameFolder(id,name,context).catch(()=>{});
  }
  function libraryName(){try{const name=String(profilePort.name()||'').trim();return name&&name.length<=200?name:FOLDER_NAME;}catch{return FOLDER_NAME;}}
  async function renameFolder(id,name,context=EMPTY_DRIVE_OPERATION){
    const response=await authorizedFetch(`${DRIVE_API}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent('id,name')}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})},API_TIMEOUT_MS,context);
    if(!response.ok)throw await apiError(response,'Could not rename the Study Director backup folder.');
  }
  // Deleting a profile everywhere leaves a marker: a small folder named
  // "Study Director – Ana (deleted)" carrying the profile id, which every
  // device checks for before it uses or makes that profile's library.
  async function deletionMarker(profile,context=EMPTY_DRIVE_OPERATION){
    const q=driveQuery([`mimeType='${FOLDER_MIME}'`,`appProperties has { key='${DELETED_MARKER}' and value='${profile}' }`,'trashed=false']);
    const params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'1',fields:'files(id)'});
    const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);
    if(!response.ok)throw await apiError(response,'Could not check whether this profile was deleted.');
    const payload=await jsonResponse(response);
    return Array.isArray(payload&&payload.files)&&payload.files.length>0;
  }
  // Delete everywhere: the marker first, so no device makes the library
  // again, then the library folder goes to the Drive Trash, where it can be
  // brought back for 30 days.
  async function deleteLibrary(){
    const expected=expectedProfile(),context=EMPTY_DRIVE_OPERATION;
    if(!expected)throw new Error('This profile is still starting.');
    if(!tokenValid())throw new Error('Sign in to Google Drive first.');
    if(!await deletionMarker(expected,context)){
      const response=await authorizedFetch(`${DRIVE_API}/files?fields=id`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`${libraryName()} (deleted)`,mimeType:FOLDER_MIME,appProperties:{[DELETED_MARKER]:expected}})},API_TIMEOUT_MS,context);
      if(!response.ok)throw await apiError(response,'Could not mark this profile as deleted in Google Drive.');
    }
    libraryDeleted=expected;repositoryUploads.clear();
    const id=await findFolder(context);
    if(id&&folderProfile(seenFolder)===expected){
      const response=await authorizedFetch(`${DRIVE_API}/files/${encodeURIComponent(id)}?fields=id`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})},API_TIMEOUT_MS,context);
      if(!response.ok)throw await apiError(response,'Could not move the library to the Google Drive Trash.');
    }
    invalidateFolderIdentity();
    return true;
  }
  async function markFolder(id,profile,context=EMPTY_DRIVE_OPERATION){
    const fields='id,name,mimeType,ownedByMe,shared,trashed,appProperties,capabilities(canAddChildren)';
    const response=await authorizedFetch(`${DRIVE_API}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({appProperties:{[PROFILE_MARKER]:profile}})},API_TIMEOUT_MS,context);
    if(!response.ok)throw await apiError(response,'Could not mark the Study Director backup folder for this profile.');
    const payload=await jsonResponse(response);
    if(!validFolderMetadata(payload)||folderProfile(payload)!==profile)throw noRetry(new Error('Google Drive did not confirm the profile of the Study Director backup folder.'));
  }
  // The signed-in Google account, shown by its email (one small request).
  async function accountEmail(context=EMPTY_DRIVE_OPERATION){
    const response=await authorizedGet(`${DRIVE_API}/about?fields=${encodeURIComponent('user(emailAddress)')}`,{},context);
    if(!response.ok)throw await apiError(response,'Could not read the Google account.');
    const email=String(jsonResponse(response)?.user?.emailAddress||'').trim().toLowerCase();
    return /^[^\s@]{1,128}@[^\s@]{1,190}$/u.test(email)?email:'';
  }
  // What the folder holds, for "Continue with your library": the newest
  // version's counts and time, or null when it holds none.
  async function latestLibrary(id,context=EMPTY_DRIVE_OPERATION){
    const q=driveQuery([`'${String(id).replaceAll("'","\\'")}' in parents`,`appProperties has { key='${REPOSITORY_MARKER.key}' and value='${REPOSITORY_MARKER.value}' }`,`appProperties has { key='${REPOSITORY_KIND_MARKER}' and value='commit' }`,'trashed=false']);
    const params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'1',orderBy:'createdTime desc',fields:'files(id,createdTime,appProperties)'});
    const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);
    if(!response.ok)throw await apiError(response,'Could not read the Study Director library on Google Drive.');
    const file=(jsonResponse(response).files||[])[0];if(!file)return null;
    const checkpoint=await latestCheckpoint(id,context),counts=/^(\d+),(\d+)$/u.exec(String(checkpoint?.appProperties?.[HISTORY_COUNTS_MARKER]||''));
    return Object.freeze({savedAt:String(file.createdTime||''),days:counts?Number(counts[1]):null,notes:counts?Number(counts[2]):null});
  }
  async function latestCheckpoint(id,context){
    const q=driveQuery([`'${String(id).replaceAll("'","\\'")}' in parents`,`appProperties has { key='${REPOSITORY_KIND_MARKER}' and value='checkpoint' }`,`appProperties has { key='${HISTORY_ROLE_MARKER}' and value='normal' }`,'trashed=false']);
    const params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'1',orderBy:'createdTime desc',fields:'files(id,createdTime,appProperties)'});
    const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);
    return response.ok?(jsonResponse(response).files||[])[0]||null:null;
  }
  function cancelFolderResolution(){
    const flight=folderResolutionFlight;
    if(!flight)return;
    folderResolutionFlight=null;
    if(!flight.settled)flight.controller.abort(new Error('Google Drive folder resolution was cancelled.'));
  }
  function startFolderResolution(){
    const controller=new Platform.AbortController(),context=driveOperationContext({signal:controller.signal});
    const flight={controller,promise:null,waiters:0,settled:false};
    const pending=resolveFolder(context);flight.promise=pending;folderResolutionFlight=flight;
    pending.then(()=>{flight.settled=true;if(folderResolutionFlight===flight)folderResolutionFlight=null;},()=>{flight.settled=true;if(folderResolutionFlight===flight)folderResolutionFlight=null;});
    return flight;
  }
  async function awaitFolderResolution(flight,context=EMPTY_DRIVE_OPERATION){
    const operation=context||EMPTY_DRIVE_OPERATION,signal=operation.signal;
    let abortListener=null;flight.waiters+=1;
    try{
      await assertDriveOperationCurrent(operation);
      let result;
      if(signal){
        result=await Promise.race([flight.promise,new Promise((_,reject)=>{
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
  async function ensureFolder(context=EMPTY_DRIVE_OPERATION){
    const operation=context||EMPTY_DRIVE_OPERATION;
    if(operation.signal&&operation.signal.aborted)throw noRetry(driveAbortError(operation.signal));
    const verified=verifiedFolderReceipt(operation);if(verified){await assertDriveOperationCurrent(operation);return verified;}
    const flight=folderResolutionFlight||startFolderResolution();
    const resolved=await awaitFolderResolution(flight,operation);
    return rememberVerifiedFolder(operation,resolved);
  }
  async function repositoryScope(context=EMPTY_DRIVE_OPERATION){return repositoryVerificationScope(await ensureFolder(context));}
  const REPOSITORY_FIELDS='id,name,size,version,modifiedTime,createdTime,mimeType,parents,ownedByMe,shared,trashed,sha256Checksum,appProperties,capabilities(canDownload)';
  function repositoryIdValid(kind,id){return kind==='object'?/^obj_[a-f0-9]{32}$/u.test(String(id||'')):['checkpoint','commit'].includes(kind)?/^cp_[a-f0-9]{32}$/u.test(String(id||'')):kind==='session-claim'?/^sc_[a-f0-9]{16}$/u.test(String(id||'')):false;}
  function repositoryFilename(kind,id){return String(id)+(kind==='object'?'.sdobject':kind==='commit'?'.sdcommit':kind==='session-claim'?'.sdsessionclaim':'.sdcheckpoint');}
  function validRepositoryMetadata(file,parent,kind=''){
    const properties=file&&file.appProperties||{},actualKind=String(properties[REPOSITORY_KIND_MARKER]||''),id=String(properties[REPOSITORY_ID_MARKER]||''),size=finiteSize(file&&file.size);
    if(kind&&actualKind!==kind)return false;
    return !!(file&&file.id&&REPOSITORY_KINDS.has(actualKind)&&repositoryIdValid(actualKind,id)&&file.name===repositoryFilename(actualKind,id)&&size!==null&&size>0&&size<=maxBackupBytes&&
      file.ownedByMe===true&&file.shared===false&&file.trashed===false&&exactParent(file,parent)&&file.appProperties&&properties[REPOSITORY_MARKER.key]===REPOSITORY_MARKER.value&&
      properties[REPOSITORY_VERSION_MARKER]===REPOSITORY_VERSION&&/^[a-f0-9]{64}$/u.test(String(properties[FILE_DIGEST_MARKER]||''))&&file.capabilities&&file.capabilities.canDownload===true);
  }
  function repositoryVerificationScope(parent){return `drive-repository:${REPOSITORY_VERSION}:${FILE_SECURITY_VERSION}:${String(parent)}`;}
  function repositoryDescriptor(file,parent){
    if(!validRepositoryMetadata(file,parent))throw noRetry(new Error('Google Drive returned unsafe Study Director backup metadata.'));
    const properties=file.appProperties,kind=String(properties[REPOSITORY_KIND_MARKER]),id=String(properties[REPOSITORY_ID_MARKER]);
    const serverDigest=/^[a-f0-9]{64}$/u.test(String(file.sha256Checksum||'').toLowerCase())?String(file.sha256Checksum).toLowerCase():'';
    let history=null;
    if(kind==='checkpoint'){
      const logicalFingerprint=String(properties[HISTORY_FINGERPRINT_MARKER]||'').toLowerCase(),countsMatch=/^(\d+),(\d+)$/u.exec(String(properties[HISTORY_COUNTS_MARKER]||'')),role=String(properties[HISTORY_ROLE_MARKER]||'normal'),protectedUntil=String(properties[HISTORY_PROTECTED_UNTIL_MARKER]||''),exportedAt=String(properties[REPOSITORY_IDENTITIES.driveExportedAtMarker]||file.createdTime||''),calendarMatch=/^(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}),(-?\d{1,4})$/u.exec(String(properties[HISTORY_CALENDAR_MARKER]||''));
      let calendar=null;
      if(calendarMatch&&Number.isFinite(Date.parse(exportedAt))){const localDate=calendarMatch[1],weekStart=calendarMatch[2],month=calendarMatch[3],utcOffsetMinutes=Number(calendarMatch[4]),localOrdinal=Math.floor(Date.parse(`${localDate}T00:00:00.000Z`)/86400000),weekOrdinal=Math.floor(Date.parse(`${weekStart}T00:00:00.000Z`)/86400000),offsetDate=new Date(Date.parse(exportedAt)+utcOffsetMinutes*60000).toISOString().slice(0,10);if(Number.isInteger(utcOffsetMinutes)&&Math.abs(utcOffsetMinutes)<=14*60&&month===localDate.slice(0,7)&&offsetDate===localDate&&Number.isFinite(localOrdinal)&&Number.isFinite(weekOrdinal)&&weekOrdinal<=localOrdinal&&localOrdinal-weekOrdinal<=6&&new Date(weekOrdinal*86400000).getUTCDay()===1)calendar=Object.freeze({localDate,weekStart,month,utcOffsetMinutes});}
      if(/^[a-f0-9]{64}$/u.test(logicalFingerprint)&&countsMatch&&['normal','before-restore'].includes(role)&&Number.isFinite(Date.parse(exportedAt))&&(!protectedUntil||Number.isFinite(Date.parse(protectedUntil))))history=Object.freeze({format:/^[1-9]\d{0,3}$/u.test(String(properties[HISTORY_FORMAT_MARKER]||''))?Number(properties[HISTORY_FORMAT_MARKER]):0,logicalFingerprint,exportedAt:new Date(exportedAt).toISOString(),counts:Object.freeze({dailyRecord:Number(countsMatch[1]),note:Number(countsMatch[2])}),encrypted:properties[HISTORY_ENCRYPTED_MARKER]==='1',retention:Object.freeze({role,protectedUntil:protectedUntil?new Date(protectedUntil).toISOString():'',calendar,notesFingerprint:/^[a-f0-9]{64}$/u.test(String(properties[HISTORY_NOTES_MARKER]||''))?String(properties[HISTORY_NOTES_MARKER]):''}),origin:ORIGIN_PATTERN.test(String(properties[HISTORY_ORIGIN_MARKER]||''))?String(properties[HISTORY_ORIGIN_MARKER]):'',attachmentsMissing:/^\d{1,6}$/u.test(String(properties[HISTORY_ATTACHMENTS_MISSING_MARKER]||''))?Number(properties[HISTORY_ATTACHMENTS_MISSING_MARKER]):0});
    }
    return Object.freeze({kind,id,remoteId:String(file.id),remoteVersion:String(file.version||''),verificationScope:repositoryVerificationScope(parent),name:String(file.name),size:Number(file.size),createdAt:String(file.createdTime||''),modifiedAt:String(file.modifiedTime||''),digest:String(properties[FILE_DIGEST_MARKER]||''),serverDigest,history});
  }
  function coordinationVerificationScope(parent){return `drive:${folderEpoch}:${String(parent)}`;}
  function publicationIdValid(id){return /^pub_[a-f0-9]{32}$/u.test(String(id||''));}
  function publicationFilename(id){return String(id)+'.sdpublication';}
  function validPublicationMetadata(file,parent){
    const properties=file&&file.appProperties||{},id=String(properties[REPOSITORY_ID_MARKER]||'');
    return !!(file&&file.id&&publicationIdValid(id)&&file.name===publicationFilename(id)&&file.ownedByMe===true&&file.shared===false&&file.trashed===false&&exactParent(file,parent)&&
      properties[REPOSITORY_MARKER.key]===REPOSITORY_MARKER.value&&properties[REPOSITORY_VERSION_MARKER]===REPOSITORY_VERSION&&properties[REPOSITORY_KIND_MARKER]===PUBLICATION_KIND);
  }
  function publicationDescriptor(file,parent){
    if(!validPublicationMetadata(file,parent))throw noRetry(new Error('Google Drive returned unsafe Study Director publication metadata.'));
    const id=String(file.appProperties[REPOSITORY_ID_MARKER]),createdAt=String(file.createdTime||''),device=thisDevice();
    const writer=String(file.appProperties[PUBLICATION_DEVICE_MARKER]||'');
    return Object.freeze({kind:PUBLICATION_KIND,id,device:DEVICE_PATTERN.test(writer)?writer:'',sameDevice:!!device&&writer===device,renews:file.appProperties[PUBLICATION_RENEWS_MARKER]==='1',startedAt:Number.isFinite(Date.parse(String(file.appProperties[PUBLICATION_STARTED_MARKER]||'')))?new Date(Date.parse(file.appProperties[PUBLICATION_STARTED_MARKER])).toISOString():createdAt,remoteId:String(file.id),verificationScope:coordinationVerificationScope(parent),name:String(file.name),createdAt,modifiedAt:String(file.modifiedTime||''),expiresAt:Number.isFinite(Date.parse(createdAt))?new Date(Date.parse(createdAt)+PUBLICATION_MAX_AGE_MS).toISOString():''});
  }
  function trustedCoordinationRemoteId(ref,parent,kind,idValid){
    const id=String(ref&&ref.id||''),remoteId=String(ref&&ref.remoteId||''),scope=String(ref&&ref.verificationScope||'');
    return ref&&ref.kind===kind&&idValid(id)&&remoteId&&remoteId.length<=512&&scope===coordinationVerificationScope(parent)?remoteId:'';
  }
  function ambiguousDriveMutation(error){
    if(!error||operationStopped(error)||error.studyDirectorDriveNoRetry||/authorization/i.test(String(error.message||'')))return false;
    const status=Number(error.driveStatus)||0;return status===0||transientStatus(status);
  }
  async function recoverCreatedCoordinationMarker(parent,id,findMarker,context,error){
    if(!ambiguousDriveMutation(error))throw error;
    const recovered=await findMarker(parent,id,context);if(recovered)return recovered;throw error;
  }
  async function deleteCoordinationMarker(metadata,{parent,id,findMarker,context,label}){
    let current=metadata,lastError=null;
    for(let attempt=0;attempt<2;attempt++){
      let response=null;
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
  async function findRepositoryPublication(parent,id,context=EMPTY_DRIVE_OPERATION){
    if(!publicationIdValid(id))throw noRetry(new Error('A Study Director publication marker has an invalid identity.'));
    const q=driveQuery([
      `'${String(parent).replaceAll("'","\\'")}' in parents`,
      `appProperties has { key='${REPOSITORY_MARKER.key}' and value='${REPOSITORY_MARKER.value}' }`,
      `appProperties has { key='${REPOSITORY_KIND_MARKER}' and value='${PUBLICATION_KIND}' }`,
      `appProperties has { key='${REPOSITORY_ID_MARKER}' and value='${String(id).replaceAll("'","\\'")}' }`,
      'trashed=false'
    ]);
    const params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'3',fields:`nextPageToken,files(${REPOSITORY_FIELDS})`});
    const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);if(!response.ok)throw await apiError(response,'Could not verify the Study Director backup publication marker.');
    const payload=await jsonResponse(response),files=(Array.isArray(payload&&payload.files)?payload.files:[]).filter(file=>validPublicationMetadata(file,parent)&&file.appProperties[REPOSITORY_ID_MARKER]===id);
    if(payload&&payload.nextPageToken||files.length>1)throw noRetry(new Error('Duplicate Study Director backup publication markers were found. Maintenance stopped safely.'));
    return files[0]||null;
  }
  // Drive's clock, learned from the markers this device creates (Drive
  // stamps their creation time). Marker ages are measured on it, so a device
  // whose own clock is wrong neither removes another device's live upload
  // marker nor waits for one that ended long ago. Until a marker is created
  // it is this device's clock.
  let driveClockOffset=0;
  function learnDriveClock(file,sentAt,receivedAt){
    const created=Date.parse(String(file&&file.createdTime||''));
    if(Number.isFinite(created)&&receivedAt>=sentAt&&receivedAt-sentAt<=30000)driveClockOffset=created-(sentAt+receivedAt)/2;
  }
  function driveNow(){return Date.now()+driveClockOffset;}
  async function beginRepositoryPublication(baseContext=EMPTY_DRIVE_OPERATION,startedAt=''){
    // An upload's first marker records no start of its own: its creation
    // time on Drive is the start. Renewals carry that time forward.
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id='pub_'+Platform.crypto.randomUUID().replace(/-/gu,''),now=new Date().toISOString(),started=Number.isFinite(Date.parse(String(startedAt||'')))?new Date(Date.parse(startedAt)).toISOString():'';
    const metadata={name:publicationFilename(id),parents:[parent],mimeType:'application/octet-stream',appProperties:{
      [REPOSITORY_MARKER.key]:REPOSITORY_MARKER.value,[REPOSITORY_VERSION_MARKER]:REPOSITORY_VERSION,[REPOSITORY_KIND_MARKER]:PUBLICATION_KIND,[REPOSITORY_ID_MARKER]:id,
      [FILE_SECURITY_MARKER]:FILE_SECURITY_VERSION,[REPOSITORY_IDENTITIES.driveAppVersionMarker]:PLUGIN_VERSION,[REPOSITORY_IDENTITIES.driveExportedAtMarker]:now,[PUBLICATION_RENEWS_MARKER]:'1',...(started?{[PUBLICATION_STARTED_MARKER]:started}:{}),
      ...(thisDevice()?{[PUBLICATION_DEVICE_MARKER]:thisDevice()}:{})
    }};
    let response=null,file=null;const sentAt=Date.now();
    try{response=await authorizedFetch(`${DRIVE_API}/files?fields=${encodeURIComponent(REPOSITORY_FIELDS)}`,{method:'POST',headers:{'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(metadata)},API_TIMEOUT_MS,context);}
    catch(error){file=await recoverCreatedCoordinationMarker(parent,id,findRepositoryPublication,context,error);}
    if(response&&!response.ok){const retryable=await retryableResponse(response),error=await apiError(response,'Could not establish a safe Google Drive backup publication marker.');if(!retryable)throw error;file=await findRepositoryPublication(parent,id,context);if(!file)throw error;}
    if(response&&response.ok){file=await jsonResponse(response);learnDriveClock(file,sentAt,Date.now());if(!file||!validPublicationMetadata(file,parent)){const remoteId=String(file&&file.id||'');file=remoteId?await getFileMetadata(remoteId,context):await findRepositoryPublication(parent,id,context);}}
    if(!file||!validPublicationMetadata(file,parent))throw noRetry(new Error('Google Drive did not confirm the backup publication marker.'));
    return publicationDescriptor(file,parent);
  }
  async function listRepositoryPublications(baseContext=EMPTY_DRIVE_OPERATION){
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),q=driveQuery([
      `'${String(parent).replaceAll("'","\\'")}' in parents`,
      `appProperties has { key='${REPOSITORY_MARKER.key}' and value='${REPOSITORY_MARKER.value}' }`,
      `appProperties has { key='${REPOSITORY_KIND_MARKER}' and value='${PUBLICATION_KIND}' }`,'trashed=false'
    ]),params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'100',fields:`nextPageToken,files(${REPOSITORY_FIELDS})`});
    const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);if(!response.ok)throw await apiError(response,'Could not inspect active Study Director backup publications.');
    const payload=await jsonResponse(response),raw=Array.isArray(payload&&payload.files)?payload.files:[],items=[];let ignored=0;
    for(const file of raw){if(validPublicationMetadata(file,parent))items.push(publicationDescriptor(file,parent));else ignored+=1;}
    return Object.freeze({items:Object.freeze(items),overflow:!!(payload&&payload.nextPageToken),ignored});
  }
  async function assertRepositoryPublication(ref,baseContext=EMPTY_DRIVE_OPERATION){
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id=String(ref&&ref.id||'');let metadata=null;
    if(ref&&ref.remoteId){const candidate=await getFileMetadata(ref.remoteId,context).catch(error=>{if(Number(error&&error.driveStatus)===404)return null;throw error;});if(candidate&&validPublicationMetadata(candidate,parent)&&candidate.appProperties[REPOSITORY_ID_MARKER]===id)metadata=candidate;}
    if(!metadata)metadata=await findRepositoryPublication(parent,id,context);if(!metadata)throw noRetry(new Error('The Google Drive backup publication marker disappeared before commit. Retry the backup.'));
    const descriptor=publicationDescriptor(metadata,parent),created=Date.parse(descriptor.createdAt);if(!Number.isFinite(created)||driveNow()-created>=PUBLICATION_MAX_AGE_MS-PUBLICATION_ASSERTION_MARGIN_MS)throw noRetry(new Error('The Google Drive backup publication marker is too old to safely begin another commit step. Retry the backup.'));
    return descriptor;
  }
  async function endRepositoryPublication(ref,baseContext=EMPTY_DRIVE_OPERATION){
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id=String(ref&&ref.id||'');if(!publicationIdValid(id))return false;let metadata=null;
    const trustedRemoteId=trustedCoordinationRemoteId(ref,parent,PUBLICATION_KIND,publicationIdValid);if(trustedRemoteId)metadata={id:trustedRemoteId};
    else if(ref&&ref.remoteId){const candidate=await getFileMetadata(ref.remoteId,context).catch(error=>{if(Number(error&&error.driveStatus)===404)return null;throw error;});if(candidate&&validPublicationMetadata(candidate,parent)&&candidate.appProperties[REPOSITORY_ID_MARKER]===id)metadata=candidate;}
    if(!metadata)metadata=await findRepositoryPublication(parent,id,context);if(!metadata)return false;
    return await deleteCoordinationMarker(metadata,{parent,id,findMarker:findRepositoryPublication,context,label:'Could not clear a completed Study Director backup publication marker.'});
  }

  // Drive markers never change, so renewal replaces the marker: a fresh one
  // first, then the old one goes. The old one must still be here and must not
  // be close to looking abandoned; otherwise cleanup may already have taken it
  // for abandoned, and the upload has to stop before it commits.
  async function renewRepositoryPublication(ref,baseContext=EMPTY_DRIVE_OPERATION){
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id=String(ref&&ref.id||'');
    if(!publicationIdValid(id))throw noRetry(new Error('A Study Director publication marker has an invalid identity.'));
    const next=await beginRepositoryPublication(context,ref&&ref.startedAt);
    try{
      const remoteId=trustedCoordinationRemoteId(ref,parent,PUBLICATION_KIND,publicationIdValid);
      const previous=remoteId?await getFileMetadata(remoteId,context).catch(error=>{if(Number(error&&error.driveStatus)===404)return null;throw error;}):await findRepositoryPublication(parent,id,context);
      const created=previous&&validPublicationMetadata(previous,parent)&&previous.appProperties[REPOSITORY_ID_MARKER]===id?Date.parse(String(previous.createdTime||'')):NaN;
      if(!Number.isFinite(created))throw noRetry(new Error('The Google Drive backup publication marker disappeared before commit. Retry the backup.'));
      if(driveNow()-created>=PUBLICATION_STALE_MS-PUBLICATION_RENEW_MS)throw noRetry(new Error('The Google Drive backup publication marker went too long without renewal. Retry the backup.'));
      await endRepositoryPublication(ref,context);return next;
    }catch(error){
      await endRepositoryPublication(next,driveOperationContext({folderState:context.folderState})).catch(()=>{});throw error;
    }
  }

  function maintenanceIdValid(id){return /^mnt_[a-f0-9]{32}$/u.test(String(id||''));}
  function maintenanceFilename(id){return String(id)+'.sdmaintenance';}
  function validMaintenanceMetadata(file,parent){
    const properties=file&&file.appProperties||{},id=String(properties[REPOSITORY_ID_MARKER]||'');
    return !!(file&&file.id&&maintenanceIdValid(id)&&file.name===maintenanceFilename(id)&&file.ownedByMe===true&&file.shared===false&&file.trashed===false&&exactParent(file,parent)&&
      properties[REPOSITORY_MARKER.key]===REPOSITORY_MARKER.value&&properties[REPOSITORY_VERSION_MARKER]===MAINTENANCE_VERSION&&properties[REPOSITORY_KIND_MARKER]===MAINTENANCE_KIND);
  }
  function maintenanceDescriptor(file,parent){
    if(!validMaintenanceMetadata(file,parent))throw noRetry(new Error('Google Drive returned unsafe Study Director maintenance metadata.'));
    const id=String(file.appProperties[REPOSITORY_ID_MARKER]),createdAt=String(file.createdTime||''),maxAge=MAINTENANCE_MAX_AGE_MS;
    const device=thisDevice();return Object.freeze({kind:MAINTENANCE_KIND,id,sameDevice:!!device&&file.appProperties[MAINTENANCE_DEVICE_MARKER]===device,remoteId:String(file.id),verificationScope:coordinationVerificationScope(parent),name:String(file.name),createdAt,modifiedAt:String(file.modifiedTime||''),expiresAt:Number.isFinite(Date.parse(createdAt))?new Date(Date.parse(createdAt)+maxAge).toISOString():''});
  }
  async function findRepositoryMaintenance(parent,id,context=EMPTY_DRIVE_OPERATION){
    if(!maintenanceIdValid(id))throw noRetry(new Error('A Study Director maintenance marker has an invalid identity.'));
    const q=driveQuery([
      `'${String(parent).replaceAll("'","\\'")}' in parents`,
      `appProperties has { key='${REPOSITORY_MARKER.key}' and value='${REPOSITORY_MARKER.value}' }`,
      `appProperties has { key='${REPOSITORY_KIND_MARKER}' and value='${MAINTENANCE_KIND}' }`,
      `appProperties has { key='${REPOSITORY_ID_MARKER}' and value='${String(id).replaceAll("'","\\'")}' }`,
      'trashed=false'
    ]);
    const params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'3',fields:`nextPageToken,files(${REPOSITORY_FIELDS})`});
    const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);if(!response.ok)throw await apiError(response,'Could not verify the Study Director repository-maintenance marker.');
    const payload=await jsonResponse(response),files=(Array.isArray(payload&&payload.files)?payload.files:[]).filter(file=>validMaintenanceMetadata(file,parent)&&file.appProperties[REPOSITORY_ID_MARKER]===id);
    if(payload&&payload.nextPageToken||files.length>1)throw noRetry(new Error('Duplicate Study Director repository-maintenance markers were found. Maintenance stopped safely.'));
    return files[0]||null;
  }
  async function beginRepositoryMaintenance(baseContext=EMPTY_DRIVE_OPERATION){
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id='mnt_'+Platform.crypto.randomUUID().replace(/-/gu,''),now=new Date().toISOString();
    const metadata={name:maintenanceFilename(id),parents:[parent],mimeType:'application/octet-stream',appProperties:{
      // Older clients classify this version as uncertain and defer. They must
      // not expire a network lease using their former 60-second lifetime.
      [REPOSITORY_MARKER.key]:REPOSITORY_MARKER.value,[REPOSITORY_VERSION_MARKER]:MAINTENANCE_VERSION,[REPOSITORY_KIND_MARKER]:MAINTENANCE_KIND,[REPOSITORY_ID_MARKER]:id,
      [FILE_SECURITY_MARKER]:FILE_SECURITY_VERSION,[REPOSITORY_IDENTITIES.driveAppVersionMarker]:PLUGIN_VERSION,[REPOSITORY_IDENTITIES.driveExportedAtMarker]:now,
      ...(thisDevice()?{[MAINTENANCE_DEVICE_MARKER]:thisDevice()}:{})
    }};
    let response=null,file=null;const sentAt=Date.now();
    try{response=await authorizedFetch(`${DRIVE_API}/files?fields=${encodeURIComponent(REPOSITORY_FIELDS)}`,{method:'POST',headers:{'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(metadata)},API_TIMEOUT_MS,context);}
    catch(error){file=await recoverCreatedCoordinationMarker(parent,id,findRepositoryMaintenance,context,error);}
    if(response&&!response.ok){const retryable=await retryableResponse(response),error=await apiError(response,'Could not establish safe Google Drive repository maintenance.');if(!retryable)throw error;file=await findRepositoryMaintenance(parent,id,context);if(!file)throw error;}
    if(response&&response.ok){file=await jsonResponse(response);learnDriveClock(file,sentAt,Date.now());if(!file||!validMaintenanceMetadata(file,parent)){const remoteId=String(file&&file.id||'');file=remoteId?await getFileMetadata(remoteId,context):await findRepositoryMaintenance(parent,id,context);}}
    if(!file||!validMaintenanceMetadata(file,parent))throw noRetry(new Error('Google Drive did not confirm the repository-maintenance marker.'));
    return maintenanceDescriptor(file,parent);
  }
  async function listRepositoryMaintenances(baseContext=EMPTY_DRIVE_OPERATION){
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),q=driveQuery([
      `'${String(parent).replaceAll("'","\\'")}' in parents`,
      `appProperties has { key='${REPOSITORY_MARKER.key}' and value='${REPOSITORY_MARKER.value}' }`,
      `appProperties has { key='${REPOSITORY_KIND_MARKER}' and value='${MAINTENANCE_KIND}' }`,'trashed=false'
    ]),params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'100',fields:`nextPageToken,files(${REPOSITORY_FIELDS})`});
    const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);if(!response.ok)throw await apiError(response,'Could not inspect active Study Director repository maintenance.');
    const payload=await jsonResponse(response),raw=Array.isArray(payload&&payload.files)?payload.files:[],items=[];let ignored=0;
    for(const file of raw){if(validMaintenanceMetadata(file,parent))items.push(maintenanceDescriptor(file,parent));else ignored+=1;}
    return Object.freeze({items:Object.freeze(items),overflow:!!(payload&&payload.nextPageToken),ignored});
  }
  async function assertRepositoryMaintenance(ref,baseContext=EMPTY_DRIVE_OPERATION){
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id=String(ref&&ref.id||'');let metadata=null;
    if(ref&&ref.remoteId){const candidate=await getFileMetadata(ref.remoteId,context).catch(error=>{if(Number(error&&error.driveStatus)===404)return null;throw error;});if(candidate&&validMaintenanceMetadata(candidate,parent)&&candidate.appProperties[REPOSITORY_ID_MARKER]===id)metadata=candidate;}
    if(!metadata)metadata=await findRepositoryMaintenance(parent,id,context);if(!metadata)throw noRetry(new Error('The Google Drive repository-maintenance marker disappeared during cleanup. Maintenance stopped safely.'));
    const descriptor=maintenanceDescriptor(metadata,parent),expires=Date.parse(descriptor.expiresAt),margin=MAINTENANCE_ASSERTION_MARGIN_MS;if(!Number.isFinite(expires)||driveNow()>=expires-margin)throw noRetry(new Error('The Google Drive repository-maintenance marker is too old to continue destructive cleanup safely.'));
    return descriptor;
  }
  async function endRepositoryMaintenance(ref,baseContext=EMPTY_DRIVE_OPERATION){
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id=String(ref&&ref.id||'');if(!maintenanceIdValid(id))return false;let metadata=null;
    const trustedRemoteId=trustedCoordinationRemoteId(ref,parent,MAINTENANCE_KIND,maintenanceIdValid);if(trustedRemoteId)metadata={id:trustedRemoteId};
    else if(ref&&ref.remoteId){const candidate=await getFileMetadata(ref.remoteId,context).catch(error=>{if(Number(error&&error.driveStatus)===404)return null;throw error;});if(candidate&&validMaintenanceMetadata(candidate,parent)&&candidate.appProperties[REPOSITORY_ID_MARKER]===id)metadata=candidate;}
    if(!metadata)metadata=await findRepositoryMaintenance(parent,id,context);if(!metadata)return false;
    return await deleteCoordinationMarker(metadata,{parent,id,findMarker:findRepositoryMaintenance,context,label:'Could not clear a completed Study Director repository-maintenance marker.'});
  }
  async function renewRepositoryMaintenance(ref,baseContext=EMPTY_DRIVE_OPERATION){
    const context=childDriveOperationContext(baseContext),parent=await ensureFolder(context),id=String(ref&&ref.id||'');
    if(!maintenanceIdValid(id))throw noRetry(new Error('Repository maintenance renewal has an invalid identity.'));
    // Rotate immutable markers with verified overlap. Missing or expired
    // protection invalidates the inventory instead of resuming deletion.
    const next=await beginRepositoryMaintenance(context);
    try{
      const remoteId=trustedCoordinationRemoteId(ref,parent,MAINTENANCE_KIND,maintenanceIdValid);
      const previous=remoteId?await getFileMetadata(remoteId,context).catch(error=>{if(Number(error&&error.driveStatus)===404)return null;throw error;}):await findRepositoryMaintenance(parent,id,context);
      const expires=previous&&validMaintenanceMetadata(previous,parent)?Date.parse(maintenanceDescriptor(previous,parent).expiresAt):NaN;
      if(!Number.isFinite(expires)||previous.appProperties[REPOSITORY_ID_MARKER]!==id||driveNow()>=expires)throw noRetry(new Error('Repository maintenance protection was interrupted. A fresh inventory is required.'));
      await endRepositoryMaintenance(ref,context);return next;
    }catch(error){
      await endRepositoryMaintenance(next,driveOperationContext({folderState:context.folderState})).catch(()=>{});throw error;
    }
  }
  async function listRepositoryFiles(kind,{limit=100000}={},context=EMPTY_DRIVE_OPERATION){
    if(!REPOSITORY_KINDS.has(kind))throw noRetry(new Error('Repository file kind is invalid.'));
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
      const payload=await jsonResponse(response),files=Array.isArray(payload&&payload.files)?payload.files:[];
      if(payload&&payload.incompleteSearch===true){overflow=true;break;}
      for(const file of files){if(validRepositoryMetadata(file,parent,kind)){items.push(repositoryDescriptor(file,parent));if(items.length>=limit){overflow=!!payload?.nextPageToken||files.indexOf(file)<files.length-1;break;}}else ignored+=1;}
      if(items.length>=limit)break;pageToken=String(payload&&payload.nextPageToken||'');
      if(pageToken){if(pageTokens.has(pageToken))throw noRetry(new Error('Google Drive repeated a backup inventory page. Nothing was changed.'));pageTokens.add(pageToken);}
      pages+=1;if(Number.isFinite(limit)&&pages>=100&&pageToken){overflow=true;break;}
    }while(pageToken);
    return Object.freeze({items:Object.freeze(items),overflow,ignored});
  }
  async function findRepositoryFile(parent,kind,id,context=EMPTY_DRIVE_OPERATION){
    if(!REPOSITORY_KINDS.has(kind)||!repositoryIdValid(kind,id))throw noRetry(new Error('A Study Director backup file has an invalid identity.'));
    const q=driveQuery([
      `'${String(parent).replaceAll("'","\\'")}' in parents`,
      `appProperties has { key='${REPOSITORY_MARKER.key}' and value='${REPOSITORY_MARKER.value}' }`,
      `appProperties has { key='${REPOSITORY_KIND_MARKER}' and value='${kind}' }`,
      `appProperties has { key='${REPOSITORY_ID_MARKER}' and value='${String(id).replaceAll("'","\\'")}' }`,
      'trashed=false'
    ]);
    const params=new Platform.URLSearchParams({q,spaces:'drive',pageSize:'3',fields:`nextPageToken,files(${REPOSITORY_FIELDS})`});
    const response=await authorizedGet(`${DRIVE_API}/files?${params}`,{},context);if(!response.ok)throw await apiError(response,'Could not locate a required Study Director backup file in Google Drive.');
    const payload=await jsonResponse(response),files=Array.isArray(payload&&payload.files)?payload.files:[];
    if(payload&&payload.nextPageToken||files.length>1)throw noRetry(new Error('Duplicate Study Director backup files were found. Nothing was changed.'));
    // A marked identity with unsafe metadata is *not* proof that the identity
    // is absent. Do not create a duplicate beside a malformed remote file.
    if(files.length&&(!validRepositoryMetadata(files[0],parent,kind)||files[0].appProperties[REPOSITORY_ID_MARKER]!==id))throw noRetry(new Error('Google Drive found a backup identity with unsafe metadata. Nothing was uploaded.'));
    return files[0]||null;
  }
  function repositoryUploadMetadata(file,parent){
    const properties={
      [REPOSITORY_MARKER.key]:REPOSITORY_MARKER.value,[REPOSITORY_VERSION_MARKER]:REPOSITORY_VERSION,[REPOSITORY_KIND_MARKER]:file.kind,[REPOSITORY_ID_MARKER]:file.id,
      [FILE_SECURITY_MARKER]:FILE_SECURITY_VERSION,[FILE_DIGEST_MARKER]:file.digest,[REPOSITORY_IDENTITIES.driveAppVersionMarker]:String(file.appVersion||PLUGIN_VERSION),[REPOSITORY_IDENTITIES.driveExportedAtMarker]:String(file.exportedAt||new Date().toISOString())
    };
    const history=file.kind==='checkpoint'&&file.historySummary&&typeof file.historySummary==='object'?file.historySummary:null;
    if(history){
      const fingerprint=String(history.logicalFingerprint||'').toLowerCase(),daily=Math.max(0,Math.floor(Number(history.counts&&history.counts.dailyRecord)||0)),notes=Math.max(0,Math.floor(Number(history.counts&&history.counts.note)||0)),role=String(history.retention&&history.retention.role||'normal'),protectedUntil=String(history.retention&&history.retention.protectedUntil||''),calendar=history.retention&&history.retention.calendar||null;
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
  async function beginRepositoryUpload(file,parent,context=EMPTY_DRIVE_OPERATION){
    const metadata=repositoryUploadMetadata(file,parent);
    const response=await authorizedFetch(`${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=${encodeURIComponent(REPOSITORY_FIELDS)}`,{
      method:'POST',headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'application/octet-stream','X-Upload-Content-Length':String(file.blob.size)},body:JSON.stringify(metadata)
    },API_TIMEOUT_MS,context);
    if(!response.ok)throw await apiError(response,'Could not begin the Google Drive backup upload.');
    const uploadUrl=response.headers.get('Location');if(!uploadUrl)throw noRetry(new Error('Google Drive did not provide a resumable backup upload session.'));
    return validatedUploadSession(uploadUrl);
  }
  async function uploadRepositoryMultipart(file,parent,context=EMPTY_DRIVE_OPERATION){
    const boundary='sd_'+Platform.crypto.randomUUID().replace(/-/gu,''),metadata=repositoryUploadMetadata(file,parent),prefix=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,suffix=`\r\n--${boundary}--\r\n`,body=new Blob([prefix,file.blob,suffix],{type:`multipart/related; boundary=${boundary}`});
    const response=await authorizedFetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=${encodeURIComponent(REPOSITORY_FIELDS)}`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body},TRANSFER_TIMEOUT_MS,context);
    if(!response.ok)throw await apiError(response,'Could not upload the Study Director backup to Google Drive.');
    return await jsonResponse(response);
  }
  async function repositoryUpload(file,baseContext=EMPTY_DRIVE_OPERATION){
    if(!file||!REPOSITORY_KINDS.has(file.kind)||!repositoryIdValid(file.kind,file.id)||!(file.blob instanceof Blob)||file.blob.size<=0||file.blob.size>maxBackupBytes||!/^[a-f0-9]{64}$/u.test(String(file.digest||'')))throw new Error('No safe Study Director backup payload was supplied to Google Drive.');
    const context=childDriveOperationContext(baseContext,{checkProtection:file.checkProtection,checkSource:file.checkSource});
    await assertDriveOperationCurrent(context);
    const parent=await ensureFolder(context),uploadKey=parent+':'+file.kind+':'+file.id;
    for(const [key,row] of repositoryUploads)if(row.parent!==parent&&!row.busy)repositoryUploads.delete(key);
    const saved=repositoryUploads.get(uploadKey);
    if(saved&&(saved.digest!==file.digest||saved.size!==file.blob.size))throw noRetry(new Error('An incomplete Study Director upload has different content for this identity.'));
    if(saved?.busy)throw noRetry(new Error('This Study Director backup file is already uploading.'));
    // A presumed-new identity is not proof of absence after an interrupted
    // upload or page restart. Check the remote logical identity before any
    // multipart POST or resumable session creation; only metadata is read.
    const existing=await findRepositoryFile(parent,file.kind,file.id,context);
    if(existing){
      const descriptor=repositoryDescriptor(existing,parent);if(descriptor.size!==file.blob.size||descriptor.digest!==file.digest||descriptor.serverDigest&&descriptor.serverDigest!==file.digest)throw noRetry(new Error('A Study Director backup file with this identity already exists but has different content.'));
      await assertDriveOperationCurrent(context);repositoryUploads.delete(uploadKey);return descriptor;
    }
    let payload,session=saved||null;
    try{
      if(file.blob.size<=MULTIPART_UPLOAD_MAX_BYTES)payload=await uploadRepositoryMultipart(file,parent,context);
      else{
        let recovered=null;
        if(session){
          session.busy=true;
          try{recovered=await recoverUploadPosition(session.url,file.blob.size,0,context);}
          catch(error){if(error?.code!=='DRIVE_UPLOAD_SESSION_EXPIRED')throw error;repositoryUploads.delete(uploadKey);session=null;}
          if(recovered&&recovered.offset<session.offset){repositoryUploads.delete(uploadKey);throw noRetry(new Error('Google Drive reported a regressed upload position. Retry the backup.'));}
          if(recovered)session.offset=recovered.offset;
        }
        if(!session){
          if(repositoryUploads.size>=MAX_RETAINED_UPLOADS){const old=[...repositoryUploads].find(([,row])=>!row.busy);if(!old)throw new Error('Google Drive upload continuation capacity is busy. Retry later.');repositoryUploads.delete(old[0]);}
          session={parent,digest:file.digest,size:file.blob.size,url:await beginRepositoryUpload(file,parent,context),offset:0,busy:true};repositoryUploads.set(uploadKey,session);
        }
        payload=recovered?.complete?await jsonResponse(recovered.response):await uploadContent(session.url,file.blob,'application/octet-stream',recovered?.offset||0,context,offset=>{session.offset=offset;});
      }
    }catch(error){
      if(operationStopped(error))throw error;
      const recovered=await findRepositoryFile(parent,file.kind,file.id,context);if(recovered){const descriptor=repositoryDescriptor(recovered,parent);if(descriptor.size===file.blob.size&&descriptor.digest===file.digest&&(!descriptor.serverDigest||descriptor.serverDigest===file.digest)){await assertDriveOperationCurrent(context);repositoryUploads.delete(uploadKey);return descriptor;}}
      throw error;
    }finally{if(session)session.busy=false;}
    await assertDriveOperationCurrent(context);
    const responseDigest=String(payload&&payload.sha256Checksum||'').toLowerCase();
    let metadata=payload&&validRepositoryMetadata(payload,parent,file.kind)&&/^[a-f0-9]{64}$/u.test(responseDigest)?payload:null;
    if(!metadata){const remoteId=String(payload&&payload.id||'');metadata=remoteId?await getFileMetadata(remoteId,context):await findRepositoryFile(parent,file.kind,file.id,context);}
    if(!metadata||!validRepositoryMetadata(metadata,parent,file.kind))throw new Error('Google Drive did not confirm the backup upload.');
    const descriptor=repositoryDescriptor(metadata,parent);if(descriptor.id!==file.id||descriptor.size!==file.blob.size||descriptor.digest!==file.digest||!descriptor.serverDigest||descriptor.serverDigest!==file.digest)throw noRetry(new Error('Google Drive server SHA-256 did not confirm the uploaded backup bytes.'));
    await assertDriveOperationCurrent(context);repositoryUploads.delete(uploadKey);return descriptor;
  }
  async function repositoryDownload(ref,options={},baseContext=EMPTY_DRIVE_OPERATION){
    if(!ref||!REPOSITORY_KINDS.has(ref.kind)||!repositoryIdValid(ref.kind,ref.id))throw new Error('A Study Director backup download has an invalid identity.');
    const context=childDriveOperationContext(baseContext,{signal:options&&options.signal});
    const parent=await ensureFolder(context),scope=repositoryVerificationScope(parent),trustedListedRef=!!(ref.remoteId&&ref.verificationScope===scope&&Number.isSafeInteger(Number(ref.size))&&Number(ref.size)>0&&/^[a-f0-9]{64}$/u.test(String(ref.digest||''))&&String(ref.remoteId).length<=256);
    let metadata=null;
    if(trustedListedRef)metadata={id:String(ref.remoteId),size:String(Number(ref.size))};
    else if(ref.remoteId){const candidate=await getFileMetadata(ref.remoteId,context);if(validRepositoryMetadata(candidate,parent,ref.kind)&&candidate.appProperties[REPOSITORY_ID_MARKER]===ref.id)metadata=candidate;}
    if(!metadata)metadata=await findRepositoryFile(parent,ref.kind,ref.id,context);
    if(!metadata){const error=new Error('A file required by this backup version is missing from Google Drive.');error.code='REPOSITORY_OBJECT_MISSING';throw error;}
    if(!trustedListedRef){const descriptor=repositoryDescriptor(metadata,parent);if(ref.size&&descriptor.size!==Number(ref.size))throw noRetry(new Error('A Google Drive backup file changed size unexpectedly.'));if(ref.digest&&descriptor.digest!==String(ref.digest))throw noRetry(new Error('Google Drive backup verification metadata changed unexpectedly.'));}
    if(Object.hasOwn(options,'offset')){
      const offset=options.offset,length=options.length,total=Number(metadata.size);
      if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||length<1||length>1024*1024||offset+length>total)throw new Error('Repository download range is invalid.');
      // Re-read metadata on every segment; a changed immutable object restarts
      // verification instead of combining bytes from different versions.
      const current=await getFileMetadata(metadata.id,context),descriptor=repositoryDescriptor(current,parent);
      if(!validRepositoryMetadata(current,parent,ref.kind)||current.appProperties[REPOSITORY_ID_MARKER]!==ref.id||descriptor.size!==total||descriptor.digest!==ref.digest)throw new Error('Repository range identity is unavailable or changed.');
      const response=await authorizedFetch(`${DRIVE_API}/files/${encodeURIComponent(metadata.id)}?alt=media`,{headers:{Range:`bytes=${offset}-${offset+length-1}`}},TRANSFER_TIMEOUT_MS,context);
      if(response.status!==206||response.headers.get('Content-Range')!==`bytes ${offset}-${offset+length-1}/${total}`)throw new Error('Google Drive did not return the requested backup range.');
      const reader=response.body?.getReader();if(!reader)throw new Error('Google Drive range body is unavailable.');
      let timer,abort,stall,loaded=0;const parts=[];
      const renew=()=>{clearTimeout(timer);timer=setTimeout(stall,TRANSFER_TIMEOUT_MS);};
      const stopped=new Promise((_,reject)=>{const stop=error=>{void reader.cancel().catch(()=>{});reject(error);};abort=()=>stop(driveAbortError(context.signal));stall=()=>stop(timeoutError('Google Drive range download'));context.signal?.addEventListener('abort',abort,{once:true});renew();if(context.signal?.aborted)abort();});
      try{for(let chunks=0;;chunks++){const part=await Promise.race([reader.read(),stopped]);if(part.done)break;loaded+=part.value.byteLength;if(loaded>length||chunks>4096)throw new Error('Google Drive range exceeded its verified size.');if(part.value.byteLength)renew();parts.push(part.value);}}
      finally{clearTimeout(timer);context.signal?.removeEventListener('abort',abort);void reader.cancel().catch(()=>{});}
      const blob=new Blob(parts);if(blob.size!==length)throw new Error('Google Drive returned an incomplete backup range.');
      const latest=repositoryDescriptor(await getFileMetadata(metadata.id,context),parent);if(latest.remoteVersion!==descriptor.remoteVersion)throw new Error('The repository object changed while reading a range.');
      return Object.freeze({blob,totalBytes:total,version:descriptor.remoteVersion});
    }
    const blob=await downloadBlob(metadata,context,typeof options.onProgress==='function'?options.onProgress:null);return Object.freeze({blob,release:()=>releaseFile(blob)});
  }
  async function repositoryDelete(ref,options={},baseContext=EMPTY_DRIVE_OPERATION){
    if(!ref||!REPOSITORY_KINDS.has(ref.kind)||!repositoryIdValid(ref.kind,ref.id))throw new Error('A Study Director backup deletion request has an invalid identity.');
    const context=childDriveOperationContext(baseContext,{signal:options&&options.signal});
    const parent=await ensureFolder(context);let metadata=null;
    if(ref.remoteId){const candidate=await getFileMetadata(ref.remoteId,context).catch(error=>{if(Number(error&&error.driveStatus)===404)return null;throw error;});if(candidate&&validRepositoryMetadata(candidate,parent,ref.kind)&&candidate.appProperties[REPOSITORY_ID_MARKER]===ref.id)metadata=candidate;}
    if(!metadata)metadata=await findRepositoryFile(parent,ref.kind,ref.id,context);if(!metadata)return false;
    const descriptor=repositoryDescriptor(metadata,parent);if(ref.remoteVersion&&descriptor.remoteVersion!==String(ref.remoteVersion))throw noRetry(new Error('A Study Director backup file changed version before deletion. Nothing was removed.'));if(ref.digest&&descriptor.digest!==String(ref.digest))throw noRetry(new Error('A Study Director backup file changed before deletion. Nothing was removed.'));
    const response=await authorizedFetch(`${DRIVE_API}/files/${encodeURIComponent(metadata.id)}`,{method:'DELETE'},API_TIMEOUT_MS,context);if(!response.ok&&response.status!==404)throw await apiError(response,'Could not remove an unused Study Director backup file from Google Drive.');return true;
  }
  async function repositoryList(options={},baseContext=EMPTY_DRIVE_OPERATION){
    const context=childDriveOperationContext(baseContext,{signal:options&&options.signal});
    // Retention is a target, not an inventory limit: blocked cleanup can leave
    // more physical versions. Read every history page before authorizing it.
    const kind=String(options&&options.kind||'');return await listRepositoryFiles(kind,{limit:['checkpoint','commit'].includes(kind)?Number.POSITIVE_INFINITY:100000},context);
  }
  function beginRepositoryOperation(options={}){
    const base=driveOperationContext({signal:options&&options.signal,checkProtection:options&&options.checkProtection});
    return Object.freeze({
      list:opts=>repositoryList(opts,base),
      upload:file=>repositoryUpload(file,base),
      download:(ref,opts)=>repositoryDownload(ref,opts,base),
      delete:(ref,opts)=>repositoryDelete(ref,opts,base),
      discardUploads:()=>repositoryUploads.clear(),
      beginPublication:()=>beginRepositoryPublication(base),
      listPublications:()=>listRepositoryPublications(base),
      assertPublication:ref=>assertRepositoryPublication(ref,base),
      renewPublication:ref=>renewRepositoryPublication(ref,base),
      // Marker retirement is cleanup, not operation work. Like maintenance
      // release, it must survive the operation signal being aborted by an
      // expected foreground preemption.
      endPublication:ref=>endRepositoryPublication(ref,driveOperationContext({folderState:base.folderState})),
      beginMaintenance:()=>beginRepositoryMaintenance(base),
      listMaintenances:()=>listRepositoryMaintenances(base),
      assertMaintenance:ref=>assertRepositoryMaintenance(ref,base),
      renewMaintenance:ref=>renewRepositoryMaintenance(ref,base),
      now:driveNow,
      endMaintenance:ref=>endRepositoryMaintenance(ref,driveOperationContext({folderState:base.folderState})),
      listSessionClaims:opts=>repositoryList(Object.freeze({...opts,kind:'session-claim'}),base),
      uploadSessionClaim:file=>repositoryUpload(file,base),
      downloadSessionClaim:(ref,opts)=>repositoryDownload(ref,opts,base),
      deleteSessionClaim:(ref,opts)=>repositoryDelete(ref,opts,base),
      scope:()=>repositoryScope(base),
      historyReadConcurrency:8
    });
  }
  function finiteSize(value){const size=Number(value);return Number.isFinite(size)&&size>=0?size:null;}
  function exactParent(file,parent){return !!parent&&Array.isArray(file&&file.parents)&&file.parents.length===1&&file.parents[0]===parent;}
  function receivedOffset(response,totalBytes){
    const raw=String(response&&response.headers&&response.headers.get('Range')||'');
    const match=raw.match(/^bytes=0-(\d+)$/i);
    const offset=match?Number(match[1])+1:0;
    if(!Number.isSafeInteger(offset)||offset<0||offset>totalBytes)throw noRetry(new Error('Google Drive returned an invalid upload position.'));
    return offset;
  }
  async function queryUploadStatus(uploadUrl,totalBytes,context=EMPTY_DRIVE_OPERATION){
    return authorizedFetch(uploadUrl,{method:'PUT',headers:{'Content-Range':`bytes */${totalBytes}`}},TRANSFER_TIMEOUT_MS,context);
  }
  async function recoverUploadPosition(uploadUrl,totalBytes,attempt,context=EMPTY_DRIVE_OPERATION){
    let lastError=null;
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
        if(operationStopped(error)||(error&&(error.studyDirectorDriveNoRetry||/authorization|expired/i.test(error.message)))||retry===MAX_TRANSIENT_ATTEMPTS-1)throw error;
        await delay(retryDelay(null,attempt+retry));
      }
    }
    throw lastError||new Error('Could not recover the Google Drive upload.');
  }
  async function uploadContent(uploadUrl,blob,mimeType,initialOffset=0,context=EMPTY_DRIVE_OPERATION,onOffset=null){
    const total=blob.size;
    if(!Number.isSafeInteger(total)||total<=0||total>maxBackupBytes)throw new Error('The prepared backup has an unsafe file size.');
    let offset=Math.max(0,Math.min(total,Number(initialOffset)||0)),transientAttempts=0,stalledRecoveries=0;
    const applyServerOffset=async(next,response)=>{
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
      let response=null;
      try{
        response=await authorizedFetch(uploadUrl,{
          method:'PUT',
          headers:{'Content-Type':mimeType,'Content-Range':`bytes ${offset}-${end}/${total}`},
          body
        },TRANSFER_TIMEOUT_MS,context);
      }catch(error){
        if(operationStopped(error)||error&&/authorization/i.test(error.message))throw error;
        const recovered=await recoverUploadPosition(uploadUrl,total,transientAttempts++,context);
        if(recovered.complete)return await jsonResponse(recovered.response);
        await applyServerOffset(recovered.offset,recovered.response);
        continue;
      }
      if(response.status===200||response.status===201)return await jsonResponse(response);
      if(response.status===308){
        await applyServerOffset(receivedOffset(response,total),response);
        continue;
      }
      if(await retryableResponse(response)){
        const recovered=await recoverUploadPosition(uploadUrl,total,transientAttempts++,context);
        if(recovered.complete)return await jsonResponse(recovered.response);
        await applyServerOffset(recovered.offset,recovered.response);
        continue;
      }
      throw await apiError(response,'Google Drive upload failed.');
    }
    const recovered=await recoverUploadPosition(uploadUrl,total,0,context);
    if(!recovered.complete)throw new Error('Google Drive did not confirm the completed upload.');
    return await jsonResponse(recovered.response);
  }
  const FILE_FIELDS='id,name,size,version,modifiedTime,createdTime,mimeType,parents,ownedByMe,shared,trashed,sha256Checksum,appProperties,capabilities(canDownload)';
  async function getFileMetadata(id,context=EMPTY_DRIVE_OPERATION){
    const fields=FILE_FIELDS;
    const response=await authorizedGet(`${DRIVE_API}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`,{},context);
    if(!response.ok)throw await apiError(response,'Could not verify the Google Drive backup.');
    return await jsonResponse(response);
  }
  async function readBoundedBlob(response,expectedSize,context=EMPTY_DRIVE_OPERATION,onProgress=null){
    const expected=finiteSize(expectedSize);
    if(expected===null||expected<=0||expected>maxBackupBytes)throw noRetry(new Error('The selected Google Drive backup has invalid size metadata.'));
    const rawLength=response.headers.get('Content-Length');
    if(rawLength!==null){
      const declared=finiteSize(rawLength);
      if(declared===null||declared!==expected)throw noRetry(new Error('The Google Drive download length does not match its verified metadata.'));
    }
    if(!receiveBackupStream)throw noRetry(new Error('Streaming backup download is unavailable. Update Study Director.'));
    return receiveBackupStream(response.body,expected,Object.freeze({signal:(context||EMPTY_DRIVE_OPERATION).signal,onProgress:typeof onProgress==='function'?onProgress:null}));
  }

  async function downloadBlob(metadata,context=EMPTY_DRIVE_OPERATION,onProgress=null){
    const url=`${DRIVE_API}/files/${encodeURIComponent(metadata.id)}?alt=media`;
    let lastError=null;
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
        if(operationStopped(error)||(error&&(error.studyDirectorDriveNoRetry||/authorization/i.test(error.message)))||attempt===MAX_TRANSIENT_ATTEMPTS-1)throw error;
        await delay(retryDelay(null,attempt));
      }
    }
    throw lastError||new Error('Could not download the selected Google Drive backup.');
  }
  function release(){if(accessToken&&Date.now()>=tokenExpiresAt)clearSession();}
  async function disconnect(){
    await prepare();
    const token=requireAccessToken();
    const oauth=window.google&&window.google.accounts&&window.google.accounts.oauth2;
    if(!oauth||typeof oauth.revoke!=='function')throw new Error('Google Drive disconnection is unavailable.');
    try{
      await new Promise((resolve,reject)=>{
        let settled=false;
        const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value);};
        const timer=setTimeout(()=>finish(reject,timeoutError('Google Drive disconnection')),REVOKE_TIMEOUT_MS);
        oauth.revoke(token,response=>{
          if(response&&response.successful===true){finish(resolve);return;}
          finish(reject,new Error(response&&response.error_description||response&&response.error||'Google did not confirm permission revocation.'));
        });
      });
    }finally{repositoryUploads.clear();clearSession();signedInBefore=false;}
  }
  function setup(api){
    if(!supportsCapabilities(api,REQUIRED_CAPABILITIES)||!api.backup||!api.backup.providers||typeof api.backup.providers.register!=='function')return false;
    const policy=api.backup.repositoryPolicy;
    if(!policy||typeof policy!=='object')return false;
    const publicationMaxAgeMs=Number(policy.publicationMaxAgeMs),publicationAssertionMarginMs=Number(policy.publicationAssertionMarginMs),publicationRenewMs=Number(policy.publicationRenewMs),publicationStaleMs=Number(policy.publicationStaleMs),maintenanceMaxAgeMs=Number(policy.maintenanceMaxAgeMs),maintenanceAssertionMarginMs=Number(policy.maintenanceAssertionMarginMs);
    const metadataTimeoutMs=Number(policy.driveMetadataTimeoutMs),driveMaintenanceMaxAgeMs=Number(policy.driveMaintenanceMaxAgeMs),driveMaintenanceAssertionMarginMs=Number(policy.driveMaintenanceAssertionMarginMs);
    if(![publicationMaxAgeMs,publicationAssertionMarginMs,publicationRenewMs,publicationStaleMs,maintenanceMaxAgeMs,maintenanceAssertionMarginMs,metadataTimeoutMs,driveMaintenanceMaxAgeMs,driveMaintenanceAssertionMarginMs].every(value=>Number.isFinite(value)&&value>0)||publicationAssertionMarginMs>=publicationMaxAgeMs||2*publicationRenewMs>=publicationStaleMs||publicationStaleMs>=publicationMaxAgeMs||maintenanceAssertionMarginMs>=maintenanceMaxAgeMs||driveMaintenanceAssertionMarginMs>=driveMaintenanceMaxAgeMs)return false;
    PUBLICATION_MAX_AGE_MS=publicationMaxAgeMs;PUBLICATION_ASSERTION_MARGIN_MS=publicationAssertionMarginMs;PUBLICATION_RENEW_MS=publicationRenewMs;PUBLICATION_STALE_MS=publicationStaleMs;API_TIMEOUT_MS=metadataTimeoutMs;MAINTENANCE_MAX_AGE_MS=driveMaintenanceMaxAgeMs;MAINTENANCE_ASSERTION_MARGIN_MS=driveMaintenanceAssertionMarginMs;
    const publishedLimit=Number(api.backup.limits&&api.backup.limits.maxFileBytes);
    if(Number.isFinite(publishedLimit)&&publishedLimit>0)maxBackupBytes=publishedLimit;
    releaseFile=api.backup.releaseFile||releaseFile;
    receiveBackupStream=typeof api.backup.receiveStream==='function'?api.backup.receiveStream:null;
    if(!receiveBackupStream)return false;
    profilePort=api.backup.profile&&['id','name','bind'].every(key=>typeof api.backup.profile[key]==='function')?api.backup.profile:null;
    devicePort=typeof api.backup.device==='function'?api.backup.device:null;
    // What the app can do with the profile's library.
    if(profilePort&&typeof profilePort.controls==='function')profilePort.controls(Object.freeze({deleteLibrary}));
    if(!profilePort)return false;
    restoreSession();
    return api.backup.providers.register(Object.freeze({
      id:'google-drive',
      label:'Google Drive',
      shared:true,
      prepare,
      authorize,
      backgroundAvailable:()=>tokenValid()&&Platform.online(),
      connected:()=>tokenValid(),
      automaticConfigured:()=>tokenValid()||signedInBefore,
      connectionExpiresAt:()=>tokenValid()?tokenExpiresAt:0,
      subscribeConnection,
      disconnect,
      release,
      repository:Object.freeze({discardUploads:()=>repositoryUploads.clear(),list:repositoryList,upload:repositoryUpload,download:repositoryDownload,delete:repositoryDelete,beginPublication:()=>beginRepositoryPublication(),listPublications:listRepositoryPublications,assertPublication:assertRepositoryPublication,renewPublication:renewRepositoryPublication,endPublication:endRepositoryPublication,beginMaintenance:beginRepositoryMaintenance,listMaintenances:listRepositoryMaintenances,assertMaintenance:assertRepositoryMaintenance,renewMaintenance:renewRepositoryMaintenance,endMaintenance:endRepositoryMaintenance,now:driveNow,listSessionClaims:opts=>repositoryList(Object.freeze({...opts,kind:'session-claim'})),uploadSessionClaim:repositoryUpload,downloadSessionClaim:repositoryDownload,deleteSessionClaim:repositoryDelete,scope:()=>repositoryScope(),beginOperation:beginRepositoryOperation,historyReadConcurrency:8})
    }));
  }

  const PLUGIN_READY_EVENT='studydirector:ready';
  const PLUGIN_DESCRIPTOR=Object.freeze({name:'SD-google-drive-backup',version:PLUGIN_VERSION,requires:REQUIRED_CAPABILITIES,setup});
  let registered=false;
  function connect(){
    if(registered)return true;
    const register=window.StudyDirector&&window.StudyDirector.registerPlugin;
    if(typeof register!=='function')return false;
    try{registered=register(PLUGIN_DESCRIPTOR)===true;}catch(error){}
    return registered;
  }
  if(!connect())window.addEventListener(PLUGIN_READY_EVENT,connect,{once:true});
})();
