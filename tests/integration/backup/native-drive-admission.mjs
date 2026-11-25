import assert from 'node:assert/strict';
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
console.log(JSON.stringify({status:'PASS',suite:'native-drive-admission',hermetic:true,noCreationOnAbsence:true,verifiedExistingBytes:true,sharedRepository:true,staleCleanupFenced:true,wrongAccountAndFolderRefused:true,refusalAndCorruptionFailClosed:true}));
