import assert from 'node:assert/strict';
import {createDriveHarness,QA_PROFILE_ID} from '../../helpers/drive-harness.mjs';

// A Drive library belongs to one profile (5.3). Once per sign-in the app is
// told the account and what the folder holds and settles it: its own folder
// continues, an unmarked one is claimed, a library from another device can be
// taken over, and anything else is refused without touching it.
const MARKER='studyDirectorProfile',OTHER='prof_ana_mvd00000_0000abcd';
const cases=[];
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
async function connected(options={}){const harness=createDriveHarness(options);await harness.provider.prepare();await harness.provider.authorize();return harness;}
const patches=state=>state.requests.filter(request=>request.method==='PATCH').length;

{
  // A new account: the folder is made already marked for this profile.
  const {state,provider}=await connected();
  await provider.repository.list({kind:'object'});
  assert.equal(state.folders.length,1);assert.equal(state.folderProperties.get(state.folders[0])[MARKER],QA_PROFILE_ID,'a new folder carries the profile id');
  assert.equal(state.binds.length,1);assert.equal(state.binds[0].mine,true);assert.equal(state.binds[0].email,'qa@example.com','the app learns the account email');assert.equal(state.binds[0].library,null,'its own folder is not read for a library');
  assert.equal(patches(state),0);
  await provider.repository.list({kind:'checkpoint'});await provider.repository.list({kind:'commit'});
  assert.equal(state.binds.length,1,'the folder is settled once per sign-in');
  cases.push('a new folder is made for the profile');
}
{
  // A folder from before profiles (no mark): claimed, with what it holds shown first.
  const harness=createDriveHarness();const {state,provider}=harness;
  state.folders.push('folder-9');state.folderProperties.set('folder-9',{});
  const stamp='2026-10-10T08:00:00.000Z';
  state.files.set('repo-c',{id:'repo-c',name:'c.sdcommit',mimeType:'application/json',parents:['folder-9'],appProperties:{studyDirectorRepository:'true',studyDirectorRepositoryKind:'commit'},content:new Blob(['{}']),ownedByMe:true,shared:false,trashed:false,canDownload:true,version:1,createdTime:stamp,modifiedTime:stamp});
  state.files.set('repo-k',{id:'repo-k',name:'k.sdcheckpoint',mimeType:'application/octet-stream',parents:['folder-9'],appProperties:{studyDirectorRepository:'true',studyDirectorRepositoryKind:'checkpoint',sdHistoryRole:'normal',sdHistoryCounts:'42,17'},content:new Blob(['x']),ownedByMe:true,shared:false,trashed:false,canDownload:true,version:2,createdTime:stamp,modifiedTime:stamp});
  await provider.prepare();await provider.authorize();await provider.repository.list({kind:'object'});
  assert.equal(state.binds.length,1);const [info]=state.binds;
  assert.equal(info.found,'');assert.equal(info.mine,false);assert.equal(info.folder,'folder-9');
  assert.deepEqual({...info.library},{savedAt:stamp,days:42,notes:17},'the app is told what the library holds');
  assert.equal(state.folderProperties.get('folder-9')[MARKER],QA_PROFILE_ID,'claiming marks the folder for this profile');assert.equal(patches(state),1);
  cases.push('an unmarked folder is claimed and shown first');
}
{
  // The same person's library from another device: this profile takes its id.
  let current=QA_PROFILE_ID;
  const harness=createDriveHarness({profileId:()=>current,bind:async info=>{if(info.found===OTHER){current=OTHER;return 'adopt';}return 'refuse';}});const {state,provider}=harness;
  state.folders.push('folder-5');state.folderProperties.set('folder-5',{[MARKER]:OTHER});
  await provider.prepare();await provider.authorize();await provider.repository.list({kind:'object'});
  assert.equal(state.binds.length,1);assert.equal(state.binds[0].found,OTHER);assert.equal(state.binds[0].mine,false);
  assert.equal(patches(state),0,'the library mark is kept as it is');
  await provider.repository.list({kind:'object'});assert.equal(state.binds.length,1,'after taking the id the folder is this profile');
  cases.push('a library from another device can be continued');
}
{
  // Another profile on this device owns the library: refused, nothing changed, and the sign-in is forgotten.
  const {state,provider}=createDriveHarness({bind:async()=>'refuse'});
  state.folders.push('folder-7');state.folderProperties.set('folder-7',{[MARKER]:OTHER});
  await provider.prepare();await provider.authorize();
  await assert.rejects(provider.repository.list({kind:'object'}),error=>error.studyDirectorProfileRefused===true&&/another profile/u.test(error.message));
  assert.equal(patches(state),0);assert.equal(state.folderProperties.get('folder-7')[MARKER],OTHER,'the other library is never touched');
  assert.equal(state.requests.filter(request=>request.method==='POST'||request.method==='DELETE').length,0,'nothing is written');
  await settle();assert.equal(provider.connected(),false,'Connect offers the choice of account again');
  cases.push('another profile library is refused untouched');
}
{
  // A decision that does not fit the folder is a refusal too.
  const {state,provider}=await connected({bind:async()=>'continue'});
  state.folders.push('folder-8');state.folderProperties.set('folder-8',{});
  await assert.rejects(provider.repository.list({kind:'object'}),/already holds a Study Director library/u);
  assert.equal(patches(state),0);
  cases.push('an unmarked folder is only claimed when the app says so');
}
{
  // A profile still starting cannot use Drive yet.
  const {state,provider}=await connected({profileId:()=>''});
  await assert.rejects(provider.repository.list({kind:'object'}),/still starting/u);
  assert.equal(state.folders.length,0,'no folder is made for it');assert.equal(state.binds.length,0);
  cases.push('a profile still starting waits');
}
{
  // Switching profile in the same page (an id taken over elsewhere) settles the folder again.
  let current=QA_PROFILE_ID;
  const {state,provider}=await connected({profileId:()=>current});
  await provider.repository.list({kind:'object'});assert.equal(state.binds.length,1);
  current='prof_qa_mve00000_abcdef02';
  await assert.rejects(provider.repository.list({kind:'object'}),/another profile/u,'a folder marked for the earlier id is not this profile');
  assert.equal(state.binds.length,2);
  cases.push('a changed profile id settles the folder again');
}
console.log(JSON.stringify({status:'PASS',suite:'drive-profile-binding',cases},null,2));
