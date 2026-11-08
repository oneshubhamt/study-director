// Two browsers sharing one simulated Google Drive, for the sync browser
// tests. Every request to Google from either browser goes to the one
// simulated Drive; the ledger lists who uploaded and deleted what.
import assert from 'node:assert/strict';
import {waitForStudyDirector,waitFor} from './browser-harness.mjs';
import {createDriveHarness,QA_PROFILE_ID} from './drive-harness.mjs';
import {LOCAL_STORAGE_KEYS} from '../../contracts/data-architecture.mjs';

export const PROFILE_KEY=LOCAL_STORAGE_KEYS.profiles||'studyDirector.profiles.v1';
export const preload=`(()=>{(localStorage.getItem(${JSON.stringify(PROFILE_KEY)})||localStorage.setItem(${JSON.stringify(PROFILE_KEY)},JSON.stringify({version:1,active:${JSON.stringify(QA_PROFILE_ID)},profiles:[{id:${JSON.stringify(QA_PROFILE_ID)},scope:'',name:'QA',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));})();`;
// Google's sign-in script, as far as Study Director uses it. Each token
// request is counted so a reload can show the sign-in was kept.
export const GIS=`window.__gisTokenRequests=0;window.google={accounts:{oauth2:{
  hasGrantedAllScopes(response,scope){return String(response&&response.scope||'').split(/\\s+/).includes(scope);},
  initTokenClient(config){return {requestAccessToken(){window.__gisTokenRequests+=1;setTimeout(()=>config.callback({access_token:'token-'+Date.now()+'-'+window.__gisTokenRequests,expires_in:3600,token_type:'Bearer',scope:'https://www.googleapis.com/auth/drive.file'}),0);}};},
  revoke(token,callback){setTimeout(()=>callback&&callback({successful:true}),0);}
}}};`;
export const CORS=[{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PUT,PATCH,DELETE'},{name:'Access-Control-Expose-Headers',value:'*'}];

export const drive=createDriveHarness(),faults=[];
// hooks.before({who,method,url,text}): runs before each request to Drive from
// either browser; it may wait (hold or slow a device's upload) or return
// 'fail' (that device's network is down). text: the start of the body.
export const hooks={before:null};
// Every request to Google from either browser goes to the one simulated Drive.
// The ledger lists who uploaded and deleted what, for the steps and on failure.
export const ledger=[];
export async function attachDrive(page,who='?'){
  page.on('Fetch.requestPaused',async({requestId,request})=>{
    try{
      if(request.method==='OPTIONS'){await page.send('Fetch.fulfillRequest',{requestId,responseCode:204,responseHeaders:CORS});return;}
      if(request.url.startsWith('https://accounts.google.com/')){await page.send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[...CORS,{name:'Content-Type',value:'text/javascript'}],body:Buffer.from(GIS).toString('base64')});return;}
      const headers=request.headers||{},type=String(Object.entries(headers).find(([name])=>name.toLowerCase()==='content-type')?.[1]||'');
      const bytes=request.postDataEntries?Buffer.concat(request.postDataEntries.map(entry=>Buffer.from(entry.bytes||'','base64'))):request.postData!==undefined?Buffer.from(request.postData):null;
      const body=bytes===null?undefined:request.method==='PUT'||/multipart/u.test(type)?new Blob([bytes]):bytes.toString('utf8');
      if(hooks.before&&await hooks.before({who,method:request.method,url:request.url,text:bytes?bytes.subarray(0,4096).toString('latin1'):''})==='fail'){await page.send('Fetch.failRequest',{requestId,errorReason:'InternetDisconnected'});return;}
      const target=drive.state.files.get(decodeURIComponent(new URL(request.url).pathname.split('/').at(-1)));
      if(request.method==='DELETE')ledger.push(`${new Date().toISOString().slice(11,23)} ${who} DELETE ${target?.name||'?'} ${target?.appProperties?.studyDirectorRepositoryKind||''}`);
      const response=await drive.fetch(request.url,{method:request.method,headers,body});
      if(request.method==='POST'||request.method==='PUT'){try{const meta=await response.clone().json();if(meta&&meta.name)ledger.push(`${new Date().toISOString().slice(11,23)} ${who} ${request.method} ${meta.id} ${meta.name} ${meta.appProperties?.studyDirectorRepositoryKind||''} ${meta.appProperties?.studyDirectorDevice||meta.appProperties?.studyDirectorRepositoryDevice||''}`);}catch{}}
      const out=Buffer.from(await response.arrayBuffer());
      await page.send('Fetch.fulfillRequest',{requestId,responseCode:response.status,responseHeaders:[...CORS,...[...response.headers].map(([name,value])=>({name,value}))],body:out.toString('base64')});
    }catch(error){
      // The page cancelled the request (an aborted fetch, or the page closed)
      // before its answer: nothing to answer, and not a fault of the harness.
      if(/Invalid InterceptionId/u.test(String(error?.message||''))){ledger.push(`${new Date().toISOString().slice(11,23)} ${who} ${request.method} cancelled by the page`);return;}
      faults.push(`${request.method} ${request.url}: ${error.message}`);await page.send('Fetch.failRequest',{requestId,errorReason:'Failed'}).catch(()=>{});
    }
  });
  await page.send('Fetch.enable',{patterns:[{urlPattern:'https://accounts.google.com/*'},{urlPattern:'https://www.googleapis.com/*'}]});
}
export const commits=()=>[...drive.state.files.values()].filter(file=>!file.trashed&&file.appProperties?.studyDirectorRepositoryKind==='commit').length;
export const noteText=(page,key)=>page.evaluate(`(()=>{const note=__PWA6.AppData.notes.get(${JSON.stringify(key)});return note?String(note.text||''):null;})()`);
export const sync=page=>page.evaluate(`__PWA6.BackupProviderRuntime.diagnosticSync()[0]||null`);
export async function open(browser,server,who){
  const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload});
  await attachDrive(page,who);
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership'});
  return page;
}
export async function reopen(page,label){
  await waitFor(()=>page.evaluate(`!!(window.__PWA6&&__PWA6.StartupLifecycle.status().fullyInitialized)`).catch(()=>false),{label,timeout:45000});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:`${label}: ownership`});
}
export async function connect(page,label){
  const connected=await page.evaluate(`__PWA6.BackupProviderRuntime.connect('google-drive').then(value=>value===true||!!value,error=>'ERR '+(error&&error.message||error))`);
  assert.equal(connected,true,`${label}: Drive connects (${connected})`);
}
// Upload or cleanup markers on Drive: a device is saving or tidying up.
export const markers=()=>[...drive.state.files.values()].some(file=>['publication','maintenance'].includes(file.appProperties?.studyDirectorRepositoryKind));
export const uploadsBy=who=>ledger.filter(line=>line.split(' ')[1]===who&&/ POST \S+ cp_\S+\.sdcommit /u.test(line)).length;
export const waiting=page=>page.evaluate(`__PWA6.BackupProviderRuntime.automaticWaiting()`);
export const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

