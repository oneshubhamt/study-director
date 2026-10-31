import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createDriveHarness as createHarness,repositoryDigest as digest} from '../../helpers/drive-harness.mjs';
import {createFakeClock} from '../../helpers/fake-clock.mjs';
let folderVerificationMeasurement=null;
async function waitFor(predicate,message){
  for(let attempt=0;attempt<100;attempt++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,0));}
  assert.fail(message);
}




{
  const {state,provider}=createHarness();await provider.prepare();let changes=0;provider.subscribeConnection(()=>{changes+=1;});
  await provider.authorize();assert.equal(provider.connected(),true);assert.equal(changes,1,'Drive authorization must notify provider UI that the connection became valid');
  state.force401Once=true;await assert.rejects(()=>provider.repository.list({kind:'object'}),/authorization expired/u);assert.equal(provider.connected(),false);assert.equal(changes,2,'a Drive 401 must invalidate authorization and notify provider UI immediately');
  await provider.authorize();assert.equal(provider.connected(),true);assert.equal(changes,3,'reauthorization must notify provider UI that Drive is connected again');
  await provider.disconnect();assert.equal(provider.connected(),false);assert.equal(changes,4,'explicit Drive disconnect must notify provider UI immediately');
}

{
  const {state,provider}=createHarness();await provider.prepare();state.expiresIn=1;let changes=0;provider.subscribeConnection(()=>{changes+=1;});await provider.authorize();assert.equal(provider.connected(),true);assert.equal(changes,1);
  await new Promise(resolve=>setTimeout(resolve,1100));assert.equal(provider.connected(),false,'Drive connected state must expire without requiring a user action');assert.equal(changes,2,'scheduled OAuth expiry must notify provider UI so stale Backup/Versions/Settings controls disappear');
}

// The sign-in lasts across a reload until it expires: it is kept in this
// browser's storage, forgotten on expiry, rejection and disconnect, and
// picked up by other tabs.
{
  const KEY='studyDirector.driveSession.v1',rows=new Map(),storage={getItem:key=>rows.has(key)?rows.get(key):null,setItem:(key,value)=>{rows.set(key,String(value));},removeItem:key=>{rows.delete(key);}};
  const first=createHarness({localStorage:storage});await first.provider.prepare();await first.provider.authorize();
  const saved=JSON.parse(rows.get(KEY));assert.match(saved.token,/^token-/u);assert.ok(saved.expiresAt>Date.now()&&saved.expiresAt<=Date.now()+3600000);assert.deepEqual(Object.keys(saved).sort(),['expiresAt','token'],'only the token and its expiry are kept');
  const reloaded=createHarness({localStorage:storage});assert.equal(reloaded.provider.connected(),true,'a reload keeps the Drive sign-in for the rest of its hour');assert.equal(reloaded.provider.connectionExpiresAt(),saved.expiresAt);
  await reloaded.provider.repository.list({kind:'object'});assert.equal(reloaded.state.requests.at(-1).authorization,'Bearer '+saved.token,'the kept sign-in is used without asking again');
  reloaded.state.force401Once=true;await assert.rejects(()=>reloaded.provider.repository.list({kind:'object'}),/authorization expired/u);assert.equal(rows.has(KEY),false,'a sign-in Google rejects is forgotten');
  rows.set(KEY,JSON.stringify({token:'token-old',expiresAt:Date.now()-1000}));assert.equal(createHarness({localStorage:storage}).provider.connected(),false);assert.equal(rows.has(KEY),false,'an expired sign-in is removed, not used');
  rows.set(KEY,JSON.stringify({token:'token-far',expiresAt:Date.now()+86400000}));assert.equal(createHarness({localStorage:storage}).provider.connected(),false,'a sign-in claiming to last a day is not trusted');
  rows.set(KEY,'{broken');assert.equal(createHarness({localStorage:storage}).provider.connected(),false);assert.equal(rows.has(KEY),false);
  const listeners=[],tab=createHarness({localStorage:storage,addEventListener:(type,listener)=>{if(type==='storage')listeners.push(listener);}});assert.equal(tab.provider.connected(),false);
  const signer=createHarness({localStorage:storage});await signer.provider.prepare();await signer.provider.authorize();const value=rows.get(KEY);
  for(const listener of listeners)listener({key:KEY,newValue:value,oldValue:null});assert.equal(tab.provider.connected(),true,'another tab picks up a new sign-in');
  await signer.provider.disconnect();assert.equal(rows.has(KEY),false,'disconnect forgets the sign-in');
  for(const listener of listeners)listener({key:KEY,newValue:null,oldValue:value});assert.equal(tab.provider.connected(),false,'disconnecting in one tab signs out the others');
  const plain=createHarness();await plain.provider.prepare();await plain.provider.authorize();assert.equal(plain.provider.connected(),true,'without browser storage Drive still signs in');
}

const makeRepositoryFile=async(kind,id,text,checkProtection=async()=>{},checkSource=async()=>{})=>{const blob=new Blob([text],{type:'application/octet-stream'});return {kind,id,name:id+(kind==='object'?'.sdobject':kind==='commit'?'.sdcommit':kind==='session-claim'?'.sdsessionclaim':'.sdcheckpoint'),blob,size:blob.size,digest:await digest(blob),exportedAt:'2026-09-19T00:00:00.000Z',appVersion:'QA_FIXTURE',checkProtection,checkSource};};

{
  const {provider}=createHarness();await provider.prepare();await provider.authorize();
  const id='sc_'+'1'.padStart(16,'0'),text=JSON.stringify({format:'study-director.active-session-claim',version:1,date:'2026-09-19',epoch:1,owner:'inst_qa_laptop_mve00000_aaaaaaaa',observedRevision:7,claimedAt:'2026-09-19T12:00:00.000Z'}),file=await makeRepositoryFile('session-claim',id,text);
  const uploaded=await provider.repository.uploadSessionClaim(file),listed=await provider.repository.listSessionClaims();
  assert.equal(listed.overflow,false);assert.equal(listed.items.length,1);assert.equal(listed.items[0].id,id);assert.equal(listed.items[0].digest,file.digest);
  const opened=await provider.repository.downloadSessionClaim(listed.items[0]);try{assert.equal(await opened.blob.text(),text);}finally{await opened.release();}
  assert.equal(await provider.repository.deleteSessionClaim(uploaded),true);assert.equal((await provider.repository.listSessionClaims()).items.length,0);
}

// Complete history discovery is independent of retention capacity. Page work
// stays bounded, while incomplete searches and repeated tokens cannot certify it.
{
 const {state,provider}=createHarness();await provider.prepare();await provider.authorize();state.pageSizes={checkpoint:1,commit:1};
 for(const kind of ['checkpoint','commit']){
  const seed=await provider.repository.upload(await makeRepositoryFile(kind,'cp_'+(9000).toString(16).padStart(32,'0'),'inventory transport proof')),template=state.files.get(seed.remoteId);
  for(let index=1;index<110;index++){const id='cp_'+(9000+index).toString(16).padStart(32,'0'),remoteId=kind+'-page-'+index;state.files.set(remoteId,{...template,id:remoteId,name:id+(kind==='commit'?'.sdcommit':'.sdcheckpoint'),appProperties:{...template.appProperties,studyDirectorRepositoryId:id}});}
  const inventory=await provider.repository.list({kind});assert.equal(inventory.items.length,110);assert.equal(inventory.overflow,false,'a healthy finite history must cross both former inventory bounds');
 }
 state.incompleteSearchKinds=new Set(['checkpoint']);const incomplete=await provider.repository.list({kind:'checkpoint'});assert.equal(incomplete.overflow,true);assert.equal(incomplete.items.length,0,'an explicitly incomplete Drive search cannot become a complete inventory');
 state.incompleteSearchKinds.clear();state.repeatPageKinds=new Set(['checkpoint']);await assert.rejects(()=>provider.repository.list({kind:'checkpoint'}),/repeated a backup inventory page/u);
 assert.equal(state.deletions.length,0);await provider.disconnect();
}

{
 const {state,provider}=createHarness();await provider.prepare();await provider.authorize();const original=await makeRepositoryFile('object','obj_'+'f'.repeat(32),'ranged repository bytes'),ref=await provider.repository.upload(original);
 const range=await provider.repository.download(ref,{offset:7,length:5});assert.equal(await range.blob.text(),'repos');assert.equal(range.totalBytes,original.blob.size);assert.ok(range.version);
 for(const mode of ['ignored','wrong-range','truncated']){state.rangeMode=mode;await assert.rejects(provider.repository.download(ref,{offset:7,length:5}),/requested backup range|incomplete backup range/u);}
 state.rangeMode='valid';const abort=new AbortController();abort.abort(new Error('test cancellation'));await assert.rejects(provider.repository.download(ref,{offset:0,length:5,signal:abort.signal}));
}

{
  const {state,provider}=createHarness();await provider.prepare();await provider.authorize();
  const largeId='obj_'+'a'.repeat(32),largeFile=await makeRepositoryFile('object',largeId,'x'.repeat(5*1024*1024+1));
  state.evilUploadLocation=true;await assert.rejects(()=>provider.repository.upload(largeFile),/unexpected Google Drive endpoint|invalid upload session/u);assert.equal(state.requests.some(request=>/attacker\.example/u.test(request.url)),false,'untrusted upload locations must never receive a request');
  state.networkFailPutOnce=true;const uploadedLarge=await provider.repository.upload(largeFile);assert.equal(uploadedLarge.id,largeId);assert.equal(uploadedLarge.serverDigest,largeFile.digest);assert.ok(state.requests.some(request=>request.method==='PUT'&&request.url.includes('/upload/drive/v3/files')&&request.url.includes('upload_id=')),'genuinely large repository objects must retain resumable uploads');
}

{
  const {state,provider}=createHarness();await provider.prepare();
  assert.equal(typeof provider.backgroundAvailable,'function','Drive must expose a non-interactive background-availability probe');assert.equal(provider.backgroundAvailable(),false,'Drive background work must not run before an in-memory OAuth token exists');
  assert.ok(provider.repository,'Drive must expose repository transport');
  assert.equal(provider.save,undefined,'legacy monolithic Drive save path must be retired');
  assert.equal(provider.load,undefined,'legacy monolithic Drive load path must be retired');
  for(const key of ['list','upload','download','delete','beginPublication','listPublications','assertPublication','endPublication','beginMaintenance','listMaintenances','assertMaintenance','endMaintenance','beginOperation'])assert.equal(typeof provider.repository[key],'function');
  assert.equal(provider.repository.historyReadConcurrency,8,'Drive immutable-history verification should use the shared eight-read concurrency ceiling');
  state.scope='https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly';await assert.rejects(()=>provider.authorize(),/permissions beyond/u);state.scope='https://www.googleapis.com/auth/drive.file';await provider.authorize();assert.equal(provider.backgroundAvailable(),true,'Drive background work may proceed while the existing OAuth token remains valid');
  const objectId='obj_'+'1'.repeat(32),file=await makeRepositoryFile('object',objectId,'repository-object-proof');
  const uploaded=await provider.repository.upload(file);assert.equal(uploaded.id,objectId);assert.equal(uploaded.digest,file.digest);assert.equal(uploaded.serverDigest,file.digest,'small repository uploads must be accepted from Drive server SHA-256 without a read-back download');assert.match(uploaded.remoteVersion,/^\d+$/u,'Drive repository descriptors must expose the fresh remote file version for verified-history reuse');assert.match(uploaded.verificationScope,/^drive-repository:1:1:folder-/u,'Drive repository descriptors must bind verified-history reuse to the stable revalidated repository folder rather than an operation epoch');
  assert.ok(state.requests.some(request=>request.method==='POST'&&request.url.includes('/upload/drive/v3/files')&&request.url.includes('uploadType=multipart')),'tiny repository files must use one-request multipart upload');assert.equal(state.requests.some(request=>request.method==='PUT'&&request.url.includes('/upload/drive/v3/files')),false,'tiny repository files must not pay for a resumable PUT round trip');
  const listed=await provider.repository.list({kind:'object'});assert.equal(listed.items.length,1);assert.equal(listed.items[0].id,objectId);const stableScope=listed.items[0].verificationScope;provider.release();await provider.authorize();const relistedAfterSession=await provider.repository.list({kind:'object'});assert.equal(relistedAfterSession.items[0].verificationScope,stableScope,'freshly revalidated access to the same Drive repository folder must preserve verified-history cache scope across provider sessions');
  const downloaded=await provider.repository.download(uploaded);assert.equal(await downloaded.blob.text(),'repository-object-proof');await downloaded.release();assert.equal(state.releasedDownloads,1,'Drive repository downloads must release their temporary local file immediately after use');
  const remote=[...state.files.values()].find(row=>row.appProperties.studyDirectorRepositoryId===objectId);assert.ok(remote);assert.equal(remote.appProperties.studyDirectorRepository,'true');assert.equal(remote.appProperties.studyDirectorRepositoryKind,'object');assert.equal(remote.appProperties.studyDirectorBackup,undefined,'repository objects must not carry retired whole-backup markers');
  await assert.rejects(()=>provider.repository.delete({...uploaded,digest:'f'.repeat(64)}),/changed before deletion/u);assert.equal(state.deletions.length,0,'digest mismatch must fail closed before deletion');
  remote.version=Number(uploaded.remoteVersion)+1;await assert.rejects(()=>provider.repository.delete(uploaded),/changed version before deletion/u);assert.equal(state.deletions.length,0,'remote-version mismatch must fail closed before deletion even when digest metadata is unchanged');remote.version=Number(uploaded.remoteVersion);
  assert.equal(await provider.repository.delete(uploaded),true);assert.equal((await provider.repository.list({kind:'object'})).items.length,0);
  const historyCheckpointId='cp_'+'b'.repeat(32),historyCheckpoint={...(await makeRepositoryFile('checkpoint',historyCheckpointId,'history-metadata-proof')),historySummary:{logicalFingerprint:'c'.repeat(64),counts:{dailyRecord:4,note:3},encrypted:false,retention:{role:'normal',protectedUntil:'',calendar:{localDate:'2026-09-19',weekStart:'2026-09-14',month:'2026-09',utcOffsetMinutes:0}}}},uploadedHistoryCheckpoint=await provider.repository.upload(historyCheckpoint),listedHistoryCheckpoints=await provider.repository.list({kind:'checkpoint'});assert.equal(listedHistoryCheckpoints.items.length,1);assert.deepEqual(JSON.parse(JSON.stringify(listedHistoryCheckpoints.items[0].history.retention.calendar)),{localDate:'2026-09-19',weekStart:'2026-09-14',month:'2026-09',utcOffsetMinutes:0},'Drive checkpoint metadata must round-trip the retention calendar so history can be tiered without downloading manifests');assert.equal(await provider.repository.delete(uploadedHistoryCheckpoint),true);
  const checkpointId='cp_'+'9'.repeat(32),commit=await makeRepositoryFile('commit',checkpointId,JSON.stringify({format:'study-director.backup-repository-commit',version:1,checkpointId,exportedAt:'2026-09-19T00:00:00.000Z',sourceRevision:'2026-09-19T00:00:00.000Z',manifestVersion:2})),uploadedCommit=await provider.repository.upload(commit);assert.equal(uploadedCommit.kind,'commit');assert.equal(uploadedCommit.name,checkpointId+'.sdcommit');const listedCommits=await provider.repository.list({kind:'commit'});assert.equal(listedCommits.items.length,1);assert.equal(listedCommits.items[0].id,checkpointId);const downloadedCommit=await provider.repository.download(uploadedCommit);assert.equal(JSON.parse(await downloadedCommit.blob.text()).checkpointId,checkpointId);await downloadedCommit.release();assert.equal(await provider.repository.delete(uploadedCommit),true);assert.equal((await provider.repository.list({kind:'commit'})).items.length,0,'Drive commit markers must use the same exact-identity transport lifecycle as manifests and objects');
  assert.ok(state.requests.filter(request=>request.authorization).every(request=>request.authorization.startsWith('Bearer token-')));
}

{
  const {state,provider}=createHarness();await provider.prepare();state.scope='https://www.googleapis.com/auth/drive.file';await provider.authorize();
  const [checkpoints,commits,objects]=await Promise.all([provider.repository.list({kind:'checkpoint'}),provider.repository.list({kind:'commit'}),provider.repository.list({kind:'object'})]);
  assert.equal(checkpoints.items.length,0);assert.equal(commits.items.length,0);assert.equal(objects.items.length,0);
  const folderCreates=state.requests.filter(request=>request.method==='POST'&&new URL(request.url).pathname==='/drive/v3/files').length;
  assert.equal(folderCreates,1,'concurrent cold repository listings must share one folder discovery/creation flight');
  assert.equal(state.folders.length,1,'cold repository resolution must create exactly one marked folder');
  const metadataBefore=state.requests.filter(request=>request.method==='GET'&&/\/drive\/v3\/files\/folder-1(?:\?|$)/u.test(new URL(request.url).pathname+new URL(request.url).search)).length;
  await provider.repository.list({kind:'object'});
  const metadataAfter=state.requests.filter(request=>request.method==='GET'&&new URL(request.url).pathname==='/drive/v3/files/folder-1').length;
  assert.ok(metadataAfter>metadataBefore,'single-flight result must be released after settlement so later operations perform the existing fresh folder verification');
}

{
  const {state,provider}=createHarness();await provider.prepare();state.scope='https://www.googleapis.com/auth/drive.file';await provider.authorize();
  await provider.repository.list({kind:'object'});
  const folderVerificationCount=()=>state.requests.filter(request=>{if(request.method!=='GET')return false;const url=new URL(request.url);const q=String(url.searchParams.get('q')||'');return url.pathname==='/drive/v3/files/folder-1'||url.pathname==='/drive/v3/files'&&q.includes("mimeType='application/vnd.google-apps.folder'")&&!q.includes('studyDirectorDeletedProfile');}).length;
  const directBefore=folderVerificationCount();
  await provider.repository.list({kind:'checkpoint'});await provider.repository.list({kind:'commit'});await provider.repository.list({kind:'object'});
  const directChecks=folderVerificationCount()-directBefore;assert.equal(directChecks,3,'independent Drive operations must retain fresh folder verification');
  const operation=provider.repository.beginOperation();assert.equal(operation.historyReadConcurrency,8,'scoped Drive operations must retain the shared eight-read immutable-history ceiling');const scopedBefore=folderVerificationCount();
  await operation.list({kind:'checkpoint'});await operation.list({kind:'commit'});await operation.list({kind:'object'});
  const scopedChecks=folderVerificationCount()-scopedBefore;assert.equal(scopedChecks,1,'one Drive repository operation must reuse one verified folder receipt');

  const controller=new AbortController(),preemptible=provider.repository.beginOperation({signal:controller.signal}),publication=await preemptible.beginPublication();
  controller.abort(Object.assign(new Error('foreground preemption'),{name:'AbortError',code:'REPOSITORY_BACKGROUND_PREEMPTED'}));
  assert.equal(await preemptible.endPublication(publication),true,'publication-marker retirement must survive an expected operation abort');
  assert.equal((await provider.repository.listPublications()).items.some(row=>row.id===publication.id),false,'preempted publication marker must be physically retired');

  const invalidated=provider.repository.beginOperation();await invalidated.list({kind:'object'});const beforeContradiction=folderVerificationCount();
  state.folderShared=true;await assert.rejects(()=>provider.repository.list({kind:'object'}),/no longer private and owned/u,'contradictory folder metadata must fail closed and invalidate prior receipts');
  state.folderShared=false;const beforeRevalidation=folderVerificationCount();await invalidated.list({kind:'object'});
  assert.equal(folderVerificationCount()-beforeRevalidation,1,'an operation receipt invalidated by contradictory metadata must reverify before reuse');
  folderVerificationMeasurement={directChecks,scopedChecks,contradictionChecks:folderVerificationCount()-beforeContradiction};
}

{
  const {state,provider}=createHarness();await provider.prepare();state.scope='https://www.googleapis.com/auth/drive.file';await provider.authorize();
  await provider.repository.list({kind:'object'});assert.deepEqual(state.folders,['folder-1']);
  const oldFolder=state.folders[0];state.folders=[];for(const [id,file] of [...state.files])if(file.parents.includes(oldFolder))state.files.delete(id);
  const result=await provider.repository.list({kind:'checkpoint'});assert.equal(result.items.length,0,'the first operation after external Drive repository deletion must recover as a fresh empty repository');
  assert.deepEqual(state.folders,['folder-2'],'a cached deleted Drive folder must be forgotten and replaced within the same operation');
  assert.ok(state.requests.some(request=>request.method==='GET'&&new URL(request.url).pathname==='/drive/v3/files/folder-1'),'self-healing must verify the remembered repository identity before creating a replacement');
}

{
  const {state,provider}=createHarness();await provider.prepare();state.scope='https://www.googleapis.com/auth/drive.file';await provider.authorize();
  await provider.repository.list({kind:'object'});const oldFolder=state.folders[0];state.trashedFolders.add(oldFolder);
  const result=await provider.repository.list({kind:'checkpoint'});assert.equal(result.items.length,0,'a Drive repository moved to Trash must be treated as externally deleted and replaced in the same operation');assert.deepEqual(state.folders.filter(id=>!state.trashedFolders.has(id)),['folder-2'],'the replacement repository must be the only active marked folder after the old folder is trashed');
}

{
  const {state,provider}=createHarness();await provider.prepare();state.scope='https://www.googleapis.com/auth/drive.file';await provider.authorize();state.folderCreateDenied=true;
  const failed=await Promise.allSettled([provider.repository.list({kind:'checkpoint'}),provider.repository.list({kind:'commit'})]);
  assert.ok(failed.every(result=>result.status==='rejected'),'all callers sharing a failed cold-folder resolution must observe the same failure');
  assert.equal(state.requests.filter(request=>request.method==='POST'&&new URL(request.url).pathname==='/drive/v3/files').length,1,'a failed concurrent cold-folder resolution must still issue only one create request');
  state.folderCreateDenied=false;await provider.repository.list({kind:'object'});
  assert.equal(state.requests.filter(request=>request.method==='POST'&&new URL(request.url).pathname==='/drive/v3/files').length,2,'a failed single-flight must clear so a later operation can retry folder creation');
  assert.equal(state.folders.length,1,'retry after a failed single-flight must create one clean repository folder');
}

{
  const {state,provider}=createHarness();await provider.prepare();state.scope='https://www.googleapis.com/auth/drive.file';await provider.authorize();state.folders.push('folder-1','folder-2');
  await assert.rejects(()=>provider.repository.list({kind:'object'}),/More than one marked Study Director backup folder/u,'ambiguous app-owned folder identity must stop repository access');
}

{
  const {state,provider}=createHarness();await provider.prepare();await provider.authorize();const objectId='obj_'+'2'.repeat(32),file=await makeRepositoryFile('object',objectId,'policy-boundary');let checks=0;
  await assert.rejects(()=>provider.repository.upload({...file,checkProtection:async()=>{checks+=1;if(checks>=2)throw Object.assign(new Error('policy changed'),{name:'AbortError',code:'BACKUP_POLICY_CHANGED'});}}),/policy changed/u);
  assert.equal(state.deletions.length,0,'policy changes must never trigger deletion/cleanup inside the transport');
}


{
  const {state,provider}=createHarness();await provider.prepare();await provider.authorize();const checkpointId='cp_'+'4'.repeat(32);let sourceChecks=0;
  const file=await makeRepositoryFile('checkpoint',checkpointId,'source-fence-checkpoint',async()=>{},async()=>{sourceChecks+=1;if(state.requests.some(request=>request.url.includes('/upload/drive/v3/files')&&['POST','PUT'].includes(request.method)))throw Object.assign(new Error('source changed during manifest publication'),{name:'AbortError',code:'BACKUP_SOURCE_CHANGED'});});
  await assert.rejects(()=>provider.repository.upload(file),/source changed during manifest publication/u,'Drive transport must keep the source-revision fence active through resumable checkpoint publication');
  assert.ok(sourceChecks>=2,'checkpoint publication must recheck source state more than once');
}


{
  const {state,provider}=createHarness();await provider.prepare();await provider.authorize();
  let releaseFolder;state.folderListGate=new Promise(resolve=>{releaseFolder=resolve;});
  const firstController=new AbortController(),secondController=new AbortController();
  const first=provider.repository.list({kind:'checkpoint',signal:firstController.signal});
  const second=provider.repository.list({kind:'commit',signal:secondController.signal});
  await waitFor(()=>state.folderListStarted===1,'parallel lists must share one in-flight folder lookup before cancellation');
  firstController.abort(new Error('cancel first Drive context'));
  await assert.rejects(first,/cancel first Drive context/u,'cancelling one repository context must reject only that caller');
  releaseFolder();state.folderListGate=null;
  const secondResult=await second;assert.equal(secondResult.items.length,0,'a sibling repository context must survive another caller cancellation');
  assert.equal(state.requests.filter(request=>request.method==='POST'&&new URL(request.url).pathname==='/drive/v3/files').length,1,'surviving folder-resolution waiter must retain the single cold-folder creation');
}

{
  const {state,provider}=createHarness();await provider.prepare();await provider.authorize();await provider.repository.list({kind:'object'});
  let releaseUploads;state.uploadPutGate=new Promise(resolve=>{releaseUploads=resolve;});let failSourceA=false,sourceA=0,sourceB=0;
  const fileA=await makeRepositoryFile('object','obj_'+'5'.repeat(32),'parallel-source-A',async()=>{},async()=>{sourceA+=1;if(failSourceA)throw Object.assign(new Error('source A changed'),{name:'AbortError',code:'BACKUP_SOURCE_CHANGED'});});
  const fileB=await makeRepositoryFile('object','obj_'+'6'.repeat(32),'parallel-source-B',async()=>{},async()=>{sourceB+=1;});
  const uploadA=provider.repository.upload(fileA),uploadB=provider.repository.upload(fileB);
  await waitFor(()=>state.uploadPutStarted>=2,'parallel source-context uploads must both reach their independent PUT requests');failSourceA=true;releaseUploads();state.uploadPutGate=null;
  const [resultA,resultB]=await Promise.allSettled([uploadA,uploadB]);
  assert.equal(resultA.status,'rejected','source failure must stop its own upload context');assert.match(String(resultA.reason&&resultA.reason.message),/source A changed/u);
  assert.equal(resultB.status,'fulfilled','source failure in one upload context must not poison a sibling upload');assert.ok(sourceA>=2&&sourceB>=2,'each upload must retain its own source fence callbacks throughout publication');
}

{
  const {state,provider}=createHarness();await provider.prepare();await provider.authorize();await provider.repository.list({kind:'object'});
  let releaseUploads;state.uploadPutGate=new Promise(resolve=>{releaseUploads=resolve;});let failProtectionA=false,protectionA=0,protectionB=0;
  const fileA=await makeRepositoryFile('object','obj_'+'7'.repeat(32),'parallel-protection-A',async()=>{protectionA+=1;if(failProtectionA)throw Object.assign(new Error('protection A changed'),{name:'AbortError',code:'BACKUP_POLICY_CHANGED'});},async()=>{});
  const fileB=await makeRepositoryFile('object','obj_'+'8'.repeat(32),'parallel-protection-B',async()=>{protectionB+=1;},async()=>{});
  const uploadA=provider.repository.upload(fileA),uploadB=provider.repository.upload(fileB);
  await waitFor(()=>state.uploadPutStarted>=2,'parallel protection-context uploads must both reach their independent PUT requests');failProtectionA=true;releaseUploads();state.uploadPutGate=null;
  const [resultA,resultB]=await Promise.allSettled([uploadA,uploadB]);
  assert.equal(resultA.status,'rejected','protection failure must stop its own upload context');assert.match(String(resultA.reason&&resultA.reason.message),/protection A changed/u);
  assert.equal(resultB.status,'fulfilled','protection failure in one upload context must not poison a sibling upload');assert.ok(protectionA>=2&&protectionB>=2,'each upload must retain its own protection fence callbacks throughout publication');
}

{
  const {state,provider}=createHarness();await provider.prepare();await provider.authorize();const objectId='obj_'+'3'.repeat(32),file=await makeRepositoryFile('object',objectId,'duplicate-proof');const uploaded=await provider.repository.upload(file);assert.equal(uploaded.serverDigest,file.digest,'Drive upload receipts must expose the output-only server SHA-256 for binary content');const original=[...state.files.values()].find(row=>row.appProperties.studyDirectorRepositoryId===objectId);const duplicate={...original,id:'repo-duplicate',content:original.content,appProperties:{...original.appProperties}};state.files.set(duplicate.id,duplicate);
  await assert.rejects(()=>provider.repository.upload(file),/Duplicate Study Director backup files/u,'duplicate logical repository identities must fail closed');
  assert.ok(state.files.has(uploaded.remoteId)&&state.files.has('repo-duplicate'),'duplicate detection must not mutate either remote object');
}


{
  const {state,provider}=createHarness();await provider.prepare();await provider.authorize();
  const operation=provider.repository.beginOperation();state.networkFailCoordinationPostOnce=true;const marker=await operation.beginPublication();assert.match(marker.id,/^pub_[a-f0-9]{32}$/u);assert.equal(marker.kind,'publication');assert.equal([...state.files.values()].filter(file=>file.appProperties.studyDirectorRepositoryKind==='publication').length,1,'ambiguous publication creation must recover the exact pre-generated marker instead of creating a duplicate');
  let active=await operation.listPublications();assert.equal(active.items.length,1,'a live Drive publication marker must be visible to repository maintenance');assert.equal(active.ignored,0);
  const verified=await operation.assertPublication(marker);assert.equal(verified.id,marker.id,'the writer must be able to reverify its publication protection before manifest/commit publication');
  const publicationReleaseStart=state.requests.length;state.networkFailCoordinationDeleteOnce=true;assert.equal(await operation.endPublication(marker),true);const publicationReleaseRequests=state.requests.slice(publicationReleaseStart).map(request=>({method:request.method,url:new URL(request.url)}));assert.equal(publicationReleaseRequests.some(request=>request.method==='GET'&&request.url.pathname===`/drive/v3/files/${marker.remoteId}`),false,'known verified publication release must DELETE directly instead of paying for a redundant metadata GET');active=await operation.listPublications();assert.equal(active.items.length,0,'ambiguous publication deletion must recheck exact identity and retry until the marker is confirmed absent');
  await assert.rejects(()=>operation.assertPublication(marker),/disappeared before commit/u,'a writer whose publication protection disappeared must fail before committing');
  assert.equal([...state.files.values()].some(file=>file.appProperties.studyDirectorRepositoryKind==='publication'),false,'publication markers must not leak into repository history after release');
}

{
  // An upload marker names the device it comes from, so a device never waits
  // its turn for a marker an earlier page of its own left behind.
  let device='inst_qa_laptop_mve00000_aaaaaaaa';const {state,provider}=createHarness({device:()=>device});await provider.prepare();await provider.authorize();
  const mine=await provider.repository.beginPublication();device='inst_qa_phone_mve00000_bbbbbbbb';const theirs=await provider.repository.beginPublication();
  const older=[...state.files.values()].find(file=>file.appProperties.studyDirectorRepositoryId===theirs.id);const legacy={...older,id:'repo-legacy-marker',appProperties:{...older.appProperties,studyDirectorRepositoryId:'pub_'+'c'.repeat(32)}};delete legacy.appProperties.sdPublicationDevice;legacy.name='pub_'+'c'.repeat(32)+older.name.slice(older.name.indexOf('.'));state.files.set(legacy.id,legacy);
  device='inst_qa_laptop_mve00000_aaaaaaaa';const listed=new Map((await provider.repository.listPublications()).items.map(row=>[row.id,row.sameDevice]));
  assert.equal(listed.get(mine.id),true,'a marker this device started reads as its own');assert.equal(listed.get(theirs.id),false,'another device\'s marker does not');assert.equal(listed.get('pub_'+'c'.repeat(32)),false,'a marker from an older build, with no device, counts as another device\'s');
  device='';assert.equal((await provider.repository.listPublications()).items.every(row=>row.sameDevice===false),true,'without a known device nothing reads as its own');
}

{
  const {state,provider}=createHarness();await provider.prepare();await provider.authorize();
  const operation=provider.repository.beginOperation();state.networkFailCoordinationPostOnce=true;const marker=await operation.beginMaintenance();assert.match(marker.id,/^mnt_[a-f0-9]{32}$/u);assert.equal(marker.kind,'maintenance');assert.equal([...state.files.values()].filter(file=>file.appProperties.studyDirectorRepositoryKind==='maintenance').length,1,'ambiguous maintenance creation must recover the exact pre-generated marker instead of creating a duplicate');
  let active=await operation.listMaintenances();assert.equal(active.items.length,1,'a live Drive maintenance marker must be visible to publication coordination');assert.equal(active.ignored,0);
  const verified=await operation.assertMaintenance(marker);assert.equal(verified.id,marker.id,'destructive maintenance must be able to reverify its provider-visible protection');
  const markerFile=state.files.get(marker.remoteId);assert.equal(markerFile.appProperties.studyDirectorRepositoryVersion,'2','the longer network lease must not be mistaken for the legacy 60-second marker');
  const maxAge=Date.parse(marker.expiresAt)-Date.parse(marker.createdAt);assert.equal(maxAge,300000);
  markerFile.createdTime=new Date(Date.now()-31*1000).toISOString();await operation.assertMaintenance(marker);
  markerFile.createdTime=new Date(Date.now()-(maxAge-75000)).toISOString();await assert.rejects(()=>operation.assertMaintenance(marker),/too old/u,'network protection must retain room for a bounded request and release');
  markerFile.appProperties.studyDirectorRepositoryVersion='1';markerFile.createdTime=new Date(Date.now()-31*1000).toISOString();await assert.rejects(()=>operation.assertMaintenance(marker),/too old/u,'legacy markers retain their original assertion and expiry semantics');
  markerFile.createdTime=marker.createdAt;assert.equal(Date.parse((await operation.listMaintenances()).items[0].expiresAt)-Date.parse(marker.createdAt),60000);
  markerFile.appProperties.studyDirectorRepositoryVersion='3';const unknown=await operation.listMaintenances();assert.equal(unknown.items.length,0);assert.equal(unknown.ignored,1,'unrecognized marker protocols remain uncertainty, which blocks coordinated writers and cleanup');
  markerFile.appProperties.studyDirectorRepositoryVersion='2';markerFile.createdTime=marker.createdAt;markerFile.modifiedTime=marker.createdAt;
  const maintenanceReleaseStart=state.requests.length;state.networkFailCoordinationDeleteOnce=true;assert.equal(await operation.endMaintenance(marker),true);const maintenanceReleaseRequests=state.requests.slice(maintenanceReleaseStart).map(request=>({method:request.method,url:new URL(request.url)}));assert.equal(maintenanceReleaseRequests.some(request=>request.method==='GET'&&request.url.pathname===`/drive/v3/files/${marker.remoteId}`),false,'known verified maintenance release must DELETE directly instead of paying for a redundant metadata GET');active=await operation.listMaintenances();assert.equal(active.items.length,0,'ambiguous maintenance deletion must recheck exact identity and retry until the marker is confirmed absent');
  await assert.rejects(()=>operation.assertMaintenance(marker),/disappeared during cleanup/u,'maintenance whose provider-visible protection disappeared must fail closed before more deletion');
  assert.equal([...state.files.values()].some(file=>file.appProperties.studyDirectorRepositoryKind==='maintenance'),false,'maintenance markers must not leak into repository history after release');
}

// Renewal preserves exclusion across immutable-marker rotation, including
// ambiguous transport outcomes, and rejects missing/expired/foreign protection.
for(const failure of ['none','legacy','missing','expired','unreadable-age','foreign']){
 const clock=createFakeClock('2026-10-03T12:00:00.000Z'),h=createHarness({clock});await h.provider.prepare();await h.provider.authorize();
 const operation=h.provider.repository.beginOperation(),marker=await operation.beginMaintenance();
 if(failure==='missing')h.state.files.delete(marker.remoteId);
 if(failure==='expired')await clock.advance(Date.parse(marker.expiresAt)-clock.now()+1000);
 if(failure==='legacy')h.state.files.get(marker.remoteId).appProperties.studyDirectorRepositoryVersion='1';
 if(failure==='unreadable-age')h.state.files.get(marker.remoteId).createdTime='unreadable';
 if(failure==='foreign')h.state.files.get(marker.remoteId).parents=['foreign-folder'];
 if(failure==='none'||failure==='legacy'){
  await clock.advance(failure==='legacy'?10000:40000);h.state.networkFailCoordinationPostOnce=true;h.state.networkFailCoordinationDeleteOnce=true;
  const next=await operation.renewMaintenance(marker);assert.notEqual(next.id,marker.id);assert.equal(h.state.files.has(marker.remoteId),false);
  assert.equal((await operation.listMaintenances()).items.length,1);assert.equal(h.state.files.get(next.remoteId).appProperties.studyDirectorRepositoryVersion,'2');await operation.assertMaintenance(next);await operation.endMaintenance(next);
 }else{
  await assert.rejects(operation.renewMaintenance(marker),/interrupted|fresh inventory/u);
  assert.equal([...h.state.files.values()].filter(file=>file.appProperties.studyDirectorRepositoryKind==='maintenance').length,failure==='missing'?0:1,'failed renewal removes only its new candidate marker');
 }
 assert.equal(h.state.requests.some(request=>request.method==='PATCH'),false,'renewal retains immutable metadata and the existing endpoint policy');
 await h.provider.disconnect();assert.equal(clock.pending(),0);
}

// Cancellation releases only coordination artifacts, using the same verified
// operation scope. Invalidating that scope still forces a fresh folder check.
for(const invalidate of [false,true]){
 const h=createHarness(),controller=new AbortController();await h.provider.prepare();await h.provider.authorize();
 const operation=h.provider.repository.beginOperation({signal:controller.signal}),marker=await operation.beginMaintenance();
 if(invalidate){h.state.trashedFolders.add('folder-1');await h.provider.repository.scope();}
 const start=h.state.requests.length;controller.abort();await operation.endMaintenance(marker);
 const metadataReads=h.state.requests.slice(start).filter(request=>request.method==='GET');
 if(invalidate){assert.ok(metadataReads.length);assert.ok(h.state.files.has(marker.remoteId),'release cannot delete an old-folder marker after repository identity changes');}
 else{assert.equal(metadataReads.length,0,'known marker release must not rediscover its already verified folder after cancellation');assert.equal(h.state.files.has(marker.remoteId),false);}
 await h.provider.disconnect();
}

// Exercise actual response streams after headers, not only pending fetch calls.
const bodyContractCases=[];
const flushBodies=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
function bodyClock(){
 let now=0,next=0;const timers=new Map();
 return {now:()=>now,setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,at:now+Number(ms)});return id;},clearTimeout:id=>timers.delete(id),
  pending:()=>[...timers.values()].map(t=>t.at-now).sort((a,b)=>a-b),
  advance:async ms=>{now+=ms;for(;;){const due=[...timers.entries()].filter(([,t])=>t.at<=now).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;timers.delete(due[0]);due[1].fn();await flushBodies();}}
 };
}
async function settleBody(task,clock){
 let result;task.then(value=>{result={ok:true,value};},error=>{result={ok:false,error};});
 for(let i=0;i<15;i++){await flushBodies();if(result)return result;const next=clock.pending()[0];assert.ok(Number.isFinite(next)&&next<=45000,'body work must retain a bounded deadline or retry');await clock.advance(next);}
 assert.fail('body request did not settle within its bounded retry sequence');
}
async function bodyFixture(){const clock=bodyClock(),h=createHarness({clock});await h.provider.prepare();await h.provider.authorize();await h.provider.repository.list({kind:'object'});return {...h,clock};}
function repositoryBackground(h){
 for(const name of ['internal','operation-lifecycle','repository-background'])vm.runInContext(fs.readFileSync(`source/core/${name}.js`,'utf8'),h.context);
 const registry=h.context[Symbol.for('studyDirector.internalModules.v1')],lifecycle=registry.require('operation-lifecycle',1),background=registry.require('repository-background',1,Object.freeze({lifecycle}));
 return background.createCoordinator(Object.freeze({target:'google-drive',environment:Object.freeze({AbortController,now:h.clock.now,setTimeout:h.clock.setTimeout,clearTimeout:h.clock.clearTimeout})}));
}
for(const status of [200,403,503]){
 const h=await bodyFixture(),bg=repositoryBackground(h),scope=await bg.beginBackground('integrity',{budgetMs:120000});h.state.jsonFault={mode:'stall',status};
 const task=h.provider.repository.beginOperation({signal:scope.signal}).list({kind:'object'}).finally(()=>scope.release());const rejected=assert.rejects(task,{name:'AbortError'});
 await flushBodies();assert.equal(h.state.bodies?.length,1);assert.ok(h.clock.pending().includes(45000),'request deadline must remain after headers');
 const foreground=bg.beginForeground();let foregroundReady=false;const ready=foreground.settled.then(()=>{foregroundReady=true;});await flushBodies();assert.equal(foregroundReady,true,'body cancellation must release background work before the foreground deadline');await rejected;await ready;
 assert.equal(h.state.bodies[0].signal.aborted,true);assert.equal(h.state.bodies[0].aborted,true);assert.deepEqual([...bg.status().active],[]);
 assert.equal(h.state.bodyRequests,1,'cancelled success/error body must not enter transient retries');
 foreground.release();assert.equal(h.clock.pending().filter(ms=>ms<=120000).length,0);await h.provider.disconnect();assert.deepEqual(h.clock.pending(),[]);
 bodyContractCases.push('foreground cancels post-header body '+status);
}
{
 const h=await bodyFixture();h.state.jsonFault={mode:'stall'};const started=h.clock.now();
 const result=await settleBody(h.provider.repository.list({kind:'object'}),h.clock);
 assert.equal(result.ok,false);assert.match(result.error.message,/timed out/u);assert.equal(h.state.bodyRequests,3);assert.equal(h.clock.now()-started,136200,'three original deadlines and bounded retry delays must cover complete bodies');
 assert.ok(h.state.bodies.every(body=>body.aborted&&body.signal.aborted));
 h.state.jsonFault=null;assert.equal((await h.provider.repository.list({kind:'object'})).items.length,0,'a genuine successful empty inventory remains usable after recovery');
 await h.provider.disconnect();assert.deepEqual(h.clock.pending(),[]);bodyContractCases.push('post-header deadlines and subsequent recovery');
}
for(const fault of [{mode:'interrupted'},{mode:'invalid'},{mode:'shape',payload:null},{mode:'shape',payload:{files:null}},{mode:'interrupted',status:403}]){
 const h=await bodyFixture();h.state.jsonFault=fault;
 const result=await settleBody(h.provider.repository.list({kind:'object'}),h.clock);
 assert.equal(result.ok,false,'unavailable/invalid JSON must not return a successful empty inventory');
 if(fault.mode==='shape')assert.match(result.error.message,/could not confirm the backup information/u);
 await h.provider.disconnect();assert.deepEqual(h.clock.pending(),[]);bodyContractCases.push('reject '+fault.mode+' body '+(fault.status||200));
}
{
 const h=await bodyFixture();h.state.jsonFault={mode:'complete',status:403,remaining:1,payload:{error:{message:'temporarily rate limited',errors:[{reason:'rateLimitExceeded'}]}}};
 const result=await settleBody(h.provider.repository.list({kind:'object'}),h.clock);assert.equal(result.ok,true);assert.equal(result.value.items.length,0);assert.equal(h.state.bodyRequests,1);
 await h.provider.disconnect();assert.deepEqual(h.clock.pending(),[]);bodyContractCases.push('parsed error payload supports retry and error handling');
}
{
 const h=await bodyFixture();h.state.jsonFault={mode:'stall',status:401};
 await assert.rejects(h.provider.repository.list({kind:'object'}),/authorization expired/u);assert.equal(h.provider.connected(),false);assert.equal(h.state.bodies[0].cancelled,true);
 await h.provider.release();assert.deepEqual(h.clock.pending(),[]);bodyContractCases.push('401 invalidates authorization without waiting for unused body');
}

const productiveTransferCases=[];
async function settleTransfer(task,clock,state,limitMs=2000000){
 let outcome;task.then(value=>{outcome={ok:true,value};},error=>{outcome={ok:false,error};});
 const started=clock.now(),wallStarted=performance.now();
 while(!outcome&&clock.now()-started<limitMs&&performance.now()-wallStarted<10000){await new Promise(resolve=>setImmediate(resolve));if(!outcome&&!state.nativeUploadReplies)await clock.advance(1000);}
 assert.ok(outcome,'transfer must settle within its productive or stalled bound');return outcome;
}
for(const chunkDelay of [9000,35000,90000]){
 const clock=createFakeClock(),h=createHarness({clock});await h.provider.prepare();await h.provider.authorize();
 const file=await makeRepositoryFile('object','obj_'+'c'.repeat(32),'x'.repeat(1048576)),ref=await h.provider.repository.upload(file);
 h.state.rangeChunkDelayMs=chunkDelay;const read=await settleTransfer(h.provider.repository.download(ref,{offset:0,length:1048576}),clock,h.state);
 assert.equal(read.ok,true,read.error?.message);assert.equal(await digest(read.value.blob),file.digest);assert.equal(h.state.rangeTransfers[0].loaded,file.size);
 await h.provider.disconnect();assert.equal(clock.pending(),0);productiveTransferCases.push('verified range completes with '+chunkDelay+'ms between chunks');
}
for(const mode of ['no-bytes','empty-progress']){
 const clock=createFakeClock(),h=createHarness({clock});await h.provider.prepare();await h.provider.authorize();
 const ref=await h.provider.repository.upload(await makeRepositoryFile('object','obj_'+'d'.repeat(32),'x'.repeat(1048576)));
 h.state.rangeChunkDelayMs=mode==='no-bytes'?150000:30000;h.state.rangeMode=mode==='empty-progress'?mode:'valid';const started=clock.now();
 const read=await settleTransfer(h.provider.repository.download(ref,{offset:0,length:1048576}),clock,h.state);
 assert.equal(read.ok,false);assert.match(read.error.message,/timed out/u);assert.ok(clock.now()-started<=122000);assert.equal(h.state.rangeTransfers[0].loaded,0);assert.equal(h.state.rangeTransfers[0].cancelled,true);
 await h.provider.disconnect();assert.equal(clock.pending(),0);productiveTransferCases.push(mode+' does not renew the stalled download watchdog');
}
for(const size of [4096,5*1048576+1]){
 const clock=createFakeClock(),h=createHarness({clock});await h.provider.prepare();await h.provider.authorize();
 h.state.uploadProgressSteps=4;h.state.uploadProgressStepMs=90000;const file=await makeRepositoryFile('object','obj_'+size.toString(16).padStart(32,'0'),'u'.repeat(size));
 const started=clock.now(),upload=await settleTransfer(h.provider.repository.upload(file),clock,h.state);
 assert.equal(upload.ok,true,upload.error?.message);assert.equal(upload.value.serverDigest,file.digest);assert.ok(clock.now()-started>=360000);assert.ok(h.state.uploadProgressStarted>0);assert.equal(h.state.uploadAborts||0,0);
 await h.provider.disconnect();assert.equal(clock.pending(),0);productiveTransferCases.push('byte-progress watchdog permits slow '+(size>5000000?'resumable':'multipart')+' upload');
}
for(const repeated of [false,true]){
 const clock=createFakeClock(),h=createHarness({clock});await h.provider.prepare();await h.provider.authorize();
 h.state.uploadProgressSteps=10;h.state.uploadProgressStepMs=repeated?30000:150000;h.state.uploadRepeatProgress=repeated;
 const file=await makeRepositoryFile('object','obj_'+'e'.repeat(32),'x'.repeat(4096)),result=await settleTransfer(h.provider.repository.upload(file),clock,h.state);
 assert.equal(result.ok,false);assert.match(result.error.message,/timed out/u);assert.ok(h.state.uploadAborts>0);assert.equal(h.state.files.size,0,'stalled uploads cannot publish a verified immutable object');
 await h.provider.disconnect();assert.equal(clock.pending(),0);productiveTransferCases.push((repeated?'repeated':'absent')+' upload progress remains bounded');
}
for(const direction of ['upload','download']){
 const clock=createFakeClock(),h=createHarness({clock});h.clock=clock;await h.provider.prepare();await h.provider.authorize();
 const file=await makeRepositoryFile('object','obj_'+'a'.repeat(32),'x'.repeat(1048576)),ref=direction==='download'?await h.provider.repository.upload(file):null;
 const bg=repositoryBackground(h),scope=await bg.beginBackground(direction==='upload'?'convergence':'integrity');
 h.state.rangeChunkDelayMs=90000;h.state.uploadProgressSteps=4;h.state.uploadProgressStepMs=90000;
 const task=(direction==='upload'?h.provider.repository.upload(file,{signal:scope.signal}):h.provider.repository.download(ref,{offset:0,length:file.size,signal:scope.signal})).finally(()=>scope.release());
 const rejected=assert.rejects(task,{name:'AbortError'});
 await waitFor(()=>direction==='upload'?h.state.uploadProgressStarted>0:h.state.rangeTransfers?.length>0,'transfer must start before foreground preemption');
 const foreground=bg.beginForeground();await rejected;await foreground.settled;assert.equal(bg.status().active.length,0);foreground.release();
 if(direction==='upload')assert.equal(h.state.files.size,0);else assert.equal(h.state.rangeTransfers[0].cancelled,true);
 await h.provider.disconnect();assert.equal(clock.pending(),0);productiveTransferCases.push('foreground cancels a slow '+direction+' and waits for actual release');
}
{
 const h=createHarness({uploadProgressTransport:false});await h.provider.prepare();await h.provider.authorize();
 const file=await makeRepositoryFile('object','obj_'+'b'.repeat(32),'fetch-only receipt proof');const uploaded=await h.provider.repository.upload(file);
 assert.equal(uploaded.serverDigest,file.digest);await h.provider.disconnect();productiveTransferCases.push('fetch-only capability fallback retains immutable server receipt validation');
}
// Retained upload progress is a server-acknowledged prefix, never a guessed
// client byte count. Exercise the production adapter and lifecycle together.
const resumableUploadCases=[];
async function settleUpload(task,h){
 let result;task.then(value=>{result={ok:true,value};},error=>{result={ok:false,error};});
 const started=h.clock.now();
 while(!result&&h.clock.now()-started<4*3600000){await new Promise(resolve=>setImmediate(resolve));if(!result&&!h.state.nativeUploadReplies)await h.clock.advance(1000);}
 assert.ok(result,'productive upload must settle within the simulated authorization windows');return result;
}
for(const bytes of [6*1048576,18*1048576]){
 const clock=createFakeClock(),h=createHarness({clock});h.clock=clock;await h.provider.prepare();
 const bg=repositoryBackground(h),file=await makeRepositoryFile('object','obj_'+'d'.repeat(32),new Blob([new Uint8Array(bytes)]));let outcome;
 const job=bg.registerJob('convergence',{initialDelayMs:null,discover:false,isAvailable:()=>h.provider.backgroundAvailable()?true:'awaiting-connection',capture:error=>{throw error;},execute:async()=>{
  const scope=await bg.beginBackground('convergence');assert.ok(scope);try{outcome=await settleUpload(h.provider.repository.upload(file,{signal:scope.signal}),h);return {status:outcome.ok?'completed':'interrupted',pending:!outcome.ok};}finally{scope.release();}
 }});
 const unsubscribe=h.provider.subscribeConnection(()=>bg.wake('connection'));h.state.uploadProgressSteps=14;h.state.uploadProgressStepMs=90000;
 let previous=0,attempts=0;
 for(;attempts<8;){await h.provider.authorize();attempts++;const start=h.state.requests.length;await job.run('reauthorized');
  const session=[...h.state.uploads.values()][0];assert.ok(session);const acknowledged=session.received||0;assert.ok(acknowledged>previous,'every ordinary authorization window must advance a confirmed prefix');
  for(const request of h.state.requests.slice(start)){const match=request.contentRange.match(/^bytes (\d+)-/u);if(match)assert.ok(Number(match[1])>=previous,'a confirmed prefix must never be retransmitted after reconnection');}
  assert.equal(h.state.uploads.size,1,'reauthorization must retain one session for the same immutable payload');assert.equal(bg.status().active.length,0);
  previous=acknowledged;if(outcome.ok)break;assert.equal(h.provider.connected(),false);assert.equal(h.state.files.size,0,'partial progress is not a completed repository object');
 }
 assert.equal(outcome.ok,true,outcome.error?.message);assert.equal(previous,bytes);assert.equal(outcome.value.serverDigest,file.digest);assert.equal(h.state.files.size,1);assert.ok(attempts>=2);
 unsubscribe();bg.clearAllScheduled();await h.provider.disconnect();assert.equal(clock.pending(),0);resumableUploadCases.push({bytes,attempts,confirmedPrefixMonotone:true,oneSession:true});
}
for(const boundary of ['payload-change','repository-change','expired-session','regressed-offset','explicit-discard','foreground','partial-prefix','partial-regression']){
 const clock=createFakeClock(),h=createHarness({clock});h.clock=clock;await h.provider.prepare();await h.provider.authorize();
 const file=await makeRepositoryFile('object','obj_'+'e'.repeat(32),new Blob([new Uint8Array(6*1048576)])),controller=new AbortController();h.state.uploadProgressSteps=14;h.state.uploadProgressStepMs=90000;
 const first=h.provider.repository.upload(file,{signal:controller.signal});let settled;first.then(value=>{settled={value};},error=>{settled={error};});
 for(let steps=0;![...h.state.uploads.values()].some(row=>row.received===2*1048576)&&steps<1300;steps++){await new Promise(resolve=>setImmediate(resolve));if(!h.state.nativeUploadReplies)await clock.advance(1000);}
 assert.equal([...h.state.uploads.values()][0]?.received,2*1048576);controller.abort(Object.assign(new Error('foreground preemption'),{name:'AbortError',code:'REPOSITORY_BACKGROUND_PREEMPTED'}));await assert.rejects(first,{name:'AbortError'});assert.ok(settled.error);
 const before=h.state.requests.length,oldSession=[...h.state.uploads.keys()][0];h.state.uploadProgressSteps=1;h.state.uploadProgressStepMs=0;
 if(boundary==='partial-prefix'||boundary==='partial-regression'){
  const row=h.state.uploads.get(oldSession);row.parts.push(file.blob.slice(2*1048576,3*1048576));row.received=3*1048576;
  if(boundary==='partial-regression'){
   const second=new AbortController(),started=h.state.uploadProgressStarted;h.state.uploadProgressSteps=14;h.state.uploadProgressStepMs=90000;
   const resumed=h.provider.repository.upload(file,{signal:second.signal}),rejected=assert.rejects(resumed,{name:'AbortError'});await waitFor(()=>h.state.uploadProgressStarted>started&&h.state.awaitingUploadProgress>0,'resume must poll the newer partial acknowledgement before sending');second.abort(Object.assign(new Error('preemption'),{name:'AbortError',code:'REPOSITORY_BACKGROUND_PREEMPTED'}));await rejected;
   row.parts=row.parts.slice(0,1);row.received=2*1048576;await assert.rejects(()=>h.provider.repository.upload(file),/regressed upload position/u);assert.equal(h.state.files.size,0);
  }else{
   const result=await settleUpload(h.provider.repository.upload(file),h);assert.equal(result.ok,true,result.error?.message);assert.equal(result.value.serverDigest,file.digest);
   assert.ok(h.state.requests.slice(before).some(value=>value.contentRange.startsWith('bytes '+3*1048576+'-')),'resume uses an extra server-confirmed partial chunk prefix');
  }
 }else if(boundary==='payload-change'){
  const changed={...file,blob:new Blob(['different'.repeat(1048576)])};changed.digest=await digest(changed.blob);await assert.rejects(()=>h.provider.repository.upload(changed),/different content/u);
  assert.equal(h.state.requests.slice(before).some(row=>row.method==='PUT'||row.method==='POST'),false);
 }else if(boundary==='regressed-offset'){
  const row=h.state.uploads.get(oldSession);row.received=0;row.parts=[];await assert.rejects(()=>h.provider.repository.upload(file),/regressed upload position/u);assert.equal(h.state.files.size,0);
 }else{
  if(boundary==='repository-change')h.state.trashedFolders.add('folder-1');
  if(boundary==='expired-session')h.state.uploads.delete(oldSession);
  if(boundary==='explicit-discard')h.provider.repository.discardUploads();
  const result=await settleUpload(h.provider.repository.upload(file),h);assert.equal(result.ok,true,result.error?.message);assert.equal(result.value.serverDigest,file.digest);
  const resumed=h.state.requests.slice(before).filter(row=>row.method==='PUT'&&/^bytes \d+-/u.test(row.contentRange));assert.ok(resumed.length);
  assert.equal(Number(resumed[0].contentRange.match(/^bytes (\d+)-/u)[1]),boundary==='foreground'?2*1048576:0);
  if(boundary==='repository-change')assert.notEqual(result.value.verificationScope,'drive-repository:1:1:folder-1');
 }
 await h.provider.disconnect();assert.equal(clock.pending(),0);resumableUploadCases.push(boundary);
}
// A second browser page has no upload session memory. It must not create a
// duplicate logical file if the prior page's response/receipt was lost.
const restartCases=[];
{
 const first=createHarness();await first.provider.prepare();await first.provider.authorize();
 const kindIds=[['object','obj_'+'1'.repeat(32)],['checkpoint','cp_'+'2'.repeat(32)],['commit','cp_'+'3'.repeat(32)]];
 for(const [kind,id] of kindIds){
  const original=await makeRepositoryFile(kind,id,'restart-'+kind+'-stable-contents');
  const sent=await first.provider.repository.upload({...original,knownAbsent:true});
  const page2=createHarness({remoteState:first.state});await page2.provider.prepare();await page2.provider.authorize();
  const duplicate=await page2.provider.repository.upload({...original,knownAbsent:true});
  assert.equal(duplicate.remoteId,sent.remoteId,'a reload replay must reuse the exact existing '+kind+' identity');
  const matching=[...page2.state.files.values()].filter(row=>row.appProperties?.studyDirectorRepositoryKind===kind&&row.appProperties?.studyDirectorRepositoryId===id);
  assert.equal(matching.length,1,'a reload replay must not create duplicate '+kind+' identities');
  const changed=await makeRepositoryFile(kind,id,'CHANGED-'+kind+'-stable-contents');
  await assert.rejects(()=>page2.provider.repository.upload({...changed,knownAbsent:true}),/different content|identity|checksum/u,'replayed '+kind+' conflicts must preserve the original');
  assert.equal(page2.state.files.get(sent.remoteId).sha256Checksum,original.digest);
  restartCases.push('completed '+kind+' replay and collision rejected');
 }
}
{
 const clock=createFakeClock(),first=createHarness({clock});first.clock=clock;await first.provider.prepare();await first.provider.authorize();
 const file=await makeRepositoryFile('object','obj_'+'4'.repeat(32),new Blob([new Uint8Array(6*1048576)]));
 first.state.uploadProgressSteps=14;first.state.uploadProgressStepMs=90000;
 const controller=new AbortController(),upload=first.provider.repository.upload({...file,knownAbsent:true},{signal:controller.signal});
 for(let steps=0;![...first.state.uploads.values()].some(row=>row.received===2*1048576)&&steps<1300;steps++){await new Promise(resolve=>setImmediate(resolve));if(!first.state.nativeUploadReplies)await clock.advance(1000);}
 assert.equal([...first.state.uploads.values()][0]?.received,2*1048576,'first page must hold only a partially acknowledged server-side upload');
 controller.abort(Object.assign(new Error('page closed during upload'),{name:'AbortError'}));await assert.rejects(upload,{name:'AbortError'});
 assert.equal(first.state.files.size,0,'partial remote object is not committed');
 const second=createHarness({clock,remoteState:first.state});second.clock=clock;await second.provider.prepare();await second.provider.authorize();
 second.state.uploadProgressSteps=1;second.state.uploadProgressStepMs=0;
 const result=await settleUpload(second.provider.repository.upload({...file,knownAbsent:true}),second);
 assert.equal(result.ok,true,result.error?.message);assert.equal(result.value.serverDigest,file.digest);
 assert.equal(second.state.files.size,1,'restart creates one verified committed remote object');
 assert.equal(second.state.uploads.size,2,'page-local upload URL is not falsely reconstructed from the remote orphan session');
 restartCases.push('interrupted large upload restarts from canonical bytes without false receipt');
}
console.log(JSON.stringify({status:'PASS',suite:'drive-repository-security',resumableUploadCases,restartCases,productiveTransferCases,bodyContractCases,folderVerificationMeasurement,transportOnly:true,commitMarkerTransport:true,legacyWholeBlobRetired:true,driveFileScopeOnly:true,endpointConfined:true,tinyMultipartUpload:true,largeResumableUpload:true,opaqueMarkers:true,boundedStreamingDownload:true,coldFolderSingleFlight:true,coldFolderFailureRetry:true,folderAmbiguityRejected:true,policyBoundaryFailClosed:true,duplicateIdentityFailClosed:true,sourceFenceThroughUpload:true,parallelCancellationIsolated:true,parallelSourceFenceIsolated:true,parallelProtectionFenceIsolated:true,folderVerificationCoalesced:true,folderReceiptInvalidation:true,exactDeletion:true,temporaryDownloadRelease:true,publicationProtectionLifecycle:true,maintenanceProtectionLifecycle:true,externalRepositoryDeletionSelfHeals:true,trashedRepositorySelfHeals:true,boundedMaintenanceLease:true},null,2));
