import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';
import {createDriveHarness,QA_PROFILE_ID} from '../../helpers/drive-harness.mjs';
import {LOCAL_STORAGE_KEYS} from '../../../contracts/data-architecture.mjs';

// Two browsers share one simulated Google Drive. A writes a note and connects;
// B, the same person's other device, connects and receives it. A edits, B
// picks the edit up when it comes back to the front. A reload keeps the
// sign-in. Then B adds a second profile (empty), switches back (the notes are
// there) and removes it (its database is deleted from this device).
const PROFILE_KEY=LOCAL_STORAGE_KEYS.profiles||'studyDirector.profiles.v1';
const preload=`(()=>{(localStorage.getItem(${JSON.stringify(PROFILE_KEY)})||localStorage.setItem(${JSON.stringify(PROFILE_KEY)},JSON.stringify({version:1,active:${JSON.stringify(QA_PROFILE_ID)},profiles:[{id:${JSON.stringify(QA_PROFILE_ID)},scope:'',name:'QA',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));})();`;
// Google's sign-in script, as far as Study Director uses it. Each token
// request is counted so a reload can show the sign-in was kept.
const GIS=`window.__gisTokenRequests=0;window.google={accounts:{oauth2:{
  hasGrantedAllScopes(response,scope){return String(response&&response.scope||'').split(/\\s+/).includes(scope);},
  initTokenClient(config){return {requestAccessToken(){window.__gisTokenRequests+=1;setTimeout(()=>config.callback({access_token:'token-'+Date.now()+'-'+window.__gisTokenRequests,expires_in:3600,token_type:'Bearer',scope:'https://www.googleapis.com/auth/drive.file'}),0);}};},
  revoke(token,callback){setTimeout(()=>callback&&callback({successful:true}),0);}
}}};`;
const CORS=[{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PUT,PATCH,DELETE'},{name:'Access-Control-Expose-Headers',value:'*'}];

const drive=createDriveHarness(),faults=[];
// Every request to Google from either browser goes to the one simulated Drive.
// The ledger lists who uploaded and deleted what, for the steps and on failure.
const ledger=[];
async function attachDrive(page,who='?'){
  page.on('Fetch.requestPaused',async({requestId,request})=>{
    try{
      if(request.method==='OPTIONS'){await page.send('Fetch.fulfillRequest',{requestId,responseCode:204,responseHeaders:CORS});return;}
      if(request.url.startsWith('https://accounts.google.com/')){await page.send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[...CORS,{name:'Content-Type',value:'text/javascript'}],body:Buffer.from(GIS).toString('base64')});return;}
      const headers=request.headers||{},type=String(Object.entries(headers).find(([name])=>name.toLowerCase()==='content-type')?.[1]||'');
      const bytes=request.postDataEntries?Buffer.concat(request.postDataEntries.map(entry=>Buffer.from(entry.bytes||'','base64'))):request.postData!==undefined?Buffer.from(request.postData):null;
      const body=bytes===null?undefined:request.method==='PUT'||/multipart/u.test(type)?new Blob([bytes]):bytes.toString('utf8');
      const target=drive.state.files.get(decodeURIComponent(new URL(request.url).pathname.split('/').at(-1)));
      if(request.method==='DELETE')ledger.push(`${new Date().toISOString().slice(11,23)} ${who} DELETE ${target?.name||'?'} ${target?.appProperties?.studyDirectorRepositoryKind||''}`);
      const response=await drive.fetch(request.url,{method:request.method,headers,body});
      if(request.method==='POST'||request.method==='PUT'){try{const meta=await response.clone().json();if(meta&&meta.name)ledger.push(`${new Date().toISOString().slice(11,23)} ${who} ${request.method} ${meta.id} ${meta.name} ${meta.appProperties?.studyDirectorRepositoryKind||''} ${meta.appProperties?.studyDirectorDevice||meta.appProperties?.studyDirectorRepositoryDevice||''}`);}catch{}}
      const out=Buffer.from(await response.arrayBuffer());
      await page.send('Fetch.fulfillRequest',{requestId,responseCode:response.status,responseHeaders:[...CORS,...[...response.headers].map(([name,value])=>({name,value}))],body:out.toString('base64')});
    }catch(error){faults.push(`${request.method} ${request.url}: ${error.message}`);await page.send('Fetch.failRequest',{requestId,errorReason:'Failed'}).catch(()=>{});}
  });
  await page.send('Fetch.enable',{patterns:[{urlPattern:'https://accounts.google.com/*'},{urlPattern:'https://www.googleapis.com/*'}]});
}
const commits=()=>[...drive.state.files.values()].filter(file=>!file.trashed&&file.appProperties?.studyDirectorRepositoryKind==='commit').length;
const noteText=(page,key)=>page.evaluate(`(()=>{const note=__PWA6.AppData.notes.get(${JSON.stringify(key)});return note?String(note.text||''):null;})()`);
const sync=page=>page.evaluate(`__PWA6.BackupProviderRuntime.diagnosticSync()[0]||null`);
async function open(browser,server,who){
  const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload});
  await attachDrive(page,who);
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership'});
  return page;
}
async function reopen(page,label){
  await waitFor(()=>page.evaluate(`!!(window.__PWA6&&__PWA6.StartupLifecycle.status().fullyInitialized)`).catch(()=>false),{label,timeout:45000});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:`${label}: ownership`});
}
async function connect(page,label){
  const connected=await page.evaluate(`__PWA6.BackupProviderRuntime.connect('google-drive').then(value=>value===true||!!value,error=>'ERR '+(error&&error.message||error))`);
  assert.equal(connected,true,`${label}: Drive connects (${connected})`);
}
// Upload or cleanup markers on Drive: a device is saving or tidying up.
const markers=()=>[...drive.state.files.values()].some(file=>['publication','maintenance'].includes(file.appProperties?.studyDirectorRepositoryKind));
const uploadsBy=who=>ledger.filter(line=>line.split(' ')[1]===who&&/ POST \S+ cp_\S+\.sdcommit /u.test(line)).length;
const waiting=page=>page.evaluate(`__PWA6.BackupProviderRuntime.automaticWaiting()`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const server=await startReleaseServer();
const first=await launchChromium({profilePrefix:'sd-sync-a-'}),second=await launchChromium({profilePrefix:'sd-sync-b-'});
try{
  // A: a note, then Drive. The first upload carries it.
  let a=await open(first,server,'A');
  await a.evaluate(`(async()=>{__PWA6.AppData.notes.update('ethics','Ethics','Written on A','');await __PWA6.AppData.notes.flush({strict:true});})()`);
  await connect(a,'A');
  await waitFor(()=>commits()>=1,{label:'A uploads its first version',timeout:60000});
  await waitFor(async()=>!!(await sync(a))?.syncedAt,{label:'A synced',timeout:30000});

  // A reload keeps the sign-in: connected again without asking Google.
  await a.reload();await reopen(a,'A after reload');
  await waitFor(()=>a.evaluate(`__PWA6.BackupProviderRuntime.connected('google-drive')`),{label:'A still signed in after reload',timeout:20000});
  assert.equal(await a.evaluate(`window.__gisTokenRequests||0`),0,'the reload asked Google for no new sign-in');

  // B: the same profile on another device. Connecting brings A's note.
  const b=await open(second,server,'B');
  assert.equal(await noteText(b,'ethics'),null,'B starts without the note');
  await connect(b,'B');
  await waitFor(async()=>/Written on A/u.test(await noteText(b,'ethics')||''),{label:'B receives A\'s note',timeout:60000});
  await waitFor(async()=>!!(await sync(b))?.syncedAt,{label:'B synced',timeout:30000});

  // B's first sync uploads what it brought (its own first-start settings),
  // and Drive cleanup may follow. Both finish before A edits.
  await waitFor(async()=>!markers()&&!await waiting(b),{label:'B settles',timeout:90000});

  // A edits and goes to the background: the edit goes up (after B's turn,
  // if B is still saving).
  const before=uploadsBy('A');
  const edited=await a.evaluate(`(async()=>{const notes=__PWA6.AppData.notes,result=notes.update('ethics','Ethics','Edited on A',notes.get('ethics').updatedAt);await notes.flush({strict:true});await __PWA6.BackupProviderRuntime.flushAutomatic('app-hidden');return result.status;})()`);
  assert.equal(edited,'changed','A edits the note');
  await waitFor(async()=>uploadsBy('A')>before&&!await waiting(a),{label:'A uploads the edit',timeout:120000});

  // B comes back to the front a minute after its last check and takes it in.
  for(let wait=1;wait>0;){wait=(Date.parse((await sync(b)).checkedAt)||0)+61000-Date.now();if(wait>0)await sleep(wait);}
  await b.evaluate(`window.dispatchEvent(new Event('focus'))`);
  await waitFor(async()=>/Edited on A/u.test(await noteText(b,'ethics')||''),{label:'B takes in A\'s edit on return',timeout:30000});
  assert.equal((await sync(b)).needsReview,false,'nothing for review: only A changed the note');

  // Profiles on B: a new one is empty, the first keeps its notes, and a
  // removed one leaves nothing behind on this device.
  const original=await b.evaluate(`__PWA6.Profiles.current().id`);
  await b.evaluate(`setTimeout(()=>__PWA6.Profiles.add(),0)`);
  await sleep(1500);await reopen(b,'B in the added profile');
  const added=await b.evaluate(`__PWA6.Profiles.current()`);
  assert.notEqual(added.id,original,'the added profile is open');
  assert.equal(await noteText(b,'ethics'),null,'the added profile is empty');
  assert.equal(await b.evaluate(`__PWA6.BackupProviderRuntime.connected('google-drive')`),false,'the added profile is not signed in to Drive');
  const databases=()=>b.evaluate(`indexedDB.databases().then(rows=>rows.map(row=>row.name))`);
  await waitFor(async()=>(await databases()).some(name=>name.endsWith(added.scope)),{label:'the added profile has its own database'});

  await b.evaluate(`setTimeout(()=>__PWA6.Profiles.switchTo(${JSON.stringify(original)}),0)`);
  await sleep(1500);await reopen(b,'B back in the first profile');
  assert.equal(await b.evaluate(`__PWA6.Profiles.current().id`),original);
  assert.match(await noteText(b,'ethics')||'',/Edited on A/u,'the first profile keeps its notes');

  await b.evaluate(`setTimeout(()=>__PWA6.Profiles.switchTo(${JSON.stringify(added.id)}),0)`);
  await sleep(1500);await reopen(b,'B in the added profile again');
  await b.evaluate(`setTimeout(()=>__PWA6.Profiles.remove(),0)`);
  await sleep(1500);await reopen(b,'B after removing the added profile');
  assert.equal(await b.evaluate(`__PWA6.Profiles.current().id`),original,'removing opens the profile it came from');
  assert.deepEqual(await b.evaluate(`__PWA6.Profiles.list().map(row=>row.id)`),[original],'the removed profile is gone from the list');
  await waitFor(async()=>!(await databases()).some(name=>name.endsWith(added.scope)),{label:'the removed profile\'s database is deleted',timeout:20000});
  assert.match(await noteText(b,'ethics')||'',/Edited on A/u,'the remaining profile is untouched');

  assert.deepEqual(faults,[],'every Drive request was well formed');
  const errors=[...a.events,...b.events].filter(event=>/startup\.initialize|Uncaught/u.test(String(event.text||'')));
  assert.deepEqual(errors.map(event=>String(event.text).slice(0,200)),[],'no start-up or uncaught errors');
  console.log(JSON.stringify({status:'PASS',commits:commits(),requests:drive.state.requests.length}));
}catch(error){
  console.error(JSON.stringify({faults:faults.slice(0,10),drive:ledger.slice(-40)},null,1));
  throw error;
}finally{
  await first.close();await second.close();await server.close();
}
