import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import cryptoNode,{webcrypto} from 'node:crypto';
import {CACHE_STORAGE_IDENTITIES} from '../../../contracts/canonical-identities.mjs';
const template=fs.readFileSync('source/platform/sw.js','utf8'),sha=value=>cryptoNode.createHash('sha256').update(value).digest('hex');
const scope='https://study.test/app/',current='study-director-shell-current',assetId='a'.repeat(24),meta=scope+'__sd_pwa_release__';
const rows=Array.from({length:9},(_,i)=>({path:`./asset-${i}.js`,body:`asset-${i}`})),manifest=rows.map(row=>({path:row.path,sha256:sha(row.body)}));
const cases=[];
function fixture({badPath='',active=null,windows=[],rejectDelete='',failMetadata=false,delays={}}={}){
 const stores=new Map(),listeners=new Map(),deletions=[],messages=[],fetches=[],fetchEvents=[],claims=[];let concurrent=0,maximum=0;
 const ensure=name=>{if(!stores.has(name))stores.set(name,new Map());return stores.get(name);};
 const caches={
  async has(name){return stores.has(name);},async keys(){return [...stores.keys()];},
  async delete(name){deletions.push(name);if(name===rejectDelete)throw new Error('delete unavailable');return stores.delete(name);},
  async match(url,{cacheName}={}){return (await caches.open(cacheName)).match(url);},
  async open(name){const map=ensure(name);return {
   async match(url){return map.get(String(url.url||url))?.clone()||null;},
   async put(url,value){if(failMetadata&&String(url)===meta)throw new Error('metadata unavailable');map.set(String(url.url||url),value.clone());},
   async delete(url){return map.delete(String(url.url||url));},async keys(){return [...map.keys()].map(url=>new Request(url));}
  };}
 };
 const self={registration:{scope,active,installing:null,waiting:null},location:{origin:'https://study.test'},addEventListener(type,fn){listeners.set(type,fn);},async skipWaiting(){claims.push('skip');}};
 const clients={async matchAll(){return windows;},async claim(){claims.push('claim');}};
 const fetch=async request=>{const row=rows.find(row=>new URL(row.path,scope).href===request.url);fetches.push({url:request.url,cache:request.cache});fetchEvents.push(`start:${row?.path||request.url}:${request.cache}`);if(!row)throw new Error('offline');concurrent++;maximum=Math.max(maximum,concurrent);await new Promise(resolve=>setTimeout(resolve,Number(delays[row.path])||1));concurrent--;fetchEvents.push(`finish:${row.path}:${request.cache}`);return new Response(row.body+(row.path===badPath?'corrupt':''));};
 const context=vm.createContext({self,caches,clients,URL,Request,Response,crypto:webcrypto,fetch,Date,console});
 const rendered=template.replaceAll('@@SD_RELEASE@@','QA_FIXTURE').replaceAll('@@SD_BUILD_ID@@','qa-build').replaceAll('@@SD_PAGE_ASSET_ID@@',assetId).replaceAll('@@SD_PWA_RELEASE_ID@@','current').replaceAll('@@SD_PWA_ASSET_MANIFEST@@',JSON.stringify(manifest)).replaceAll('@@SD_CACHE_STORAGE_IDENTITIES@@',JSON.stringify(CACHE_STORAGE_IDENTITIES));
 vm.runInContext(rendered,context,{filename:'source/platform/sw.js'});
 async function emit(type,event={}){const waits=[];let response;listeners.get(type)({...event,waitUntil(value){waits.push(value);},respondWith(value){response=value;}});await Promise.all(waits);return response?await response:null;}
 function seed(name,id,{activatedAt=1,state='active',asset='old.js'}={}){const map=ensure(name);map.set(meta,new Response(JSON.stringify({assetId:id,buildId:'qa-'+id,state,activatedAt})));map.set(scope+asset,new Response(name+' offline bytes'));return map;}
 function client(id){return {id,url:scope,postMessage(value){messages.push({id,...value});}};}
 async function report(client,id){await emit('message',{source:client,data:{type:'SD_PWA_CLIENT_STATE',assetId:id,ready:true}});}
 return {stores,windows,deletions,messages,fetches,fetchEvents,claims,self,seed,client,report,emit,maximum:()=>maximum};
}
{
 const h=fixture();await h.emit('install');assert.equal(h.stores.get(current).size,rows.length+1);assert.equal(h.maximum(),8);assert.equal(h.fetches.length,rows.length);assert.ok(h.fetches.every(row=>row.cache==='default'));assert.deepEqual(h.claims,['skip']);assert.equal(h.deletions.length,0);cases.push('eight-way verified precache and first installation');
}
{
 const h=fixture({delays:{'./asset-0.js':30}});await h.emit('install');
 const startNinth=h.fetchEvents.findIndex(value=>value.startsWith('start:./asset-8.js:')),finishSlow=h.fetchEvents.findIndex(value=>value.startsWith('finish:./asset-0.js:'));
 assert.ok(startNinth>=0&&finishSlow>=0&&startNinth<finishSlow,'a free precache worker must start the next asset without waiting for the slowest request in the first eight');
 cases.push('bounded worker queue has no eight-item batch barrier');
}
{
 const h=fixture({active:{}}),old=h.seed('study-director-shell-old','b'.repeat(24));
 for(const row of rows.slice(0,4))old.set(new URL(row.path,scope).href,new Response(row.body));
 await h.emit('install');
 assert.equal(h.fetches.length,rows.length-4,'verified assets already present in a retained shell must not hit the network');
 const currentCache=h.stores.get(current);
 for(const row of rows.slice(0,4))assert.equal(await currentCache.get(new URL(row.path,scope).href).clone().text(),row.body);
 cases.push('verified retained-shell assets are copied into the new release without network fetch');
}
{
 const h=fixture({badPath:'./asset-4.js',active:{}});h.seed('study-director-shell-old','b'.repeat(24));await assert.rejects(h.emit('install'),/identity failed/);
 const badUrl=new URL('./asset-4.js',scope).href,badRequests=h.fetches.filter(row=>row.url===badUrl);
 assert.deepEqual(badRequests.map(row=>row.cache),['default','reload'],'an ordinary cached/network response is verified before the forced reload fallback');
 assert.equal(h.stores.has(current),false);assert.equal(h.stores.has('study-director-shell-old'),true);assert.deepEqual(h.deletions,[current]);assert.equal(h.claims.length,0);cases.push('failed new candidate retries a mismatched response with reload and preserves active offline shell');
}
{
 const h=fixture({badPath:'./asset-4.js',active:{}}),map=h.seed(current,assetId);map.set(scope+'asset-0.js',new Response(rows[0].body));await assert.rejects(h.emit('install'),/identity failed/);assert.equal(await map.get(scope+'asset-0.js').clone().text(),rows[0].body);assert.equal(h.deletions.length,0);cases.push('failed same-identity retry preserves existing verified entries');
}
{
 const h=fixture({active:{},rejectDelete:'study-director-shell-old'}),page=h.client('page');h.windows.push(page);h.seed(current,assetId);h.seed('study-director-shell-old','b'.repeat(24));h.seed('study-director-shell-newer','c'.repeat(24),{activatedAt:2});await h.emit('activate');assert.ok(h.claims.includes('claim'));assert.equal(h.deletions.length,0);await h.report(page,assetId);assert.ok(h.messages.some(row=>row.type==='SD_PWA_CACHE_STATUS'&&row.state==='failed'));assert.equal(h.stores.has('study-director-shell-old'),true);cases.push('retirement failure is independent of activation readiness');
}
{
 const h=fixture({active:{},failMetadata:true});h.seed(current,assetId);await h.emit('activate');assert.ok(h.claims.includes('claim'));cases.push('optional activation metadata failure cannot prevent claim');
}
{
 const h=fixture({active:{}}),old=h.client('older'),fresh=h.client('newer');h.windows.push(old,fresh);h.seed(current,assetId,{asset:'current.js'});h.seed('study-director-shell-old','b'.repeat(24));h.seed('study-director-shell-unused','c'.repeat(24),{activatedAt:2});
 await h.emit('activate');await h.report(fresh,assetId);assert.equal(h.deletions.length,0);assert.ok(h.messages.some(row=>row.type==='SD_PWA_CLIENT_STATE_REQUEST'&&row.id==='older'));
 await h.report(old,'b'.repeat(24));assert.equal(h.stores.has('study-director-shell-old'),true);assert.equal(h.stores.has('study-director-shell-unused'),false);
 const bytes=await h.emit('fetch',{request:new Request(scope+'old.js')});assert.equal(await bytes.text(),'study-director-shell-old offline bytes');
 h.windows.splice(0,1);await h.report(fresh,assetId);assert.equal(h.stores.has('study-director-shell-old'),true,'one previous generation remains for history return');
 h.seed('study-director-shell-newer','d'.repeat(24),{activatedAt:3});await h.report(fresh,assetId);assert.equal(h.stores.has('study-director-shell-old'),false);assert.equal(h.stores.has('study-director-shell-newer'),true);cases.push('unknown and old pages retain assets; unused generations retire after safe handoff');
}
{
 const h=fixture({active:{}}),page=h.client('page');h.windows.push(page);h.seed(current,assetId);h.seed('study-director-shell-same-assets',assetId);await h.report(page,assetId);assert.equal(h.stores.has('study-director-shell-same-assets'),false);cases.push('worker-only generations with identical page assets do not accumulate pinned caches');
}
{
 const h=fixture({active:{}});for(let i=0;i<3;i++)h.seed('study-director-shell-held-'+i,String(i).repeat(24));await assert.rejects(h.emit('install'),error=>error.code==='SD_PWA_CACHE_LIMIT');assert.equal(h.fetches.length,0);assert.equal(h.stores.size,3);assert.equal(h.deletions.length,0);cases.push('cache capacity defers installation without deleting held assets');
}
{
 const h=fixture({active:{}}),page=h.client('page');h.windows.push(page);h.seed(current,assetId);h.seed('study-director-shell-orphan','b'.repeat(24),{state:'installed'});h.self.registration.waiting={};await h.report(page,assetId);assert.equal(h.stores.has('study-director-shell-orphan'),true);h.self.registration.waiting=null;await h.report(page,assetId);assert.equal(h.stores.has('study-director-shell-orphan'),false);cases.push('waiting candidate is retained and a later abandoned candidate is reclaimed');
}
{
 const h=fixture({active:{}});h.seed(current,assetId);h.seed('study-director-shell-old','b'.repeat(24));h.stores.set(CACHE_STORAGE_IDENTITIES.updateRecoveryPrefix+'current',new Map());await h.emit('activate');assert.equal(h.claims.includes('claim'),false);assert.equal(h.messages.some(row=>row.type==='SD_PWA_ACTIVATED'),false);assert.equal(h.stores.has('study-director-shell-old'),true);cases.push('legacy recovery handoff preserves its no-claim path and old assets');
}
{
 const h=fixture({active:{}}),page=h.client('page');h.windows.push(page);h.seed(current,assetId);h.stores.set('study-director-shell-downloading',new Map());h.self.registration.installing={};await h.report(page,assetId);assert.equal(h.stores.has('study-director-shell-downloading'),true,'an installing cache without final metadata must remain intact');h.self.registration.installing=null;await h.report(page,assetId);assert.equal(h.stores.has('study-director-shell-downloading'),false);cases.push('retirement cannot delete a downloading candidate before metadata is written');
}
{
 const h=fixture({active:{}}),page=h.client('page');h.windows.push(page);h.seed(current,assetId);h.seed('study-director-shell-previous','b'.repeat(24),{activatedAt:2});h.stores.set('study-director-shell-partial',new Map([[scope+'index.html',new Response('<meta name="study-director-build" content="candidate"><meta name="study-director-assets" content="'+ 'c'.repeat(24)+'">')]]));h.self.registration.installing={};await h.report(page,assetId);assert.equal(h.stores.has('study-director-shell-partial'),true,'candidate index cannot turn an incomplete cache into an eligible old shell');cases.push('candidate protection survives a downloaded index before final install metadata');
}
{
 const h=fixture({active:{}}),page=h.client('page');h.windows.push(page);h.seed(current,assetId);h.stores.set('study-director-shell-legacy',new Map([[scope+'index.html',new Response('<meta name="study-director-build" content="old-build">')]]));await h.report(page,assetId);assert.equal(h.stores.has('study-director-shell-legacy'),true,'one previous legacy shell is retained for history return');cases.push('previous-generation retention also covers legacy pages without asset metadata');
}
console.log(JSON.stringify({status:'PASS',suite:'service-worker-lifecycle',cases},null,2));
