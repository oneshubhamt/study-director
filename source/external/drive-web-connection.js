/*
  Study Director Web Google Drive connection
  Copyright © 2026 Shubham Tiwari and Dr Satyam Kumar. All rights reserved.

  Source-available for personal and noncommercial use only.
  See LICENSE.txt and NOTICE.txt for full terms.

  Web OAuth and HTTP authorization. The shared repository provider does not
  own bearer credentials or browser-specific sign-in.
*/

const createStudyDirectorDriveConnection=ports=>{
  'use strict';
  const {Platform,requirePlatform,profileEmail,timeoutError,onInvalidated}=ports;
  const GOOGLE_OAUTH_CLIENT_ID='@@SD_GOOGLE_OAUTH_CLIENT_ID@@';
  // Each profile on the device keeps its own sign-in (see the profile scope in app.html).
  const SESSION_KEY=window[Symbol.for('studyDirector.profileScope.v1')].scoped('@@SD_DRIVE_SESSION_STORAGE_KEY@@');
  const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
  const GIS_SRC='https://accounts.google.com/gsi/client';
  const GIS_LOAD_TIMEOUT_MS=20000;
  const AUTH_TIMEOUT_MS=120000;
  let gisPromise=null;
  let tokenClient=null;
  let accessToken='';
  let tokenExpiresAt=0,signedInBefore=false;
  let connectionExpiryTimer=null;
  const connectionListeners=new Set();
  let pendingAuthorization=null;
  function configuredClientId(){
    const value=String(GOOGLE_OAUTH_CLIENT_ID||'').trim();
    return value&&!value.includes('PASTE_')?value:'';
  }
  function configurationError(){
    return new Error('Google Drive is not configured. Add the production Web OAuth client ID in the release configuration and rebuild Study Director.');
  }
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
  function usableSession(value){const expiresAt=value?.expiresAt;return Number.isSafeInteger(expiresAt)&&Object.keys(value).length===2&&typeof value.token==='string'&&!!value.token&&expiresAt>Date.now()+5000&&expiresAt<=Date.now()+7200000;}
  function storedSession(){try{return parseSession(window.localStorage.getItem(SESSION_KEY));}catch{return null;}}
  function rememberSession(){try{window.localStorage.setItem(SESSION_KEY,JSON.stringify({token:accessToken,expiresAt:tokenExpiresAt}));}catch{}}
  function forgetSession(token){if(token&&(storedSession()||{}).token===token)try{window.localStorage.removeItem(SESSION_KEY);}catch{}}
  function adoptSession(value){accessToken=value.token;tokenExpiresAt=value.expiresAt;signedInBefore=true;scheduleConnectionExpiry();notifyConnectionChange();}
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
  function clearSession(){clearAccessToken();onInvalidated();}
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
    // A profile syncs with one Google account: once it has one, the sign-in
    // goes straight to it (no account chooser, here or after a reload).
    const hint=profileEmail();
    try{tokenClient.requestAccessToken({include_granted_scopes:false,prompt:signedInBefore||hint?'':'select_account',...(hint?{login_hint:hint}:{})});}
    catch(error){settleAuthorization(error instanceof Error?error:new Error(String(error)));}
    return promise;
  }
  function requireAccessToken(){
    if(tokenValid())return accessToken;
    clearSession();
    throw new Error('Google authorization expired. Retry the Drive action.');
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
  function release(){if(accessToken&&Date.now()>=tokenExpiresAt)clearSession();}
  // Disconnect signs this device out of Google Drive. Study Director keeps
  // its permission on the Google account, so the profile's other devices
  // stay signed in; the account's own settings withdraw it everywhere.
  async function disconnect(){clearSession();signedInBefore=false;return true;}
  function prepareRequest(url,options){
    // Capture the credential before asynchronous provider guards.
    const headers=new Platform.Headers(options.headers||{});
    headers.set('Authorization',`Bearer ${requireAccessToken()}`);
    const progressUpload=Platform.XMLHttpRequest&&Platform.Response&&options.body instanceof Platform.Blob&&new Platform.URL(url).pathname==='/upload/drive/v3/files';
    return (signal,progress)=>{
      const requestOptions={...options,headers,signal};
      return progressUpload?uploadWithProgress(url,requestOptions,signal,progress):Platform.fetch(url,{...requestOptions,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
    };
  }
  return Object.freeze({kind:'web',prepare,authorize,connected:tokenValid,automaticConfigured:()=>tokenValid()||signedInBefore,
    connectionExpiresAt:()=>tokenValid()?tokenExpiresAt:0,subscribeConnection,restoreSession,disconnect,release,prepareRequest,invalidate:clearSession});
};
