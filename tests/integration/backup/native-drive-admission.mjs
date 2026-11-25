import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createDriveHarness,repositoryDigest,QA_PROFILE_ID} from '../../helpers/drive-harness.mjs';

const file=async(kind,id,text)=>{const blob=new Blob([text]);return Object.freeze({kind,id,blob,size:blob.size,digest:await repositoryDigest(blob)});};
const cp='cp_'+'a'.repeat(32),obj='obj_'+'b'.repeat(32);
const mutationCount=state=>state.requests.filter(row=>row.method!=='GET').length;
async function connect(h){await h.provider.prepare();await h.provider.authorize();return h;}
async function seed(){
  const web=await connect(createDriveHarness());
  await web.provider.repository.upload(await file('object',obj,'verified object'));
  await web.provider.repository.upload(await file('checkpoint',cp,'verified checkpoint'));
  await web.provider.repository.upload(await file('commit',cp,'verified commit'));
  return web;
}

// Absence under a per-file grant is not absence in Drive. Never create.
{
  const native=await connect(createDriveHarness({native:true}));
  await assert.rejects(native.provider.verifyAccount(),/existing Study Director folder/);
  await assert.rejects(native.provider.repository.beginPublication(),/existing Study Director folder/);
  assert.equal(mutationCount(native.state),0);
  assert.equal(native.state.folders.length,0);
}
// An owned folder without published bytes is not enough.
{
  const web=await connect(createDriveHarness());await web.provider.repository.list({kind:'object'});
  const native=await connect(createDriveHarness({native:true,remoteState:web.state}));
  await assert.rejects(native.provider.verifyAccount(),/existing repository inventory/);
  assert.equal(mutationCount(native.state),0);assert.equal(native.state.binds.length,0);
}
// Actual shared protocol, simulated native host. Same repository and bytes.
{
  const web=await seed(),native=await connect(createDriveHarness({native:true,remoteState:web.state}));
  const scope=await native.provider.verifyAccount();
  assert.equal(scope,web.state.folders[0]);
  assert.equal(native.state.binds.length,1);assert.equal(mutationCount(native.state),0);
  assert.equal(native.state.requests.filter(row=>row.url.includes('alt=media')).length,3);
  const nativeRef=await native.provider.repository.upload(await file('object','obj_'+'c'.repeat(32),'native object'));
  assert.equal(nativeRef.verificationScope,await web.provider.repository.scope());
  const visible=(await web.provider.repository.list({kind:'object'})).items.find(item=>item.id===nativeRef.id);
  assert.equal(visible.digest,nativeRef.digest);assert.equal(web.state.folders.length,1);
  assert.ok(native.state.nativeHeaders.every(headers=>headers.every(([name])=>name!=='authorization')));
  const marker=await native.provider.repository.beginPublication();
  const old=native.provider.repository.beginOperation();
  native.state.replaceNativeConnection();
  const before=mutationCount(native.state);
  await assert.rejects(old.endPublication(marker),/authorization changed/);
  assert.equal(mutationCount(native.state),before,'stale cleanup may not use a successor authorization');
  await native.provider.verifyAccount();
  await native.provider.repository.endPublication(marker);
}
{
  const web=await seed(),native=await connect(createDriveHarness({native:true,remoteState:web.state,profileFolder:()=> 'other-folder'}));
  await assert.rejects(native.provider.verifyAccount(),/existing Study Director folder/);assert.equal(mutationCount(native.state),0);
}
{
  const web=await seed(),native=await connect(createDriveHarness({native:true,remoteState:web.state,bind:async()=> 'refuse'}));
  await assert.rejects(native.provider.verifyAccount(),/another profile/);assert.equal(mutationCount(native.state),0);
}
{
  const web=await seed(),native=await connect(createDriveHarness({native:true,remoteState:web.state}));
  const target=[...native.state.files.values()].find(row=>row.appProperties.studyDirectorRepositoryKind==='commit');
  // Keep length equal to isolate the digest failure from size validation.
  target.content=new Blob(['modified commit']);
  await assert.rejects(native.provider.verifyAccount(),/bytes failed verification/);
  assert.equal(mutationCount(native.state),0);assert.equal(native.state.binds.length,0);
}
{
  const web=await seed(),native=await connect(createDriveHarness({native:true,remoteState:web.state}));
  native.state.email='wrong@example.com';
  await assert.rejects(native.provider.verifyAccount(),/This profile syncs with/);assert.equal(mutationCount(native.state),0);
}
// A successful HTTP response without the requested inventory is not evidence.
{
  const web=await seed(),native=await connect(createDriveHarness({native:true,remoteState:web.state}));
  native.state.jsonFault={mode:'complete',payload:{},remaining:1};
  await assert.rejects(native.provider.verifyAccount(),/complete repository listing/);
  assert.equal(mutationCount(native.state),0);assert.equal(native.state.binds.length,0);
}
// Authorization replacement while awaiting a local profile decision.
{
  const web=await seed();let native;
  native=await connect(createDriveHarness({native:true,remoteState:web.state,bind:async()=>{native.state.replaceNativeConnection();return 'continue';}}));
  await assert.rejects(native.provider.verifyAccount(),/authorization changed|abort|cancel/i);
  assert.equal(mutationCount(native.state),0);
}
// A still-visible folder for a remotely deleted portable profile must not be adopted.
{
  const web=await seed(),other='prof_ana_mvd00000_0000abcd';
  web.state.folderProperties.set(web.state.folders[0],{studyDirectorProfile:other});
  web.state.deletionMarkers.push({id:'marker-remote',profile:other});
  let current=QA_PROFILE_ID;
  const native=await connect(createDriveHarness({native:true,remoteState:web.state,profileId:()=>current,bind:async info=>{current=info.found;return 'adopt';}}));
  await assert.rejects(native.provider.verifyAccount(),/library was deleted/);
  assert.equal(current,QA_PROFILE_ID);assert.equal(native.state.binds.length,0);
  assert.equal(mutationCount(native.state),0);assert.equal(native.state.deletedSignals.length,0);
}
// Deletion arriving during a binding decision must block publication after adoption.
{
  const web=await seed(),other='prof_ana_mvd00000_0000abcd';
  web.state.folderProperties.set(web.state.folders[0],{studyDirectorProfile:other});
  let current=QA_PROFILE_ID;
  const native=await connect(createDriveHarness({native:true,remoteState:web.state,profileId:()=>current,bind:async info=>{
    current=info.found;web.state.deletionMarkers.push({id:'marker-late',profile:other});return 'adopt';
  }}));
  await assert.rejects(native.provider.verifyAccount(),/library was deleted/);
  assert.equal(native.state.binds.length,1);assert.equal(mutationCount(native.state),0);
  assert.equal(native.state.deletedSignals.length,0);
}
// Unknown remote deletion status is not a proof of absence.
for(const payload of [{files:[],incompleteSearch:null},{files:[],nextPageToken:'next'},{files:[],nextPageToken:0}]){
  const web=await seed(),other='prof_ana_mvd00000_0000abcd';
  web.state.folderProperties.set(web.state.folders[0],{studyDirectorProfile:other});
  const native=await connect(createDriveHarness({native:true,remoteState:web.state,bind:async()=>{throw new Error('must not bind');}}));
  native.state.deletionListFault={profile:other,payload};
  await assert.rejects(native.provider.verifyAccount(),/verify profile deletion status/);
  assert.equal(native.state.binds.length,0);assert.equal(mutationCount(native.state),0);
}
// Adoption of a live remote ID still succeeds and preserves the single folder.
{
  const web=await seed(),other='prof_ana_mvd00000_0000abcd';
  web.state.folderProperties.set(web.state.folders[0],{studyDirectorProfile:other});
  let current=QA_PROFILE_ID;
  const native=await connect(createDriveHarness({native:true,remoteState:web.state,profileId:()=>current,bind:async info=>{current=info.found;return 'adopt';}}));
  assert.equal(await native.provider.verifyAccount(),web.state.folders[0]);
  assert.equal(current,other);assert.equal(mutationCount(native.state),0);
  await native.provider.repository.beginPublication();
  assert.equal(web.state.folders.length,1);
}

// Exercise the real native JavaScript connection owner through a disposable
// typed IPC fixture, not the shared provider's token-bearing mock transport.
{
  const source=fs.readFileSync(new URL('../../../source/external/drive-native-connection.js',import.meta.url),'utf8');
  const calls=[],handles=new Set(),cancelled=[];
  let generation=1,configured=true,delayRequest=null,readCount=0;
  const session='s'.repeat(43);
  let next=0;
  const invoke=async(name,{command})=>{
    assert.equal(name,'native_drive');calls.push(command);
    const {op,id}=command;
    if(op==='open'){assert.equal(command.scope,'');assert.equal(command.email,'qa@example.com');return {session,generation};}
    assert.equal(command.session,session);
    if(op==='generation')return generation;
    if(op==='allocate'){assert.equal(command.generation,generation);const id=String(++next).padStart(43,'0');handles.add(id);return id;}
    if(op==='cancel'){handles.delete(id);cancelled.push(id);return null;}
    if(op==='authorize'){assert.ok(handles.has(id));assert.equal(command.interactive,true);generation++;return {generation,remaining_seconds:3000,email:'qa@example.com'};}
    if(op==='admit'){assert.equal(command.generation,generation);assert.equal(command.folder,'folder');return null;}
    if(op==='request'){
      assert.ok(handles.has(id));assert.equal(command.generation,generation);assert.equal(Object.hasOwn(command.request.headers,'authorization'),false);
      if(delayRequest)await delayRequest;
      return command.request.url.endsWith('alt=media')?{status:200,headers:{'content-length':'3'},body:'',stream:true}:{status:308,headers:{range:'bytes=0-1'},body:'',stream:false};
    }
    if(op==='read'){assert.ok(handles.has(id));return ++readCount===1?{done:false,body:'YWJj'}:{done:true,body:''};}
    if(op==='invalidate'){assert.equal(command.generation,generation);return ++generation;}
    if(op==='disconnect'){assert.equal(command.generation,generation);generation++;return null;}
    throw Error('Unexpected IPC command: '+op);
  };
  const context=vm.createContext({window:{get __SD_NATIVE_DRIVE_AVAILABLE__(){return configured;},__TAURI_INTERNALS__:{invoke}},Headers,Response,Blob,ReadableStream,Uint8Array,TextEncoder,Date,Error,Object,Number,Symbol,AbortController,atob,btoa});
  context.window[Symbol.for('studyDirector.profileScope.v1')]={scope:''};
  const create=vm.runInContext(source+'\ncreateStudyDirectorDriveConnection;',context);
  const ports={Platform:{Headers,Response,Blob},requirePlatform(){},profileEmail:()=> 'qa@example.com',profileFolder:()=>'',onInvalidated(){}};
  configured=false;assert.equal(create(ports).available,false);configured=true;
  const bridge=create(ports);assert.equal(bridge.connected(),false);
  await bridge.prepare();const auth=await bridge.authorize();
  assert.equal(bridge.connected(),false,'account authorization is not library admission');
  await bridge.admit(auth,'folder','prof_qa_fixture_12345678');
  assert.equal(bridge.connected(),false);bridge.confirmAdmission(auth);assert.equal(bridge.connected(),true);
  const response=await bridge.prepareRequest('https://www.googleapis.com/drive/v3/files/item?alt=media',{method:'GET'},auth)(new AbortController().signal,()=>{});
  assert.equal(await response.text(),'abc');assert.equal(handles.size,0);
  const upload=await bridge.prepareRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=opaque',{method:'PUT',headers:{'Content-Range':'bytes 0-1/3'},body:new Blob(['ab'])},auth)(new AbortController().signal,()=>{});
  assert.equal(upload.status,308);assert.equal(upload.headers.get('range'),'bytes=0-1');
  assert.equal(calls.findLast(c=>c.op==='request').request.body,'YWI=');
  assert.throws(()=>bridge.prepareRequest('https://www.googleapis.com/drive/v3/about',{headers:{Authorization:'forbidden'}},auth),/browser credentials/);
  let release;delayRequest=new Promise(resolve=>{release=resolve;});
  const abort=new AbortController();
  const pending=bridge.prepareRequest('https://www.googleapis.com/drive/v3/files/item?alt=media',{},auth)(abort.signal,()=>{});
  await new Promise(resolve=>setTimeout(resolve,0));abort.abort();
  await assert.rejects(pending,/abort|cancel/i);release();delayRequest=null;
  assert.ok(cancelled.length>=3);assert.equal(handles.size,0);
  await bridge.invalidate(auth);assert.equal(bridge.connected(),false);
  assert.throws(()=>bridge.prepareRequest('https://www.googleapis.com/drive/v3/about',{},auth),/authorization changed/);
  await bridge.disconnect(null);
}

console.log(JSON.stringify({status:'PASS',suite:'native-drive-admission',hermetic:true,noCreationOnAbsence:true,verifiedExistingBytes:true,sharedRepository:true,staleCleanupFenced:true,wrongAccountAndFolderRefused:true,refusalAndCorruptionFailClosed:true}));
