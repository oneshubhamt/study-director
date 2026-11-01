/* Study Director Service Worker · @@SD_RELEASE@@
   Copyright © 2026 Shubham Tiwari and Dr Satyam Kumar. All rights reserved.
   Source-available for personal and noncommercial use only. See LICENSE.txt and NOTICE.txt. */
'use strict';

const RELEASE_ID='@@SD_PWA_RELEASE_ID@@';
const BUILD_ID='@@SD_BUILD_ID@@';
const ASSET_ID='@@SD_PAGE_ASSET_ID@@';
const CACHE_IDENTITIES=Object.freeze(@@SD_CACHE_STORAGE_IDENTITIES@@);
const CACHE_PREFIX=CACHE_IDENTITIES.shellPrefix;
const CACHE_NAME=CACHE_PREFIX+RELEASE_ID;
const MAX_SHELL_CACHES=3,MAX_CLIENTS=128;
const RELEASE_META_URL=new URL('./__sd_pwa_release__',self.registration.scope).href;
const CLIENT_STATE_PREFIX=new URL('./__sd_pwa_clients/',self.registration.scope).href;
let retirement=null,lastRetirementAt=0;
// Temporary compatibility companion for the Service Worker execution realm.
// Retire this object with the main CompatibilityFacade once every supported
// installed page has crossed the L9 updater baseline.
const CompatibilityFacade=Object.freeze((()=>{
  const bridgeCache=CACHE_IDENTITIES.updateBridge;
  const recoveryCache=CACHE_IDENTITIES.updateRecoveryPrefix+RELEASE_ID;
  return Object.freeze({
    async installBridgeRequired(){return !!self.registration.active&&!(await caches.has(bridgeCache));},
    async prepareBridge(){await caches.open(bridgeCache);await caches.open(recoveryCache);},
    async prepareCurrent(){await caches.open(bridgeCache);},
    recoveryHandoff:()=>caches.has(recoveryCache)
  });
})());
const PRECACHE=Object.freeze(JSON.parse('@@SD_PWA_ASSET_MANIFEST@@'));
const PRECACHE_CONCURRENCY=8;
const resolveAssets=assets=>new Map(assets.map(asset=>[
  new URL(asset.path,self.registration.scope).href,
  Object.freeze({...asset,url:new URL(asset.path,self.registration.scope).href})
]));
const PRECACHE_BY_URL=resolveAssets(PRECACHE);
const INDEX_URL=new URL('./index.html',self.registration.scope).href;
const LEGAL_NAVIGATION_URLS=new Set(['./privacy.html','./terms.html','./security.html','./license.html','./notices.html','./LICENSE.txt','./NOTICE.txt'].map(path=>new URL(path,self.registration.scope).href));

function bytesToHex(bytes){return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');}
async function responseSha256(response){return bytesToHex(await crypto.subtle.digest('SHA-256',await response.arrayBuffer()));}
async function verifiedAssetResponse(asset,response){
  if(!response||!response.ok)return null;
  return await responseSha256(response.clone())===asset.sha256?response:null;
}
async function fetchVerifiedAsset(asset){
  let response=null;
  try{response=await fetch(new Request(asset.url,{credentials:'same-origin'}));}catch{}
  const ordinary=await verifiedAssetResponse(asset,response);
  if(ordinary)return ordinary;
  try{response=await fetch(new Request(asset.url,{cache:'reload',credentials:'same-origin'}));}
  catch{throw new Error(`Required app asset failed: ${asset.path}.`);}
  if(!response.ok)throw new Error(`Required app asset failed: ${asset.path} (${response.status}).`);
  const reloaded=await verifiedAssetResponse(asset,response);
  if(!reloaded)throw new Error(`Required app asset identity failed: ${asset.path}.`);
  return reloaded;
}
async function reusableVerifiedAsset(asset,cacheList){
  for(const cache of cacheList){
    const stored=await cache.match?.(asset.url);
    const verified=await verifiedAssetResponse(asset,stored);
    if(verified)return verified;
  }
  return null;
}
async function installRelease(){
  const cacheNames=await caches.keys(),shellNames=cacheNames.filter(name=>name.startsWith(CACHE_PREFIX)),existed=shellNames.includes(CACHE_NAME);
  if(!existed&&shellNames.length>=MAX_SHELL_CACHES){
    const error=new Error('Close older Study Director windows and retry the update.');error.code='SD_PWA_CACHE_LIMIT';throw error;
  }
  const cache=await caches.open(CACHE_NAME);
  const reusableCaches=[cache,...await Promise.all(shellNames.filter(name=>name!==CACHE_NAME).map(name=>caches.open(name)))];
  try{
    let next=0,failure=null;
    const worker=async()=>{
      while(!failure){
        const index=next++;
        if(index>=PRECACHE.length)return;
        const resolved=PRECACHE_BY_URL.get(new URL(PRECACHE[index].path,self.registration.scope).href);
        try{
          const reusable=await reusableVerifiedAsset(resolved,reusableCaches);
          await cache.put(resolved.url,reusable||await fetchVerifiedAsset(resolved));
        }catch(error){failure??=error;}
      }
    };
    await Promise.all(Array.from({length:Math.min(PRECACHE_CONCURRENCY,PRECACHE.length)},()=>worker()));
    if(failure)throw failure;
    await cache.put(RELEASE_META_URL,new Response(JSON.stringify({releaseId:RELEASE_ID,buildId:BUILD_ID,assetId:ASSET_ID,state:'installed',installedAt:Date.now()}),{headers:{'Content-Type':'application/json'}}));
  }catch(error){
    // A same-identity retry may be serving a page. Preserve its verified entries.
    if(!existed)await caches.delete(CACHE_NAME);
    throw error;
  }
}
async function notifyClients(message,options={}){
  const windows=await clients.matchAll({type:'window',includeUncontrolled:options.includeUncontrolled===true});
  windows.forEach(client=>client.postMessage(message));
  return windows;
}
function scopedClient(client){
  try{const url=new URL(client.url),scope=new URL(self.registration.scope);return url.origin===scope.origin&&url.pathname.startsWith(scope.pathname);}catch{return false;}
}
async function shellMetadata(name){
  const cache=await caches.open(name),stored=await cache.match(RELEASE_META_URL);
  if(stored){const value=await stored.json();if(typeof value.buildId==='string')return value;}
  const index=await cache.match(INDEX_URL),html=index?await index.text():'';
  return {buildId:html.match(/<meta\s+name="study-director-build"\s+content="([^"]+)"/u)?.[1]||'',assetId:html.match(/<meta\s+name="study-director-assets"\s+content="([^"]+)"/u)?.[1]||'',state:'legacy'};
}
async function cleanupOldShellCaches({force=false}={}){
  if(retirement)return retirement;
  if(!force&&Date.now()-lastRetirementAt<30000)return {state:'deferred',reason:'cooldown'};
  lastRetirementAt=Date.now();
  retirement=(async()=>{
    const windows=(await clients.matchAll({type:'window',includeUncontrolled:true})).filter(scopedClient);
    if(windows.length>MAX_CLIENTS)return {state:'deferred',reason:'client-limit'};
    const control=await caches.open(CACHE_IDENTITIES.updateBridge),liveIds=new Set(windows.map(client=>client.id)),assets=new Set();let unknown=false;
    for(const client of windows){
      const stored=await control.match(CLIENT_STATE_PREFIX+encodeURIComponent(client.id)),state=stored?await stored.json():null;
      if(!state?.ready||typeof state.assetId!=='string'){unknown=true;postToClient(client,{type:'SD_PWA_CLIENT_STATE_REQUEST',releaseId:RELEASE_ID});}
      else assets.add(state.assetId);
    }
    for(const key of await control.keys())if(key.url.startsWith(CLIENT_STATE_PREFIX)&&!liveIds.has(decodeURIComponent(key.url.slice(CLIENT_STATE_PREFIX.length))))await control.delete(key);
    if(unknown)return {state:'deferred',reason:'awaiting-client-state'};
    const names=(await caches.keys()).filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME),rows=[];
    for(const name of names)rows.push({name,...await shellMetadata(name)});
    if([...assets].some(asset=>asset!==ASSET_ID&&!rows.some(row=>row.assetId===asset)))return {state:'deferred',reason:'unknown-client-release'};
    // Keep one recent unused generation for history/BFCache return. Live
    // generations remain pinned; installations stop at the cache cap.
    const previous=[...assets].some(asset=>asset!==ASSET_ID)?'':rows.filter(row=>(row.assetId&&row.assetId!==ASSET_ID||!row.assetId&&row.buildId)&&row.state!=='installed').sort((a,b)=>(Number(b.activatedAt)||0)-(Number(a.activatedAt)||0))[0]?.name;
    const removed=[];
    for(const row of rows){
      if(row.name===previous||assets.has(row.assetId)&&row.assetId!==ASSET_ID)continue;
      if(!row.assetId&&windows.length&&[...assets].some(asset=>asset!==ASSET_ID))continue;
      // An installing candidate has no release metadata until every asset is
      // verified. Protect it as well as a completed waiting candidate.
      if(row.state!=='active'&&(self.registration.installing||self.registration.waiting))continue;
      if(await caches.delete(row.name))removed.push(row.name);
    }
    return {state:'completed',removed:removed.length,retained:rows.length-removed.length};
  })().catch(()=>({state:'failed',reason:'cache-storage-unavailable'})).then(async result=>{
    try{await notifyClients({type:'SD_PWA_CACHE_STATUS',releaseId:RELEASE_ID,...result});}catch{}
    return result;
  }).finally(()=>{retirement=null;});return retirement;
}
function postToClient(client,message){try{client&&client.postMessage(message);return true;}catch(error){return false;}}
function canonicalAssetUrl(requestUrl){
  const url=new URL(requestUrl);
  url.search='';url.hash='';
  return url.href;
}
async function cachedOrNetwork(url,request){
  const cached=await caches.match(url,{cacheName:CACHE_NAME});
  return cached||fetch(request);
}
async function retainedAsset(url,request){
  const current=await caches.match(url,{cacheName:CACHE_NAME});if(current)return current;
  for(const name of (await caches.keys()).filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME)){
    const previous=await caches.match(url,{cacheName:name});if(previous)return previous;
  }
  return fetch(request);
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    try{await installRelease();}catch(error){try{await notifyClients({type:'SD_PWA_INSTALL_FAILED',releaseId:RELEASE_ID,reason:error.code==='SD_PWA_CACHE_LIMIT'?'cache-limit':'asset-unavailable'},{includeUncontrolled:true});}catch{}throw error;}
    const legacyBridgeRequired=await CompatibilityFacade.installBridgeRequired();
    if(legacyBridgeRequired){
      await CompatibilityFacade.prepareBridge();
      await self.skipWaiting();
    }else if(!self.registration.active)await self.skipWaiting();
    else await notifyClients({type:'SD_PWA_UPDATE_AVAILABLE',releaseId:RELEASE_ID},{includeUncontrolled:true});
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const recoveryHandoff=await CompatibilityFacade.recoveryHandoff();
    await CompatibilityFacade.prepareCurrent();
    try{const cache=await caches.open(CACHE_NAME);await cache.put(RELEASE_META_URL,new Response(JSON.stringify({releaseId:RELEASE_ID,buildId:BUILD_ID,assetId:ASSET_ID,state:'active',activatedAt:Date.now()}),{headers:{'Content-Type':'application/json'}}));}catch{}
    if(recoveryHandoff)return;
    await clients.claim();
    await notifyClients({type:'SD_PWA_ACTIVATED',releaseId:RELEASE_ID},{includeUncontrolled:true});
  })());
});

self.addEventListener('message',event=>{
  const message=event.data&&typeof event.data==='object'?event.data:{};
  if(message.type==='SD_PWA_IDENTIFY'){
    const reply={type:'SD_PWA_IDENTITY',releaseId:RELEASE_ID,buildId:BUILD_ID,assetId:ASSET_ID,waiting:!!self.registration.waiting};
    if(event.ports&&event.ports[0])event.ports[0].postMessage(reply);else postToClient(event.source,reply);
    return;
  }
  if(message.type==='SD_PWA_APPLY_UPDATE'&&String(message.releaseId||'')===RELEASE_ID){
    const acknowledgement={type:'SD_PWA_ACTIVATION_ACK',requestId:String(message.requestId||''),releaseId:RELEASE_ID};
    if(event.ports&&event.ports[0])event.ports[0].postMessage(acknowledgement);else postToClient(event.source,acknowledgement);
    event.waitUntil(self.skipWaiting());
  }
  if(message.type==='SD_PWA_CLIENT_STATE'&&event.source?.id&&scopedClient(event.source)&&typeof message.assetId==='string'&&/^[a-f0-9]{24}$/u.test(message.assetId)&&message.ready===true){
    event.waitUntil((async()=>{
      const cache=await caches.open(CACHE_IDENTITIES.updateBridge);
      await cache.put(CLIENT_STATE_PREFIX+encodeURIComponent(event.source.id),new Response(JSON.stringify({assetId:message.assetId,ready:true}),{headers:{'Content-Type':'application/json'}}));
      await cleanupOldShellCaches({force:true});
    })().catch(()=>{}));
  }
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const scope=new URL(self.registration.scope);
  let requested=new URL('./',scope);
  try{
    const candidate=new URL(event.notification&&event.notification.data&&event.notification.data.url||'./',scope);
    if(candidate.origin===scope.origin&&candidate.pathname.startsWith(scope.pathname))requested=candidate;
  }catch(error){}
  event.waitUntil((async()=>{
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(client=>{const url=new URL(client.url);return url.origin===scope.origin&&url.pathname.startsWith(scope.pathname);});
    if(existing){
      // A notification is a focus request, not permission to reload unsaved
      // work in an already-open app client (including /index.html or a deep URL).
      return existing.focus();
    }
    return clients.openWindow?clients.openWindow(requested.href):null;
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const requestUrl=new URL(request.url);
  if(requestUrl.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    const navigationUrl=canonicalAssetUrl(request.url);
    event.respondWith(LEGAL_NAVIGATION_URLS.has(navigationUrl)?cachedOrNetwork(navigationUrl,request):cachedOrNetwork(INDEX_URL,request));
    event.waitUntil(cleanupOldShellCaches());
    return;
  }
  const assetUrl=canonicalAssetUrl(request.url);
  // Retained fingerprinted assets remain available to pages that have not yet
  // completed their own safe reload, including offline lazy imports.
  if(PRECACHE_BY_URL.has(assetUrl)||/\.(?:js|css|woff2?|png|svg|ico)$/u.test(requestUrl.pathname))event.respondWith(retainedAsset(assetUrl,request));
});
